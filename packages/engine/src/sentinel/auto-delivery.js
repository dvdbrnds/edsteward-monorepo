/**
 * Auto-Delivery Pipeline
 *
 * After the Workflow Executor confirms a real change, this module delivers
 * the update to customer apps using the existing delivery infrastructure:
 *
 *   - Routine / eCFR-only changes → POST /api/send-to-edsteward (direct sync)
 *   - Major / final-rule changes  → POST /api/customers/push   (pending CCO review)
 *
 * Uses the Delivery Server at :3003 as the intermediary — the same paths the
 * console UI already calls.
 */

import {
  getPendingDeliverySignals,
  updateSignalDelivery,
} from './sentinel-db.js';

const DELIVERY_SERVER = process.env.DELIVERY_SERVER_URL || 'http://localhost:3003';

/**
 * Deliver a regulation update through the direct-sync path.
 * Bypasses the CCO review queue — used for routine/minor changes.
 */
async function deliverDirectSync(slug, regKey) {
  const url = `${DELIVERY_SERVER}/api/send-to-edsteward`;
  console.log(`[Sentinel:Delivery] Direct sync for ${slug} → ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regulationSlug: slug, regKey, name: slug }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Direct sync HTTP ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Deliver a regulation update through the customer push path.
 * Goes into the pending CCO review queue — used for major changes.
 *
 * @param {string} slug        - Regulation slug
 * @param {string[]} customerIds - Specific customers, or empty for default
 */
async function deliverPendingReview(slug, customerIds = []) {
  const url = `${DELIVERY_SERVER}/api/customers/push`;
  console.log(`[Sentinel:Delivery] CCO review push for ${slug} → ${url}`);

  const body = { regulationId: slug };
  if (customerIds.length > 0) {
    body.customerIds = customerIds;
  }
  // pushToAll defaults to false in delivery-server; it will use the default customer

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Customer push HTTP ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Process all sentinel signals that have completed workflows but haven't been
 * delivered yet. Routes them based on delivery_mode:
 *   - 'direct_sync'    → deliverDirectSync
 *   - 'pending_review'  → deliverPendingReview
 *
 * @param {object} options
 * @param {number} options.limit - Max signals to deliver in one pass
 * @returns {Promise<{processed: number, delivered: number, failed: number}>}
 */
export async function processPendingDeliveries(options = {}) {
  const limit = options.limit || 50;

  const pending = await getPendingDeliverySignals(limit);
  if (pending.length === 0) {
    console.log('[Sentinel:Delivery] No pending deliveries.');
    return { processed: 0, delivered: 0, failed: 0 };
  }

  console.log(`[Sentinel:Delivery] Delivering ${pending.length} completed signals...`);

  let delivered = 0;
  let failed = 0;

  for (const signal of pending) {
    try {
      if (signal.delivery_mode === 'direct_sync') {
        await deliverDirectSync(signal.slug, signal.slug);
      } else if (signal.delivery_mode === 'pending_review') {
        await deliverPendingReview(signal.slug);
      } else {
        console.warn(`[Sentinel:Delivery] Unknown delivery_mode "${signal.delivery_mode}" for signal ${signal.id}, skipping`);
        await updateSignalDelivery(signal.id, 'skipped');
        continue;
      }

      await updateSignalDelivery(signal.id, 'delivered');
      delivered++;
      console.log(`[Sentinel:Delivery] ✅ ${signal.slug} delivered via ${signal.delivery_mode}`);
    } catch (err) {
      await updateSignalDelivery(signal.id, 'failed');
      failed++;
      console.error(`[Sentinel:Delivery] ❌ ${signal.slug} delivery failed: ${err.message}`);
    }
  }

  console.log(`[Sentinel:Delivery] Done — ${delivered} delivered, ${failed} failed out of ${pending.length}`);
  return { processed: pending.length, delivered, failed };
}

/**
 * Manually deliver a specific signal (dashboard action).
 */
export async function deliverSignal(signalId, mode) {
  const { query: dbQuery } = await import('../services/database.js');
  const result = await dbQuery('SELECT * FROM sentinel_signals WHERE id = $1', [signalId]);
  const signal = result.rows[0];
  if (!signal) throw new Error(`Signal ${signalId} not found`);

  const deliveryMode = mode || signal.delivery_mode || 'pending_review';

  try {
    if (deliveryMode === 'direct_sync') {
      await deliverDirectSync(signal.slug, signal.slug);
    } else {
      await deliverPendingReview(signal.slug);
    }
    await updateSignalDelivery(signalId, 'delivered');
    return { success: true, mode: deliveryMode };
  } catch (err) {
    await updateSignalDelivery(signalId, 'failed');
    throw err;
  }
}

export default { processPendingDeliveries, deliverSignal };
