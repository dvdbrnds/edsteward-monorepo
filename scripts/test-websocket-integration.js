#!/usr/bin/env node

/**
 * WebSocket Integration Test Client
 * Tests MCP Engine WebSocket broadcasting for EdSteward integration
 */

const WebSocket = require('ws');
const { setTimeout } = require('timers/promises');

const WEBSOCKET_URL = 'ws://localhost:3051/regulation-updates';
const TEST_REGULATION_ID = 'REG-66';

console.log('🧪 MCP Engine WebSocket Integration Test');
console.log('=======================================');
console.log(`📡 Connecting to: ${WEBSOCKET_URL}`);

const ws = new WebSocket(WEBSOCKET_URL);
let messageCount = 0;
let testResults = {
  connection: false,
  subscription: false,
  messageReceived: false,
  regulationUpdate: false
};

ws.on('open', function open() {
  console.log('✅ WebSocket connection established');
  testResults.connection = true;
  
  // Subscribe to REG-66 updates
  const subscribeMessage = {
    type: 'subscribe',
    regulationIds: [TEST_REGULATION_ID]
  };
  
  console.log(`📋 Subscribing to ${TEST_REGULATION_ID}...`);
  ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', function message(data) {
  messageCount++;
  console.log(`📨 Message ${messageCount} received:`);
  
  try {
    const parsedMessage = JSON.parse(data.toString());
    console.log('   Type:', parsedMessage.type);
    console.log('   Data:', JSON.stringify(parsedMessage, null, 2));
    
    testResults.messageReceived = true;
    
    // Check message types
    switch (parsedMessage.type) {
      case 'connected':
        console.log('✅ Connection confirmation received');
        break;
        
      case 'subscription_confirmed':
        console.log('✅ Subscription confirmed');
        testResults.subscription = true;
        break;
        
      case 'regulation_updated':
        console.log('🎯 REGULATION UPDATE MESSAGE RECEIVED!');
        console.log('   Regulation ID:', parsedMessage.regulationId);
        console.log('   Change Type:', parsedMessage.changeType);
        console.log('   Version:', parsedMessage.version);
        console.log('   Timestamp:', parsedMessage.timestamp);
        testResults.regulationUpdate = true;
        break;
        
      case 'pong':
        console.log('🏓 Pong received');
        break;
        
      default:
        console.log('ℹ️ Unknown message type:', parsedMessage.type);
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error.message);
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('📴 WebSocket connection closed');
  
  // Print test results
  console.log('\n🧪 Integration Test Results:');
  console.log('============================');
  console.log(`✅ Connection established: ${testResults.connection ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Subscription confirmed: ${testResults.subscription ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Messages received: ${testResults.messageReceived ? 'PASS' : 'FAIL'} (${messageCount} total)`);
  console.log(`✅ Regulation updates: ${testResults.regulationUpdate ? 'PASS' : 'FAIL'}`);
  
  const allPassed = Object.values(testResults).every(result => result === true);
  console.log(`\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🚀 MCP Engine WebSocket integration is working correctly!');
    console.log('📋 EdSteward team can proceed with WebSocket integration.');
  } else {
    console.log('\n⚠️ Integration issues detected. Check the failed tests above.');
  }
  
  process.exit(allPassed ? 0 : 1);
});

// Send a ping after 2 seconds to test connectivity
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('🏓 Sending ping...');
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 2000);

// Close connection after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout reached, closing connection...');
  ws.close();
}, 10000);
