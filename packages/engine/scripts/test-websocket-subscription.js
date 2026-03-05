#!/usr/bin/env node

/**
 * Test WebSocket subscription for Drug-Free Schools regulation
 */

import { WebSocket } from 'ws';

const REGULATION_ID = 'drug-free-schools-and-communities-act';
const WS_URL = 'ws://localhost:3051/regulation-updates';

console.log(`🧪 Testing WebSocket subscription for: ${REGULATION_ID}`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  
  // Subscribe to the Drug-Free Schools regulation
  ws.send(JSON.stringify({
    type: 'subscribe',
    regulationIds: [REGULATION_ID]
  }));
  
  console.log(`📋 Subscribed to: ${REGULATION_ID}`);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message.type);
    
    if (message.type === 'subscription_confirmed') {
      console.log(`✅ Subscription confirmed for: ${message.regulationIds.join(', ')}`);
      
      // Now trigger an update to test if we receive it
      setTimeout(() => {
        console.log('🔄 Triggering test update...');
        
        fetch('http://localhost:3051/api/trigger-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            regulationId: REGULATION_ID,
            changeType: 'WEBSOCKET_TEST',
            message: 'Testing WebSocket delivery'
          })
        }).then(response => response.json())
          .then(result => {
            console.log(`📤 Update triggered: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          })
          .catch(error => {
            console.error('❌ Failed to trigger update:', error.message);
          });
      }, 1000);
    }
    
    if (message.type === 'regulation_updated') {
      console.log(`🎯 UPDATE RECEIVED!`);
      console.log(`   Regulation: ${message.regulationId}`);
      console.log(`   Version: ${message.version}`);
      console.log(`   Change Type: ${message.data?.changeType}`);
      
      // Test successful, close connection
      setTimeout(() => {
        console.log('✅ Test completed successfully!');
        ws.close();
        process.exit(0);
      }, 500);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('📴 WebSocket disconnected');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - no update received');
  ws.close();
  process.exit(1);
}, 10000);
