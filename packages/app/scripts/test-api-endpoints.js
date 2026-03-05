#!/usr/bin/env node

/**
 * Test script to verify API endpoints are working after deployment
 * Tests authentication flows and key endpoints
 */

import axios from 'axios';

const BASE_URL = 'https://moravian.edsteward.ai';

// Test configuration
const tests = [
  {
    name: 'Health Check',
    url: `${BASE_URL}/health`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Auth Status (Unauthenticated)',
    url: `${BASE_URL}/api/auth/status`,
    method: 'GET',
    expectedStatus: 200,
    expectedData: { authenticated: false, user: null }
  },
  {
    name: 'Setup Status',
    url: `${BASE_URL}/api/setup/status`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Deadlines (Should be 401 without auth)',
    url: `${BASE_URL}/api/deadlines`,
    method: 'GET',
    expectedStatus: 401
  },
  {
    name: 'Regulations (Public endpoint)',
    url: `${BASE_URL}/api/regulations`,
    method: 'GET',
    expectedStatus: 200
  }
];

async function runTest(test) {
  try {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    const response = await axios({
      method: test.method,
      url: test.url,
      validateStatus: () => true, // Don't throw on any status code
      timeout: 10000
    });
    
    const statusMatch = response.status === test.expectedStatus;
    const statusIcon = statusMatch ? '✅' : '❌';
    
    console.log(`   ${statusIcon} Status: ${response.status} (expected: ${test.expectedStatus})`);
    
    if (test.expectedData) {
      const dataMatch = JSON.stringify(response.data) === JSON.stringify(test.expectedData);
      const dataIcon = dataMatch ? '✅' : '❌';
      console.log(`   ${dataIcon} Data: ${JSON.stringify(response.data)}`);
      console.log(`   Expected: ${JSON.stringify(test.expectedData)}`);
      return statusMatch && dataMatch;
    }
    
    if (response.data && typeof response.data === 'object') {
      console.log(`   📄 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
    }
    
    return statusMatch;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   🔌 Connection refused - service may not be ready yet`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 EdSteward API Endpoint Testing');
  console.log('==================================');
  console.log(`Testing against: ${BASE_URL}`);
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The deployment appears successful.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
}); 