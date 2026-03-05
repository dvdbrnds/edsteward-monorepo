#!/usr/bin/env node

/**
 * MCP Protocol Test
 * 
 * This file tests the MCP Validation Protocol implementation.
 */

import { 
  ValidationServer, 
  ValidationClient, 
  ValidationErrorCode,
  createValidationResult,
  createEvidence,
  CERTAINTY_LEVELS,
  EVIDENCE_TYPES 
} from './mcp-validation-protocol.js';

import { 
  ValidationSessionManager,
  ValidatorRegistry,
  ValidationOrchestrator 
} from './component-interaction-model.js';

// Simple test framework
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log("Running MCP Protocol Tests\n============================\n");
  
  for (const t of tests) {
    try {
      console.log(`Running test: ${t.name}`);
      await t.fn();
      console.log(`✅ PASSED: ${t.name}\n`);
      passed++;
    } catch (error) {
      console.error(`❌ FAILED: ${t.name}`);
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n')[1]}`);
      }
      console.error('');
      failed++;
    }
  }
  
  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Test creating a ValidationServer
test('Create ValidationServer', async () => {
  const server = new ValidationServer({
    name: 'Test Server',
    version: '1.0.0',
    supportedRegulations: ['GDPR', 'HIPAA']
  });
  
  if (!server) {
    throw new Error('Failed to create ValidationServer');
  }
  
  console.log('Server created successfully', server);
});

// Test creating a ValidationClient
test('Create ValidationClient', async () => {
  const client = new ValidationClient({
    name: 'Test Client',
    version: '1.0.0'
  });
  
  if (!client) {
    throw new Error('Failed to create ValidationClient');
  }
  
  console.log('Client created successfully', client);
});

// Test session manager
test('ValidationSessionManager basic operations', async () => {
  const sessionManager = new ValidationSessionManager();
  
  // Create a test client
  const client = new ValidationClient({
    name: 'Test Client',
    version: '1.0.0'
  });
  
  // Register client
  sessionManager.registerClient('client1', client);
  
  // Connect client
  await sessionManager.connectClient('client1');
  
  // Create session
  const session = sessionManager.createSession('client1', 'GDPR', {
    validationType: 'standard'
  });
  
  if (!session || !session.id) {
    throw new Error('Failed to create session');
  }
  
  console.log('Session created:', session);
});

// Test validator registry
test('ValidatorRegistry operations', () => {
  const registry = new ValidatorRegistry();
  
  // Register validator
  registry.registerValidator('validator1', {
    name: 'GDPR Validator',
    version: '1.0.0',
    description: 'Validates content against GDPR rules',
    supportedRegulations: ['GDPR'],
    endpointType: 'http',
    endpoint: 'http://localhost:3000/validate'
  });
  
  // Find validators for regulation
  const validators = registry.findValidatorsForRegulation('GDPR');
  
  if (validators.length !== 1) {
    throw new Error(`Expected 1 validator, found ${validators.length}`);
  }
  
  console.log('Found validator:', validators[0]);
});

// Test evidence and validation result creation
test('Evidence and ValidationResult creation', () => {
  // Create evidence
  const evidence = createEvidence({
    type: EVIDENCE_TYPES.TEXT_MATCH,
    content: 'Personal data was found',
    details: {
      pattern: 'email',
      matches: ['john@example.com']
    },
    certainty: CERTAINTY_LEVELS.HIGH
  });
  
  if (!evidence || evidence.type !== EVIDENCE_TYPES.TEXT_MATCH) {
    throw new Error('Failed to create evidence correctly');
  }
  
  // Create validation result
  const validationResult = createValidationResult({
    regulationId: 'GDPR',
    compliant: false,
    certainty: CERTAINTY_LEVELS.HIGH,
    evidence: [evidence],
    details: {
      rule: 'PII-001',
      description: 'Contains personal identifiable information'
    }
  });
  
  if (!validationResult || validationResult.regulationId !== 'GDPR') {
    throw new Error('Failed to create validation result correctly');
  }
  
  console.log('Evidence created:', evidence);
  console.log('Validation result created:', validationResult);
});

// Real TEACH Act validation test
test('Real TEACH Act Validation - Standard', async () => {
  const client = new ValidationClient({ 
    name: 'test-client',
    transport: 'mock'
  });
  
  await client.connect();
  
  const testContent = {
    institutional_type: 'accredited_nonprofit_educational_institution',
    instructor_supervision: true,
    copyright_policy: 'comprehensive',
    technological_measures: 'implemented',
    content_type: 'portion_of_work',
    transmission_method: 'digital_classroom'
  };
  
  const result = await client.validate('REG-66', testContent, 'standard');
  
  console.log('📋 TEACH Act validation result:', JSON.stringify(result.result, null, 2));
  
  // Validate result structure
  if (!result.validation_id) throw new Error('Should have validation ID');
  if (result.result.regulationId !== 'REG-66') throw new Error('Should validate REG-66');
  if (typeof result.result.compliant !== 'boolean') throw new Error('Should have compliance status');
  if (result.result.evidence.length === 0) throw new Error('Should have evidence');
  if (result.result.details.confidence_score === undefined) throw new Error('Should have confidence score');
  
  await client.disconnect();
});

test('Real TEACH Act Validation - Comprehensive', async () => {
  const client = new ValidationClient({ 
    name: 'comprehensive-test-client',
    transport: 'mock'
  });
  
  await client.connect();
  
  const testContent = {
    institutional_type: 'accredited_nonprofit_educational_institution',
    instructor_supervision: true,
    copyright_policy: 'comprehensive',
    technological_measures: 'implemented',
    content_type: 'portion_of_work',
    transmission_method: 'digital_classroom'
  };
  
  console.log('🔬 Running comprehensive TEACH Act validation...');
  const result = await client.validate('REG-66', testContent, 'comprehensive');
  
  console.log('📊 Comprehensive validation result:', JSON.stringify(result.result, null, 2));
  
  // Validate comprehensive result
  if (!result.validation_id) throw new Error('Should have validation ID');
  if (result.result.regulationId !== 'REG-66') throw new Error('Should validate REG-66');
  if (result.result.evidence.length < 3) throw new Error('Should have evidence from multiple sources');
  if (!result.result.details.sources_consulted.includes('Copyright Office')) throw new Error('Should consult Copyright Office');
  if (!result.result.details.sources_consulted.includes('Harvard Law Library')) throw new Error('Should consult Harvard Law Library');
  
  await client.disconnect();
});

test('Server Capabilities - Real Features', async () => {
  const client = new ValidationClient({ 
    name: 'capabilities-test-client',
    transport: 'mock'
  });
  
  await client.connect();
  
  const capabilities = await client.queryCapabilities();
  
  console.log('🛠️  Server capabilities:', JSON.stringify(capabilities, null, 2));
  
  // Validate capabilities
  if (!capabilities.supported_regulations.includes('REG-66')) throw new Error('Should support REG-66');
  if (!capabilities.validation_types.includes('comprehensive')) throw new Error('Should support comprehensive validation');
  if (capabilities.teach_act_features.real_web_scraping !== true) throw new Error('Should have real web scraping');
  if (capabilities.teach_act_features.university_libraries.length < 4) throw new Error('Should have university libraries');
  
  await client.disconnect();
});

// Run all tests
console.log('🧪 Starting Real MCP Protocol Tests...');
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 