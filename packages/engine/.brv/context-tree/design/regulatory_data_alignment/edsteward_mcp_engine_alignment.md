## EdSteward ↔ MCP Engine Alignment System (January 2026)

Complete 5-prompt system for establishing baseline data alignment between MCP Engine (authoritative source) and EdSteward (client).

### Architecture Understanding

MCP Engine is the SINGLE SOURCE OF TRUTH:
- 355+ regulations, each with its own MCP
- Gathers data from authoritative sources (eCFR, Federal Register, Cornell LII)
- Interprets regulation content
- Extracts deadlines and tasks
- Certifies via L.O.V.V. framework (A/B/C/D levels)
- Transmits to EdSteward clients

EdSteward is the CLIENT/CONSUMER:
- Receives processed regulation data
- Displays to compliance officers
- Manages attestation workflows
- Should faithfully reflect MCP Engine data

### 5-Prompt Alignment System

**Prompt 1: MCP Engine Full Regulation Audit**
- Audits all 355+ regulations for completeness
- Checks: identity fields, legal references, content, compliance fields, metadata
- Validates deadlines and tasks are properly structured
- Outputs: Audit report with completeness scores and issues

**Prompt 2: Schema Alignment Verification**
- Maps MCP Engine fields to EdSteward columns
- Identifies missing columns, type mismatches, naming differences
- Outputs: Field mapping table and required migrations

**Prompt 3: Deadline & Task Extraction Audit**
- Verifies all deadlines extracted from regulation text
- Checks task-to-deadline linkages
- Prioritizes high-stakes regulations (Clery, Title IX, FERPA)
- Outputs: Deadline verification report

**Prompt 4: Data Transformation & Transmission Mapping**
- Defines field rename rules (camelCase → snake_case)
- Defines type transforms (arrays → JSONB)
- Defines transmission payload structure with checksums
- Outputs: Transformation code and validation rules

**Prompt 5: Execute Full Alignment**
- Backup EdSteward current state
- Apply schema migrations
- Execute FULL_REPLACE or INCREMENTAL sync
- Verify counts and hashes match
- Outputs: Alignment report with verification results

### Critical Fields Every Regulation Must Have

Required fields: itemId, name, statute, summary (100+ chars), textContent (500+ chars), lovvLevel, deadlines[], tasks[]

### High-Stakes Regulations (Must Be Perfect)

1. Clery Act - Oct 1 ASR deadline
2. Title IX - 60-day investigation timeline
3. FERPA - Annual notification, 45-day response
4. Drug-Free Schools - Biennial review
5. IPEDS - Multiple federal deadlines
6. Title IV Financial Aid - Strict deadlines

### Success Criteria

All must be true:
- Regulation counts match 100%
- Deadline counts match 100%
- Task counts match 100%
- Global hash matches
- Critical regulations verified
- Zero alignment errors
- UI displays correctly

### Execution Timeline

Week 1: Run Prompts 1-3 (audit), fix issues
Week 2: Run Prompts 4-5 (transform, execute), verify