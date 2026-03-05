-- Fix task_activity foreign key constraint to allow cascade delete
-- This ensures that when a compliance_task is deleted, its activity records are also removed
-- instead of blocking the delete with a foreign key violation

-- Drop the existing constraint
ALTER TABLE task_activity 
DROP CONSTRAINT IF EXISTS task_activity_task_id_compliance_tasks_id_fk;

-- Re-add with ON DELETE CASCADE
ALTER TABLE task_activity 
ADD CONSTRAINT task_activity_task_id_compliance_tasks_id_fk 
FOREIGN KEY (task_id) 
REFERENCES compliance_tasks(id) 
ON DELETE CASCADE;

-- Also fix task_attestation_tokens if needed (already has CASCADE but verify)
-- ALTER TABLE task_attestation_tokens 
-- DROP CONSTRAINT IF EXISTS task_attestation_tokens_task_id_compliance_tasks_id_fk;
-- 
-- ALTER TABLE task_attestation_tokens 
-- ADD CONSTRAINT task_attestation_tokens_task_id_compliance_tasks_id_fk 
-- FOREIGN KEY (task_id) 
-- REFERENCES compliance_tasks(id) 
-- ON DELETE CASCADE;
