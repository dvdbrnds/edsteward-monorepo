#!/usr/bin/env node

/**
 * FRIDAY BETA - CLIENT INTEGRATION TEST
 * Tests pushing all 295 regulations to a test client
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const LLM_GATEWAY = 'http://localhost:3002';

async function testClientIntegration() {
  console.log('🚀 FRIDAY BETA - CLIENT INTEGRATION TEST');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Fetch all regulations from Registry API
    console.log('📊 Step 1: Fetching all regulations from Registry API...');
    const response = await fetch(`${REGISTRY_API}/api/regulations`, {
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Registry API failed: ${response.status} ${response.statusText}`);
    }
    
    const regulations = await response.json();
    console.log(`✅ Successfully fetched ${regulations.length} regulations`);
    
    // Step 2: Test sample regulations for accuracy
    console.log('\n📋 Step 2: Testing sample regulations for accuracy...');
    
    const testRegulations = [
      { name: 'Clery Act', slug: 'jeanne-clery-disclosure-of-campus-security-policy-', expectedCategory: 'campus-safety' },
      { name: 'Title IX', slug: 'title-ix-of-the-education-amendment-of-1972', expectedCategory: 'civil-rights' },
      { name: 'ADA', slug: 'americans-with-disabilities-act-of-1990', expectedCategory: 'civil-rights' },
      { name: 'Fair Housing Act', slug: 'fair-housing-act-section-6', expectedCategory: 'civil-rights' }
    ];
    
    let accuracyResults = [];
    
    for (const test of testRegulations) {
      try {
        console.log(`🔍 Testing ${test.name}...`);
        
        // Test compliance endpoint
        const complianceResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${test.slug}`, {
          timeout: 5000
        });
        
        if (complianceResponse.ok) {
          const complianceData = await complianceResponse.json();
          const actualCategory = complianceData.data?.metadata?.category;
          
          const isAccurate = actualCategory === test.expectedCategory;
          accuracyResults.push({
            regulation: test.name,
            expected: test.expectedCategory,
            actual: actualCategory,
            accurate: isAccurate,
            status: isAccurate ? '✅' : '❌'
          });
          
          console.log(`  ${isAccurate ? '✅' : '❌'} Category: ${actualCategory} (expected: ${test.expectedCategory})`);
        } else {
          accuracyResults.push({
            regulation: test.name,
            expected: test.expectedCategory,
            actual: 'ERROR',
            accurate: false,
            status: '❌'
          });
          console.log(`  ❌ Failed to fetch compliance data: ${complianceResponse.status}`);
        }
      } catch (error) {
        console.log(`  ❌ Error testing ${test.name}: ${error.message}`);
        accuracyResults.push({
          regulation: test.name,
          expected: test.expectedCategory,
          actual: 'ERROR',
          accurate: false,
          status: '❌'
        });
      }
    }
    
    // Step 3: Test batch delivery capability
    console.log('\n📦 Step 3: Testing batch delivery capability...');
    
    const batchSize = 10;
    const testBatch = regulations.slice(0, batchSize);
    
    console.log(`🔄 Testing delivery of ${batchSize} regulations in batch...`);
    
    const batchResults = await Promise.allSettled(
      testBatch.map(async (reg, index) => {
        const slug = reg.name.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);
        
        const response = await fetch(`${REGISTRY_API}/console/${slug}`, {
          timeout: 5000
        });
        
        return {
          regulation: reg.name,
          slug: slug,
          status: response.ok ? 'SUCCESS' : 'FAILED',
          statusCode: response.status
        };
      })
    );
    
    const successfulDeliveries = batchResults.filter(result => 
      result.status === 'fulfilled' && result.value.status === 'SUCCESS'
    ).length;
    
    console.log(`✅ Batch delivery: ${successfulDeliveries}/${batchSize} successful`);
    
    // Step 4: Generate Friday Beta Report
    console.log('\n📊 FRIDAY BETA INTEGRATION REPORT');
    console.log('=' .repeat(50));
    
    const accurateCount = accuracyResults.filter(r => r.accurate).length;
    const accuracyPercentage = Math.round((accurateCount / accuracyResults.length) * 100);
    const deliveryPercentage = Math.round((successfulDeliveries / batchSize) * 100);
    
    console.log(`📈 REGULATION COUNT: ${regulations.length}/295 regulations available`);
    console.log(`🎯 ACCURACY RATE: ${accuracyPercentage}% (${accurateCount}/${accuracyResults.length} tested)`);
    console.log(`📦 DELIVERY RATE: ${deliveryPercentage}% (${successfulDeliveries}/${batchSize} tested)`);
    
    console.log('\n📋 ACCURACY DETAILS:');
    accuracyResults.forEach(result => {
      console.log(`  ${result.status} ${result.regulation}: ${result.actual} (expected: ${result.expected})`);
    });
    
    // Step 5: Friday Beta Readiness Assessment
    console.log('\n🎯 FRIDAY BETA READINESS ASSESSMENT');
    console.log('=' .repeat(50));
    
    const isReady = regulations.length >= 295 && accuracyPercentage >= 75 && deliveryPercentage >= 80;
    
    if (isReady) {
      console.log('🟢 READY FOR FRIDAY BETA DEPLOYMENT');
      console.log('✅ All systems operational and meeting minimum thresholds');
    } else {
      console.log('🟡 NEEDS ATTENTION BEFORE FRIDAY BETA');
      if (regulations.length < 295) console.log('❌ Regulation count below 295');
      if (accuracyPercentage < 75) console.log('❌ Accuracy rate below 75%');
      if (deliveryPercentage < 80) console.log('❌ Delivery rate below 80%');
    }
    
    console.log('\n🏁 CLIENT INTEGRATION TEST COMPLETE');
    
    return {
      regulationCount: regulations.length,
      accuracyPercentage,
      deliveryPercentage,
      isReady
    };
    
  } catch (error) {
    console.error('❌ CLIENT INTEGRATION TEST FAILED:', error.message);
    throw error;
  }
}

// Run the test
testClientIntegration()
  .then(results => {
    console.log('\n✅ Test completed successfully');
    process.exit(results.isReady ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });




