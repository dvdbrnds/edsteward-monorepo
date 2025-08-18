#!/usr/bin/env node

/**
 * MCP Engine Integration Test Script
 * Tests the connection between EdSteward and MCP Engine
 */

import WebSocket from 'ws';

const MCP_ENGINE_URL = 'ws://localhost:3003/regulation-updates';
const EDSTEWARD_URL = 'http://localhost:3000';

console.log('🚀 Testing MCP Engine Integration');
console.log('=' .repeat(50));

// Test 1: Check if MCP Engine is running
async function testMCPEngineHealth() {
  console.log('\n1. Testing MCP Engine Health...');
  try {
    const response = await fetch('http://localhost:3003/health');
    if (response.ok) {
      const health = await response.json();
      console.log('✅ MCP Engine is running');
      console.log('   Service:', health.service);
      console.log('   Status:', health.status);
      console.log('   Details:', JSON.stringify(health.details, null, 2));
      return true;
    } else {
      console.log('❌ MCP Engine health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ MCP Engine not accessible:', error.message);
    return false;
  }
}

// Test 2: Test WebSocket connection to MCP Engine
async function testMCPWebSocketConnection() {
  console.log('\n2. Testing MCP Engine WebSocket...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(MCP_ENGINE_URL);
    let connected = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        console.log('❌ WebSocket connection timeout');
        ws.close();
        resolve(false);
      }
    }, 5000);
    
    ws.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      console.log('✅ Connected to MCP Engine WebSocket');
      
      // Subscribe to REG-66
      const subscribeMessage = {
        type: 'subscribe',
        regulationIds: ['REG-66']
      };
      
      console.log('📤 Sending subscription:', JSON.stringify(subscribeMessage));
      ws.send(JSON.stringify(subscribeMessage));
      
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 2000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📥 Received:', JSON.stringify(message, null, 2));
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

// Test 3: Check EdSteward configuration
async function testEdStewardConfiguration() {
  console.log('\n3. Testing EdSteward Configuration...');
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/health`);
    if (response.ok) {
      console.log('✅ EdSteward is running and accessible');
      
      // Check if environment variables are set correctly
      console.log('📋 Configuration Status:');
      console.log('   • VITE_MCP_WS_URL should be set to:', MCP_ENGINE_URL);
      console.log('   • EdSteward should attempt MCP Engine connection on page load');
      
      return true;
    } else {
      console.log('❌ EdSteward not accessible');
      return false;
    }
  } catch (error) {
    console.log('❌ EdSteward connection failed:', error.message);
    return false;
  }
}

// Test 4: Simulate a regulation update
async function simulateRegulationUpdate() {
  console.log('\n4. Testing Regulation Update Simulation...');
  
  try {
    const response = await fetch('http://localhost:3003/api/simulate-change/REG-66', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'content_update',
        mockData: {
          section: 'Section 110(2)',
          impact: 'high'
        }
      })
    });
    
    if (response.ok) {
      console.log('✅ Regulation update simulation triggered');
      console.log('   📡 This should send updates to connected EdSteward clients');
      return true;
    } else {
      console.log('❌ Simulation failed - MCP Engine may not be running');
      return false;
    }
  } catch (error) {
    console.log('❌ Simulation error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  const results = [];
  
  results.push(await testMCPEngineHealth());
  results.push(await testMCPWebSocketConnection());
  results.push(await testEdStewardConfiguration());
  results.push(await simulateRegulationUpdate());
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(50));
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! MCP Engine integration is working.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
    
    if (!results[0]) {
      console.log('\n📝 To start MCP Engine:');
      console.log('   cd /path/to/mcp-engine');
      console.log('   npm install');
      console.log('   npm start');
    }
    
    if (!results[2]) {
      console.log('\n📝 To start EdSteward:');
      console.log('   npm run dev');
    }
  }
  
  console.log('\n🔗 Integration Setup Complete!');
  console.log('   • EdSteward: http://localhost:3000');
  console.log('   • MCP Engine: http://localhost:3003');
  console.log('   • WebSocket: ws://localhost:3003/regulation-updates');
}

// Run the tests
runTests().catch(console.error);




