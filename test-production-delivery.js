#!/usr/bin/env node
/**
 * Test delivery to EdSteward Production (Moravian)
 */

import { EdStewardIntegration } from './src/delivery-system/edsteward-integration.js';

async function testProduction() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 EdSteward PRODUCTION (Moravian) Delivery Test');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const edsteward = new EdStewardIntegration({
    environment: 'production'  // Uses moravian.edsteward.ai
  });

  // Health check
  console.log('📋 Step 1: Health Check');
  console.log('─────────────────────────────────────────────────────────────');
  const health = await edsteward.testConnection();
  console.log(`   URL: https://moravian.edsteward.ai`);
  console.log(`   Status: ${health.success ? '✅ Connected' : '❌ Failed'}`);
  
  if (health.health) {
    console.log(`   Database: ${health.health.database || 'unknown'}`);
    console.log(`   Bulk Import: ${health.health.bulkImportEnabled}`);
    console.log(`   Pending Updates: ${health.health.pendingUpdates || 0}`);
  }
  
  if (!health.success) {
    console.log(`\n   Error: ${health.error}`);
    return;
  }

  console.log('\n📋 Step 2: Ready to deliver regulations');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('   Production endpoint is ready!');
  console.log('   Run with --send flag to actually deliver ADA regulation');
  console.log('');
  console.log('   Example: node test-production-delivery.js --send');

  // Only send if --send flag provided
  if (process.argv.includes('--send')) {
    console.log('\n📋 Step 3: Sending ADA Regulation');
    console.log('─────────────────────────────────────────────────────────────');
    
    const adaUpdate = {
      regulationId: 'americans-with-disabilities-act-of-1990',
      data: {
        after: {
          fullText: 'The Americans with Disabilities Act of 1990 (42 U.S.C. § 12101 et seq.) prohibits discrimination against individuals with disabilities in all areas of public life, including jobs, schools, transportation, and all public and private places that are open to the general public.',
          summary: 'Prohibits discrimination based on disability in employment, public services, and accommodations.',
          requirements: ['Provide reasonable accommodations', 'Maintain accessible facilities', 'Publish non-discrimination policy', 'Designate ADA coordinator']
        }
      }
    };

    console.log('   Sending ADA regulation with 9 compliance tasks...');
    const result = await edsteward.sendRegulationUpdate(adaUpdate);
    
    if (result.success) {
      console.log('   ✅ Delivery successful!');
      console.log(`   Update ID: ${result.updateId}`);
      console.log(`   Regulation ID: ${result.regulationId}`);
      console.log('\n   📋 Check EdSteward UI: https://moravian.edsteward.ai');
      console.log('      → Pending Updates → ADA → Apply Tasks');
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

testProduction().catch(console.error);
