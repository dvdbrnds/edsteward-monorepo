#!/usr/bin/env node

/**
 * FRIDAY BETA - EDSTEWARD INTEGRATION TEST
 * Tests MCP Engine APIs provide correct data format for EdSteward integration
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const LLM_GATEWAY = 'http://localhost:3002';

async function testEdStewardIntegration() {
  console.log('🔗 FRIDAY BETA - EDSTEWARD INTEGRATION TEST');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Regulation Metadata Format
    console.log('📊 Test 1: Regulation Metadata Format...');
    const response = await fetch(`${REGISTRY_API}/api/regulations`, { timeout: 5000 });
    const regulations = await response.json();
    
    // Validate regulation metadata structure for EdSteward
    const sampleRegulation = regulations[0];
    const requiredFields = ['regulationId', 'name', 'description', 'version', 'enactedDate'];
    const missingFields = requiredFields.filter(field => !sampleRegulation[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ Regulation metadata format compatible with EdSteward');
      console.log(`  Sample: ${sampleRegulation.name} (ID: ${sampleRegulation.regulationId})`);
    } else {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Test 2: Compliance Data Format
    console.log('\n🔬 Test 2: Compliance Data Format...');
    const testRegulations = [
      'jeanne-clery-disclosure-of-campus-security-policy-',
      'title-ix-of-the-education-amendment-of-1972',
      'americans-with-disabilities-act-of-1990'
    ];
    
    let complianceFormatResults = [];
    
    for (const slug of testRegulations) {
      try {
        const complianceResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${slug}`, { timeout: 5000 });
        const complianceData = await complianceResponse.json();
        
        // Validate EdSteward-expected compliance format
        const requiredComplianceFields = [
          'data.regulation',
          'data.title', 
          'data.overallCompliance',
          'data.institutionalRequirements',
          'data.riskAssessment',
          'data.enforcementStatistics',
          'data.metadata.category'
        ];
        
        const hasAllFields = requiredComplianceFields.every(field => {
          const fieldPath = field.split('.');
          let obj = complianceData;
          for (const key of fieldPath) {
            if (!obj || !obj[key]) return false;
            obj = obj[key];
          }
          return true;
        });
        
        complianceFormatResults.push({
          regulation: slug,
          formatValid: hasAllFields,
          overallCompliance: complianceData.data?.overallCompliance,
          category: complianceData.data?.metadata?.category,
          requirementsCount: complianceData.data?.institutionalRequirements?.length || 0
        });
        
      } catch (error) {
        complianceFormatResults.push({
          regulation: slug,
          formatValid: false,
          error: error.message
        });
      }
    }
    
    const validFormats = complianceFormatResults.filter(r => r.formatValid).length;
    console.log(`✅ Compliance format validation: ${validFormats}/${testRegulations.length} regulations`);
    
    complianceFormatResults.forEach(result => {
      if (result.formatValid) {
        console.log(`  ✅ ${result.regulation}: ${result.overallCompliance}% compliance, ${result.requirementsCount} requirements`);
      } else {
        console.log(`  ❌ ${result.regulation}: Format validation failed`);
      }
    });
    
    // Test 3: Error Handling Format
    console.log('\n⚠️  Test 3: Error Handling Format...');
    try {
      const errorResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/nonexistent-regulation`, { timeout: 5000 });
      const errorData = await errorResponse.json();
      
      const hasErrorFormat = errorData.success === false && errorData.error;
      console.log(`${hasErrorFormat ? '✅' : '❌'} Error response format: ${hasErrorFormat ? 'EdSteward compatible' : 'Needs standardization'}`);
      
    } catch (error) {
      console.log('⚠️  Error handling test failed - network issue');
    }
    
    // Test 4: Validation Levels (A, B, C, D)
    console.log('\n🎯 Test 4: Validation Levels Support...');
    
    // Simulate validation level requests (EdSteward would send these)
    const validationLevels = ['A', 'B', 'C', 'D'];
    const testRegulation = 'jeanne-clery-disclosure-of-campus-security-policy-';
    
    let validationResults = [];
    
    for (const level of validationLevels) {
      try {
        // Test if compliance endpoint can handle level parameter
        const levelResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${testRegulation}?level=${level}`, { timeout: 5000 });
        const levelData = await levelResponse.json();
        
        validationResults.push({
          level: level,
          supported: levelResponse.ok && levelData.success,
          confidence: levelData.data?.metadata?.confidence || 0
        });
        
      } catch (error) {
        validationResults.push({
          level: level,
          supported: false,
          error: error.message
        });
      }
    }
    
    const supportedLevels = validationResults.filter(r => r.supported).length;
    console.log(`✅ Validation levels supported: ${supportedLevels}/${validationLevels.length}`);
    
    // Test 5: Batch Request Handling
    console.log('\n📦 Test 5: Batch Request Handling...');
    
    const batchRegulations = regulations.slice(0, 5);
    const batchPromises = batchRegulations.map(async (reg) => {
      const slug = reg.name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      try {
        const start = Date.now();
        const response = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${slug}`, { timeout: 8000 });
        const responseTime = Date.now() - start;
        
        return {
          regulation: reg.name,
          success: response.ok,
          responseTime: responseTime
        };
      } catch (error) {
        return {
          regulation: reg.name,
          success: false,
          error: error.message
        };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    const successfulBatch = batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const avgBatchTime = batchResults
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .reduce((sum, r) => sum + r.value.responseTime, 0) / successfulBatch;
    
    console.log(`✅ Batch processing: ${successfulBatch}/${batchRegulations.length} successful`);
    console.log(`⏱️  Average batch response time: ${Math.round(avgBatchTime)}ms`);
    
    // Test 6: WebSocket Communication (if available)
    console.log('\n🔌 Test 6: WebSocket Communication...');
    try {
      // Test if WebSocket service is available for real-time updates
      const wsHealthResponse = await fetch('http://localhost:3003/health', { timeout: 3000 });
      if (wsHealthResponse.ok) {
        console.log('✅ WebSocket service available for real-time EdSteward updates');
      } else {
        console.log('⚠️  WebSocket service not responding (may not be critical for Friday beta)');
      }
    } catch (error) {
      console.log('⚠️  WebSocket service not available (may not be critical for Friday beta)');
    }
    
    // EdSteward Integration Assessment
    console.log('\n🔗 EDSTEWARD INTEGRATION ASSESSMENT');
    console.log('=' .repeat(50));
    
    const metadataValid = missingFields.length === 0;
    const complianceFormatValid = validFormats >= testRegulations.length * 0.9; // 90% threshold
    const batchProcessingValid = successfulBatch >= batchRegulations.length * 0.8; // 80% threshold
    const responseTimeValid = avgBatchTime < 3000; // 3 second threshold for batch
    
    console.log(`📊 Regulation Metadata: ${metadataValid ? '✅ Compatible' : '❌ Needs fixes'}`);
    console.log(`🔬 Compliance Format: ${complianceFormatValid ? '✅ Compatible' : '❌ Needs fixes'} (${validFormats}/${testRegulations.length})`);
    console.log(`📦 Batch Processing: ${batchProcessingValid ? '✅ Compatible' : '❌ Needs fixes'} (${successfulBatch}/${batchRegulations.length})`);
    console.log(`⏱️  Response Performance: ${responseTimeValid ? '✅ Good' : '❌ Slow'} (${Math.round(avgBatchTime)}ms avg)`);
    console.log(`🎯 Validation Levels: ${supportedLevels}/4 levels supported`);
    console.log(`📈 Total Regulations: ${regulations.length}/295 available`);
    
    const isEdStewardReady = metadataValid && complianceFormatValid && batchProcessingValid && responseTimeValid;
    
    if (isEdStewardReady) {
      console.log('\n🟢 MCP ENGINE READY FOR EDSTEWARD INTEGRATION');
      console.log('✅ All API formats and performance requirements met');
      console.log('✅ EdSteward can successfully integrate with MCP Engine for Friday beta');
    } else {
      console.log('\n🟡 MCP ENGINE NEEDS EDSTEWARD INTEGRATION FIXES');
      if (!metadataValid) console.log('❌ Fix regulation metadata format');
      if (!complianceFormatValid) console.log('❌ Fix compliance data format');
      if (!batchProcessingValid) console.log('❌ Improve batch processing reliability');
      if (!responseTimeValid) console.log('❌ Optimize response performance');
    }
    
    console.log('\n📋 EDSTEWARD INTEGRATION RECOMMENDATIONS:');
    console.log('  1. Verify EdSteward can parse regulation metadata correctly');
    console.log('  2. Test compliance scoring integration with EdSteward frontend');
    console.log('  3. Validate error handling between MCP Engine and EdSteward');
    console.log('  4. Set up monitoring for MCP Engine → EdSteward data flow');
    console.log('  5. Test real-time updates if WebSocket integration is needed');
    
    console.log('\n🏁 EDSTEWARD INTEGRATION TEST COMPLETE');
    
    return {
      metadataValid,
      complianceFormatValid,
      batchProcessingValid,
      responseTimeValid,
      totalRegulations: regulations.length,
      isReady: isEdStewardReady
    };
    
  } catch (error) {
    console.error('❌ EDSTEWARD INTEGRATION TEST FAILED:', error.message);
    throw error;
  }
}

// Run the test
testEdStewardIntegration()
  .then(results => {
    console.log('\n✅ EdSteward integration test completed');
    process.exit(results.isReady ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ EdSteward integration test failed:', error.message);
    process.exit(1);
  });


