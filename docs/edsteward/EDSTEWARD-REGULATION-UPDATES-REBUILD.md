# EdSteward `/api/regulation-updates` Endpoint Rebuild Specification

**From**: MCP Engine Team  
**Date**: 2026-02-12  
**Priority**: CRITICAL  
**Blocking**: All regulation pushes from MCP Engine GUI

---

## Problem Statement

MCP Engine's GUI "Push to Selected Target" button sends regulation updates to EdSteward's `/api/regulation-updates` endpoint. This endpoint currently only accepts flat string fields and rejects the **complete** compliance data payload that MCP Engine now produces (tasks, risk assessments, executive orders, filing deadlines, etc.).

The endpoint **must** accept and store the complete payload in EdSteward's `pending_updates` (or equivalent staging) table for **CCO review and approval**. Nothing should be written to production regulation/task tables until the CCO approves.

## Current State

- **Endpoint**: `POST /api/regulation-updates`
- **Auth**: `X-MCP-API-Key` header (working)
- **What works**: Flat fields only (`regulationId`, `name`, `originalContent`, `updatedContent`, `status`, `summary`)
- **What fails**: Arrays (`filingDeadlines`, `complianceTasks`), nested objects (`riskAssessment`), and additional metadata fields

### Current Validation Error Example
```json
{
  "error": "Invalid regulation update data",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "array",
      "path": ["filingDeadlines"],
      "message": "Expected string, received array"
    }
  ]
}
```

---

## Required Changes

### 1. Update Zod/Validation Schema

The `/api/regulation-updates` POST handler needs its validation schema updated to accept the full payload. Here is the **complete TypeScript type** for what MCP Engine sends:

```typescript
interface MCPRegulationUpdate {
  // ═══════════════════════════════════════════════════
  // IDENTIFIERS
  // ═══════════════════════════════════════════════════
  regulationId: number;           // EdSteward's internal numeric ID (REQUIRED)
  mcpRegKey: string;              // MCP canonical key "REG-001" to "REG-251"
  regKey: string;                 // Alias for mcpRegKey
  itemId: string;                 // MCP slug ID e.g. "title-ix-of-the-education-amendments-of-1972"

  // ═══════════════════════════════════════════════════
  // REGULATION CORE
  // ═══════════════════════════════════════════════════
  name: string;                   // Full regulation name (REQUIRED)
  statute: string;                // e.g. "20 U.S.C. § 1681"
  category: string;               // e.g. "Athletics", "Financial Aid"
  topic: string;                  // e.g. "Title IX", "FERPA"
  cfr: string;                    // e.g. "34 CFR Part 106"

  // ═══════════════════════════════════════════════════
  // CONTENT FOR CCO REVIEW
  // ═══════════════════════════════════════════════════
  originalContent: string;        // Current regulation text (up to 10,000 chars)
  updatedContent: string;         // Updated regulation text (up to 10,000 chars)
  status: "pending";              // ALWAYS "pending" — CCO must approve
  summary: string;                // Human-readable summary of changes
  requirements: string;           // Markdown-formatted requirements text

  // ═══════════════════════════════════════════════════
  // COMPLIANCE TASKS — Full hierarchical tree
  // ═══════════════════════════════════════════════════
  complianceTasks: ComplianceTask[];

  // ═══════════════════════════════════════════════════
  // FILING & REPORTING
  // ═══════════════════════════════════════════════════
  filingDeadlines: FilingDeadline[];
  reportingRequirements: string | null;
  submissionGuidelines: string | null;
  reportingFrequency: string | null;

  // ═══════════════════════════════════════════════════
  // RISK ASSESSMENT — Complete institutional risk breakdown
  // ═══════════════════════════════════════════════════
  riskScore: number | null;       // 1-100
  riskLevel: string | null;       // "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "CRITICAL"
  riskAssessment: RiskAssessment | null;

  // ═══════════════════════════════════════════════════
  // EXECUTIVE ORDERS & RELATED REGULATIONS
  // ═══════════════════════════════════════════════════
  executiveOrders: ExecutiveOrder[];
  relatedRegulations: string[];

  // ═══════════════════════════════════════════════════
  // ADDITIONAL METADATA
  // ═══════════════════════════════════════════════════
  agencyDepartment: string | null;
  regulationUrl: string | null;
  applicableInstitutions: string | null;
  applicableForms: string[];
  sections: any[];
  lovvLevel: string | null;       // LOVV validation level: "A", "B", "C", or null
  mcpEngineTimestamp: string;     // ISO 8601 timestamp
}

interface ComplianceTask {
  tempId: string;                 // Temporary ID for parent-child linking (e.g. "task-3903")
  taskId: string;                 // Stable task ID from MCP Engine
  parentTempId: string | null;    // Links to parent task's tempId (null = top-level)
  title: string;                  // Task title
  description: string;            // Task description
  category: string;               // e.g. "Administration", "Policy", "Training"
  priority: "critical" | "high" | "medium" | "low";
  requirementType: string;        // "requirement" | "recommendation" | "best-practice"
  statutoryRole: string;          // Role required by statute (may be empty)
  statutoryCitation: string;      // Legal citation (may be empty)
  assignedRole: string;           // Suggested assignee role
  evidenceRequired: boolean;
  evidenceType: string;           // "document" | "attestation" | "audit"
  sortOrder: number;
  estimatedEffort: string | null; // e.g. "2-4 hours", "1-2 weeks"
  deliverable: string | null;     // e.g. "Written policy document"
  source: string;                 // "rules-engine" | "llm-extractor" | "manual"
}

interface FilingDeadline {
  deadline: string;               // Date string or descriptor ("continuous", "event-triggered")
  description: string;
}

interface RiskAssessment {
  score: number;
  level: string;
  factors: {
    financialPenalty: RiskFactor;
    federalFunding: RiskFactor;
    accreditationImpact: RiskFactor;
    reputationalLegal: RiskFactor;
    operationalDisruption: RiskFactor;
  } | null;
  factorScores: {
    financialPenalty: number | null;
    federalFunding: number | null;
    accreditationImpact: number | null;
    reputationalLegal: number | null;
    operationalDisruption: number | null;
  };
  enforcementTrend: string | null;          // "INCREASING" | "STABLE" | "DECREASING"
  recentEnforcementActions: EnforcementAction[];
  assessmentDate: string;
  assessmentVersion: string;
  isPreliminary: boolean;
}

interface RiskFactor {
  score: number;
  rationale: string;
  maxPenaltyReference?: string;
  fundingTypesAtRisk?: string[];
  accreditorRelevance?: string[];
  precedentCases?: string[];
  affectedOperations?: string[];
}

interface EnforcementAction {
  date: string;
  penalty: string;
  summary: string;
  institution: string;
}

interface ExecutiveOrder {
  eoNumber: string;
  title: string;
  signedDate: string;
  relevance: string;
  impactLevel: string;
}
```

### 2. Storage Strategy

The **entire** JSON payload should be stored in the `pending_updates` table (or equivalent). Recommended approach:

```sql
ALTER TABLE regulation_updates ADD COLUMN IF NOT EXISTS
  mcp_payload JSONB;
```

Store the complete payload as JSONB. When the CCO reviews, the UI can render:
- The regulation metadata diff (name, statute, category, etc.)
- The full compliance task list (with hierarchy)
- The risk assessment breakdown
- Filing deadlines and reporting requirements
- Executive order linkages

### 3. CCO Approval Flow

When the CCO **approves** a pending update, EdSteward should:

1. **Update regulation metadata** from the payload fields (name, statute, category, topic, cfr, etc.)
2. **Sync compliance tasks** — use the `complianceTasks` array to create/update tasks on the regulation. Use `tempId`/`parentTempId` to establish parent-child relationships. Use `taskId` for deduplication (upsert by taskId).
3. **Update risk data** — store `riskScore`, `riskLevel`, and the full `riskAssessment` object on the regulation
4. **Update filing deadlines** — replace filing deadlines with the new array
5. **Link executive orders** — if any `executiveOrders` are present

When the CCO **rejects**, nothing is written. The pending update is marked rejected.

### 4. Response Format

The current response format is fine:
```json
{
  "success": true,
  "updateId": "903",
  "verified": false,
  "regulationId": 7,
  "timestamp": "2026-02-12T18:59:15.338Z",
  "bulkImport": true
}
```

---

## Immediate Cleanup Required

During debugging, approximately **19 junk pending updates** were created (IDs ~902 through ~920) on regulation ID 7 (Title IX) and regulation ID 2 (ADA). These should be deleted from the `regulation_updates` table:

```sql
DELETE FROM regulation_updates
WHERE id BETWEEN 902 AND 920
  AND verified = false;
```

Additionally, the `/api/mcp/regulations/sync` endpoint has a SQL bug:
```
op ANY/ALL (array) requires array on right side
```
This occurs when `preserveExistingTasks: false` is used with a non-empty task array. The SQL query that deletes existing tasks before replacement has a null/non-array value being passed to an `ANY()` clause. This should be investigated and fixed independently.

---

## Sample Payload

A complete sample payload is available at:
`MCP-Engine/data/sample-regulation-update-payload.json`

This is a real Title IX payload with 21 compliance tasks, 5 filing deadlines, a full risk assessment (score: 88, SEVERE), and all metadata fields populated.

**Payload size**: ~13KB per regulation (varies by task count)

---

## Testing

Once EdSteward rebuilds the endpoint, MCP Engine can immediately push. The delivery server is configured and ready:

```bash
# From MCP Engine GUI:
# Select regulation → Select "Moravian Prod" → Click "Push to Selected Target"

# Or via curl:
curl -X POST http://localhost:3003/api/customers/push \
  -H 'Content-Type: application/json' \
  -d '{"regulationId":"title-ix-of-the-education-amendments-of-1972","customerIds":["moravian-prod"]}'
```

The push will hit `https://moravian.edsteward.ai/api/regulation-updates` with the full payload and `X-MCP-API-Key` authentication.
