## EdSteward Regulation Testing Framework (January 2026)

Created comprehensive regulation-by-regulation testing system with three documents:

### 1. MASTER_REGULATION_TRACKER.md
- All 251 regulations listed in order of Institutional Risk Score (IRS)
- Checkboxes for tracking: Main test, MCP Engine, EdSteward, Data Integrity
- Risk levels: CRITICAL (1), SEVERE (25), HIGH (139), MODERATE (85), LOW (1)
- Cumulative improvements registry for tracking fixes to propagate
- Session logging for tracking testing progress

### 2. REGULATION_TESTING_PROMPTS.md  
- Prompt template for testing any regulation with AI assistance
- Pre-filled prompts for first 26 regulations (CRITICAL + SEVERE)
- Structure: Regulation details → MCP Engine tests → EdSteward tests → Data integrity → Improvements capture
- "PREVIOUS FIXES TO APPLY" section accumulates as testing progresses

### 3. REGULATION_TESTING_SCRIPT.md
- Detailed manual checklist with 100+ individual test items
- MCP Engine: Database, Registry API, Validation, WebSocket, Version Control
- EdSteward: List View, Detail Page, Deliverables, Assignments, Status, Evidence, Notes, Timeline, Audit
- Data integrity verification template
- Quick reference commands for curl, SQL, and wscat

### Testing Order (by risk score)
1. Clery Act/VAWA (96 - CRITICAL)
2-3. Title IX variants (88 - SEVERE)
4. FERPA (85 - SEVERE)
5-26. Remaining SEVERE regulations (72-78)
27-165. HIGH regulations (50-68)
166-250. MODERATE regulations (35-48)
251. LOW regulation (29)

### Key Principle
"Copy what works" - Any fix discovered during Regulation N becomes the template for Regulations N+1 through 251.