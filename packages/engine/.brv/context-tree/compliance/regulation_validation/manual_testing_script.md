## EdSteward Regulation-by-Regulation Manual Testing Script (January 2026)

Created comprehensive testing methodology for validating each regulation across MCP Engine and EdSteward:

### Testing Approach
- Sequential regulation testing with forward propagation of fixes
- "Copy what works" pattern - improvements from Reg A apply to Reg B, C, D, etc.
- Both sides tested: MCP Engine (backend) + EdSteward (frontend)

### MCP Engine Tests Cover:
1. Database record verification (all fields populated)
2. Registry API responses
3. Validation service (hash verification, source comparison by LOVV level)
4. WebSocket communication
5. Version control and change detection

### EdSteward Tests Cover:
1. Regulation list view (display, sorting, filtering, search)
2. Detail page (all fields, source links, LOVV indicators)
3. Deliverables/tasks (CRUD operations)
4. Assignments (user-regulation and user-deliverable)
5. Compliance status (calculation, history, changes)
6. Evidence & documentation uploads
7. Notes & comments
8. Timeline & audit history
9. MCP update accept/reject workflow
10. Audit trail export

### Data Integrity Verification:
- Field-by-field comparison MCP Engine vs EdSteward
- SHA-256 hash verification between systems

### Recommended Testing Order:
1. TEACH Act (Level A - establishes webscrape pattern)
2. Clery Act (Level D - establishes human review pattern)
3. FERPA (Level B - establishes API pattern)
4. Title IX (Level C - establishes AI pattern)
Then all remaining regulations by LOVV level

### Files Created:
- REGULATION_TESTING_SCRIPT.md - Full test checklist per regulation
- REGULATION_TESTING_TRACKER.md - Progress tracking across all regulations