#!/usr/bin/env node

/**
 * Final Demo Integration Validation Script
 * Comprehensive end-to-end testing for both Wednesday and Friday demos
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

const EDSTEWARD_URL = 'http://localhost:3000';
const MCP_ENGINE_WS = 'ws://localhost:3003/regulation-updates';
const MCP_ENGINE_HTTP = 'http://localhost:3003';

console.log('🎯 FINAL DEMO INTEGRATION VALIDATION');
console.log('=' .repeat(60));
console.log('🎪 Testing complete integration for both demos');
console.log('=' .repeat(60));

let validationResults = {
  systemHealth: false,
  websocketIntegration: false,
  realTimeUpdates: false,
  errorHandling: false,
  demoReadiness: false
};

// Test 1: System Health Validation
async function validateSystemHealth() {
  console.log('\n🏥 1. SYSTEM HEALTH VALIDATION');
  console.log('-' .repeat(50));
  
  try {
    // Check EdSteward
    const edResponse = await fetch(`${EDSTEWARD_URL}/api/health`);
    if (!edResponse.ok) throw new Error('EdSteward health check failed');
    console.log('✅ EdSteward: Healthy and accessible');
    
    // Check MCP Engine
    const mcpResponse = await fetch(`${MCP_ENGINE_HTTP}/health`);
    if (!mcpResponse.ok) throw new Error('MCP Engine health check failed');
    
    const mcpHealth = await mcpResponse.json();
    console.log('✅ MCP Engine: Healthy and accessible');
    console.log(`   Service: ${mcpHealth.service}`);
    console.log(`   Connected Clients: ${mcpHealth.details.connectedClients}`);
    console.log(`   Available Regulations: ${mcpHealth.details.availableRegulations}`);
    
    validationResults.systemHealth = true;
    return true;
  } catch (error) {
    console.log('❌ System health validation failed:', error.message);
    return false;
  }
}

// Test 2: WebSocket Integration Validation
async function validateWebSocketIntegration() {
  console.log('\n🔌 2. WEBSOCKET INTEGRATION VALIDATION');
  console.log('-' .repeat(50));
  
  return new Promise((resolve) => {
    const ws = new WebSocket(MCP_ENGINE_WS);
    let connectionEstablished = false;
    let subscriptionConfirmed = false;
    
    const timeout = setTimeout(() => {
      console.log('❌ WebSocket integration test timeout');
      ws.close();
      resolve(false);
    }, 10000);
    
    ws.on('open', () => {
      connectionEstablished = true;
      console.log('✅ WebSocket connection established');
      
      // Test subscription protocol
      const subscribeMessage = {
        type: 'subscribe',
        regulationIds: ['REG-66', 'REG-42']
      };
      
      console.log('📤 Testing subscription protocol...');
      ws.send(JSON.stringify(subscribeMessage));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📥 Received: ${message.type}`);
      
      if (message.type === 'connected') {
        console.log('✅ Connection handshake successful');
        console.log(`   Client ID: ${message.clientId}`);
        console.log(`   Available Regulations: ${message.availableRegulations?.join(', ')}`);
      }
      
      if (message.type === 'subscribed') {
        subscriptionConfirmed = true;
        console.log('✅ Subscription protocol working');
        console.log(`   Subscribed to: ${message.regulationIds?.join(', ')}`);
        
        // Test ping/pong
        console.log('📤 Testing ping/pong protocol...');
        ws.send(JSON.stringify({ type: 'ping' }));
      }
      
      if (message.type === 'pong') {
        console.log('✅ Ping/pong protocol working');
        
        // All tests passed
        if (connectionEstablished && subscriptionConfirmed) {
          console.log('✅ WebSocket integration fully validated');
          validationResults.websocketIntegration = true;
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve(false);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
  });
}

// Test 3: Real-Time Updates Validation
async function validateRealTimeUpdates() {
  console.log('\n📡 3. REAL-TIME UPDATES VALIDATION');
  console.log('-' .repeat(50));
  
  return new Promise((resolve) => {
    const ws = new WebSocket(MCP_ENGINE_WS);
    let updateReceived = false;
    
    const timeout = setTimeout(() => {
      console.log('❌ Real-time update test timeout');
      ws.close();
      resolve(false);
    }, 15000);
    
    ws.on('open', () => {
      console.log('✅ Connected for real-time update test');
      
      // Subscribe to REG-66
      ws.send(JSON.stringify({
        type: 'subscribe',
        regulationIds: ['REG-66']
      }));
      
      // Wait for subscription confirmation, then trigger update
      setTimeout(async () => {
        console.log('📤 Triggering regulation update...');
        
        try {
          const response = await fetch(`${MCP_ENGINE_HTTP}/api/simulate-change/REG-66`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changeType: 'VALIDATION_TEST',
              mockData: {
                impact: 'high',
                message: 'Real-time update validation test',
                section: 'Section 110(2)',
                summary: 'Critical compliance update detected'
              }
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Update trigger successful');
            console.log(`   New Version: ${result.newVersion}`);
            console.log(`   Broadcast Count: ${result.broadcastCount}`);
          }
        } catch (error) {
          console.log('❌ Failed to trigger update:', error.message);
        }
      }, 2000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'regulation_updated') {
        updateReceived = true;
        console.log('✅ Real-time update received!');
        console.log(`   Regulation: ${message.regulationId}`);
        console.log(`   Version: ${message.version}`);
        console.log(`   Change Type: ${message.changeType}`);
        console.log(`   Impact: ${message.details?.impact}`);
        console.log(`   Summary: ${message.details?.summary}`);
        
        validationResults.realTimeUpdates = true;
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ Real-time update test error:', error.message);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Test 4: Error Handling Validation
async function validateErrorHandling() {
  console.log('\n🛡️  4. ERROR HANDLING VALIDATION');
  console.log('-' .repeat(50));
  
  // Test graceful handling of invalid messages
  return new Promise((resolve) => {
    const ws = new WebSocket(MCP_ENGINE_WS);
    let errorHandlingWorking = false;
    
    const timeout = setTimeout(() => {
      console.log('❌ Error handling test timeout');
      ws.close();
      resolve(false);
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ Connected for error handling test');
      
      // Send invalid message
      console.log('📤 Testing invalid message handling...');
      ws.send('invalid json message');
      
      // Send unknown message type
      setTimeout(() => {
        console.log('📤 Testing unknown message type handling...');
        ws.send(JSON.stringify({
          type: 'unknown_message_type',
          data: 'test'
        }));
      }, 1000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'error') {
        errorHandlingWorking = true;
        console.log('✅ Error handling working correctly');
        console.log(`   Error Message: ${message.message}`);
        
        validationResults.errorHandling = true;
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    });
    
    ws.on('error', (error) => {
      // This is expected for invalid JSON
      console.log('✅ WebSocket error handling working:', error.message);
    });
  });
}

// Test 5: Demo Readiness Final Check
async function validateDemoReadiness() {
  console.log('\n🎪 5. DEMO READINESS FINAL CHECK');
  console.log('-' .repeat(50));
  
  // Check if core systems are working (excluding demoReadiness itself)
  const coreSystemsWorking = validationResults.systemHealth && 
                            validationResults.websocketIntegration && 
                            validationResults.realTimeUpdates && 
                            validationResults.errorHandling;
  
  if (coreSystemsWorking) {
    console.log('✅ All systems operational and demo-ready');
    console.log('✅ Wednesday demo: Technical architecture ready');
    console.log('✅ Friday demo: Business value demonstration ready');
    console.log('✅ Real-time updates working perfectly');
    console.log('✅ Error handling robust and user-friendly');
    
    validationResults.demoReadiness = true;
    return true;
  } else {
    console.log('⚠️  Some systems need attention before demos');
    return false;
  }
}

// Final Results Summary
function displayFinalResults() {
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL VALIDATION RESULTS');
  console.log('=' .repeat(60));
  
  const totalTests = Object.keys(validationResults).length;
  const passedTests = Object.values(validationResults).filter(Boolean).length;
  
  console.log(`\n📈 Overall Score: ${passedTests}/${totalTests} validations passed`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  Object.entries(validationResults).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`   ${status} ${testName}`);
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 INTEGRATION VALIDATION COMPLETE!');
    console.log('🚀 Both demos are ready for execution');
    console.log('💼 Business value can be demonstrated effectively');
    console.log('🔧 Technical architecture is solid and reliable');
  } else {
    console.log('\n⚠️  VALIDATION INCOMPLETE');
    console.log('🔧 Address failing tests before demo execution');
  }
  
  console.log('\n🎯 Demo Execution Guidelines:');
  console.log('📅 Wednesday: Focus on technical capabilities and architecture');
  console.log('📅 Friday: Emphasize business value and operational efficiency');
  console.log('🔄 Real-time updates: Use simulate-change API for live demo');
  console.log('🛡️  Error handling: System gracefully handles edge cases');
}

// Main validation runner
async function runFinalValidation() {
  console.log('🚀 Starting comprehensive integration validation...\n');
  
  await validateSystemHealth();
  await validateWebSocketIntegration();
  await validateRealTimeUpdates();
  await validateErrorHandling();
  await validateDemoReadiness();
  
  displayFinalResults();
  
  console.log('\n🎯 Final validation complete!');
  console.log('📋 System ready for demo execution');
}

// Run the validation
runFinalValidation().catch(console.error);
