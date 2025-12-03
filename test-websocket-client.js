#!/usr/bin/env node

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3051/regulation-updates');

console.log('🔌 Connecting to WebSocket...');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket!');
  
  // Subscribe to TEACH Act
  const subscribeMessage = {
    type: 'subscribe',
    regulationIds: ['technology-education-and-copyright-harmonization-a', 'REG-66']
  };
  
  console.log('📤 Sending subscription:', JSON.stringify(subscribeMessage, null, 2));
  ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', (data) => {
  console.log('\n📨 RECEIVED MESSAGE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const message = JSON.parse(data.toString());
    console.log(JSON.stringify(message, null, 2));
    
    // Check for structured fields
    if (message.type === 'regulation_updated') {
      console.log('\n📋 STRUCTURED FIELDS CHECK:');
      console.log(`  updatedContent: ${message.data?.updatedContent ? message.data.updatedContent.length + ' chars' : 'MISSING'}`);
      console.log(`  summary: ${message.data?.summary ? message.data.summary.substring(0, 60) + '...' : 'MISSING'}`);
      console.log(`  requirements: ${message.data?.requirements ? message.data.requirements.length + ' chars' : 'MISSING'}`);
      console.log(`  filingDeadlines: ${message.data?.filingDeadlines || 'MISSING'}`);
    }
  } catch (error) {
    console.log('Raw message:', data.toString());
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
  process.exit(0);
});

// Keep alive for 60 seconds
console.log('⏳ Listening for messages for 60 seconds...');
console.log('   (Trigger an update from the console to test)\n');

setTimeout(() => {
  console.log('\n⏱️  Test timeout - closing connection');
  ws.close();
}, 60000);









