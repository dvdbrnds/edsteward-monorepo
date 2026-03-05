## Coordinated Cursor IDE Testing Prompts for EdSteward (January 2026)

Created two coordinated system prompts for parallel regulation testing across MCP Engine and EdSteward:

### CURSOR_PROMPT_MCP_ENGINE.md
For MCP Engine backend Cursor instance. Handles:
- Database verification (SQL queries for all fields)
- Registry API testing (curl commands)
- Validation service testing
- WebSocket verification
- Generates "DATA HANDOFF" block to pass to EdSteward

Key sections:
- Phase 1-5 testing protocol with specific commands
- Data handoff template format
- Propagation protocol (Global G-XXX, LOVV-level L[A/B/C/D]-XXX)
- Cumulative fixes log
- Regulation checklist by risk score

### CURSOR_PROMPT_EDSTEWARD.md
For EdSteward frontend Cursor instance. Handles:
- Waits for MCP Engine data handoff
- API integration verification
- 10-phase UI testing (List, Detail, Deliverables, Assignments, Status, Evidence, Notes, Timeline, Audit, MCP Updates)
- Data integrity comparison table
- Generates "REPORT" block back to MCP Engine

Key sections:
- Phase 1-10 testing protocol with test tables
- Key file locations for fixes
- Field mapping issue identification
- Propagation protocol (Global EG-XXX, Category EC-[CAT]-XXX)

### PARALLEL_TESTING_GUIDE.md
Coordination instructions:
1. MCP Engine starts, runs phases 1-4
2. MCP Engine generates DATA HANDOFF block
3. User copies block to EdSteward Cursor
4. EdSteward runs phases 1-10
5. EdSteward generates REPORT block
6. User copies back if MCP fixes needed
7. Both update cumulative logs
8. Move to next regulation

Communication format uses bordered blocks:
- MCP→EdSteward: "MCP ENGINE → EDSTEWARD DATA HANDOFF"
- EdSteward→MCP: "EDSTEWARD → MCP ENGINE REPORT"
- Quick messages: "📤 TO [PARTNER]" format