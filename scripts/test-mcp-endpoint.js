#!/usr/bin/env node

/**
 * MCP Endpoint Test Script
 * Tests the deployed MCP validation endpoint
 */

const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Configuration - Update this with your deployed endpoint
const CONFIG = {
  // Will be updated after deployment
  endpoint: process.env.MCP_ENDPOINT || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/mcp/validate',
  healthEndpoint: process.env.MCP_HEALTH_ENDPOINT || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/health'
};

/**
 * Test MCP validation endpoint with sample data
 */
async function testMCPValidation() {
  console.log('🧪 Testing MCP Validation Endpoint...');
  console.log('📍 Endpoint:', CONFIG.endpoint);
  
  // Sample MCP validation request
  const testRequest = {
    requestId: uuidv4(),
    timestamp: new Date().toISOString(),
    protocol: {
      version: '1.0',
      level: 'BASIC'
    },
    client: {
      id: 'test-client',
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
    const response = await makeHttpsRequest(CONFIG.endpoint, 'POST', testRequest);
    
    console.log('✅ MCP Validation Response:');
    console.log(JSON.stringify(response, null, 2));
    
    // Validate response structure
    if (response.validation && response.regulation) {
      console.log('✅ Response has valid MCP structure');
      console.log(`📊 Status: ${response.validation.status}`);
      console.log(`🎯 Confidence: ${Math.round(response.validation.confidence * 100)}%`);
      console.log(`🔍 Findings: ${response.validation.findings?.length || 0}`);
      
      if (response.validation.findings && response.validation.findings.length > 0) {
        console.log('📋 Validation Findings:');
        response.validation.findings.forEach((finding, index) => {
          console.log(`  ${index + 1}. ${finding.severity}: ${finding.message}`);
        });
      }
    } else {
      console.warn('⚠️ Response missing expected MCP structure');
    }
    
    return true;
  } catch (error) {
    console.error('❌ MCP Validation Test Failed:', error.message);
    return false;
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  console.log('\\n🏥 Testing Health Endpoint...');
  console.log('📍 Endpoint:', CONFIG.healthEndpoint);
  
  try {
    const response = await makeHttpsRequest(CONFIG.healthEndpoint, 'GET');
    
    console.log('✅ Health Response:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.status === 'healthy') {
      console.log('✅ MCP system is healthy');
      return true;
    } else {
      console.warn('⚠️ MCP system health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
    return false;
  }
}

/**
 * Make HTTPS request
 */
function makeHttpsRequest(url, method, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Test-Client/1.0'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
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
          reject(new Error(`Invalid JSON response: ${responseData}`));
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
async function runTests() {
  console.log('🚀 MCP Engine MVP - Endpoint Testing');
  console.log('=====================================\\n');
  
  const results = {
    health: false,
    validation: false
  };
  
  // Test health endpoint first
  results.health = await testHealthEndpoint();
  
  // Test validation endpoint
  results.validation = await testMCPValidation();
  
  // Summary
  console.log('\\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`🏥 Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🧪 MCP Validation: ${results.validation ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = results.health && results.validation;
  console.log(`\\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\\n🎉 MCP Engine MVP is ready for EdSteward integration!');
    console.log('📝 Next steps:');
    console.log('   1. Share validation endpoint with EdSteward team');
    console.log('   2. Configure EdSteward to send regulation data to MCP endpoint');  
    console.log('   3. Monitor CloudWatch logs for validation activity');
  } else {
    console.log('\\n⚠️ Please fix failing tests before proceeding with integration.');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testMCPValidation, testHealthEndpoint };
