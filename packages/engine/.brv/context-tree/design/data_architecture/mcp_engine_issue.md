## CRITICAL: MCP Engine Data Architecture Issue (January 2026)

### The Problem
MCP Engine claims to be the "authoritative source of truth" but appears to be using CSV files instead of a proper database. This is a fundamental architecture flaw that must be resolved before:
- Adding PA/NJ state regulations
- Reliable EdSteward alignment
- Commercial deployment

### Evidence of Issue
- CSV Source: 689 rows
- Enhanced Folder: 241 regulations
- Console Pages: 285 pages
- Registry API serves: 295 regulations only
- PA regulations (13) and NJ regulations (6) exist in enhanced data but NOT in Registry API

### Questions Requiring Answers
1. Is there a PostgreSQL database in MCP Engine?
2. If yes, why isn't it being used?
3. If no, why not?
4. What CSV file feeds the Registry API?
5. Why does 689 CSV rows become 295 in Registry? Where's the filter?
6. How does enhanced data (AI summaries) merge with source data?

### Required Database Schema (if migrating)
Tables needed:
- regulations (main table with all fields)
- regulation_deadlines (separate from JSONB)
- regulation_tasks (separate from JSONB)
- regulation_audit_log (immutable audit trail)
- regulation_versions (version history)

### Priority
This is the #1 blocker for EdSteward alignment. Cannot proceed until data architecture is understood and fixed.