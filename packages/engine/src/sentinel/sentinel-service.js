// Regulation Sentinel Service
//
// Standalone entry point that orchestrates the full automated
// change-detection and delivery pipeline on a cron schedule.
//
// Default schedule:
//   - Full source scan   -> every 6 hours  (0 0,6,12,18 * * *)
//   - FR quick check     -> every hour     (0 * * * *)
//   - Process workflows  -> every 30 min   (0,30 * * * *)
//   - Process deliveries -> every 15 min   (0,15,30,45 * * * *)
//
// Can also be run as a one-shot via: node sentinel-service.js --once
//
// Environment variables:
//   SENTINEL_ENABLED          - set to "false" to disable cron (default: true)
//   SENTINEL_FULL_SCAN_CRON   - cron expression for full scan
//   SENTINEL_FR_CRON          - cron expression for FR-only check
//   SENTINEL_WORKFLOW_CRON    - cron expression for workflow processing
//   SENTINEL_DELIVERY_CRON    - cron expression for delivery processing
//   SENTINEL_LOOKBACK_DAYS    - how many days to look back for FR docs (default: 7)

import cron from 'node-cron';
import { ensureSchema, createRun, completeRun, failRun, insertSignal } from './sentinel-db.js';
import { runFullScan } from './source-scanner.js';
import { classifyAll } from './change-classifier.js';
import { processPendingWorkflows } from './workflow-executor.js';
import { processPendingDeliveries } from './auto-delivery.js';

const ENABLED = (process.env.SENTINEL_ENABLED || 'true') !== 'false';
const FULL_SCAN_CRON  = process.env.SENTINEL_FULL_SCAN_CRON  || '0 */6 * * *';
const FR_CRON         = process.env.SENTINEL_FR_CRON          || '0 * * * *';
const WORKFLOW_CRON   = process.env.SENTINEL_WORKFLOW_CRON    || '*/30 * * * *';
const DELIVERY_CRON   = process.env.SENTINEL_DELIVERY_CRON    || '*/15 * * * *';
const LOOKBACK_DAYS   = parseInt(process.env.SENTINEL_LOOKBACK_DAYS || '7', 10);

let isRunningFullScan = false;
let isRunningWorkflows = false;
let isRunningDeliveries = false;

function sinceDate(days = LOOKBACK_DAYS) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Execute a full scan → classify → persist signals.
 */
export async function executeFullScan(scanType = 'full') {
  if (isRunningFullScan) {
    console.log('[Sentinel] Full scan already in progress, skipping.');
    return null;
  }

  isRunningFullScan = true;
  const since = sinceDate();
  let run;

  try {
    await ensureSchema();
    run = await createRun(since, scanType);
    console.log(`[Sentinel] Starting ${scanType} scan (run #${run.id}, since ${since})...`);

    const summary = await runFullScan({ sinceDate: since, concurrency: 5 });
    const classified = classifyAll(summary.signals);

    for (const item of classified.all) {
      if (item.classification !== 'none') {
        await insertSignal(run.id, item);
      }
    }

    await completeRun(run.id, summary);
    console.log(`[Sentinel] Scan #${run.id} complete — ${classified.actionable.length} actionable, ${classified.informational.length} informational`);
    return summary;
  } catch (err) {
    console.error(`[Sentinel] Scan failed: ${err.message}`);
    if (run) await failRun(run.id, err.message).catch(() => {});
    return null;
  } finally {
    isRunningFullScan = false;
  }
}

/**
 * Process all pending workflows.
 */
export async function runWorkflows() {
  if (isRunningWorkflows) return;
  isRunningWorkflows = true;
  try {
    await processPendingWorkflows();
  } catch (err) {
    console.error(`[Sentinel] Workflow processing error: ${err.message}`);
  } finally {
    isRunningWorkflows = false;
  }
}

/**
 * Process all pending deliveries.
 */
export async function runDeliveries() {
  if (isRunningDeliveries) return;
  isRunningDeliveries = true;
  try {
    await processPendingDeliveries();
  } catch (err) {
    console.error(`[Sentinel] Delivery processing error: ${err.message}`);
  } finally {
    isRunningDeliveries = false;
  }
}

/**
 * Start all cron schedules.
 */
export function startScheduler() {
  if (!ENABLED) {
    console.log('[Sentinel] Scheduler disabled via SENTINEL_ENABLED=false');
    return;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  REGULATION SENTINEL — Scheduler Started');
  console.log(`  Full scan:  ${FULL_SCAN_CRON}`);
  console.log(`  FR check:   ${FR_CRON}`);
  console.log(`  Workflows:  ${WORKFLOW_CRON}`);
  console.log(`  Deliveries: ${DELIVERY_CRON}`);
  console.log(`${'═'.repeat(60)}\n`);

  cron.schedule(FULL_SCAN_CRON, () => {
    console.log('[Sentinel] Cron: full source scan');
    executeFullScan('full');
  });

  cron.schedule(FR_CRON, () => {
    console.log('[Sentinel] Cron: Federal Register quick check');
    executeFullScan('fr_only');
  });

  cron.schedule(WORKFLOW_CRON, () => {
    console.log('[Sentinel] Cron: processing workflows');
    runWorkflows();
  });

  cron.schedule(DELIVERY_CRON, () => {
    console.log('[Sentinel] Cron: processing deliveries');
    runDeliveries();
  });
}

/**
 * Run a single pass of the full pipeline (scan → workflows → deliveries).
 */
export async function runOnce() {
  console.log('[Sentinel] Running one-shot pipeline...');
  await ensureSchema();
  await executeFullScan('manual');
  await runWorkflows();
  await runDeliveries();
  console.log('[Sentinel] One-shot complete.');
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('sentinel-service.js') ||
  process.argv[1].endsWith('sentinel-service')
);

if (isDirectRun) {
  const once = process.argv.includes('--once');

  if (once) {
    runOnce().then(() => process.exit(0)).catch(err => {
      console.error('[Sentinel] Fatal:', err);
      process.exit(1);
    });
  } else {
    ensureSchema()
      .then(() => startScheduler())
      .catch(err => {
        console.error('[Sentinel] Schema init failed:', err);
        process.exit(1);
      });

    // Keep alive
    process.stdin.resume();

    process.on('SIGINT', () => {
      console.log('\n[Sentinel] Shutting down...');
      process.exit(0);
    });
  }
}

export default { executeFullScan, runWorkflows, runDeliveries, startScheduler, runOnce };
