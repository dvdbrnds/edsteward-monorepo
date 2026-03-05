/**
 * Test script for MCP Regulation Delivery System
 * Demonstrates real-time regulation updates
 */

import { DeliveryServer } from './delivery-server.js';
import { RegulationUpdateClient } from './client-sdk.js';
import WebSocket from 'ws';

// Make WebSocket available globally for the client SDK in Node.js
global.WebSocket = WebSocket;

async function testDeliverySystem() {
  console.log('🧪 Starting MCP Regulation Delivery System Test...\n');

  // Start the delivery server
  console.log('1️⃣ Starting delivery server...');
  const server = new DeliveryServer({ port: 3003 });
  await server.start();
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test client connection
    console.log('\n2️⃣ Testing client connection...');
    const client = new RegulationUpdateClient({
      wsUrl: 'ws://localhost:3003/regulation-updates'
    });

    // Set up event handlers
    client.on('connected', () => {
      console.log('✅ Client connected successfully');
    });

    client.on('regulation_updated', (data) => {
      console.log('📋 Regulation update received:');
      console.log(`   - Regulation: ${data.regulationId}`);
      console.log(`   - Version: ${data.version}`);
      console.log(`   - Change Type: ${data.data.changeType}`);
      console.log(`   - Timestamp: ${data.timestamp}`);
    });

    client.on('subscription_confirmed', (data) => {
      console.log(`✅ Subscribed to: ${data.regulationIds.join(', ')}`);
    });

    // Connect client
    await client.connect();

    // Subscribe to REG-66
    console.log('\n3️⃣ Subscribing to REG-66...');
    client.subscribeToRegulations(['REG-66']);

    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate regulation change
    console.log('\n4️⃣ Simulating REG-66 regulation change...');
    const response = await fetch('http://localhost:3003/api/simulate-change/REG-66', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'content_update',
        mockData: {
          section: 'Section 110(2)',
          impact: 'high',
          summary: 'Updated compliance requirements for TEACH Act'
        }
      })
    });

    const result = await response.json();
    console.log('✅ Change simulation triggered:', result.message);

    // Wait for update to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test system status
    console.log('\n5️⃣ Checking system status...');
    const healthResponse = await fetch('http://localhost:3003/health');
    const health = await healthResponse.json();
    console.log('📊 System Status:');
    console.log(`   - Service: ${health.service}`);
    console.log(`   - Status: ${health.status}`);
    console.log(`   - Connected Clients: ${health.details?.pushService?.totalClients || 0}`);

    // Clean up
    console.log('\n6️⃣ Cleaning up...');
    client.disconnect();
    await server.stop();

    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start delivery server: npm run start');
    console.log('   2. Integrate with REG-66 console');
    console.log('   3. Open http://localhost:3050/reg-66-advanced-console.html');
    console.log('   4. Monitor real-time regulation updates');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await server.stop();
    process.exit(1);
  }
}

// Run the test
testDeliverySystem().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
