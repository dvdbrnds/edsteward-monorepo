#!/usr/bin/env node

/**
 * Test All Regulation Consoles - Verify WebSocket Subscription IDs
 * Ensures all real regulation consoles use correct regulation IDs instead of REG-66
 */

import fetch from 'node-fetch';

console.log('🧪 Testing All Regulation Console WebSocket Subscription IDs');
console.log('=' .repeat(70));

// Real regulations from CSV data
const realRegulations = [
    'age-discrimination-act-of-1975',
    'americans-with-disabilities-act-of-1990', 
    'drug-free-schools-and-communities-act',
    'higher-education-act-institutional-and-financial-assistance-information-for-students',
    'energy-reorganization-act-of-1974-as-amended'
];

async function testRegulationConsole(regulationSlug) {
    try {
        console.log(`\n🔍 Testing: ${regulationSlug}`);
        
        const response = await fetch(`http://localhost:3010/console/${regulationSlug}`);
        
        if (!response.ok) {
            console.log(`   ❌ Console not found (${response.status})`);
            return { slug: regulationSlug, status: 'NOT_FOUND', correctId: false };
        }
        
        const html = await response.text();
        
        // Check if it uses the correct regulation ID in WebSocket subscription
        const subscriptionMatch = html.match(/regulationIds:\s*\['([^']+)'\]/);
        
        if (!subscriptionMatch) {
            console.log(`   ❌ No WebSocket subscription found`);
            return { slug: regulationSlug, status: 'NO_WEBSOCKET', correctId: false };
        }
        
        const subscriptionId = subscriptionMatch[1];
        const isCorrect = subscriptionId === regulationSlug;
        
        if (isCorrect) {
            console.log(`   ✅ Correct subscription ID: ${subscriptionId}`);
        } else {
            console.log(`   ❌ Wrong subscription ID: ${subscriptionId} (expected: ${regulationSlug})`);
        }
        
        // Check if it still has REG-66 hardcoded anywhere
        const hasREG66 = html.includes("'REG-66'") || html.includes('"REG-66"');
        if (hasREG66) {
            console.log(`   ⚠️  Still contains REG-66 references`);
        }
        
        return { 
            slug: regulationSlug, 
            status: 'FOUND', 
            correctId: isCorrect,
            subscriptionId: subscriptionId,
            hasREG66: hasREG66
        };
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { slug: regulationSlug, status: 'ERROR', correctId: false };
    }
}

async function runAllTests() {
    console.log(`📋 Testing ${realRegulations.length} real regulation consoles...\n`);
    
    const results = [];
    
    for (const regulation of realRegulations) {
        const result = await testRegulationConsole(regulation);
        results.push(result);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Print summary
    console.log('\n📊 SUMMARY RESULTS');
    console.log('=' .repeat(70));
    
    const found = results.filter(r => r.status === 'FOUND');
    const correctIds = results.filter(r => r.correctId);
    const withREG66 = results.filter(r => r.hasREG66);
    
    console.log(`📈 Consoles Found: ${found.length}/${realRegulations.length}`);
    console.log(`✅ Correct WebSocket IDs: ${correctIds.length}/${found.length}`);
    console.log(`⚠️  Still have REG-66: ${withREG66.length}/${found.length}`);
    
    if (correctIds.length === found.length && withREG66.length === 0) {
        console.log('\n🎉 SUCCESS: All regulation consoles use correct WebSocket subscription IDs!');
        console.log('✅ The expansion to ALL regulations is working properly');
    } else {
        console.log('\n❌ ISSUES FOUND:');
        
        results.forEach(result => {
            if (result.status === 'FOUND' && !result.correctId) {
                console.log(`   - ${result.slug}: Uses ${result.subscriptionId} instead of ${result.slug}`);
            }
            if (result.hasREG66) {
                console.log(`   - ${result.slug}: Still contains REG-66 references`);
            }
            if (result.status !== 'FOUND') {
                console.log(`   - ${result.slug}: ${result.status}`);
            }
        });
    }
    
    console.log('\n🔧 Next step: Test the static template redirect...');
    
    // Test static template redirect
    console.log('\n🔄 Testing static template redirect...');
    try {
        const staticResponse = await fetch('http://localhost:3050/reg-66-advanced-console.html', {
            redirect: 'manual'
        });
        
        console.log(`📄 Static template response: ${staticResponse.status}`);
        
        if (staticResponse.status === 200) {
            console.log('✅ Static template accessible - redirect should work in browser');
        }
    } catch (error) {
        console.log(`❌ Static template test error: ${error.message}`);
    }
    
    console.log('\n' + '=' .repeat(70));
}

runAllTests().catch(console.error);
