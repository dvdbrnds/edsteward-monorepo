-- Regulation Sentinel — automated change detection persistence
-- Tracks scan runs, per-regulation change signals, and delivery actions.

-- ── Sentinel scan runs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_runs (
  id            SERIAL PRIMARY KEY,
  started_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  TIMESTAMP WITH TIME ZONE,
  scan_type     VARCHAR(30) NOT NULL DEFAULT 'full',   -- 'full' | 'fr_only' | 'manual'
  since_date    DATE NOT NULL,                         -- lookback window start
  regs_scanned  INTEGER NOT NULL DEFAULT 0,
  fr_signals    INTEGER NOT NULL DEFAULT 0,
  ecfr_changes  INTEGER NOT NULL DEFAULT 0,
  state_activity INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'running', -- running | completed | failed
  error_message TEXT,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_sentinel_runs_started ON sentinel_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentinel_runs_status  ON sentinel_runs(status);

-- ── Per-regulation change signals ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_signals (
  id              SERIAL PRIMARY KEY,
  run_id          INTEGER NOT NULL REFERENCES sentinel_runs(id) ON DELETE CASCADE,
  regulation_id   INTEGER NOT NULL,                      -- FK to regulations.id
  slug            VARCHAR(200) NOT NULL,
  classification  VARCHAR(20) NOT NULL DEFAULT 'none',   -- major | routine | informational | watch | none
  priority        INTEGER NOT NULL DEFAULT 0,
  reason          TEXT,
  needs_workflow  BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_mode   VARCHAR(20),                           -- direct_sync | pending_review | NULL
  fr_documents    JSONB,                                 -- array of FR document summaries
  ecfr_change     JSONB,                                 -- { oldHash, newHash, length }
  state_bills     JSONB,                                 -- array of bill summaries
  workflow_status VARCHAR(20) DEFAULT 'pending',         -- pending | running | completed | failed | skipped
  workflow_at     TIMESTAMP WITH TIME ZONE,
  delivery_status VARCHAR(20) DEFAULT 'pending',         -- pending | delivered | failed | skipped
  delivered_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sentinel_signals_run      ON sentinel_signals(run_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_signals_reg      ON sentinel_signals(regulation_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_signals_class    ON sentinel_signals(classification);
CREATE INDEX IF NOT EXISTS idx_sentinel_signals_workflow ON sentinel_signals(workflow_status);
CREATE INDEX IF NOT EXISTS idx_sentinel_signals_delivery ON sentinel_signals(delivery_status);
