-- Export for table: version_conflicts
-- Exported on: 2025-05-29T18:37:08.637Z

-- Data for version_conflicts
INSERT INTO version_conflicts (id, regulation_id, local_version_id, remote_version_id, conflicts, status, resolution_method, resolved_at, resolved_by, created_at) VALUES (1, 4897, 8, 'MCP-V3-REG4897', '[{"field":"requirements","localValue":"- Implement data encryption for all PII\n- Obtain explicit consent for data collection\n- Establish data retention policies\n- **NEW**: Conduct annual data privacy audit","remoteValue":"- Implement data encryption for all PII\n- Obtain explicit consent for data collection\n- Establish data retention policies\n- **NEW**: Conduct bi-annual data privacy audit\n- **NEW**: Implement breach notification procedure","resolutionStrategy":"manual"},{"field":"compliance_deadline","localValue":"Initial assessment: 5/15/2025\nFull compliance: 11/30/2025","remoteValue":"Initial assessment: 5/15/2025\nFull compliance: 10/31/2025\nAudit submission: 12/15/2025","resolutionStrategy":"remote"}]', 'pending', NULL, NULL, NULL, '2025-03-20T04:00:00.000Z');

