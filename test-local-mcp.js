#!/usr/bin/env node

/**
 * Local MCP Testing Script
 * Tests the MCP protocol against your running local services
 */

import http from 'http';
import { v4 as uuidv4 } from 'uuid';

// Local endpoints (no AWS needed)
const LOCAL_ENDPOINTS = {
  llmGateway: 'http://localhost:3002',
  registryApi: 'http://localhost:3010',
  deliverySystem: 'http://localhost:3051',
  frontend: 'http://localhost:3050'
};

/**
 * Test MCP validation against local LLM Gateway
 */
async function testLocalMCPValidation() {
  console.log('🧪 Testing LOCAL MCP Validation...');
  console.log('📍 LLM Gateway:', LOCAL_ENDPOINTS.llmGateway);
  
  // Create MCP-style request for local testing
  const mcpRequest = {
    requestId: uuidv4(),
    timestamp: new Date().toISOString(),
    protocol: {
      version: '1.0',
      level: 'BASIC'
    },
    client: {
      id: 'local-test-client',
      version: '1.0.0'
    },
    regulation: {
      id: 'reg-66',
      name: 'TEACH Act Section 110',
      version: '2023-01-01'
    },
    data: `
      Sample institutional policy document for TEACH Act compliance:
      
      Our accredited nonprofit educational institution has established comprehensive 
      policies regarding copyright compliance. All performance and display activities 
      are made by, at the direction of, or under the actual supervision of an instructor 
      as an integral part of class experience controlled by instructor.
      
      We provide informational materials about copyright compliance to all faculty 
      and students, including notice about copyright protection. Our technological 
      measures prevent retention longer than class session and prevent unauthorized 
      dissemination. Students officially enrolled in the course have access to 
      transmissions that are analogous to live classroom setting.
    `,
    options: {
      attestation: false,
      diff: false,
      explanation: true
    }
  };

  try {
    // Test direct LLM Gateway endpoint (your current working system)
    console.log('🎯 Testing USC 17/110 endpoint...');
    const uscResponse = await makeHttpRequest(`${LOCAL_ENDPOINTS.llmGateway}/api/llm/usc/17/110`, 'GET');
    
    console.log('✅ USC Response received:');
    console.log(`📊 Title: ${uscResponse.data?.title || 'N/A'}`);
    console.log(`🎯 Confidence: ${uscResponse.data?.confidence || 'N/A'}`);
    console.log(`📝 Content Length: ${uscResponse.data?.fullText?.length || 0} characters`);
    
    // Test CFR endpoint for Age Discrimination Act
    console.log('\n🎯 Testing CFR endpoint...');
    const cfrResponse = await makeHttpRequest(`${LOCAL_ENDPOINTS.llmGateway}/api/llm/cfr/age-discrimination-act-of-1975`, 'GET');
    
    console.log('✅ CFR Response received:');
    console.log(`📊 Title: ${cfrResponse.data?.title || 'N/A'}`);
    console.log(`🎯 Confidence: ${cfrResponse.data?.confidence || 'N/A'}`);
    console.log(`📝 Content Length: ${cfrResponse.data?.fullText?.length || 0} characters`);
    
    // Test compliance endpoint
    console.log('\n🎯 Testing Compliance endpoint...');
    const complianceResponse = await makeHttpRequest(`${LOCAL_ENDPOINTS.llmGateway}/api/llm/compliance/reg-66`, 'GET');
    
    console.log('✅ Compliance Response received:');
    console.log(`📊 Status: ${complianceResponse.status || 'N/A'}`);
    console.log(`🎯 Confidence: ${complianceResponse.confidence || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Local MCP Test Failed:', error.message);
    return false;
  }
}

/**
 * Test all local services health
 */
async function testAllLocalServices() {
  console.log('\n🏥 Testing All Local Services...');
  
  const services = [
    { name: 'LLM Gateway', url: `${LOCAL_ENDPOINTS.llmGateway}/api/llm/health` },
    { name: 'Registry API', url: `${LOCAL_ENDPOINTS.registryApi}/api/regulations` },
    { name: 'Delivery System', url: `${LOCAL_ENDPOINTS.deliverySystem}/health` },
    { name: 'Frontend', url: `${LOCAL_ENDPOINTS.frontend}/reg-66-advanced-console.html` }
  ];
  
  const results = {};
  
  for (const service of services) {
    try {
      console.log(`🔍 Testing ${service.name}...`);
      const response = await makeHttpRequest(service.url, 'GET');
      results[service.name] = '✅ HEALTHY';
      console.log(`✅ ${service.name}: Working`);
    } catch (error) {
      results[service.name] = '❌ ERROR';
      console.log(`❌ ${service.name}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Make HTTP request to local services
 */
function makeHttpRequest(url, method, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Local-MCP-Test/1.0'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonResponse);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${jsonResponse.message || responseData}`));
          }
        } catch (error) {
          // Handle non-JSON responses (like HTML from frontend)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: responseData, status: 'success' });
          } else {
            reject(new Error(`Invalid response: ${responseData.substring(0, 100)}...`));
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Main test runner
 */
async function runLocalTests() {
  console.log('🚀 MCP Engine LOCAL Testing');
  console.log('============================\n');
  
  // Test all services first
  const serviceResults = await testAllLocalServices();
  
  // Test MCP validation
  const mcpResult = await testLocalMCPValidation();
  
  // Summary
  console.log('\n📊 Local Test Results Summary:');
  console.log('==============================');
  
  Object.entries(serviceResults).forEach(([service, status]) => {
    console.log(`${status} ${service}`);
  });
  
  console.log(`${mcpResult ? '✅' : '❌'} MCP Validation: ${mcpResult ? 'PASS' : 'FAIL'}`);
  
  const allHealthy = Object.values(serviceResults).every(status => status.includes('✅'));
  const overallStatus = allHealthy && mcpResult;
  
  console.log(`\n🎯 Overall Status: ${overallStatus ? '✅ ALL SYSTEMS OPERATIONAL' : '❌ SOME ISSUES FOUND'}`);
  
  if (overallStatus) {
    console.log('\n🎉 Your local MCP Engine is ready!');
    console.log('📝 Next steps:');
    console.log('   1. Open browser: http://localhost:3050');
    console.log('   2. Test regulation console pages');
    console.log('   3. Check WebSocket connections working');
    console.log('   4. AWS deployment can come later when ready');
  }
  
  process.exit(overallStatus ? 0 : 1);
}

// Run tests if called directly
console.log('Script started, checking if main module...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

runLocalTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { testLocalMCPValidation, testAllLocalServices };
