/**
 * Automated Workflow Executor
 *
 * Processes actionable sentinel signals by triggering the existing
 * comprehensive workflow on the LLM Gateway. Includes:
 *   - Concurrency limiting (avoid burning through Anthropic quota)
 *   - Cooldown between batches
 *   - Per-signal status tracking in sentinel_signals table
 */

import {
  getPendingWorkflowSignals,
  updateSignalWorkflow,
} from './sentinel-db.js';

const LLM_GATEWAY = process.env.LLM_GATEWAY_URL || 'http://localhost:3004';
const DEFAULT_CONCURRENCY = parseInt(process.env.SENTINEL_WORKFLOW_CONCURRENCY || '3', 10);
const COOLDOWN_MS = parseInt(process.env.SENTINEL_WORKFLOW_COOLDOWN_MS || '10000', 10);

/**
 * Execute the LLM Gateway comprehensive workflow for a single regulation slug.
 *
 * @param {string} slug
 * @param {object} options - { quick, saveToDatabase }
 * @returns {Promise<object>} - Workflow result
 */
async function executeWorkflow(slug, options = {}) {
  const quick = options.quick ?? false;
  const saveToDatabase = options.saveToDatabase ?? true;

  const url = `${LLM_GATEWAY}/api/llm/workflow/execute`;
  console.log(`[Sentinel:Workflow] Running ${quick ? 'quick' : 'comprehensive'} workflow for ${slug}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regulation: slug, quick, saveToDatabase }),
    signal: AbortSignal.timeout(180000), // 3 min timeout per workflow
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Workflow HTTP ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Process all pending workflow signals in priority order.
 *
 * @param {object} options
 * @param {number} options.concurrency - Max parallel workflows (default 3)
 * @param {number} options.limit       - Max signals to process in one pass
 * @param {boolean} options.quickMode  - Use quick workflow (cheaper, less thorough)
 * @returns {Promise<{processed: number, succeeded: number, failed: number}>}
 */
export async function processPendingWorkflows(options = {}) {
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const limit = options.limit || 50;
  const quickMode = options.quickMode || false;

  const pending = await getPendingWorkflowSignals(limit);
  if (pending.length === 0) {
    console.log('[Sentinel:Workflow] No pending workflows.');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`[Sentinel:Workflow] Processing ${pending.length} pending workflows (concurrency: ${concurrency})...`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (signal) => {
        await updateSignalWorkflow(signal.id, 'running');

        try {
          const result = await executeWorkflow(signal.slug, { quick: quickMode });
          await updateSignalWorkflow(signal.id, 'completed');
          console.log(`[Sentinel:Workflow] ✅ ${signal.slug} completed (${result.duration || 'n/a'})`);
          return result;
        } catch (err) {
          await updateSignalWorkflow(signal.id, 'failed');
          console.error(`[Sentinel:Workflow] ❌ ${signal.slug} failed: ${err.message}`);
          throw err;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') succeeded++;
      else failed++;
    }

    // Cooldown between batches
    if (i + concurrency < pending.length) {
      console.log(`[Sentinel:Workflow] Cooldown ${COOLDOWN_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, COOLDOWN_MS));
    }
  }

  console.log(`[Sentinel:Workflow] Done — ${succeeded} succeeded, ${failed} failed out of ${pending.length}`);
  return { processed: pending.length, succeeded, failed };
}

/**
 * Execute a single workflow for a specific signal id (manual trigger from dashboard).
 */
export async function executeSignalWorkflow(signalId, options = {}) {
  const result = await import('./sentinel-db.js').then(db =>
    db.default.getPendingWorkflowSignals(1000)
  );
  const signal = result.find(s => s.id === signalId);
  if (!signal) {
    // Try direct lookup — signal may already be marked as something other than pending
    const { query: dbQuery } = await import('../services/database.js');
    const row = await dbQuery('SELECT * FROM sentinel_signals WHERE id = $1', [signalId]);
    if (!row.rows[0]) throw new Error(`Signal ${signalId} not found`);
    const sig = row.rows[0];

    await updateSignalWorkflow(signalId, 'running');
    try {
      const workflowResult = await executeWorkflow(sig.slug, { quick: options.quick || false });
      await updateSignalWorkflow(signalId, 'completed');
      return workflowResult;
    } catch (err) {
      await updateSignalWorkflow(signalId, 'failed');
      throw err;
    }
  }

  await updateSignalWorkflow(signalId, 'running');
  try {
    const workflowResult = await executeWorkflow(signal.slug, { quick: options.quick || false });
    await updateSignalWorkflow(signalId, 'completed');
    return workflowResult;
  } catch (err) {
    await updateSignalWorkflow(signalId, 'failed');
    throw err;
  }
}

export default { processPendingWorkflows, executeSignalWorkflow, executeWorkflow };
