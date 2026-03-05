## EdSteward MCP Alignment Cleanup - January 19, 2026

### Cleanup Completed
- Removed 352 pre-alignment regulations (without L.O.V.V. validation)
- Kept 251 MCP-validated regulations (237 federal, 8 PA, 6 NJ)
- Cleaned dependent data: 106 tasks, attestation tokens, audit logs, notifications, regulation updates/versions

### Foreign Key Cascade Order
When deleting regulations, must delete in this order to handle FK constraints:
1. task_activity, task_evidence → compliance_tasks
2. attestation_tokens, audit_logs, notification_queue
3. regulation_topics, regulation_updates, regulation_versions
4. sync_control, validation_status, version_conflicts
5. regulations (handle self-referencing previous_version_id first)

### New MCP Integration Endpoints
```
GET /api/mcp/alignment-status - Returns alignment verification stats
GET /api/mcp/regulation-hashes - Returns item_id + version_hash for diff checking
```
Both use Basic Auth (dvdbrnds:gabadh)

### Verification Commands
```bash
npm run verify:alignment  # CLI verification
SELECT * FROM alignment_status;  # Database view
```

### Database State After Cleanup
- 251 regulations (100% MCP validated)
- L.O.V.V. distribution: A=6, B=201, C=44
- 999 compliance tasks, 292 topic mappings
- Backup tables: regulations_pre_cleanup_backup, compliance_tasks_pre_cleanup_backup

### UI Fix
Changed ID column in regulation-list.tsx from `regulation.itemId` (string) to `regulation.id` (numeric) for clearer display.