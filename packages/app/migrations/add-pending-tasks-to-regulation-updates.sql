-- Migration: Add pending_tasks column to regulation_updates
-- Date: 2026-01-23
-- Purpose: Store compliance tasks from MCP Engine for approval workflow

-- Add pending_tasks column to store tasks that will be applied on approval
ALTER TABLE regulation_updates
ADD COLUMN IF NOT EXISTS pending_tasks JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN regulation_updates.pending_tasks IS
'JSON array of compliance tasks from MCP Engine to be applied when update is approved. 
Each task contains: tempId, parentTempId, taskId, title, description, instructions, 
assignedRole, priority, requirementType, dueDate, evidenceRequired, evidenceType';

-- Create index for querying updates that have pending tasks
CREATE INDEX IF NOT EXISTS regulation_updates_has_pending_tasks_idx
ON regulation_updates ((pending_tasks IS NOT NULL))
WHERE pending_tasks IS NOT NULL;
