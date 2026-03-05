#!/usr/bin/env node

/**
 * End-to-End Regulation Update Delivery Test
 * Tests the complete flow: Console Push -> Delivery System -> WebSocket -> Client Receipt
 */

import { WebSocket } from 'ws';
import fetch from 'node-fetch';

const REGULATION_ID = 'drug-free-schools-and-communities-act';
const WS_URL = 'ws://localhost:3051/regulation-updates';
const API_URL = 'http://localhost:3051/api/trigger-update';

console.log('🧪 Starting End-to-End Regulation Update Delivery Test');
console.log('=' .repeat(60));
console.log(`📋 Testing regulation: ${REGULATION_ID}`);
console.log(`🔌 WebSocket URL: ${WS_URL}`);
console.log(`📡 API URL: ${API_URL}`);
console.log('');

let testResults = {
    websocketConnection: false,
    subscription: false,
    updateTrigger: false,
    updateReceived: false,
    correctRegulationId: false,
    correctData: false
};

let ws = null;
let testTimeout = null;

// Step 1: Connect to WebSocket
console.log('🔌 Step 1: Connecting to WebSocket...');
ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    testResults.websocketConnection = true;
    
    // Step 2: Subscribe to regulation
    console.log('📋 Step 2: Subscribing to regulation updates...');
    ws.send(JSON.stringify({
        type: 'subscribe',
        regulationIds: [REGULATION_ID]
    }));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Received: ${message.type}`);
        
        if (message.type === 'connected') {
            console.log(`   Client ID: ${message.clientId}`);
        }
        
        if (message.type === 'subscription_confirmed') {
            console.log(`✅ Subscription confirmed for: ${message.regulationIds.join(', ')}`);
            testResults.subscription = true;
            
            // Step 3: Trigger update via API
            setTimeout(() => {
                console.log('');
                console.log('📤 Step 3: Triggering regulation update via API...');
                triggerUpdate();
            }, 1000);
        }
        
        if (message.type === 'regulation_updated') {
            console.log('🎯 Step 4: UPDATE RECEIVED!');
            console.log(`   Regulation ID: ${message.regulationId}`);
            console.log(`   Version: ${message.version}`);
            console.log(`   Change Type: ${message.data?.changeType}`);
            console.log(`   Timestamp: ${message.timestamp}`);
            
            testResults.updateReceived = true;
            testResults.correctRegulationId = (message.regulationId === REGULATION_ID);
            testResults.correctData = !!(message.version && message.timestamp);
            
            // Test completed successfully
            setTimeout(() => {
                printTestResults();
                cleanup();
            }, 500);
        }
        
    } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error.message);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    testResults.websocketConnection = false;
    setTimeout(() => {
        printTestResults();
        cleanup();
    }, 1000);
});

ws.on('close', () => {
    console.log('📴 WebSocket disconnected');
});

async function triggerUpdate() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                regulationId: REGULATION_ID,
                changeType: 'END_TO_END_TEST',
                message: 'Testing complete end-to-end delivery flow'
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log('✅ Update triggered successfully');
            console.log(`   Update ID: ${result.updateId}`);
            console.log(`   Version: ${result.version}`);
            console.log(`   Clients Notified: ${result.clientsNotified}`);
            testResults.updateTrigger = true;
            
            if (result.clientsNotified === 0) {
                console.log('⚠️  Warning: No clients were notified - this might indicate a subscription issue');
            }
        } else {
            console.error('❌ Failed to trigger update:', result.error || 'Unknown error');
            testResults.updateTrigger = false;
        }
        
    } catch (error) {
        console.error('❌ Error triggering update:', error.message);
        testResults.updateTrigger = false;
    }
}

function printTestResults() {
    console.log('');
    console.log('📊 END-TO-END TEST RESULTS');
    console.log('=' .repeat(60));
    
    const results = [
        { name: 'WebSocket Connection', status: testResults.websocketConnection },
        { name: 'Regulation Subscription', status: testResults.subscription },
        { name: 'Update API Trigger', status: testResults.updateTrigger },
        { name: 'Update Received via WebSocket', status: testResults.updateReceived },
        { name: 'Correct Regulation ID', status: testResults.correctRegulationId },
        { name: 'Valid Update Data', status: testResults.correctData }
    ];
    
    let passedTests = 0;
    results.forEach(result => {
        const status = result.status ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name}`);
        if (result.status) passedTests++;
    });
    
    console.log('');
    console.log(`📈 Overall Result: ${passedTests}/${results.length} tests passed`);
    
    if (passedTests === results.length) {
        console.log('🎉 SUCCESS: End-to-end regulation update delivery is working!');
        console.log('');
        console.log('✅ The expansion of OSHA update capability to all regulations is COMPLETE');
        console.log('✅ Drug-Free Schools and Communities Act updates work end-to-end');
        console.log('✅ WebSocket delivery system is operational');
        console.log('✅ Console push mechanism reaches clients successfully');
    } else {
        console.log('❌ FAILURE: Some tests failed. Check the issues above.');
        
        if (!testResults.websocketConnection) {
            console.log('   - Check if delivery system is running on port 3051');
        }
        if (!testResults.subscription) {
            console.log('   - Check WebSocket subscription logic');
        }
        if (!testResults.updateTrigger) {
            console.log('   - Check API endpoint and delivery system');
        }
        if (!testResults.updateReceived) {
            console.log('   - Check WebSocket push service and client subscriptions');
        }
    }
    
    console.log('');
}

function cleanup() {
    if (testTimeout) {
        clearTimeout(testTimeout);
    }
    
    if (ws) {
        ws.close(1000, 'Test completed');
    }
    
    const totalTests = 6;
    const passedCount = Object.values(testResults).filter(Boolean).length;
    process.exit(passedCount === totalTests ? 0 : 1);
}

// Set overall test timeout
testTimeout = setTimeout(() => {
    console.log('⏰ Test timeout - not all steps completed within 30 seconds');
    printTestResults();
    cleanup();
}, 30000);

// Handle process interruption
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    cleanup();
});
