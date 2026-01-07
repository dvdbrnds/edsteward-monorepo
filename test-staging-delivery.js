#!/usr/bin/env node
/**
 * Test delivery to EdSteward Staging
 */

import { EdStewardIntegration } from './src/delivery-system/edsteward-integration.js';

async function testStaging() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 EdSteward STAGING Delivery Test');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const edsteward = new EdStewardIntegration({
    environment: 'staging'  // Uses staging.edsteward.ai
  });

  // Health check
  console.log('📋 Step 1: Health Check');
  console.log('─────────────────────────────────────────────────────────────');
  const health = await edsteward.testConnection();
  console.log(`   URL: https://staging.edsteward.ai`);
  console.log(`   Status: ${health.success ? '✅ Connected' : '❌ Failed - ' + health.error}`);
  
  if (!health.success) {
    console.log('\n⚠️  Cannot connect to staging. Options:');
    console.log('   1. Check if staging.edsteward.ai is running');
    console.log('   2. Verify credentials: dvdbrnds:gabadh');
    console.log('   3. Try production instead: moravian.edsteward.ai');
    return;
  }

  // Send ADA regulation with tasks
  console.log('\n📋 Step 2: Send ADA Regulation');
  console.log('─────────────────────────────────────────────────────────────');
  
  const adaUpdate = {
    regulationId: 'americans-with-disabilities-act-of-1990',
    data: {
      after: {
        fullText: 'The Americans with Disabilities Act of 1990 (42 U.S.C. § 12101 et seq.) prohibits discrimination against individuals with disabilities...',
        summary: 'Prohibits discrimination based on disability in employment, public services, and accommodations.',
        requirements: ['Provide reasonable accommodations', 'Maintain accessible facilities', 'Publish non-discrimination policy', 'Designate ADA coordinator']
      }
    }
  };

  const result = await edsteward.sendRegulationUpdate(adaUpdate);
  
  if (result.success) {
    console.log('   ✅ Delivery successful!');
    console.log(`   Update ID: ${result.updateId}`);
    console.log(`   Tasks sent: 9 ADA compliance tasks`);
    console.log('\n   📋 Next: Check EdSteward staging UI to verify tasks');
  } else {
    console.log(`   ❌ Failed: ${result.error}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

testStaging().catch(console.error);
