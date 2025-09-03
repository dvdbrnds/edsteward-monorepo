#!/usr/bin/env node

/**
 * FRIDAY BETA CLAIMS VERIFICATION
 * Independent verification of all claims without EdSteward dependency
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const LLM_GATEWAY = 'http://localhost:3002';
const FRONTEND = 'http://localhost:3050';

async function verifyFridayBetaClaims() {
  console.log('🔍 FRIDAY BETA CLAIMS VERIFICATION');
  console.log('=' .repeat(50));
  console.log('Testing WITHOUT EdSteward dependency...\n');
  
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    claims: []
  };
  
  // CLAIM 1: API serves all 295 regulations
  console.log('📊 CLAIM 1: API serves all 295 regulations');
  results.totalTests++;
  try {
    const response = await fetch(`${REGISTRY_API}/api/regulations`, { timeout: 10000 });
    if (response.ok) {
      const regulations = await response.json();
      const count = regulations.length;
      const claim1Pass = count === 295;
      
      console.log(`   Result: ${count} regulations found`);
      console.log(`   Status: ${claim1Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
      
      results.claims.push({
        claim: 'API serves all 295 regulations',
        expected: 295,
        actual: count,
        passed: claim1Pass
      });
      
      if (claim1Pass) results.passedTests++;
      else results.failedTests++;
    } else {
      throw new Error(`API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   Status: ❌ FAILED - ${error.message}`);
    results.failedTests++;
    results.claims.push({
      claim: 'API serves all 295 regulations',
      expected: 295,
      actual: 'ERROR',
      passed: false,
      error: error.message
    });
  }
  
  // CLAIM 2: Clery Act correctly categorized as "campus-safety"
  console.log('\n🎯 CLAIM 2: Clery Act correctly categorized as "campus-safety"');
  results.totalTests++;
  try {
    const response = await fetch(`${LLM_GATEWAY}/api/llm/compliance/jeanne-clery-disclosure-of-campus-security-policy-`, { timeout: 10000 });
    if (response.ok) {
      const data = await response.json();
      const category = data.data?.metadata?.category;
      const claim2Pass = category === 'campus-safety';
      
      console.log(`   Result: Category = "${category}"`);
      console.log(`   Status: ${claim2Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
      
      results.claims.push({
        claim: 'Clery Act categorized as campus-safety',
        expected: 'campus-safety',
        actual: category,
        passed: claim2Pass
      });
      
      if (claim2Pass) results.passedTests++;
      else results.failedTests++;
    } else {
      throw new Error(`LLM Gateway returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   Status: ❌ FAILED - ${error.message}`);
    results.failedTests++;
    results.claims.push({
      claim: 'Clery Act categorized as campus-safety',
      expected: 'campus-safety',
      actual: 'ERROR',
      passed: false,
      error: error.message
    });
  }
  
  // CLAIM 3: Console generation works for sample regulations
  console.log('\n🖥️  CLAIM 3: Console generation works for sample regulations');
  results.totalTests++;
  const testConsoles = [
    'jeanne-clery-disclosure-of-campus-security-policy-',
    'title-ix-of-the-education-amendment-of-1972',
    'americans-with-disabilities-act-of-1990'
  ];
  
  let consoleSuccesses = 0;
  for (const slug of testConsoles) {
    try {
      const response = await fetch(`${REGISTRY_API}/console/${slug}`, { timeout: 8000 });
      if (response.ok) {
        consoleSuccesses++;
        console.log(`   ✅ ${slug.substring(0, 30)}... - Console generated`);
      } else {
        console.log(`   ❌ ${slug.substring(0, 30)}... - Failed (${response.status})`);
      }
    } catch (error) {
      console.log(`   ❌ ${slug.substring(0, 30)}... - Error: ${error.message}`);
    }
  }
  
  const claim3Pass = consoleSuccesses === testConsoles.length;
  console.log(`   Result: ${consoleSuccesses}/${testConsoles.length} consoles generated`);
  console.log(`   Status: ${claim3Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
  
  results.claims.push({
    claim: 'Console generation works',
    expected: testConsoles.length,
    actual: consoleSuccesses,
    passed: claim3Pass
  });
  
  if (claim3Pass) results.passedTests++;
  else results.failedTests++;
  
  // CLAIM 4: Response times are fast (under 2000ms)
  console.log('\n⏱️  CLAIM 4: Response times are fast (under 2000ms)');
  results.totalTests++;
  
  const responseTimeTests = [];
  for (let i = 0; i < 5; i++) {
    try {
      const start = Date.now();
      const response = await fetch(`${LLM_GATEWAY}/api/llm/compliance/title-ix-of-the-education-amendment-of-1972`, { timeout: 10000 });
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        responseTimeTests.push(responseTime);
        console.log(`   Test ${i + 1}: ${responseTime}ms`);
      }
    } catch (error) {
      console.log(`   Test ${i + 1}: Failed - ${error.message}`);
    }
  }
  
  if (responseTimeTests.length > 0) {
    const avgResponseTime = Math.round(responseTimeTests.reduce((a, b) => a + b, 0) / responseTimeTests.length);
    const claim4Pass = avgResponseTime < 2000;
    
    console.log(`   Result: Average ${avgResponseTime}ms`);
    console.log(`   Status: ${claim4Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
    
    results.claims.push({
      claim: 'Response times under 2000ms',
      expected: '< 2000ms',
      actual: `${avgResponseTime}ms`,
      passed: claim4Pass
    });
    
    if (claim4Pass) results.passedTests++;
    else results.failedTests++;
  } else {
    console.log(`   Status: ❌ FAILED - No successful response time tests`);
    results.failedTests++;
    results.claims.push({
      claim: 'Response times under 2000ms',
      expected: '< 2000ms',
      actual: 'ERROR',
      passed: false
    });
  }
  
  // CLAIM 5: Moravian's critical regulations are accessible
  console.log('\n🎓 CLAIM 5: Moravian\'s critical regulations are accessible');
  results.totalTests++;
  
  const moravianCritical = [
    'family-educational-rights-and-privacy-act-ferpa',
    'title-ix-of-the-education-amendment-of-1972', 
    'americans-with-disabilities-act-of-1990',
    'jeanne-clery-disclosure-of-campus-security-policy-',
    'higher-education-act-institutional-and-financial-a'
  ];
  
  let moravianSuccesses = 0;
  for (const slug of moravianCritical) {
    try {
      const response = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${slug}`, { timeout: 8000 });
      if (response.ok) {
        const data = await response.json();
        const compliance = data.data?.overallCompliance;
        moravianSuccesses++;
        console.log(`   ✅ ${slug.substring(0, 25)}... - ${compliance}% compliance`);
      } else {
        console.log(`   ❌ ${slug.substring(0, 25)}... - Failed (${response.status})`);
      }
    } catch (error) {
      console.log(`   ❌ ${slug.substring(0, 25)}... - Error: ${error.message}`);
    }
  }
  
  const claim5Pass = moravianSuccesses >= 4; // 80% threshold
  console.log(`   Result: ${moravianSuccesses}/${moravianCritical.length} critical regulations accessible`);
  console.log(`   Status: ${claim5Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
  
  results.claims.push({
    claim: 'Moravian critical regulations accessible',
    expected: '≥ 4/5',
    actual: `${moravianSuccesses}/5`,
    passed: claim5Pass
  });
  
  if (claim5Pass) results.passedTests++;
  else results.failedTests++;
  
  // CLAIM 6: Services are running on correct ports
  console.log('\n🔌 CLAIM 6: Services are running on correct ports');
  results.totalTests++;
  
  const serviceTests = [
    { name: 'Registry API', url: `${REGISTRY_API}/api/regulations`, port: 3010 },
    { name: 'LLM Gateway', url: `${LLM_GATEWAY}/api/llm/compliance/title-ix-of-the-education-amendment-of-1972`, port: 3002 }
  ];
  
  let serviceSuccesses = 0;
  for (const service of serviceTests) {
    try {
      const response = await fetch(service.url, { timeout: 5000 });
      if (response.ok) {
        serviceSuccesses++;
        console.log(`   ✅ ${service.name} (port ${service.port}) - Running`);
      } else {
        console.log(`   ❌ ${service.name} (port ${service.port}) - Not responding (${response.status})`);
      }
    } catch (error) {
      console.log(`   ❌ ${service.name} (port ${service.port}) - Error: ${error.message}`);
    }
  }
  
  const claim6Pass = serviceSuccesses === serviceTests.length;
  console.log(`   Result: ${serviceSuccesses}/${serviceTests.length} services running`);
  console.log(`   Status: ${claim6Pass ? '✅ VERIFIED' : '❌ FAILED'}`);
  
  results.claims.push({
    claim: 'Services running on correct ports',
    expected: serviceTests.length,
    actual: serviceSuccesses,
    passed: claim6Pass
  });
  
  if (claim6Pass) results.passedTests++;
  else results.failedTests++;
  
  // FINAL VERIFICATION REPORT
  console.log('\n📋 FINAL VERIFICATION REPORT');
  console.log('=' .repeat(50));
  
  const overallSuccess = (results.passedTests / results.totalTests) * 100;
  
  console.log(`📊 OVERALL VERIFICATION: ${Math.round(overallSuccess)}% (${results.passedTests}/${results.totalTests} claims verified)`);
  
  if (overallSuccess >= 80) {
    console.log('🟢 FRIDAY BETA CLAIMS: VERIFIED');
    console.log('✅ System is ready for Friday beta deployment');
  } else if (overallSuccess >= 60) {
    console.log('🟡 FRIDAY BETA CLAIMS: PARTIALLY VERIFIED');
    console.log('⚠️  Some issues need attention before Friday beta');
  } else {
    console.log('🔴 FRIDAY BETA CLAIMS: NOT VERIFIED');
    console.log('❌ Significant issues must be resolved before Friday beta');
  }
  
  console.log('\n📋 DETAILED CLAIM VERIFICATION:');
  results.claims.forEach((claim, index) => {
    console.log(`  ${index + 1}. ${claim.claim}`);
    console.log(`     Expected: ${claim.expected}`);
    console.log(`     Actual: ${claim.actual}`);
    console.log(`     Status: ${claim.passed ? '✅ VERIFIED' : '❌ FAILED'}`);
    if (claim.error) console.log(`     Error: ${claim.error}`);
    console.log('');
  });
  
  console.log('🏁 VERIFICATION COMPLETE');
  console.log('Note: This verification was conducted WITHOUT EdSteward running');
  
  return {
    overallSuccess,
    passedTests: results.passedTests,
    totalTests: results.totalTests,
    claims: results.claims,
    isReady: overallSuccess >= 80
  };
}

// Run verification
verifyFridayBetaClaims()
  .then(results => {
    console.log('\n✅ Verification completed');
    process.exit(results.isReady ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });



