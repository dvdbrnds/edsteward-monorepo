-- Export for table: sync_control
-- Exported on: 2025-05-29T18:37:08.069Z

-- Data for sync_control
INSERT INTO sync_control (id, regulation_id, last_sync_attempt, last_successful_sync, sync_errors, next_scheduled_sync, sync_state, sync_settings, created_at, updated_at) VALUES (1, 4896, '2025-03-10T18:30:00.000Z', '2025-03-10T18:30:00.000Z', NULL, '2025-04-10T18:30:00.000Z', 'completed', '{"priority":"high","frequency":"daily","includeContent":true,"validateOnSync":true}', '2025-01-15T05:00:00.000Z', '2025-03-10T04:00:00.000Z');
INSERT INTO sync_control (id, regulation_id, last_sync_attempt, last_successful_sync, sync_errors, next_scheduled_sync, sync_state, sync_settings, created_at, updated_at) VALUES (2, 4897, '2025-03-15T14:15:00.000Z', '2025-02-10T14:00:00.000Z', '[{"code":"ERR_NETWORK","message":"Network timeout during sync","timestamp":"2025-03-15T10:15:00"}]', '2025-03-16T14:15:00.000Z', 'failed', '{"priority":"normal","frequency":"daily","includeContent":true,"validateOnSync":true}', '2025-02-10T05:00:00.000Z', '2025-03-15T04:00:00.000Z');
INSERT INTO sync_control (id, regulation_id, last_sync_attempt, last_successful_sync, sync_errors, next_scheduled_sync, sync_state, sync_settings, created_at, updated_at) VALUES (3, 4900, '2025-07-10T20:45:00.000Z', '2025-07-10T20:45:00.000Z', NULL, '2025-08-10T20:45:00.000Z', 'idle', '{"priority":"low","frequency":"monthly","includeContent":true,"validateOnSync":true}', '2025-05-01T04:00:00.000Z', '2025-07-10T04:00:00.000Z');

