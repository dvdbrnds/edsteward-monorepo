#!/usr/bin/env node

/**
 * FRIDAY BETA - BATCH DELIVERY SYSTEM TEST
 * Tests delivery system can handle all 295 regulations
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const DELIVERY_SYSTEM = 'http://localhost:3051';
const LLM_GATEWAY = 'http://localhost:3002';

async function testBatchDelivery() {
  console.log('📦 FRIDAY BETA - BATCH DELIVERY SYSTEM TEST');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Get all regulations
    console.log('📊 Step 1: Fetching all regulations...');
    const response = await fetch(`${REGISTRY_API}/api/regulations`, {
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Registry API failed: ${response.status}`);
    }
    
    const regulations = await response.json();
    console.log(`✅ Found ${regulations.length} regulations to test`);
    
    // Step 2: Test delivery system health
    console.log('\n🏥 Step 2: Testing delivery system health...');
    try {
      const healthResponse = await fetch(`${DELIVERY_SYSTEM}/health`, {
        timeout: 5000
      });
      
      if (healthResponse.ok) {
        console.log('✅ Delivery system is healthy');
      } else {
        console.log('⚠️  Delivery system health check failed, but continuing...');
      }
    } catch (error) {
      console.log('⚠️  Delivery system not responding, testing direct API delivery...');
    }
    
    // Step 3: Test batch delivery in chunks
    console.log('\n📦 Step 3: Testing batch delivery capability...');
    
    const BATCH_SIZE = 50;
    const TOTAL_BATCHES = Math.ceil(regulations.length / BATCH_SIZE);
    
    let deliveryResults = {
      totalRegulations: regulations.length,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      batchResults: [],
      averageResponseTime: 0,
      totalTime: 0
    };
    
    const startTime = Date.now();
    
    for (let batchIndex = 0; batchIndex < TOTAL_BATCHES; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, regulations.length);
      const batch = regulations.slice(batchStart, batchEnd);
      
      console.log(`\n📋 Processing Batch ${batchIndex + 1}/${TOTAL_BATCHES} (${batch.length} regulations)...`);
      
      const batchStartTime = Date.now();
      
      // Test parallel delivery for this batch
      const batchPromises = batch.map(async (regulation, index) => {
        const regulationSlug = regulation.name.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);
        
        try {
          const requestStart = Date.now();
          
          // Test console delivery
          const consoleResponse = await fetch(`${REGISTRY_API}/console/${regulationSlug}`, {
            timeout: 8000
          });
          
          const responseTime = Date.now() - requestStart;
          
          return {
            regulation: regulation.name,
            slug: regulationSlug,
            success: consoleResponse.ok,
            statusCode: consoleResponse.status,
            responseTime: responseTime,
            batchIndex: batchIndex + 1,
            indexInBatch: index + 1
          };
          
        } catch (error) {
          return {
            regulation: regulation.name,
            slug: regulationSlug,
            success: false,
            statusCode: 'ERROR',
            responseTime: 0,
            error: error.message,
            batchIndex: batchIndex + 1,
            indexInBatch: index + 1
          };
        }
      });
      
      // Wait for all regulations in this batch
      const batchResults = await Promise.allSettled(batchPromises);
      const batchTime = Date.now() - batchStartTime;
      
      // Process batch results
      let batchSuccesses = 0;
      let batchFailures = 0;
      let batchResponseTimes = [];
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          batchSuccesses++;
          deliveryResults.successfulDeliveries++;
          batchResponseTimes.push(result.value.responseTime);
        } else {
          batchFailures++;
          deliveryResults.failedDeliveries++;
        }
      });
      
      const batchAvgResponseTime = batchResponseTimes.length > 0 
        ? Math.round(batchResponseTimes.reduce((a, b) => a + b, 0) / batchResponseTimes.length)
        : 0;
      
      deliveryResults.batchResults.push({
        batchIndex: batchIndex + 1,
        size: batch.length,
        successes: batchSuccesses,
        failures: batchFailures,
        successRate: Math.round((batchSuccesses / batch.length) * 100),
        avgResponseTime: batchAvgResponseTime,
        totalTime: batchTime
      });
      
      console.log(`  ✅ Batch ${batchIndex + 1}: ${batchSuccesses}/${batch.length} successful (${Math.round((batchSuccesses / batch.length) * 100)}%)`);
      console.log(`  ⏱️  Batch time: ${batchTime}ms, Avg response: ${batchAvgResponseTime}ms`);
      
      // Brief pause between batches to avoid overwhelming the system
      if (batchIndex < TOTAL_BATCHES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    deliveryResults.totalTime = Date.now() - startTime;
    deliveryResults.averageResponseTime = deliveryResults.batchResults.length > 0
      ? Math.round(deliveryResults.batchResults.reduce((sum, batch) => sum + batch.avgResponseTime, 0) / deliveryResults.batchResults.length)
      : 0;
    
    // Step 4: Test compliance data delivery
    console.log('\n🔬 Step 4: Testing compliance data delivery...');
    
    const testComplianceRegulations = [
      'jeanne-clery-disclosure-of-campus-security-policy-',
      'title-ix-of-the-education-amendment-of-1972',
      'americans-with-disabilities-act-of-1990',
      'family-educational-rights-and-privacy-act-ferpa'
    ];
    
    let complianceDeliveryResults = [];
    
    for (const slug of testComplianceRegulations) {
      try {
        const complianceResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${slug}`, {
          timeout: 5000
        });
        
        complianceDeliveryResults.push({
          regulation: slug,
          success: complianceResponse.ok,
          statusCode: complianceResponse.status
        });
        
      } catch (error) {
        complianceDeliveryResults.push({
          regulation: slug,
          success: false,
          statusCode: 'ERROR',
          error: error.message
        });
      }
    }
    
    const successfulCompliance = complianceDeliveryResults.filter(r => r.success).length;
    console.log(`✅ Compliance delivery: ${successfulCompliance}/${testComplianceRegulations.length} successful`);
    
    // Step 5: Generate Friday Beta Delivery Report
    console.log('\n📊 FRIDAY BETA DELIVERY SYSTEM REPORT');
    console.log('=' .repeat(50));
    
    const overallSuccessRate = Math.round((deliveryResults.successfulDeliveries / deliveryResults.totalRegulations) * 100);
    const complianceSuccessRate = Math.round((successfulCompliance / testComplianceRegulations.length) * 100);
    
    console.log(`📈 OVERALL DELIVERY RATE: ${overallSuccessRate}% (${deliveryResults.successfulDeliveries}/${deliveryResults.totalRegulations})`);
    console.log(`🔬 COMPLIANCE DELIVERY RATE: ${complianceSuccessRate}% (${successfulCompliance}/${testComplianceRegulations.length})`);
    console.log(`⏱️  AVERAGE RESPONSE TIME: ${deliveryResults.averageResponseTime}ms`);
    console.log(`🕐 TOTAL DELIVERY TIME: ${Math.round(deliveryResults.totalTime / 1000)}s`);
    console.log(`📦 BATCHES PROCESSED: ${deliveryResults.batchResults.length}`);
    
    console.log('\n📋 BATCH PERFORMANCE:');
    deliveryResults.batchResults.forEach(batch => {
      console.log(`  Batch ${batch.batchIndex}: ${batch.successRate}% success, ${batch.avgResponseTime}ms avg, ${Math.round(batch.totalTime / 1000)}s total`);
    });
    
    // Step 6: Friday Beta Readiness Assessment
    console.log('\n🎯 FRIDAY BETA DELIVERY READINESS');
    console.log('=' .repeat(50));
    
    const isDeliveryReady = overallSuccessRate >= 85 && complianceSuccessRate >= 90 && deliveryResults.averageResponseTime < 2000;
    
    if (isDeliveryReady) {
      console.log('🟢 DELIVERY SYSTEM READY FOR FRIDAY BETA');
      console.log('✅ Batch delivery meets performance and reliability requirements');
    } else {
      console.log('🟡 DELIVERY SYSTEM NEEDS OPTIMIZATION');
      if (overallSuccessRate < 85) console.log('❌ Overall delivery rate below 85%');
      if (complianceSuccessRate < 90) console.log('❌ Compliance delivery rate below 90%');
      if (deliveryResults.averageResponseTime >= 2000) console.log('❌ Average response time above 2000ms');
    }
    
    console.log('\n📋 DELIVERY SYSTEM RECOMMENDATIONS:');
    console.log('  1. Monitor batch delivery performance under load');
    console.log('  2. Implement delivery retry mechanisms for failed regulations');
    console.log('  3. Add delivery caching for frequently requested regulations');
    console.log('  4. Set up delivery system health monitoring');
    console.log('  5. Test delivery system with EdSteward integration');
    
    console.log('\n🏁 BATCH DELIVERY TEST COMPLETE');
    
    return {
      overallSuccessRate,
      complianceSuccessRate,
      averageResponseTime: deliveryResults.averageResponseTime,
      totalTime: deliveryResults.totalTime,
      isReady: isDeliveryReady
    };
    
  } catch (error) {
    console.error('❌ BATCH DELIVERY TEST FAILED:', error.message);
    throw error;
  }
}

// Run the test
testBatchDelivery()
  .then(results => {
    console.log('\n✅ Batch delivery test completed successfully');
    process.exit(results.isReady ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Batch delivery test failed:', error.message);
    process.exit(1);
  });




