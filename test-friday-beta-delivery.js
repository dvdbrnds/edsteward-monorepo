#!/usr/bin/env node

/**
 * FRIDAY BETA - FOCUSED DELIVERY TEST
 * Quick validation of delivery system for Friday beta
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const LLM_GATEWAY = 'http://localhost:3002';

async function testFridayBetaDelivery() {
  console.log('🚀 FRIDAY BETA - FOCUSED DELIVERY TEST');
  console.log('=' .repeat(40));
  
  try {
    // Test 1: API Capacity Test (sample of 20 regulations)
    console.log('📊 Test 1: API Capacity Test...');
    const response = await fetch(`${REGISTRY_API}/api/regulations`, { timeout: 5000 });
    const regulations = await response.json();
    
    const sampleSize = Math.min(20, regulations.length);
    const sampleRegulations = regulations.slice(0, sampleSize);
    
    console.log(`Testing delivery of ${sampleSize} regulations...`);
    
    const deliveryPromises = sampleRegulations.map(async (reg, index) => {
      const slug = reg.name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      try {
        const start = Date.now();
        const consoleResponse = await fetch(`${REGISTRY_API}/console/${slug}`, { timeout: 5000 });
        const responseTime = Date.now() - start;
        
        return {
          success: consoleResponse.ok,
          responseTime,
          regulation: reg.name
        };
      } catch (error) {
        return {
          success: false,
          responseTime: 0,
          regulation: reg.name,
          error: error.message
        };
      }
    });
    
    const deliveryResults = await Promise.allSettled(deliveryPromises);
    const successful = deliveryResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const avgResponseTime = deliveryResults
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .reduce((sum, r) => sum + r.value.responseTime, 0) / successful;
    
    console.log(`✅ Console Delivery: ${successful}/${sampleSize} successful (${Math.round((successful/sampleSize)*100)}%)`);
    console.log(`⏱️  Average Response Time: ${Math.round(avgResponseTime)}ms`);
    
    // Test 2: Critical Regulations Test
    console.log('\n🎯 Test 2: Critical Regulations Test...');
    const criticalRegulations = [
      'jeanne-clery-disclosure-of-campus-security-policy-',
      'title-ix-of-the-education-amendment-of-1972',
      'americans-with-disabilities-act-of-1990',
      'family-educational-rights-and-privacy-act-ferpa'
    ];
    
    let criticalResults = [];
    for (const slug of criticalRegulations) {
      try {
        const complianceResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${slug}`, { timeout: 5000 });
        criticalResults.push({
          regulation: slug,
          success: complianceResponse.ok,
          status: complianceResponse.status
        });
      } catch (error) {
        criticalResults.push({
          regulation: slug,
          success: false,
          error: error.message
        });
      }
    }
    
    const criticalSuccessful = criticalResults.filter(r => r.success).length;
    console.log(`✅ Critical Compliance: ${criticalSuccessful}/${criticalRegulations.length} successful (${Math.round((criticalSuccessful/criticalRegulations.length)*100)}%)`);
    
    // Test 3: Load Test (concurrent requests)
    console.log('\n⚡ Test 3: Concurrent Load Test...');
    const loadTestRegulations = regulations.slice(0, 10);
    const concurrentRequests = 5;
    
    const loadTestPromises = Array(concurrentRequests).fill().map(async (_, i) => {
      const reg = loadTestRegulations[i % loadTestRegulations.length];
      const slug = reg.name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      try {
        const start = Date.now();
        const response = await fetch(`${REGISTRY_API}/console/${slug}`, { timeout: 8000 });
        return {
          success: response.ok,
          responseTime: Date.now() - start,
          concurrent: i + 1
        };
      } catch (error) {
        return {
          success: false,
          responseTime: 0,
          concurrent: i + 1,
          error: error.message
        };
      }
    });
    
    const loadResults = await Promise.allSettled(loadTestPromises);
    const loadSuccessful = loadResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    console.log(`✅ Concurrent Load: ${loadSuccessful}/${concurrentRequests} successful (${Math.round((loadSuccessful/concurrentRequests)*100)}%)`);
    
    // Friday Beta Assessment
    console.log('\n🎯 FRIDAY BETA DELIVERY ASSESSMENT');
    console.log('=' .repeat(40));
    
    const deliveryRate = Math.round((successful/sampleSize)*100);
    const criticalRate = Math.round((criticalSuccessful/criticalRegulations.length)*100);
    const loadRate = Math.round((loadSuccessful/concurrentRequests)*100);
    const responseTimeOk = avgResponseTime < 2000;
    
    console.log(`📊 Sample Delivery Rate: ${deliveryRate}%`);
    console.log(`🎯 Critical Regulations: ${criticalRate}%`);
    console.log(`⚡ Concurrent Load: ${loadRate}%`);
    console.log(`⏱️  Response Time: ${Math.round(avgResponseTime)}ms (${responseTimeOk ? 'GOOD' : 'SLOW'})`);
    console.log(`📈 Total Regulations Available: ${regulations.length}/295`);
    
    const isReady = deliveryRate >= 80 && criticalRate >= 90 && loadRate >= 80 && responseTimeOk && regulations.length >= 295;
    
    if (isReady) {
      console.log('\n🟢 DELIVERY SYSTEM READY FOR FRIDAY BETA');
      console.log('✅ All delivery requirements met for Moravian University beta');
    } else {
      console.log('\n🟡 DELIVERY SYSTEM NEEDS ATTENTION');
      if (deliveryRate < 80) console.log('❌ Sample delivery rate below 80%');
      if (criticalRate < 90) console.log('❌ Critical regulations below 90%');
      if (loadRate < 80) console.log('❌ Concurrent load handling below 80%');
      if (!responseTimeOk) console.log('❌ Response time above 2000ms');
      if (regulations.length < 295) console.log('❌ Not all 295 regulations available');
    }
    
    console.log('\n🏁 FRIDAY BETA DELIVERY TEST COMPLETE');
    
    return {
      deliveryRate,
      criticalRate,
      loadRate,
      avgResponseTime,
      totalRegulations: regulations.length,
      isReady
    };
    
  } catch (error) {
    console.error('❌ FRIDAY BETA DELIVERY TEST FAILED:', error.message);
    throw error;
  }
}

// Run the test
testFridayBetaDelivery()
  .then(results => {
    console.log('\n✅ Friday beta delivery test completed');
    process.exit(results.isReady ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Friday beta delivery test failed:', error.message);
    process.exit(1);
  });



