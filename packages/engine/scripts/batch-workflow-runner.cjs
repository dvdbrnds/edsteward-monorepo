#!/usr/bin/env node
/**
 * Batch Workflow Runner
 * Runs the comprehensive workflow for all non-Gold regulations in reg_key order.
 * Waits between runs to respect rate limits. Logs results as it goes.
 * 
 * Usage:
 *   node scripts/batch-workflow-runner.cjs              # Run all non-Gold
 *   node scripts/batch-workflow-runner.cjs --limit 10   # Run first 10
 *   node scripts/batch-workflow-runner.cjs --start REG-050  # Start from REG-050
 *   node scripts/batch-workflow-runner.cjs --dry-run    # Preview without executing
 */

const REGISTRY_URL = 'http://localhost:3010';
const LLM_URL = 'http://localhost:3004';
const DELAY_BETWEEN_MS = 3000;

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
  const startIdx = args.indexOf('--start');
  const startKey = startIdx >= 0 ? args[startIdx + 1] : null;
  const dryRun = args.includes('--dry-run');

  console.log('═'.repeat(80));
  console.log('  BATCH WORKFLOW RUNNER');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}  Limit: ${limit === Infinity ? 'ALL' : limit}  Start: ${startKey || 'beginning'}`);
  console.log('═'.repeat(80));

  // Fetch all regulations
  const res = await fetch(`${REGISTRY_URL}/api/regulations/all`);
  const data = await res.json();
  if (!data.data) {
    console.error('Failed to load regulations');
    process.exit(1);
  }

  // Sort by reg_key number
  const sorted = data.data
    .filter(r => {
      const lovv = r.lovv_level || r.lovvLevel;
      return lovv !== 'A'; // skip Gold
    })
    .sort((a, b) => {
      const aNum = parseInt((a.reg_key || a.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      const bNum = parseInt((b.reg_key || b.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      return aNum - bNum;
    });

  // Find start position — match by reg_key number (e.g. --start REG-031 or --start 31)
  let startIndex = 0;
  if (startKey) {
    const startNum = parseInt(startKey.replace(/\D/g, ''));
    startIndex = sorted.findIndex(r => {
      const rk = r.reg_key || r.regKey || '';
      const num = parseInt(rk.replace(/\D/g, ''));
      return num >= startNum;
    });
    if (startIndex < 0) {
      console.error(`No regulation found at or after ${startKey}`);
      process.exit(1);
    }
  }

  const toProcess = sorted.slice(startIndex, startIndex + limit);
  console.log(`\nFound ${sorted.length} non-Gold regulations. Processing ${toProcess.length} starting from ${toProcess[0]?.reg_key || toProcess[0]?.regKey}.\n`);

  const results = { success: 0, failed: 0, skipped: 0 };
  const failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const reg = toProcess[i];
    const regKey = reg.reg_key || reg.regKey;
    const slug = reg.regulationId || reg.slug || reg.item_id;
    const name = reg.name || slug;
    const tasksBefore = reg.complianceTasks?.length || reg.tasks?.length || 0;
    
    console.log(`\n[${ i + 1}/${toProcess.length}] ${regKey} — ${name}`);
    console.log(`  Slug: ${slug}`);
    console.log(`  Before: ${tasksBefore} tasks, LOVV ${reg.lovv_level || reg.lovvLevel || '?'}`);

    if (dryRun) {
      console.log('  [DRY RUN] Would execute workflow');
      results.skipped++;
      continue;
    }

    try {
      const startTime = Date.now();
      const wfRes = await fetch(`${LLM_URL}/api/llm/workflow/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regulation: slug, quick: false, saveToDatabase: true })
      });

      const wfData = await wfRes.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (wfData.success) {
        const pkg = wfData.compliancePackage || {};
        const save = wfData.databaseSave || {};
        const tasks = pkg.complianceTasks?.length || 0;
        const deadlines = pkg.filingDeadlines?.length || 0;
        const method = wfData.steps?.taskExtraction?.data?.analysis?.method || '?';
        
        console.log(`  ✅ Success (${duration}s) — ${tasks} tasks, ${deadlines} deadlines [${method}]`);
        console.log(`  DB: tasks=${save.tasksUpdated || 0}, deadlines=${save.deadlinesUpdated || 0}`);
        results.success++;
      } else {
        console.log(`  ❌ FAILED (${duration}s): ${wfData.error || wfData.message || 'unknown error'}`);
        results.failed++;
        failures.push({ regKey, slug, error: wfData.error || wfData.message });
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}`);
      results.failed++;
      failures.push({ regKey, slug, error: err.message });
    }

    // Delay between runs
    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  BATCH COMPLETE');
  console.log(`  Success: ${results.success}  Failed: ${results.failed}  Skipped: ${results.skipped}`);
  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`    ${f.regKey} (${f.slug}): ${f.error}`));
  }
  console.log('═'.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
