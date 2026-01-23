-- Migration: Add requirement_type field to compliance_tasks
-- Date: 2026-01-22
-- Purpose: Support MCP Engine task categorization (requirement vs best_practice)

-- Add task_id column for unique task identifiers (e.g., GLBA-001, OSHA-005)
ALTER TABLE compliance_tasks 
ADD COLUMN IF NOT EXISTS task_id VARCHAR(50);

-- Add requirement_type column to distinguish legally mandated tasks from best practices
-- Values: 'requirement' (legally mandated) or 'best_practice' (recommended)
ALTER TABLE compliance_tasks 
ADD COLUMN IF NOT EXISTS requirement_type VARCHAR(20) DEFAULT 'requirement';

-- Create index for efficient filtering by requirement type
CREATE INDEX IF NOT EXISTS compliance_tasks_requirement_type_idx 
ON compliance_tasks(requirement_type);

-- Create index for task_id lookups
CREATE INDEX IF NOT EXISTS compliance_tasks_task_id_idx 
ON compliance_tasks(task_id);

-- Update existing tasks to default to 'requirement' if null
UPDATE compliance_tasks 
SET requirement_type = 'requirement' 
WHERE requirement_type IS NULL;

-- Add comment to document the field purpose
COMMENT ON COLUMN compliance_tasks.requirement_type IS 
'Task categorization: requirement = legally mandated (must do), best_practice = recommended (should do)';

COMMENT ON COLUMN compliance_tasks.task_id IS 
'Unique task identifier from MCP Engine (e.g., GLBA-001, COPPA-004)';
