-- EdSteward: Export Shared Data for New Tenant Template
-- This exports PUBLIC/SHARED data that all tenants need
-- Run against the Moravian (source) database

-- ============================================
-- REGULATIONS (Public regulatory data from MCP)
-- ============================================
\copy (SELECT * FROM regulations) TO '/tmp/edsteward_regulations.csv' WITH CSV HEADER;

-- ============================================
-- REGULATION UPDATES (Pending MCP updates)
-- ============================================
\copy (SELECT * FROM regulation_updates) TO '/tmp/edsteward_regulation_updates.csv' WITH CSV HEADER;

-- ============================================
-- REGULATION VERSIONS (Version history)
-- ============================================
\copy (SELECT * FROM regulation_versions) TO '/tmp/edsteward_regulation_versions.csv' WITH CSV HEADER;

-- ============================================
-- VALIDATION STATUS
-- ============================================
\copy (SELECT * FROM validation_status) TO '/tmp/edsteward_validation_status.csv' WITH CSV HEADER;

-- ============================================
-- SYNC CONTROL (MCP sync config)
-- ============================================
\copy (SELECT * FROM sync_control) TO '/tmp/edsteward_sync_control.csv' WITH CSV HEADER;

-- ============================================
-- VERSION CONFLICTS
-- ============================================
\copy (SELECT * FROM version_conflicts) TO '/tmp/edsteward_version_conflicts.csv' WITH CSV HEADER;

-- ============================================
-- GUIDES (Compliance guides)
-- ============================================
\copy (SELECT * FROM guides) TO '/tmp/edsteward_guides.csv' WITH CSV HEADER;

-- ============================================
-- DEADLINES (Base deadlines from MCP)
-- ============================================
\copy (SELECT * FROM deadlines) TO '/tmp/edsteward_deadlines.csv' WITH CSV HEADER;

-- ============================================
-- COMPLIANCE TASK TEMPLATES
-- Export tasks that are templates (not assigned to specific users)
-- These have assignedTo IS NULL or are parent tasks
-- ============================================
\copy (
  SELECT * FROM compliance_tasks 
  WHERE assigned_to IS NULL 
     OR parent_task_id IS NULL
) TO '/tmp/edsteward_compliance_task_templates.csv' WITH CSV HEADER;

-- Output summary
SELECT 'regulations' as table_name, COUNT(*) as row_count FROM regulations
UNION ALL SELECT 'regulation_updates', COUNT(*) FROM regulation_updates
UNION ALL SELECT 'regulation_versions', COUNT(*) FROM regulation_versions
UNION ALL SELECT 'validation_status', COUNT(*) FROM validation_status
UNION ALL SELECT 'sync_control', COUNT(*) FROM sync_control
UNION ALL SELECT 'version_conflicts', COUNT(*) FROM version_conflicts
UNION ALL SELECT 'guides', COUNT(*) FROM guides
UNION ALL SELECT 'deadlines', COUNT(*) FROM deadlines
UNION ALL SELECT 'compliance_tasks (templates)', COUNT(*) FROM compliance_tasks WHERE assigned_to IS NULL OR parent_task_id IS NULL;

