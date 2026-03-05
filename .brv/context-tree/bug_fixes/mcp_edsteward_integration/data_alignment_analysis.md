## MCP Engine ↔ EdSteward Alignment Analysis Complete (January 2026)

### Critical Findings

**Missing Required Fields in MCP Engine:**
MCP Engine does NOT send these fields that EdSteward REQUIRES:
- `statute` (legal citation) - REQUIRED
- `category` (classification) - REQUIRED  
- `topic` (subject area) - REQUIRED

**Field Mapping Issues:**
- `regulationId` (int) must become `itemId` (string)
- `updatedContent` must be renamed to `regulationText`
- `filingDeadlines` sent as JSON string, needs to be parsed array

**EdSteward Integration Endpoint:**
```
POST /api/mcp/regulations/create
Auth: Basic (dvdbrnds:gabadh) or X-MCP-API-KEY header
```

**Expected Payload Structure:**
```json
{
  "itemId": "ferpa-001",
  "name": "FERPA",
  "statute": "20 U.S.C. § 1232g",
  "category": "Student Privacy",
  "topic": "Privacy & Data Protection",
  "jurisdictionSource": "federal",
  "regulationText": "...",
  "summary": "...",
  "requirements": "...",
  "filingDeadlines": [{"type": "...", "date": "...", "frequency": "...", "description": "..."}],
  "complianceTasks": [{"tempId": "...", "title": "...", "assignedRole": "...", "priority": "...", "dueDate": "..."}],
  "agency_name": "...",
  "agency_url": "...",
  "effectiveDate": "YYYY-MM-DD"
}
```

**EdSteward Auto-Creates:**
- `actions` array (attestation, website_publish, community_communication, agency_submission)
- Task parent/child relationships via tempId/parentTempId

**Template Regulations:**
Clery, FERPA, Title IX use `templateHint` instead of sending full tasks - EdSteward applies built-in templates.

**Alignment Execution Prompts Created:**
- Prompt A: Audit missing fields
- Prompt B: Enrich regulations with required fields
- Prompt C: Transform payload format
- Prompt D: Validate deadline structure
- Prompt E: Execute full alignment
- Prompt F: Post-alignment verification