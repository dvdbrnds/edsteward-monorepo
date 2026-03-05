## EdSteward Cleanup Required After Initial Alignment (January 19, 2026)

### Problem Discovered
After first alignment sync:
- EdSteward had 603 regulations (356 pre-alignment + 251 MCP synced)
- UPSERT didn't match because item_ids were different
- Created duplicates instead of updates

### Solution: Option A - Clean Slate
Delete regulations without L.O.V.V. validation (the pre-alignment data), keep only MCP-synced data.

```sql
DELETE FROM compliance_tasks WHERE regulation_id IN (
  SELECT id FROM regulations WHERE lovv_level IS NULL
);
DELETE FROM regulation_topics WHERE regulation_id IN (
  SELECT id FROM regulations WHERE lovv_level IS NULL
);
DELETE FROM regulations WHERE lovv_level IS NULL;
```

### Ongoing Alignment Scripts Created

**EdSteward:**
- `npm run verify:alignment` - Check alignment status
- API endpoint: `/api/mcp/alignment-status`
- API endpoint: `/api/mcp/regulation-hashes`

**MCP Engine:**
- `npm run verify:alignment` - Verify EdSteward matches MCP
- `npm run align` - Re-sync all regulations
- `npm run auto-align` - Detect drift and auto-resync
- API endpoint: `/api/alignment-status`
- API endpoint: `/api/regulation-hashes`

### Expected Final State
Both systems should have:
- Total: 251 regulations
- Federal: 237
- PA: 8
- NJ: 6
- Topics: 292 mappings
- Tasks: ~1,001