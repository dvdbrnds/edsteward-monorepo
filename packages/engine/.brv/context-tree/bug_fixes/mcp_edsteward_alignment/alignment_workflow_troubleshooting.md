## MCP ↔ EdSteward Ongoing Alignment Workflow

### Verification Workflow
```
┌─────────────────┐
│   MCP Engine    │
│  (251 regs)     │
└────────┬────────┘
         │
    npm run verify:alignment
         │
         ▼
    ┌────────────┐
    │  Aligned?  │
    └─────┬──────┘
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    ▼           ▼
  Done    npm run align
                │
                ▼
         Re-verify
```

### Common Issues & Fixes

**Issue: "Cannot reach EdSteward"**
- Check EdSteward is running
- Verify EDSTEWARD_URL environment variable
- Test: `curl http://localhost:5000/api/health`

**Issue: Rate limiting during sync**
- Disable rate limiting in dev: set in EdSteward config
- Add delays between requests in alignment script

**Issue: Duplicate regulations after sync**
- item_id mismatch between systems
- Solution: Delete WHERE lovv_level IS NULL (keep only MCP data)

**Issue: Alignment endpoints missing**
- Add GET /api/mcp/alignment-status
- Add GET /api/mcp/regulation-hashes
- See EDSTEWARD-ADD-ALIGNMENT-ENDPOINTS.md

### Environment Variables

**MCP Engine:**
```bash
MCP_DB_HOST=localhost
MCP_DB_PORT=5432
MCP_DB_NAME=mcp_engine
MCP_DB_USER=mcp_admin
MCP_DB_PASSWORD=McpEngine2026!Secure
EDSTEWARD_URL=http://localhost:5000
```

**EdSteward:**
- Basic Auth: gabadhgabadh
- API base: /api/mcp/