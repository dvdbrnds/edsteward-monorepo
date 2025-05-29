-- Export for table: notification_queue
-- Exported on: 2025-05-29T18:37:08.353Z

-- Data for notification_queue
INSERT INTO notification_queue (id, regulation_id, user_id, type, content, status, created_at, sent_at, priority, retry_count, next_retry_at) VALUES (1, 4896, 5, 'sync_complete', '{"message":"Davegulation 1 has been successfully synchronized with MCP","versionId":6,"versionNumber":3}', 'sent', '2025-03-10T18:30:00.000Z', '2025-03-10T18:31:00.000Z', 'normal', 0, NULL);
INSERT INTO notification_queue (id, regulation_id, user_id, type, content, status, created_at, sent_at, priority, retry_count, next_retry_at) VALUES (2, 4897, 5, 'validation_failed', '{"details":"Clarity needed on audit procedure requirements","message":"Validation failed for Davegulation 2 at level C"}', 'pending', '2025-03-16T14:00:00.000Z', NULL, 'high', 0, NULL);
INSERT INTO notification_queue (id, regulation_id, user_id, type, content, status, created_at, sent_at, priority, retry_count, next_retry_at) VALUES (3, 4897, 5, 'version_conflict', '{"message":"Version conflict detected for Davegulation 2","conflictId":1,"conflictCount":2}', 'pending', '2025-03-20T13:30:00.000Z', NULL, 'high', 0, NULL);
INSERT INTO notification_queue (id, regulation_id, user_id, type, content, status, created_at, sent_at, priority, retry_count, next_retry_at) VALUES (4, 4900, 5, 'change_detected', '{"message":"Changes detected for Davegulation 5, sync scheduled","nextSync":"2025-08-10T16:45:00"}', 'pending', '2025-07-10T20:45:00.000Z', NULL, 'normal', 0, NULL);

