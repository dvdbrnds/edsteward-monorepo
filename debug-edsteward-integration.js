#!/usr/bin/env node

/**
 * EdSteward Integration Debug Script
 * 
 * This script helps diagnose why OSHA regulation updates aren't reaching EdSteward
 * while REG-66 (TEACH Act) updates work perfectly.
 */

import fetch from 'node-fetch';

const EDSTEWARD_URL = 'http://localhost:3000';
const DELIVERY_URL = 'http://localhost:3051';

console.log('🔍 EdSteward Integration Diagnostic Tool');
console.log('=====================================\n');

// Test 1: Check EdSteward connectivity
async function testEdStewardConnectivity() {
  console.log('📡 TEST 1: EdSteward Connectivity');
  console.log('----------------------------------');
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/health`, { timeout: 5000 });
    console.log(`✅ EdSteward Health Check: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log(`📄 Response: ${data.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ EdSteward Connection Failed: ${error.message}`);
  }
  console.log('');
}

// Test 2: Compare working vs non-working regulation payloads
async function compareRegulationPayloads() {
  console.log('🔬 TEST 2: Payload Comparison (REG-66 vs OSHA)');
  console.log('----------------------------------------------');
  
  // Working payload (REG-66)
  const workingPayload = {
    regulationId: 4524,  // EdSteward ID for TEACH Act
    name: "TEACH Act 2024 Update",
    originalContent: "USC 17 Section 110 - TEACH Act provisions for educational use of copyrighted materials",
    updatedContent: "USC 17 Section 110 - TEACH Act provisions for educational use of copyrighted materials [UPDATED]",
    status: "pending"
  };
  
  // Non-working payload (OSHA)
  const oshaPayload = {
    regulationId: 3656,  // EdSteward ID for OSHA Emergency Action Plan
    name: "OSHA Emergency Action Plan Standard 2024 Update",
    originalContent: "29 CFR 1910.38 - Emergency Action Plan Standard requirements",
    updatedContent: "29 CFR 1910.38 - Emergency Action Plan Standard requirements [UPDATED]",
    status: "pending"
  };
  
  console.log('✅ Working Payload (REG-66/TEACH Act):');
  console.log(JSON.stringify(workingPayload, null, 2));
  console.log('');
  
  console.log('❌ Non-Working Payload (OSHA):');
  console.log(JSON.stringify(oshaPayload, null, 2));
  console.log('');
  
  return { workingPayload, oshaPayload };
}

// Test 3: Test EdSteward API directly
async function testEdStewardAPI(payload, testName) {
  console.log(`🧪 TEST 3: Direct EdSteward API Test (${testName})`);
  console.log('------------------------------------------------');
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);
    
    if (response.ok) {
      console.log(`✅ ${testName} - SUCCESS`);
    } else {
      console.log(`❌ ${testName} - FAILED`);
    }
    
  } catch (error) {
    console.log(`❌ ${testName} - ERROR: ${error.message}`);
  }
  console.log('');
}

// Test 4: Check regulation ID existence
async function checkRegulationExists(regulationId) {
  console.log(`🔍 TEST 4: Check if Regulation ID ${regulationId} exists in EdSteward`);
  console.log('-----------------------------------------------------------');
  
  try {
    // Try to get regulation info (assuming EdSteward has a GET endpoint)
    const response = await fetch(`${EDSTEWARD_URL}/api/regulations/${regulationId}`, {
      timeout: 5000
    });
    
    console.log(`📊 GET /api/regulations/${regulationId}: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log(`✅ Regulation ${regulationId} exists: ${data.substring(0, 200)}...`);
    } else if (response.status === 404) {
      console.log(`❌ Regulation ${regulationId} NOT FOUND in EdSteward`);
    } else {
      console.log(`⚠️ Regulation ${regulationId} check returned: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Error checking regulation ${regulationId}: ${error.message}`);
  }
  console.log('');
}

// Test 5: MCP Engine delivery system test
async function testMCPDelivery(regulationSlug) {
  console.log(`🚀 TEST 5: MCP Engine Delivery Test (${regulationSlug})`);
  console.log('--------------------------------------------------');
  
  try {
    const response = await fetch(`${DELIVERY_URL}/api/trigger-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        regulationId: regulationSlug,
        changeType: 'update',
        source: 'debug-test'
      }),
      timeout: 15000
    });
    
    console.log(`📊 MCP Delivery Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ MCP Delivery Success: ${result.message}`);
      console.log(`📋 Update ID: ${result.updateId}`);
      console.log(`📋 Clients Notified: ${result.clientsNotified}`);
    } else {
      const error = await response.text();
      console.log(`❌ MCP Delivery Failed: ${error}`);
    }
    
  } catch (error) {
    console.log(`❌ MCP Delivery Error: ${error.message}`);
  }
  console.log('');
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('🏁 Starting EdSteward Integration Diagnostics...\n');
  
  // Test 1: Basic connectivity
  await testEdStewardConnectivity();
  
  // Test 2: Compare payloads
  const { workingPayload, oshaPayload } = await compareRegulationPayloads();
  
  // Test 3: Test both payloads directly with EdSteward
  await testEdStewardAPI(workingPayload, 'REG-66 (Working)');
  await testEdStewardAPI(oshaPayload, 'OSHA (Not Working)');
  
  // Test 4: Check if regulation IDs exist
  await checkRegulationExists(4524); // REG-66/TEACH Act
  await checkRegulationExists(3656); // OSHA Emergency Action Plan
  
  // Test 5: Test MCP Engine delivery
  await testMCPDelivery('REG-66');
  await testMCPDelivery('osha-s-emergency-action-plan-standard');
  
  console.log('🏆 DIAGNOSTIC SUMMARY');
  console.log('====================');
  console.log('');
  console.log('📋 QUESTIONS FOR EDSTEWARD TEAM:');
  console.log('1. Does regulation ID 3656 exist in your system?');
  console.log('2. What is the correct EdSteward ID for "OSHA Emergency Action Plan Standard"?');
  console.log('3. Are there any validation rules for regulation names or content?');
  console.log('4. Can you check your server logs for HTTP 500 errors when we send regulation ID 3656?');
  console.log('5. What is the exact payload format your /api/regulation-updates endpoint expects?');
  console.log('');
  console.log('📤 SHARE THIS OUTPUT WITH EDSTEWARD TEAM');
}

// Run diagnostics
runDiagnostics().catch(console.error);



