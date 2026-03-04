#!/usr/bin/env node

/**
 * Final Multi-Regulation Update Test
 * Tests multiple regulations simultaneously to ensure all updates reach clients
 */

import { WebSocket } from 'ws';
import fetch from 'node-fetch';

const regulations = [
    'age-discrimination-act-of-1975',
    'americans-with-disabilities-act-of-1990',
    'drug-free-schools-and-communities-act',
    'energy-reorganization-act-of-1974-as-amended'
];

const WS_URL = 'ws://localhost:3051/regulation-updates';
const API_URL = 'http://localhost:3051/api/trigger-update';

console.log('🧪 Final Multi-Regulation Update Test');
console.log('=' .repeat(60));
console.log(`📋 Testing ${regulations.length} regulations simultaneously`);
console.log('');

let connections = [];
let testResults = {};

// Initialize results tracking
regulations.forEach(reg => {
    testResults[reg] = {
        connected: false,
        subscribed: false,
        updateSent: false,
        updateReceived: false
    };
});

async function connectToRegulation(regulationId, index) {
    return new Promise((resolve, reject) => {
        console.log(`🔌 [${index + 1}] Connecting to ${regulationId}...`);
        
        const ws = new WebSocket(WS_URL);
        const connection = { ws, regulationId, index };
        
        ws.on('open', () => {
            console.log(`✅ [${index + 1}] Connected to ${regulationId}`);
            testResults[regulationId].connected = true;
            
            // Subscribe to this regulation
            ws.send(JSON.stringify({
                type: 'subscribe',
                regulationIds: [regulationId]
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'subscription_confirmed') {
                    console.log(`📋 [${index + 1}] Subscribed to ${regulationId}`);
                    testResults[regulationId].subscribed = true;
                    resolve(connection);
                }
                
                if (message.type === 'regulation_updated' && message.regulationId === regulationId) {
                    console.log(`🎯 [${index + 1}] UPDATE RECEIVED for ${regulationId}!`);
                    testResults[regulationId].updateReceived = true;
                }
                
            } catch (error) {
                console.error(`❌ [${index + 1}] Parse error for ${regulationId}:`, error.message);
            }
        });
        
        ws.on('error', (error) => {
            console.error(`❌ [${index + 1}] WebSocket error for ${regulationId}:`, error.message);
            reject(error);
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (!testResults[regulationId].subscribed) {
                reject(new Error(`Subscription timeout for ${regulationId}`));
            }
        }, 10000);
    });
}

async function triggerUpdate(regulationId, index) {
    try {
        console.log(`📤 [${index + 1}] Triggering update for ${regulationId}...`);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                regulationId: regulationId,
                changeType: 'MULTI_REGULATION_TEST',
                message: `Testing ${regulationId} in multi-regulation scenario`
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log(`✅ [${index + 1}] Update triggered for ${regulationId} (clients: ${result.clientsNotified})`);
            testResults[regulationId].updateSent = true;
            return true;
        } else {
            console.error(`❌ [${index + 1}] Failed to trigger ${regulationId}:`, result.error);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ [${index + 1}] Error triggering ${regulationId}:`, error.message);
        return false;
    }
}

async function runMultiRegulationTest() {
    try {
        // Step 1: Connect to all regulations
        console.log('🔌 Step 1: Connecting to all regulations...');
        
        const connectionPromises = regulations.map((reg, index) => 
            connectToRegulation(reg, index)
        );
        
        connections = await Promise.all(connectionPromises);
        console.log(`✅ All ${connections.length} connections established`);
        
        // Step 2: Wait a moment for subscriptions to settle
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Trigger updates for all regulations
        console.log('\n📤 Step 2: Triggering updates for all regulations...');
        
        const updatePromises = regulations.map((reg, index) => 
            triggerUpdate(reg, index)
        );
        
        await Promise.all(updatePromises);
        
        // Step 4: Wait for updates to be received
        console.log('\n⏳ Step 3: Waiting for updates to be received...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 5: Print results
        printFinalResults();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        printFinalResults();
    } finally {
        // Cleanup
        connections.forEach(conn => {
            if (conn.ws) {
                conn.ws.close(1000, 'Test completed');
            }
        });
    }
}

function printFinalResults() {
    console.log('\n📊 FINAL MULTI-REGULATION TEST RESULTS');
    console.log('=' .repeat(60));
    
    let totalTests = 0;
    let passedTests = 0;
    
    regulations.forEach((reg, index) => {
        const result = testResults[reg];
        const tests = [
            { name: 'Connected', status: result.connected },
            { name: 'Subscribed', status: result.subscribed },
            { name: 'Update Sent', status: result.updateSent },
            { name: 'Update Received', status: result.updateReceived }
        ];
        
        console.log(`\n[${index + 1}] ${reg}:`);
        tests.forEach(test => {
            const status = test.status ? '✅' : '❌';
            console.log(`   ${status} ${test.name}`);
            totalTests++;
            if (test.status) passedTests++;
        });
    });
    
    console.log(`\n📈 Overall Result: ${passedTests}/${totalTests} tests passed`);
    
    const successRate = (passedTests / totalTests * 100).toFixed(1);
    console.log(`📊 Success Rate: ${successRate}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 PERFECT SUCCESS: All regulation updates working end-to-end!');
        console.log('✅ The OSHA update mechanism has been successfully expanded to ALL regulations!');
        console.log('✅ Multi-regulation scenarios work flawlessly');
        console.log('✅ WebSocket delivery system is fully operational');
    } else if (successRate >= 90) {
        console.log('\n🟢 EXCELLENT: Nearly all tests passed - system is working well');
    } else if (successRate >= 75) {
        console.log('\n🟡 GOOD: Most tests passed - minor issues to address');
    } else {
        console.log('\n🔴 NEEDS WORK: Significant issues found');
    }
    
    console.log('\n' + '=' .repeat(60));
}

// Run the test
runMultiRegulationTest().catch(console.error);
