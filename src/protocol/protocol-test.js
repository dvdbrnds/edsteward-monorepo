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

// Run all tests
console.log('Starting MCP Protocol Tests...');
runTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 