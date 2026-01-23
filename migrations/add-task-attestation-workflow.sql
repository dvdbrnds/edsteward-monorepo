-- Migration: Add task attestation workflow and magic link tokens
-- Date: 2026-01-23
-- Purpose: Enable DRI assignment, attestation workflow, and email-based evidence upload

-- =====================================================
-- 1. Add attestation fields to compliance_tasks
-- =====================================================

-- Attestation timestamp
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS attested_at TIMESTAMP;

-- Who attested (DRI)
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS attested_by INTEGER REFERENCES users(id);

-- Digital signature text
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS attestation_signature TEXT;

-- Optional notes from DRI
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS attestation_notes TEXT;

-- Attestation status: not_required, pending, attested, rejected
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS attestation_status TEXT DEFAULT 'not_required';

-- Index for attestation queries
CREATE INDEX IF NOT EXISTS compliance_tasks_attestation_status_idx
ON compliance_tasks (attestation_status)
WHERE attestation_status IS NOT NULL;

-- =====================================================
-- 2. Create task_attestation_tokens table (magic links)
-- =====================================================

CREATE TABLE IF NOT EXISTS task_attestation_tokens (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES compliance_tasks(id) ON DELETE CASCADE,
  
  -- Token for secure access
  token TEXT NOT NULL UNIQUE,
  
  -- Who the token is for
  email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Token validity
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  
  -- What actions are allowed
  can_upload_evidence BOOLEAN DEFAULT TRUE,
  can_attest BOOLEAN DEFAULT TRUE,
  
  -- Audit trail
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  
  -- Optional message
  personal_message TEXT
);

-- Indexes for token lookups
CREATE INDEX IF NOT EXISTS task_attestation_tokens_token_idx
ON task_attestation_tokens (token);

CREATE INDEX IF NOT EXISTS task_attestation_tokens_task_id_idx
ON task_attestation_tokens (task_id);

CREATE INDEX IF NOT EXISTS task_attestation_tokens_email_idx
ON task_attestation_tokens (email);

-- =====================================================
-- 3. Add activity type for attestation
-- =====================================================

-- Update existing task_activity table to support attestation activities
-- (The column is already text so no migration needed, just document the new types:
--  'attestation_requested', 'attestation_completed', 'attestation_rejected')

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN compliance_tasks.attested_at IS 
'Timestamp when the DRI attested to task completion';

COMMENT ON COLUMN compliance_tasks.attested_by IS 
'User ID of the DRI who attested to completion';

COMMENT ON COLUMN compliance_tasks.attestation_signature IS 
'Digital signature text from DRI attestation';

COMMENT ON COLUMN compliance_tasks.attestation_notes IS 
'Optional notes provided by DRI during attestation';

COMMENT ON COLUMN compliance_tasks.attestation_status IS 
'Attestation workflow status: not_required, pending, attested, rejected';

COMMENT ON TABLE task_attestation_tokens IS 
'Magic link tokens for field compliance officers to attest/upload evidence via email';

COMMENT ON COLUMN task_attestation_tokens.token IS 
'Secure UUID token for magic link access without full authentication';
