-- Migration: Add statutory role fields to compliance_tasks
-- Date: 2026-01-23
-- Purpose: Track legally required roles separately from suggested assignment roles

-- =====================================================
-- Add statutory role fields
-- =====================================================

-- The role legally required by the regulation to perform this task
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS statutory_role TEXT;

-- Legal citation for the statutory requirement
ALTER TABLE compliance_tasks
ADD COLUMN IF NOT EXISTS statutory_citation TEXT;

-- Index for querying tasks by statutory role
CREATE INDEX IF NOT EXISTS compliance_tasks_statutory_role_idx
ON compliance_tasks (statutory_role)
WHERE statutory_role IS NOT NULL;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN compliance_tasks.statutory_role IS 
'Role legally required by regulation to perform this task (e.g., "Title IX Coordinator" per 34 CFR 106.8)';

COMMENT ON COLUMN compliance_tasks.statutory_citation IS 
'Legal citation for the statutory role requirement (e.g., "34 CFR 106.8")';

-- Note: assigned_role remains the suggested default for auto-assignment
-- statutory_role is the LEGAL requirement - they may differ
-- Example: 
--   statutory_role = "Title IX Coordinator" (required by law)
--   assigned_role = "Title IX Coordinator" (suggested default)
--   assigned_to = 5 (actual person assigned - may be the coordinator or delegate)
