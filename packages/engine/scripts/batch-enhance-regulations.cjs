#!/usr/bin/env node

/**
 * BATCH REGULATION ENHANCER
 * 
 * Process multiple regulations in parallel for faster enhancement
 * 
 * Features:
 * - Process 5 regulations at a time (parallel)
 * - Progress tracking with ETA
 * - Automatic retries on failure
 * - Quality reporting
 * - Rate limiting for API quotas
 */

const { enhanceRegulation } = require('./enhance-regulation-ai.cjs');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function batchEnhance(regulationIds, tier, options = {}) {
  const {
    batchSize = 5,
    delayBetweenBatches = 5000, // 5 seconds
    saveReport = true
  } = options;

  const report = {
    startTime: new Date().toISOString(),
    tier: tier,
    total: regulationIds.length,
    succeeded: 0,
    failed: 0,
    needsReview: 0,
    averageScore: 0,
    details: []
  };

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║          BATCH REGULATION ENHANCEMENT                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Configuration:`);
  console.log(`   Total regulations: ${regulationIds.length}`);
  console.log(`   Tier: ${tier} (target: ${tier === 1 ? '90+' : tier === 2 ? '85+' : '80+'})`);
  console.log(`   Batch size: ${batchSize} parallel`);
  console.log(`   Delay between batches: ${delayBetweenBatches}ms\n`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const startTime = Date.now();
  let processed = 0;

  // Process in batches
  for (let i = 0; i < regulationIds.length; i += batchSize) {
    const batch = regulationIds.slice(i, Math.min(i + batchSize, regulationIds.length));
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(regulationIds.length / batchSize);

    console.log(`\n📦 BATCH ${batchNum}/${totalBatches} (${batch.length} regulations)\n`);
    console.log('───────────────────────────────────────────────────────────────────\n');

    // Process batch in parallel
    const batchPromises = batch.map(regId => 
      enhanceRegulation(regId, tier)
        .catch(error => ({
          success: false,
          error: error.message,
          regulationId: regId
        }))
    );

    const batchResults = await Promise.all(batchPromises);

    // Track results
    batchResults.forEach((result, idx) => {
      const regId = batch[idx];
      
      if (result.success) {
        report.succeeded++;
        console.log(`   ✅ ${regId}: Score ${result.score}`);
      } else if (result.needsManualReview) {
        report.needsReview++;
        console.log(`   ⚠️  ${regId}: Score ${result.score} - Needs review`);
      } else {
        report.failed++;
        console.log(`   ❌ ${regId}: FAILED - ${result.error}`);
      }

      report.details.push({
        regulationId: regId,
        success: result.success,
        score: result.score || 0,
        needsReview: result.needsManualReview || false,
        error: result.error || null
      });
    });

    processed += batch.length;

    // Progress update
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const rate = processed / elapsed;
    const remaining = (regulationIds.length - processed) / rate;
    const percentComplete = ((processed / regulationIds.length) * 100).toFixed(1);

    console.log('\n───────────────────────────────────────────────────────────────────');
    console.log(`📈 Progress: ${processed}/${regulationIds.length} (${percentComplete}%)`);
    console.log(`   Succeeded: ${report.succeeded} | Needs Review: ${report.needsReview} | Failed: ${report.failed}`);
    console.log(`   Elapsed: ${elapsed}m | Est. Remaining: ${remaining.toFixed(1)}m`);
    console.log('───────────────────────────────────────────────────────────────────\n');

    // Rate limiting between batches (except for last batch)
    if (i + batchSize < regulationIds.length) {
      console.log(`⏸️  Waiting ${delayBetweenBatches/1000}s before next batch...\n`);
      await sleep(delayBetweenBatches);
    }
  }

  // Calculate final statistics
  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const scores = report.details.filter(d => d.score > 0).map(d => d.score);
  report.averageScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : 0;
  report.endTime = new Date().toISOString();
  report.totalTime = parseFloat(totalElapsed);

  // Final report
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 BATCH ENHANCEMENT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`   Total processed: ${processed}`);
  console.log(`   ✅ Succeeded: ${report.succeeded} (${((report.succeeded/processed)*100).toFixed(1)}%)`);
  console.log(`   ⚠️  Needs review: ${report.needsReview} (${((report.needsReview/processed)*100).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${report.failed} (${((report.failed/processed)*100).toFixed(1)}%)`);
  console.log(`   📈 Average score: ${report.averageScore}`);
  console.log(`   ⏱️  Total time: ${totalElapsed} minutes\n`);

  // Save report
  if (saveReport) {
    const reportPath = `batch-enhancement-report-tier${tier}-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`   💾 Report saved to: ${reportPath}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════════\n');

  return report;
}

// CLI interface
if (require.main === module) {
  const tier = parseInt(process.argv[2]) || 1;
  const count = parseInt(process.argv[3]) || 10;
  
  console.log(`Starting batch enhancement: Tier ${tier}, ${count} regulations\n`);
  
  // Load priority candidates from audit
  let candidates = [];
  try {
    const auditReport = JSON.parse(fs.readFileSync('comprehensive-audit-report.json', 'utf8'));
    candidates = auditReport.lowestScoring
      .slice(0, count)
      .map(r => r.slug || r.id);
  } catch (error) {
    console.error('❌ Failed to load audit report');
    console.error('   Run: node audit-all-354-regulations.cjs first');
    process.exit(1);
  }
  
  if (candidates.length === 0) {
    console.error('❌ No candidate regulations found');
    process.exit(1);
  }
  
  console.log(`📋 Selected ${candidates.length} regulations for enhancement:\n`);
  candidates.forEach((reg, i) => {
    console.log(`   ${i+1}. ${reg}`);
  });
  console.log('');
  
  batchEnhance(candidates, tier)
    .then(report => {
      if (report.succeeded > 0) {
        console.log('✅ Batch enhancement completed successfully');
        console.log(`   ${report.succeeded} regulations enhanced`);
        if (report.needsReview > 0) {
          console.log(`   ${report.needsReview} regulations need manual review`);
        }
      } else {
        console.log('⚠️  No regulations were successfully enhanced');
        console.log('   Check the error log and ANTHROPIC_API_KEY configuration');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ FATAL ERROR:', error);
      process.exit(1);
    });
}

module.exports = { batchEnhance };

