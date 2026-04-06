/**
 * Sentinel Database Layer
 *
 * Persistence helpers for sentinel_runs, sentinel_signals, and read-back
 * queries used by the dashboard API.
 */

import { query } from '../services/database.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema bootstrap — idempotent, safe to call every startup
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS sentinel_runs (
      id            SERIAL PRIMARY KEY,
      started_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at  TIMESTAMP WITH TIME ZONE,
      scan_type     VARCHAR(30) NOT NULL DEFAULT 'full',
      since_date    DATE NOT NULL,
      regs_scanned  INTEGER NOT NULL DEFAULT 0,
      fr_signals    INTEGER NOT NULL DEFAULT 0,
      ecfr_changes  INTEGER NOT NULL DEFAULT 0,
      state_activity INTEGER NOT NULL DEFAULT 0,
      errors        INTEGER NOT NULL DEFAULT 0,
      status        VARCHAR(20) NOT NULL DEFAULT 'running',
      error_message TEXT,
      metadata      JSONB
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sentinel_signals (
      id              SERIAL PRIMARY KEY,
      run_id          INTEGER NOT NULL REFERENCES sentinel_runs(id) ON DELETE CASCADE,
      regulation_id   INTEGER NOT NULL,
      slug            VARCHAR(200) NOT NULL,
      classification  VARCHAR(20) NOT NULL DEFAULT 'none',
      priority        INTEGER NOT NULL DEFAULT 0,
      reason          TEXT,
      needs_workflow  BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_mode   VARCHAR(20),
      fr_documents    JSONB,
      ecfr_change     JSONB,
      state_bills     JSONB,
      workflow_status VARCHAR(20) DEFAULT 'pending',
      workflow_at     TIMESTAMP WITH TIME ZONE,
      delivery_status VARCHAR(20) DEFAULT 'pending',
      delivered_at    TIMESTAMP WITH TIME ZONE,
      created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes (IF NOT EXISTS requires PG 9.5+)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sentinel_runs_started ON sentinel_runs(started_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_runs_status  ON sentinel_runs(status)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_signals_run      ON sentinel_signals(run_id)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_signals_reg      ON sentinel_signals(regulation_id)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_signals_class    ON sentinel_signals(classification)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_signals_workflow ON sentinel_signals(workflow_status)',
    'CREATE INDEX IF NOT EXISTS idx_sentinel_signals_delivery ON sentinel_signals(delivery_status)',
  ];
  for (const ddl of indexes) {
    await query(ddl);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentinel Runs
// ─────────────────────────────────────────────────────────────────────────────

export async function createRun(sinceDate, scanType = 'full') {
  const result = await query(
    `INSERT INTO sentinel_runs (since_date, scan_type) VALUES ($1, $2) RETURNING id, started_at`,
    [sinceDate, scanType]
  );
  return result.rows[0];
}

export async function completeRun(runId, summary) {
  await query(
    `UPDATE sentinel_runs
     SET completed_at  = NOW(),
         status        = 'completed',
         regs_scanned  = $2,
         fr_signals    = $3,
         ecfr_changes  = $4,
         state_activity = $5,
         errors        = $6,
         metadata      = $7
     WHERE id = $1`,
    [
      runId,
      summary.regulationsScanned || 0,
      summary.frSignals || 0,
      summary.ecfrChanges || 0,
      summary.stateActivity || 0,
      summary.errors || 0,
      JSON.stringify({ durationMs: summary.durationMs, signalCount: summary.signals?.length || 0 }),
    ]
  );
}

export async function failRun(runId, errorMessage) {
  await query(
    `UPDATE sentinel_runs SET completed_at = NOW(), status = 'failed', error_message = $2 WHERE id = $1`,
    [runId, errorMessage]
  );
}

export async function getRecentRuns(limit = 20) {
  const result = await query(
    `SELECT * FROM sentinel_runs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getRunById(runId) {
  const result = await query(`SELECT * FROM sentinel_runs WHERE id = $1`, [runId]);
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentinel Signals
// ─────────────────────────────────────────────────────────────────────────────

export async function insertSignal(runId, classified) {
  const result = await query(
    `INSERT INTO sentinel_signals
       (run_id, regulation_id, slug, classification, priority, reason,
        needs_workflow, delivery_mode, fr_documents, ecfr_change, state_bills)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      runId,
      classified.regulationId,
      classified.slug,
      classified.classification,
      classified.priority,
      classified.reason,
      classified.needsWorkflow,
      classified.deliveryMode,
      JSON.stringify(classified.frDocuments || []),
      JSON.stringify(classified.details?.ecfr || null),
      JSON.stringify(classified.details?.stateBill ? [classified.details.stateBill] : []),
    ]
  );
  return result.rows[0].id;
}

export async function updateSignalWorkflow(signalId, status) {
  await query(
    `UPDATE sentinel_signals SET workflow_status = $2, workflow_at = NOW() WHERE id = $1`,
    [signalId, status]
  );
}

export async function updateSignalDelivery(signalId, status) {
  await query(
    `UPDATE sentinel_signals SET delivery_status = $2, delivered_at = NOW() WHERE id = $1`,
    [signalId, status]
  );
}

export async function getSignalsForRun(runId) {
  const result = await query(
    `SELECT * FROM sentinel_signals WHERE run_id = $1 ORDER BY priority DESC, created_at`,
    [runId]
  );
  return result.rows;
}

export async function getPendingWorkflowSignals(limit = 50) {
  const result = await query(
    `SELECT * FROM sentinel_signals
     WHERE needs_workflow = TRUE AND workflow_status = 'pending'
     ORDER BY priority DESC, created_at
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getPendingDeliverySignals(limit = 50) {
  const result = await query(
    `SELECT * FROM sentinel_signals
     WHERE needs_workflow = TRUE
       AND workflow_status = 'completed'
       AND delivery_status = 'pending'
     ORDER BY priority DESC, created_at
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard aggregations
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM sentinel_runs) AS total_runs,
      (SELECT COUNT(*) FROM sentinel_runs WHERE status = 'completed') AS completed_runs,
      (SELECT started_at FROM sentinel_runs ORDER BY started_at DESC LIMIT 1) AS last_scan,
      (SELECT COUNT(*) FROM sentinel_signals WHERE classification != 'none') AS total_signals,
      (SELECT COUNT(*) FROM sentinel_signals WHERE classification = 'major') AS major_signals,
      (SELECT COUNT(*) FROM sentinel_signals WHERE classification = 'routine') AS routine_signals,
      (SELECT COUNT(*) FROM sentinel_signals WHERE workflow_status = 'pending' AND needs_workflow) AS pending_workflows,
      (SELECT COUNT(*) FROM sentinel_signals WHERE delivery_status = 'pending' AND workflow_status = 'completed') AS pending_deliveries,
      (SELECT COUNT(*) FROM sentinel_signals WHERE delivery_status = 'delivered') AS total_delivered
  `);
  return result.rows[0];
}

export async function getRecentSignals(limit = 50) {
  const result = await query(
    `SELECT ss.*, sr.started_at AS scan_started_at
     FROM sentinel_signals ss
     JOIN sentinel_runs sr ON sr.id = ss.run_id
     WHERE ss.classification != 'none'
     ORDER BY ss.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getSignalsForRegulation(regulationId, limit = 20) {
  const result = await query(
    `SELECT ss.*, sr.started_at AS scan_started_at
     FROM sentinel_signals ss
     JOIN sentinel_runs sr ON sr.id = ss.run_id
     WHERE ss.regulation_id = $1
     ORDER BY ss.created_at DESC
     LIMIT $2`,
    [regulationId, limit]
  );
  return result.rows;
}

export default {
  ensureSchema,
  createRun,
  completeRun,
  failRun,
  getRecentRuns,
  getRunById,
  insertSignal,
  updateSignalWorkflow,
  updateSignalDelivery,
  getSignalsForRun,
  getPendingWorkflowSignals,
  getPendingDeliverySignals,
  getDashboardStats,
  getRecentSignals,
  getSignalsForRegulation,
};
