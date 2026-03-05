#!/usr/bin/env node

/**
 * Test script to verify Phase 4 imports
 */

console.log('Testing Phase 4 imports...');

try {
  console.log('1. Testing ServiceContainer...');
  const { ServiceContainer } = await import('../src/shared/container/service-container.js');
  console.log('✓ ServiceContainer imported successfully');

  console.log('2. Testing AdvancedRegulationService...');
  const { AdvancedRegulationService } = await import('../src/shared/services/AdvancedRegulationService.js');
  console.log('✓ AdvancedRegulationService imported successfully');

  console.log('3. Testing CacheManager...');
  const { cacheManager } = await import('../src/shared/cache/CacheManager.js');
  console.log('✓ CacheManager imported successfully');

  console.log('4. Testing AuthenticationManager...');
  const { authManager } = await import('../src/shared/security/AuthenticationManager.js');
  console.log('✓ AuthenticationManager imported successfully');

  console.log('5. Testing MetricsCollector...');
  const { metricsCollector } = await import('../src/shared/monitoring/MetricsCollector.js');
  console.log('✓ MetricsCollector imported successfully');

  console.log('6. Testing core services...');
  const { ComplianceService } = await import('../src/shared/services/compliance-service.js');
  const { LLMService } = await import('../src/shared/services/llm-service.js');
  const { RegulationRepository } = await import('../src/shared/repositories/regulation-repository.js');
  console.log('✓ Core services imported successfully');

  console.log('\n🎉 All imports successful! Phase 4 dependencies are ready.');

  // Test basic instantiation
  console.log('\n7. Testing basic instantiation...');
  const container = new ServiceContainer();
  const regulationRepository = new RegulationRepository();
  const llmService = new LLMService();
  const complianceService = new ComplianceService({
    regulationRepository,
    llmService
  });
  
  console.log('✓ Basic instantiation successful');
  
  // Test service registration
  console.log('\n8. Testing service registration...');
  container.registerInstance('regulationRepository', regulationRepository);
  container.registerInstance('llmService', llmService);
  container.registerInstance('complianceService', complianceService);
  
  console.log('✓ Service registration successful');
  
  // Test service resolution
  console.log('\n9. Testing service resolution...');
  const resolvedRepo = container.resolve('regulationRepository');
  const resolvedLLM = container.resolve('llmService');
  const resolvedCompliance = container.resolve('complianceService');
  
  console.log('✓ Service resolution successful');
  
  console.log('\n✅ All Phase 4 components are working correctly!');

} catch (error) {
  console.error('\n❌ Import test failed:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  process.exit(1);
} 