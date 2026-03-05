# MCP Engine → EdSteward: Schema Alignment Brief

> **Date:** February 12, 2026
> **From:** EdSteward team
> **Re:** All inbound endpoints expanded — here's what we now accept and what we need from you

---

## What Changed on Our Side

EdSteward has completed a full schema alignment across all three MCP
integration endpoints. Every endpoint now accepts the same expanded payloads:

- **48 regulation fields** (up from ~15-30 depending on endpoint)
- **21 compliance task fields** (up from ~12, now consistent across all
  endpoints)
- **22 Executive Order fields** with automatic impact record creation
  (previously only handled on approval)

All three endpoints are now at parity — you can send the same payload shape
to any of them.

---

## Authentication — Please Migrate to API Key

All endpoints now accept `X-MCP-API-Key` as the **preferred** auth method:

```
X-MCP-API-Key: <value of MCP_API_KEY env var>
```

Basic Auth still works for backward compatibility but is **deprecated**. The
hardcoded credentials in Create/Sync are logged as warnings. Please migrate
to the API key header.

---

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/mcp/regulations/create` | Create new regulation with tasks + EOs | First-time import |
| `POST /api/mcp/regulations/sync` | Upsert regulation (create or update by regKey) | Ongoing sync |
| `POST /api/regulation-updates` | Queue update for CCO review/approval | Real-time changes |

---

## Regulation Payload (48 fields)

**Required:** `name`, `statute`, `category`, `topic`

All other fields are optional. Send everything you have — we store it all.

```json
{
  "name": "Clery Act",
  "statute": "20 U.S.C. § 1092(f)",
  "statuteIds": ["20-usc-1092f"],
  "publicLaw": "Public Law 101-542",
  "category": "Campus Safety",
  "topic": "Crime Reporting",
  "regKey": "REG-001",
  "jurisdictionSource": "federal",
  "effectiveDate": "1990-11-08",
  "originationDate": "1990-11-08",
  "nextReviewDate": "2027-01-01",

  "summary": "Requires institutions to disclose campus security policies...",
  "purpose": "To provide transparency in campus crime statistics...",
  "scope": "All Title IV participating institutions...",
  "requirements": "• Annual Security Report\n• Timely warnings\n• Crime log",
  "regulationText": "Full text of the regulation...",
  "submissionGuidelines": "Submit via Department of Education portal",
  "complianceNotes": "Institutions must publish ASR by October 1",
  "verificationMethod": "Annual DOE review + complaint-driven audits",
  "reportingFrequency": "annual",

  "reportingRequirements": {
    "frequency": "annual",
    "deadline": "October 1",
    "format": "electronic",
    "recipient": "Department of Education"
  },

  "riskScore": 82,
  "riskLevel": "HIGH",
  "riskAssessment": {
    "score": 82,
    "level": "HIGH",
    "factors": ["enforcement-trend", "penalty-severity"],
    "enforcementTrend": "increasing"
  },

  "agencyName": "Department of Education",
  "agencyUrl": "https://www2.ed.gov/",
  "agencyContact": "clery@ed.gov",
  "agencyDepartment": "Office of Postsecondary Education",

  "regulationUrl": "https://www.ecfr.gov/...",
  "requirementsUrl": "https://studentaid.gov/...",
  "submissionGuideUrl": "https://surveys.ope.ed.gov/...",
  "formsUrl": "https://surveys.ope.ed.gov/...",
  "sourceUrl": "https://www.congress.gov/bill/...",

  "lovvLevel": "A",
  "versionHash": "abc123...",
  "stateCode": null,

  "sources": [
    { "name": "Federal Register", "url": "https://..." }
  ],
  "sections": [
    { "type": "subpart", "value": "Subpart A - General" }
  ],
  "relatedRegulations": [
    { "regKey": "REG-045", "relationship": "related" }
  ],
  "applicableInstitutions": ["4-year", "2-year", "graduate"],
  "applicableForms": ["SF-269", "ED Form 1"],
  "filingDeadlines": [
    {
      "type": "Annual Security Report",
      "date": "2026-10-01",
      "frequency": "annual",
      "description": "Publish ASR"
    }
  ],

  "complianceTasks": [],
  "executiveOrders": []
}
```

### Field Reference

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | **Required.** Full regulation name |
| `statute` | string | **Required.** Primary statute citation |
| `category` | string | **Required.** e.g. "Campus Safety", "Financial Aid" |
| `topic` | string | **Required.** e.g. "Crime Reporting" |
| `regKey` | string | Universal key (REG-001 to REG-251). **Always include.** |
| `statuteIds` | string[] | Multiple statute identifiers |
| `publicLaw` | string | e.g. "Public Law 101-542" |
| `jurisdictionSource` | string | "federal", "state", "accreditor", etc. |
| `effectiveDate` | string | ISO date |
| `originationDate` | string | ISO date |
| `nextReviewDate` | string | ISO date |
| `summary` | string | Brief regulation summary |
| `purpose` | string | Why the regulation exists |
| `scope` | string | Who/what it applies to |
| `requirements` | string | Compliance requirements text |
| `regulationText` | string | Full regulation text |
| `submissionGuidelines` | string | How to submit compliance evidence |
| `complianceNotes` | string | Compliance guidance text |
| `verificationMethod` | string | How compliance is verified |
| `reportingFrequency` | string | "annual", "quarterly", "semester" |
| `reportingRequirements` | object | Structured reporting requirements (JSONB) |
| `riskScore` | number | 1–100 institutional risk score |
| `riskLevel` | enum | `CRITICAL` \| `SEVERE` \| `HIGH` \| `MODERATE` \| `LOW` |
| `riskAssessment` | object | Full risk assessment (JSONB) |
| `agencyName` | string | Enforcing agency name |
| `agencyUrl` | string | Agency website |
| `agencyContact` | string | Agency email/phone |
| `agencyDepartment` | string | Specific department |
| `regulationUrl` | string | Link to regulation text |
| `requirementsUrl` | string | Link to requirements |
| `submissionGuideUrl` | string | Submission guide link |
| `formsUrl` | string | Required forms link |
| `sourceUrl` | string | Original source link |
| `lovvLevel` | enum | `A` \| `B` \| `C` \| `D` (L.O.V.V. validation) |
| `versionHash` | string | Change detection hash |
| `stateCode` | string | 2-letter state code (state regulations only) |
| `sources` | array | `[{ name, url, citation, lastChecked }]` |
| `sections` | array | `[{ type, value }]` structured sections |
| `relatedRegulations` | array | `[{ regKey, relationship }]` |
| `applicableInstitutions` | string[] | e.g. `["4-year", "2-year"]` |
| `applicableForms` | string[] | Required form names |
| `filingDeadlines` | array | `[{ type, date, frequency, description }]` |

---

## Compliance Tasks (21 fields per task)

Include in the regulation payload as `complianceTasks` array.

**Use `tempId` / `parentTempId` for parent-child hierarchy.** This is how
EdSteward knows which tasks are subtasks of which parent.

### Full Example

```json
{
  "complianceTasks": [
    {
      "tempId": "clery-001",
      "taskId": "001",
      "title": "Publish Annual Security Report",
      "description": "Compile and publish the ASR by October 1",
      "instructions": "Step 1: Gather crime statistics from CSAs.\nStep 2: Compile Clery geography data.\nStep 3: Draft report using DOE template.\nStep 4: Publish on institution website.\nStep 5: Submit to DOE via Campus Safety survey.",
      "category": "Reporting",
      "assignedRole": "Clery Compliance Officer",
      "statutoryRole": "Campus Security Authority",
      "statutoryCitation": "20 U.S.C. § 1092(f)(1)",
      "requirementType": "requirement",
      "priority": "critical",
      "dueDate": "2026-10-01",
      "recurringSchedule": "annual",
      "reminderDays": 30,
      "evidenceRequired": true,
      "evidenceType": "document",
      "evidenceInstructions": "Upload the published ASR PDF",
      "estimatedEffort": "40-80 hours",
      "deliverable": "Published Annual Security Report",
      "deliverableTemplateUrl": "https://example.gov/templates/asr-template.docx",
      "sortOrder": 1
    },
    {
      "tempId": "clery-001a",
      "parentTempId": "clery-001",
      "taskId": "001-a",
      "title": "Collect Crime Statistics from CSAs",
      "description": "Survey all Campus Security Authorities for incident data",
      "instructions": "Distribute CSA survey forms to all identified CSAs.\nCollect responses within 30-day window.\nReconcile with local police data.",
      "category": "Reporting",
      "assignedRole": "Staff",
      "statutoryRole": "Campus Security Authority",
      "statutoryCitation": "34 CFR 668.46(c)(2)",
      "requirementType": "requirement",
      "priority": "high",
      "recurringSchedule": "annual",
      "reminderDays": 14,
      "evidenceRequired": true,
      "evidenceType": "spreadsheet",
      "evidenceInstructions": "Upload completed CSA survey responses",
      "estimatedEffort": "8-16 hours",
      "deliverable": "Compiled CSA survey data",
      "deliverableTemplateUrl": null,
      "sortOrder": 2
    }
  ]
}
```

### Task Field Reference

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `tempId` | string | No | Temp ID for parent-child linking within this payload |
| `parentTempId` | string | No | References parent task's `tempId` |
| `taskId` | string | No | Stable ID across syncs (e.g. "001", "001-a") |
| `title` | string | **Yes** | Task title |
| `description` | string | No | What the task involves |
| `instructions` | string | No | **Step-by-step how-to. This is a key gap — please populate.** |
| `category` | string | No | Grouping: "Reporting", "Training", "Policy", "Documentation", etc. |
| `assignedRole` | string | No | Institutional role (e.g. "Compliance Officer") |
| `statutoryRole` | string | No | **Legal role from the statute** (e.g. "Title IX Coordinator") |
| `statutoryCitation` | string | No | **Legal citation** (e.g. "34 CFR 106.8") |
| `requirementType` | enum | No | `requirement` \| `best_practice` |
| `priority` | enum | No | `critical` \| `high` \| `medium` \| `low` |
| `dueDate` | string | No | ISO date for one-time deadlines |
| `recurringSchedule` | string | No | "annual", "quarterly", "semester", "monthly" |
| `reminderDays` | number | No | Days before due to send reminder (default: 30) |
| `evidenceRequired` | boolean | No | Whether proof of completion is needed |
| `evidenceType` | string | No | "document", "spreadsheet", "screenshot", "attestation" |
| `evidenceInstructions` | string | No | **What to upload as proof** |
| `estimatedEffort` | string | No | **Time estimate** (e.g. "2-4 hours", "1 week") |
| `deliverable` | string | No | **Expected output description** |
| `deliverableTemplateUrl` | string | No | Link to a template document |
| `sortOrder` | number | No | Display order (lower = first) |

### The Standard We Want (follow Clery as the model)

Every regulation should have:

1. **Parent tasks** — high-level compliance obligations (3-10 per regulation)
2. **Subtasks** — actionable steps under each parent (2-5 per parent)
3. **Every task** should have at minimum: `title`, `description`,
   `instructions`, `category`, `statutoryCitation`, `priority`,
   `requirementType`, `estimatedEffort`
4. **Evidence tasks** should include: `evidenceRequired: true`,
   `evidenceType`, `evidenceInstructions`
5. **Recurring tasks** should include: `recurringSchedule`, `reminderDays`

---

## Executive Orders (22 fields per EO)

Include in the regulation payload as `executiveOrders` array. EdSteward will
automatically create/update both the EO record and the regulation-specific
impact assessment.

### Full Example

```json
{
  "executiveOrders": [
    {
      "eoNumber": "EO 14373",
      "title": "Ending Radical Indoctrination in K-12 Schooling",
      "signedDate": "2025-01-29",
      "publishedDate": "2025-02-03",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "summary": "Directs federal agencies to review grants to institutions...",
      "fullTextUrl": "https://www.federalregister.gov/documents/...",
      "pdfUrl": "https://www.govinfo.gov/content/pkg/...",
      "federalRegisterCitation": "90 FR 35821",
      "topics": ["higher-education", "dei", "federal-funding"],
      "impactType": "modifies",
      "impactSeverity": "high",
      "impactSummary": "May affect Title IX compliance by redefining sex-based protections...",
      "affectedSections": ["Section 3", "Section 7(a)"],
      "confidenceScore": 0.85,
      "assessmentDate": "2026-02-12",
      "enjoinedDate": null,
      "enjoinedBy": null,
      "revokedDate": null,
      "revokedBy": null
    }
  ]
}
```

### EO Field Reference

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `eoNumber` | string | **Yes** | e.g. "EO 14373" |
| `title` | string | **Yes** | Full EO title |
| `signedDate` | string | **Yes** | ISO date when signed |
| `publishedDate` | string | No | Federal Register publication date |
| `status` | enum | No | `active` \| `enjoined` \| `revoked` \| `superseded` (default: active) |
| `president` | string | No | e.g. "Donald Trump" |
| `term` | string | No | e.g. "Trump-2", "Biden-1" |
| `summary` | string | No | Federal Register abstract |
| `fullTextUrl` | string | No | Federal Register link |
| `pdfUrl` | string | No | PDF download link |
| `federalRegisterCitation` | string | No | e.g. "90 FR 35821" |
| `topics` | string[] | No | **Must be an array**, not comma-separated string |
| `impactType` | enum | **Yes** | `modifies` \| `reinforces` \| `conflicts` \| `supersedes` |
| `impactSeverity` | enum | **Yes** | `critical` \| `high` \| `medium` \| `low` |
| `impactSummary` | string | No | AI-generated impact analysis text |
| `affectedSections` | string[] | No | Which regulation sections are affected |
| `confidenceScore` | number | No | 0–1 confidence in the impact assessment |
| `assessmentDate` | string | No | ISO date when impact was assessed |
| `enjoinedDate` | string | No | Court injunction date (if enjoined) |
| `enjoinedBy` | string | No | Court that issued injunction |
| `revokedDate` | string | No | Revocation date (if revoked) |
| `revokedBy` | string | No | EO number or action that revoked it |

### Critical: Send EOs for ALL Affected Regulations

Currently we are only receiving Executive Orders for Title IX. **Every
regulation that is affected by an active EO should include that EO in its
payload.** This includes at minimum:

- **Clery Act** — affected by EOs on campus safety, reporting requirements
- **FERPA** — affected by EOs on data privacy, student records
- **Title IV** — affected by EOs on federal financial aid
- **Title IX** — already receiving EOs (good)
- **HEA** — affected by EOs on higher education funding

---

## What We Specifically Need from MCP Engine

### 1. Send ALL fields you have

Every field listed above is optional except the 4 required regulation fields
and the 5 required EO fields. We store everything. **Don't hold back data
because it wasn't in the old schema.**

### 2. Use the Clery standard for tasks

Every regulation should have hierarchical parent tasks with subtasks, using
`tempId` / `parentTempId`. Include `instructions`, `statutoryRole`,
`statutoryCitation`, `estimatedEffort`, `deliverable`, and `category` on
every task.

### 3. Send Executive Orders for ALL affected regulations

Not just Title IX. Clery, FERPA, Title IV, and others are all affected by
current EOs. Include the full 22-field payload with impact assessment per
regulation.

### 4. Use `regKey` as the primary identifier

e.g. "REG-001". This is the universal key that links MCP Engine and
EdSteward. Always include it.

### 5. Prefer camelCase field names

We accept both `agencyName` and `agency_name`, but camelCase is canonical.

### 6. Migrate auth to `X-MCP-API-Key` header

Basic Auth is deprecated.

### 7. `topics` on EOs must be an array of strings

```json
"topics": ["higher-education", "compliance"]
```

Not:

```json
"topics": "higher-education,compliance"
```

---

## Naming Conventions Quick Reference

| Use This (camelCase) | Not This (snake_case) |
|---------------------|----------------------|
| `agencyName` | `agency_name` |
| `agencyUrl` | `agency_url` |
| `agencyContact` | `agency_contact` |
| `agencyDepartment` | `agency_department` |
| `fullTextUrl` | `full_text_url` |
| `regulationText` | `regulation_text` |
| `statutoryRole` | `statutory_role` |
| `statutoryCitation` | `statutory_citation` |
| `evidenceRequired` | `evidence_required` |
| `evidenceType` | `evidence_type` |
| `evidenceInstructions` | `evidence_instructions` |
| `impactType` | `impact_type` |
| `impactSeverity` | `impact_severity` |
| `submissionGuidelines` | `submission_guidelines` |
| `filingDeadlines` | `filing_deadlines` |
| `applicableInstitutions` | N/A |
| `reportingRequirements` | N/A |
| `riskAssessment` | N/A |

Both work on all endpoints, but camelCase is the canonical format going
forward.

---

## Validation Rules Summary

| Rule | Detail |
|------|--------|
| `riskLevel` | Must be one of: `CRITICAL`, `SEVERE`, `HIGH`, `MODERATE`, `LOW` |
| `priority` (tasks) | Must be one of: `critical`, `high`, `medium`, `low` |
| `requirementType` | Must be one of: `requirement`, `best_practice` |
| `impactType` (EOs) | Must be one of: `modifies`, `reinforces`, `conflicts`, `supersedes` |
| `impactSeverity` (EOs) | Must be one of: `critical`, `high`, `medium`, `low` |
| `status` (EOs) | Must be one of: `active`, `enjoined`, `revoked`, `superseded` |
| `lovvLevel` | Must be one of: `A`, `B`, `C`, `D` |
| `stateCode` | Max 2 characters |
| `topics` (EOs) | Must be `string[]` array, not comma-separated string |
| `confidenceScore` | Number between 0 and 1 |
| `riskScore` | Integer between 1 and 100 |

---

## Testing

EdSteward has a test script that sends full payloads through all 3 endpoints
and verifies they land correctly:

```bash
node scripts/test-mcp-schema-alignment.cjs
```

45 assertions, all passing. After you update your payloads, we can run this
against staging to verify end-to-end.

---

_This brief reflects the EdSteward schema as of February 12, 2026 (v1.4.10).
The dual-system philosophy only works if the data transport is complete and
consistent. Please reach out with any questions about field formats or
payload structure._
