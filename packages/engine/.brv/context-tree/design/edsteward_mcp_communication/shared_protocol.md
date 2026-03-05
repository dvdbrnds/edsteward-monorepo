## EdSteward ↔ MCP Engine Shared Communication Protocol (January 2026)

Created SHARED_PROTOCOL.md defining exact communication formats between Cursor instances:

### Message Types

**1. DATA_HANDOFF (MCP → EdSteward)**
Structured block with: timestamp, MCP_STATUS, DATABASE_RECORD (all fields), API_FIELDS, WEBSOCKET_FIELDS, VALIDATION_RESULT, ISSUES_FOUND, FIXES_APPLIED, FIELD_MAP_NOTES

**2. FRONTEND_REPORT (EdSteward → MCP)**
Structured block with: timestamp, OVERALL_STATUS, DATA_INTEGRITY comparison, TEST_RESULTS (10 categories), BACKEND_FIXES_NEEDED, FRONTEND_FIXES_APPLIED, FIELD_MAPPING_CHANGES

**3. QUICK_MSG (Either direction)**
For quick questions: FROM, TO, message, ACTION_NEEDED, BLOCKING flags

**4. FIX_PROPAGATION (Either direction)**
Announces fixes: FIX_ID, ORIGIN, SCOPE (GLOBAL/LOVV/CATEGORY/SPECIFIC), FILES_CHANGED, APPLY_TO, VERIFIED

### Fix ID Format
- MCP Global: MG-### (e.g., MG-001)
- MCP LOVV-Level: ML[A-D]-### (e.g., MLA-001)
- MCP Category: MC-###
- MCP Regulation-Specific: MR-###
- EdSteward Global: EG-###
- EdSteward LOVV-Level: EL[A-D]-###
- EdSteward Category: EC-###
- EdSteward Regulation-Specific: ER-###

### Severity Levels
- [S1] CRITICAL - Blocks testing
- [S2] HIGH - Fix before moving on
- [S3] MEDIUM - Should fix, can proceed
- [S4] LOW - Minor, document for later

### Status Codes
MCP_STATUS: READY | BLOCKED | PARTIAL
OVERALL_STATUS: PASS | FAIL | PARTIAL
TEST_RESULTS: PASS | FAIL | SKIP

### Workflow State Machine
START → MCP Testing → MCP_STATUS check → DATA_HANDOFF → ES Testing → BACKEND_FIXES check → FRONTEND_REPORT → PROPAGATE FIXES → COMPLETE

Both prompts (CURSOR_PROMPT_MCP_ENGINE.md and CURSOR_PROMPT_EDSTEWARD.md) now reference this shared protocol.