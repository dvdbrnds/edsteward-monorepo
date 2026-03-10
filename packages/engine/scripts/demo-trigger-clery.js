#!/usr/bin/env node
/**
 * 🎯 DEMO TRIGGER - Clery Act Update to EdSteward
 * 
 * Run: node scripts/demo-trigger-clery.js
 * 
 * Sends a simulated regulation update that appears as "pending"
 * in EdSteward for the CCO to accept.
 */

const EDSTEWARD_URL = 'https://moravian.edsteward.ai';
const EDSTEWARD_USER = process.env.EDSTEWARD_USER || 'dvdbrnds';
const EDSTEWARD_PASS = process.env.EDSTEWARD_PASSWORD || process.env.EDSTEWARD_PASS;
const AUTH = Buffer.from(`${EDSTEWARD_USER}:${EDSTEWARD_PASS}`).toString('base64');

// Clery Act EdSteward ID = 9 (from existing mapping)
const CLERY_ACT_ID = 9;

async function sendCleryUpdate() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🚨 MCP ENGINE - REGULATION CHANGE DETECTED              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📡 Source: Federal Register API');
  console.log('📋 Regulation: Clery Act (20 U.S.C. § 1092(f))');
  console.log('🔍 Change Type: Amendment - Updated Reporting Requirements\n');
  
  const timestamp = new Date().toISOString();
  
  const payload = {
    regulationId: CLERY_ACT_ID,
    name: "Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act",
    originalContent: "The Clery Act requires institutions to compile and publish an Annual Security Report (ASR) by October 1st each year...",
    updatedContent: `[UPDATED ${new Date().toLocaleDateString()}] The Clery Act requires institutions to compile and publish an Annual Security Report (ASR) by October 1st each year. 

NEW REQUIREMENT (2026): Institutions must now include enhanced data on:
• Dating violence incidents (expanded categories)
• Stalking reports with geographic data
• Emergency notification system testing documentation
• Daily crime log accessibility standards

Amendment published in Federal Register Vol. 91, No. 15, effective July 1, 2026.`,
    status: 'pending',
    summary: "Updated Clery Act reporting requirements effective July 1, 2026. New documentation standards for dating violence, stalking, emergency notifications, and crime log accessibility.",
    requirements: "1. Annual Security Report by October 1\n2. Daily crime log maintenance\n3. Timely warning procedures\n4. Emergency notification testing\n5. NEW: Enhanced dating violence/stalking reporting",
    metadata: {
      mcpEngineId: 'clery-act',
      timestamp: timestamp,
      enhanced: true,
      source: 'MCP_ENGINE_LIVE_DEMO',
      changeDetectedAt: timestamp,
      federalRegisterDoc: 'FR-2026-01-15-12345',
      changeType: 'amendment',
      effectiveDate: '2026-07-01',
      affectedSections: ['668.46(b)', '668.46(c)', '668.46(g)']
    }
  };
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 Transmitting to EdSteward...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ UPDATE DELIVERED SUCCESSFULLY!\n');
      console.log('📊 Status: Pending CCO Review');
      console.log(`🔗 EdSteward: ${EDSTEWARD_URL}/regulations/${CLERY_ACT_ID}`);
      console.log('\n🎯 The update is now waiting in EdSteward for the CCO to accept.\n');
    } else {
      console.log(`❌ Delivery failed: HTTP ${response.status}`);
      console.log('Response:', JSON.stringify(result, null, 2));
    }
    
    return { success: response.ok, status: response.status, result };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run it
sendCleryUpdate().then(result => {
  process.exit(result.success ? 0 : 1);
});
