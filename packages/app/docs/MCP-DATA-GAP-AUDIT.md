# MCP Engine ↔ EdSteward — Data Transport Gap Audit

> **Date:** February 12, 2026
> **Updated:** February 12, 2026 — **BOTH SIDES ALIGNED** (EdSteward Phase 6 + MCP Engine Phase 6)
> **Purpose:** Identify all data fields that SHOULD come from the MCP Engine but
> currently don't, and reconcile inconsistencies across inbound endpoints.
> **Principle:** MCP Engine is the regulatory knowledge source of truth. EdSteward
> handles institutional operations (assignments, evidence, attestations, workflow).

---

## Executive Summary

EdSteward's `regulations` table has **~60 columns**. The MCP Engine currently
populates a subset via two inbound paths:

1. **Create/Sync** (`POST /api/mcp/regulations/create` and `/sync`) — the
   richer schema, ~30 fields accepted
2. **Updates** (`POST /api/regulation-updates`) — the real-time change path,
   ~15 regulation fields accepted

**Key findings:**

- **12 regulation fields** exist in the schema with no MCP inbound path at all
- **9 regulation fields** are accepted by Create/Sync but NOT by Updates —
  meaning day-2 changes to those fields can never flow through
- **5 compliance task fields** exist in the DB but no MCP endpoint accepts them
- **6 executive order fields** exist in the DB but MCP doesn't send them
- The two task schemas (Create vs Update) are inconsistent — 6 fields differ

---

## 1. Regulation Fields — Full Gap Matrix

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | MCP sends this field |
| ⚠️ | MCP sends this on ONE endpoint only (inconsistency) |
| ❌ | Schema field exists, MCP never sends it |
| 🏛️ | Correctly institutional — should NOT come from MCP |

### Core Regulation Identity

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `name` | ✅ | ✅ | — | |
| `itemId` | ✅ | ✅ | — | |
| `regKey` | — | ✅ | ⚠️ | Create doesn't use regKey |
| `statute` | ✅ | ⚠️ | ⚠️ | In update only for auto-create |
| `topic` | ✅ | ⚠️ | ⚠️ | Same |
| `category` | ✅ | ⚠️ | ⚠️ | Same |
| `jurisdictionSource` | ✅ | ⚠️ | ⚠️ | Same |
| `statuteIds` | ❌ | ❌ | **GAP** | Multiple statute identifiers |

### Regulation Content

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `regulationText` | ✅ | ✅ | — | `regulation_text` in updates |
| `summary` | ✅ | ✅ | — | |
| `requirements` | ✅ | ✅ | — | String in create, array in updates |
| `sections` | ❌ | ❌ | **GAP** | Structured section breakdown |
| `complianceNotes` | ❌ | ❌ | **GAP** | Compliance guidance |
| `verificationMethod` | ❌ | ❌ | **GAP** | How to verify compliance |

### Dates & Scheduling

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `effectiveDate` | ✅ | ✅ | — | |
| `originationDate` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `lastUpdated` | — | — | Auto | Set on write |
| `lastVerified` | — | — | ❌ | Never set by MCP |
| `nextReviewDate` | ❌ | ❌ | **GAP** | Review scheduling |
| `reportingFrequency` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `filingDeadlines` | ✅ | ✅ | — | |

### Agency & Source Information

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `agency_name` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `agency_url` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `agency_contact` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `agency_department` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `regulationUrl` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `requirementsUrl` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `submissionGuideUrl` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `formsUrl` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `sourceUrl` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `submissionGuidelines` | ✅ | ✅ | — | `submission_guidelines` in updates |
| `sources` | ❌ | ❌ | **GAP** | RegulationSource[] array |

### Applicability & Classification

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `applicableInstitutions` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Critical for institution config |
| `isApplicable` | ❌ | ❌ | **GAP** | Could be derived from above |
| `applicableforms` | ❌ | ❌ | **GAP** | Forms required for compliance |
| `relatedRegulations` | ❌ | ❌ | **GAP** | Cross-references |
| `originalCategory` | ❌ | ❌ | **GAP** | MCP's original category name |

### Risk & Validation (MCP-Specific)

| Field | Create/Sync | Updates | Gap? | Notes |
|-------|:-----------:|:-------:|------|-------|
| `riskScore` | ❌ | ✅ | ⚠️ | Not in create |
| `riskLevel` | ❌ | ✅ | ⚠️ | Not in create |
| `lovvLevel` | ✅ | ❌ | **⚠️ INCONSISTENCY** | Not in updates |
| `versionHash` | ✅ | ❌ | ⚠️ | Used for change detection |
| `stateCode` | ✅ | ❌ | ⚠️ | Not in updates |

### Institutional / Operational (Correctly NOT from MCP)

| Field | Source | Notes |
|-------|--------|-------|
| `dro` | 🏛️ User | Designated Responsible Officer |
| `ownerId` | 🏛️ User | Regulation owner |
| `responsibleOffice` | 🏛️ User | But MCP could suggest defaults |
| `responsibleOfficeEmail` | 🏛️ User | |
| `escalationTarget` | 🏛️ User | |
| `escalationEmail` | 🏛️ User | |
| `notificationsDisabled` | 🏛️ User | |
| `notificationSchedule` | ❓ Mixed | MCP could suggest; user customizes |
| `notificationOverride` | 🏛️ User | |
| `actions` | ❓ Mixed | MCP could provide action templates |

---

## 2. Compliance Task Fields — Gap Matrix

| Field | Create Task Schema | Update Task Schema | Gap? |
|-------|:-----------------:|:------------------:|------|
| `tempId` | ✅ | ✅ | — |
| `parentTempId` | ✅ | ✅ | — |
| `taskId` | ❌ | ✅ | **⚠️ INCONSISTENCY** |
| `title` | ✅ | ✅ | — |
| `description` | ✅ | ✅ | — |
| `instructions` | ✅ | ✅ | — |
| `assignedRole` | ✅ | ✅ | — |
| `priority` | ✅ | ✅ | — but enum differs! |
| `dueDate` | ✅ | ✅ | — |
| `evidenceRequired` | ✅ | ✅ | — |
| `evidenceType` | ✅ | ✅ | — |
| `evidenceInstructions` | ✅ | ❌ | **⚠️ INCONSISTENCY** |
| `recurringSchedule` | ✅ | ❌ | **⚠️ INCONSISTENCY** |
| `reminderDays` | ✅ | ❌ | **⚠️ INCONSISTENCY** |
| `sortOrder` | ✅ | ❌ | **⚠️ INCONSISTENCY** |
| `requirementType` | ❌ | ✅ | **⚠️ INCONSISTENCY** |
| `category` | ❌ | ❌ | **GAP** | Task grouping |
| `statutoryRole` | ❌ | ❌ | **GAP** | e.g. "Title IX Coordinator" |
| `statutoryCitation` | ❌ | ❌ | **GAP** | e.g. "34 CFR 106.8" |
| `escalationEmail` | ❌ | ❌ | **GAP** | Escalation contact |
| `escalationName` | ❌ | ❌ | **GAP** | Escalation name |

**Priority enum inconsistency:**
- Create: `['low', 'medium', 'high', 'critical']`
- Update: `['high', 'medium', 'low']` (no `critical`)

---

## 3. Executive Order Fields — Gap Matrix

| Field | MCP Sends | Gap? | Notes |
|-------|:---------:|------|-------|
| `eoNumber` | ✅ | — | |
| `title` | ✅ | — | |
| `signedDate` | ✅ | — | |
| `status` | ✅ | — | |
| `president` | ✅ | — | |
| `term` | ✅ | — | |
| `impactType` | ✅ | — | |
| `impactSeverity` | ✅ | — | |
| `impactSummary` | ✅ | — | |
| `fullTextUrl` | ✅ | — | |
| `confidenceScore` | ✅ | — | |
| `publishedDate` | ❌ | **GAP** | Federal Register publish date |
| `federalRegisterCitation` | ❌ | **GAP** | e.g. "89 FR 12345" |
| `topics` | ❌ | **GAP** | Topic tags array |
| `pdfUrl` | ❌ | **GAP** | PDF link |
| `enjoinedDate` | ❌ | **GAP** | Legal challenge date |
| `enjoinedBy` | ❌ | **GAP** | Court/judge |
| `revokedDate` | ❌ | **GAP** | |
| `revokedBy` | ❌ | **GAP** | |
| `summary` | ❌ | **GAP** | Full EO summary |

---

## 4. Schema Inconsistencies Between Endpoints

These are the most urgent issues — they mean the MCP Engine team may be building
against one endpoint but not the other, and data silently gets dropped.

### 4.1 Field naming mismatches

| Concept | Create/Sync endpoint | Updates endpoint |
|---------|---------------------|-----------------|
| Regulation text | `regulationText` | `regulation_text` |
| Requirements | `requirements` (string) | `requirements` (array of strings) |
| Submission guide | `submissionGuidelines` | `submission_guidelines` |
| Filing deadlines | typed array | `z.any()` |

### 4.2 Auth inconsistencies

| Endpoint | Auth Method |
|----------|------------|
| Create/Sync (`/api/mcp/regulations/*`) | Basic Auth (hardcoded `dvdbrnds:[REDACTED]`) |
| Updates (`/api/regulation-updates`) | Basic Auth (`MCP_ENGINE_USERNAME`/`MCP_ENGINE_PASSWORD` from env) |
| Orchestrator (`/api/mcp/versions/*`) | `X-MCP-API-Key` header |

Three different auth mechanisms for three MCP entry points. This should be
unified.

### 4.3 Identifier confusion

The MCP Engine must choose between three identifiers:

| Identifier | Type | Used Where |
|------------|------|-----------|
| `regKey` | `REG-001` style | Updates endpoint (primary) |
| `itemId` | Slug like `clery-act-vawa` | Both (fallback) |
| `regulationId` | Numeric DB ID | Both (legacy) |

The Create endpoint doesn't accept `regKey` at all. The Updates endpoint prefers
it. This needs a single canonical identifier.

---

## 5. Summary: What MCP Should Send But Doesn't

### Tier 1: Critical Gaps (regulatory content MCP MUST provide)

| # | Field | Why It Matters |
|---|-------|---------------|
| 1 | `sections` | Structured regulation breakdown — institutions need this to map compliance |
| 2 | `relatedRegulations` | Cross-references — compliance officers need to see connections |
| 3 | `applicableforms` | Which forms to file — core compliance knowledge |
| 4 | `statuteIds` | Multiple statute citations per regulation |
| 5 | `verificationMethod` | How to prove compliance — this IS the MCP Engine's job |
| 6 | `sources` | Authoritative source documents |
| 7 | Task `statutoryRole` | Legal role required (Title IX Coordinator, etc.) |
| 8 | Task `statutoryCitation` | Legal citation (34 CFR 106.8, etc.) |
| 9 | Task `category` | Task grouping for the UI |

### Tier 2: Important Gaps (should come from MCP for completeness)

| # | Field | Why It Matters |
|---|-------|---------------|
| 10 | `nextReviewDate` | When should the institution re-check this regulation? |
| 11 | `complianceNotes` | Guidance notes from the regulatory source |
| 12 | `originalCategory` | MCP's raw category before normalization |
| 13 | EO `publishedDate` | Federal Register publication date |
| 14 | EO `federalRegisterCitation` | Citation reference |
| 15 | EO `topics` | Topic tags |
| 16 | EO `summary` | Full summary text |
| 17 | EO `pdfUrl` | PDF document link |
| 18 | EO injunction/revocation fields | Legal status tracking |

### Tier 3: Endpoint Parity (fields that work on Create but not Updates)

| # | Field | Impact |
|---|-------|--------|
| 19 | `applicableInstitutions` | Updates can't change which institutions a reg applies to |
| 20 | `originationDate` | Updates can't correct origination dates |
| 21 | `agency_*` fields (4) | Agency info can't be updated via the change flow |
| 22 | URL fields (4) | Links can't be updated via the change flow |
| 23 | `reportingFrequency` | Can't be updated |
| 24 | `lovvLevel` | Can't be updated |
| 25 | `stateCode` | Can't be updated |
| 26 | `riskScore`/`riskLevel` | Can't be SET on create, only on update |
| 27 | Task: `recurringSchedule`, `reminderDays`, `evidenceInstructions` | Lost on update path |
| 28 | Task: `taskId`, `requirementType` | Lost on create path |

---

## 6. Correctly Institutional (NOT MCP's job)

These should remain human/institutional data and are NOT gaps:

- **Users, roles, role assignments** — org structure
- **Evidence uploads** — institution-specific documents
- **Attestations** — human signatures and affirmations
- **Notes** — institutional analysis and commentary
- **Notification preferences** — per-user/per-institution
- **Deadlines** (user-created) — institution-specific scheduling
- **Branding, tenants** — platform configuration

---

## 7. Recommended Coordination Plan with MCP Engine Team

### Phase A: Schema Alignment (Week 1)

1. **Unify the task schemas** — Create a single `McpComplianceTask` type used by
   both endpoints. Add all fields: `taskId`, `category`, `statutoryRole`,
   `statutoryCitation`, `requirementType`, `recurringSchedule`, `reminderDays`,
   `evidenceInstructions`, `escalationEmail`, `escalationName`, `sortOrder`.

2. **Unify the regulation field names** — Pick one convention and stick to it:
   - `regulationText` (not `regulation_text`)
   - `requirements` as string (not array)
   - `submissionGuidelines` (not `submission_guidelines`)

3. **Add `regKey` to the Create/Sync endpoint** — It's the canonical identifier;
   both endpoints should accept it.

4. **Unify auth** — Move all MCP endpoints to `X-MCP-API-Key` header auth.
   Remove hardcoded credentials.

### Phase B: Close Critical Gaps (Week 2)

5. **Expand the Updates schema** to accept ALL fields that Create/Sync accepts:
   - `applicableInstitutions`, `originationDate`, `agency_*`, URL fields,
     `reportingFrequency`, `lovvLevel`, `stateCode`, `riskScore`, `riskLevel`

6. **Add missing regulatory content fields** to both endpoints:
   - `sections` — structured section breakdown
   - `sources` — source document references
   - `relatedRegulations` — cross-references
   - `applicableforms` — required forms
   - `verificationMethod` — compliance verification guidance
   - `statuteIds` — multiple statute identifiers
   - `complianceNotes` — compliance guidance text
   - `nextReviewDate` — review schedule

7. **Expand EO schema** to include:
   - `publishedDate`, `federalRegisterCitation`, `topics`, `summary`, `pdfUrl`
   - Injunction fields: `enjoinedDate`, `enjoinedBy`
   - Revocation fields: `revokedDate`, `revokedBy`

### Phase C: Verify End-to-End (Week 3)

8. **Write integration tests** that send a full regulation payload through each
   endpoint and verify ALL fields land in the database correctly.

9. **Run the alignment verification script** (`scripts/verify-mcp-alignment.cjs`)
   after a full sync to confirm field-level coverage.

10. **Document the canonical MCP payload schema** — single reference document
    shared between both teams.

### Phase D: Future Considerations

11. **Suggested defaults from MCP** — For fields like `notificationSchedule`,
    `responsibleOffice`, and `actions`, MCP could provide SUGGESTED values that
    institutions can override. This keeps the dual-system philosophy intact:
    MCP suggests, institutions decide.

12. **`actions` templates** — MCP could send a default set of compliance actions
    (e.g., "Publish policy on website", "Send annual attestation", "File with
    DOE") that institutions can customize.

---

## Appendix: Database Tables by Data Source

| Table | Primary Source | MCP Role |
|-------|---------------|----------|
| `regulations` | **MCP** | Creates and updates regulatory content |
| `regulation_updates` | **MCP** | Pending change proposals |
| `regulation_versions` | **MCP** | Version history |
| `canonical_categories` | **MCP** | Category taxonomy |
| `category_mappings` | **MCP** | Category normalization rules |
| `executive_orders` | **MCP** | EO data and tracking |
| `eo_regulation_impacts` | **MCP** | EO impact on regulations |
| `eo_status_history` | **MCP** | EO legal status changes |
| `sync_control` | System | Sync state management |
| `validation_status` | System | LOVV validation results |
| `version_conflicts` | System | Conflict resolution |
| `notification_queue` | System | Notification delivery |
| `compliance_tasks` | **Both** | MCP provides templates; users manage workflow |
| `task_evidence` | **User** | Institution-uploaded files/links |
| `task_attestation_tokens` | **User** | Magic link tokens |
| `task_activity` | **User** | Comments and status changes |
| `users` | **User** | Identity management |
| `role_assignments` | **User** | Org chart mapping |
| `notes` | **User** | Institutional analysis |
| `note_history` | System | Audit trail |
| `evidence_files` | **User** | Regulation-level evidence |
| `attestation_tokens` | **User** | Magic link attestation |
| `deadlines` | **User** | Institution-specific deadlines |
| `notifications` | **User** | Notification preferences |
| `guides` | **User** | Internal documentation |
| `email_configs` | **Admin** | SMTP configuration |
| `twilio_configs` | **Admin** | SMS configuration |
| `csv_schemas` | System | Data import schemas |
| `field_mappings` | System | CSV field mapping |
| `validation_rules` | System | CSV validation |
| `transformation_logs` | System | Import audit |
| `error_records` | System | Import errors |
| `system_logs` | System | Application logging |
| `audit_logs` | System | Compliance audit trail |

---

## 8. Executive Order Coverage Gap

### The Problem

Executive Orders are a critical regulatory signal — especially for regulations
like Title IX where EOs can modify, conflict with, or supersede existing
requirements. The MCP Engine is the ONLY source of EO data in the system (no
seeds, no manual entry), but EOs are **not reliably included in regulation
update packets**.

### Current State

| Fact | Detail |
|------|--------|
| EO source | MCP Engine only (via `executiveOrders` array in regulation updates) |
| EO seed data | **None** — no seed scripts create EO records |
| EO test payloads | **None** — `test-mcp-integration.cjs` has no `executiveOrders` |
| EOs in production | Only whatever MCP has sent and users have approved |
| Title IX + EOs | Title IX is directly affected by multiple EOs but there is no guarantee MCP sends them |
| Clery + EOs | No EOs expected (correct) |

### Known EOs That Should Be Tracked (Title IX)

These Executive Orders are known to impact Title IX and SHOULD be flowing from
the MCP Engine:

| EO | Title | Impact on Title IX |
|----|-------|-------------------|
| EO 13988 | Preventing and Combating Discrimination on the Basis of Gender Identity or Sexual Orientation | Reinforces — expands protections |
| EO 14021 | Guaranteeing an Educational Environment Free from Discrimination on the Basis of Sex | Modifies — directed DOE to review Title IX |
| EO 14160 | Defending Women From Gender Ideology Extremism (Jan 2025) | Conflicts — redefines sex, impacts Title IX scope |
| Any future EOs | MCP Engine should detect and send automatically | — |

### What MCP Engine Must Do

1. **Include `executiveOrders` array in EVERY regulation update** where EOs
   apply — not just sometimes
2. **Send EO status changes** (e.g., when an EO is enjoined by a court) as
   follow-up updates
3. **Include the full EO field set** (see Section 3 above — `publishedDate`,
   `federalRegisterCitation`, `topics`, `summary`, `pdfUrl`, injunction fields)
4. **Send EO-only updates** — If an EO changes status but the regulation text
   hasn't changed, MCP should still send an update packet so the impact
   assessment stays current

---

## 9. Compliance Task Formatting Standard

### The Problem

Tasks from the MCP Engine arrive with inconsistent formatting across
regulations. Some have rich hierarchical structures, some are flat lists. Some
include evidence requirements, some don't. The Clery Act task structure is the
closest to a "gold standard" but even it doesn't use all available fields.

### The Clery Standard (Current Best)

The Clery Act tasks use this pattern:

```
10 parent tasks (one per compliance area)
├── 35 subtasks (3-5 per parent)
│
Fields populated: title, description, assignedRole, priority,
                  evidenceRequired, evidenceType, dueDate, sortOrder
│
Fields NOT populated: taskId, category, statutoryRole, statutoryCitation,
                      instructions, evidenceInstructions, requirementType,
                      recurringSchedule, reminderDays
```

### The FULL Standard (What ALL Regulations Should Follow)

Every regulation's tasks from MCP should follow this complete structure:

```typescript
// Parent task (one per compliance area/section)
{
  tempId: "REGKEY-SECTION",           // e.g. "CLERY-ASR", "TIX-COORDINATOR"
  taskId: "CLERY-001",               // Persistent ID: REG-NNN
  title: "Annual Security Report",
  description: "Comprehensive description of the compliance requirement",
  instructions: "Step-by-step instructions for completing this task",
  category: "Reporting",             // Task grouping for UI
  assignedRole: "Director of Campus Safety",
  statutoryRole: "Campus Security Authority",  // Legal role from statute
  statutoryCitation: "20 USC §1092(f)",       // Legal citation
  requirementType: "requirement",              // vs "best_practice"
  priority: "critical",
  dueDate: "2026-10-01",
  recurringSchedule: "annual",
  reminderDays: 30,
  evidenceRequired: true,
  evidenceType: "document",
  evidenceInstructions: "Upload the published ASR PDF and DOE submission receipt",
  sortOrder: 1
}

// Subtask (under the parent)
{
  tempId: "CLERY-ASR-DRAFT",
  parentTempId: "CLERY-ASR",
  taskId: "CLERY-001-A",
  title: "Draft ASR content",
  description: "...",
  instructions: "...",
  category: "Reporting",
  assignedRole: "Compliance Officer",
  statutoryRole: "Campus Security Authority",
  statutoryCitation: "20 USC §1092(f)(1)",
  requirementType: "requirement",
  priority: "high",
  dueDate: "2026-08-01",
  recurringSchedule: "annual",
  reminderDays: 14,
  evidenceRequired: true,
  evidenceType: "document",
  evidenceInstructions: "Upload draft ASR document for review",
  sortOrder: 1
}
```

### Field Requirements for MCP Engine

| Field | Required? | MCP Engine Must Send? | Notes |
|-------|:---------:|:--------------------:|-------|
| `tempId` | Yes | Yes | Unique ID within the payload |
| `parentTempId` | Subtasks | Yes | Links to parent's tempId |
| `taskId` | Yes | **YES — NEW** | Persistent ID (REG-001, REG-001-A) |
| `title` | Yes | Yes | |
| `description` | Yes | Yes | Full description |
| `instructions` | Yes | **YES — NEW** | Step-by-step guidance |
| `category` | Yes | **YES — NEW** | Grouping (Reporting, Training, Policy, etc.) |
| `assignedRole` | Yes | Yes | Suggested role |
| `statutoryRole` | Yes | **YES — NEW** | Legal role from statute |
| `statutoryCitation` | Yes | **YES — NEW** | Legal citation |
| `requirementType` | Yes | **YES — NEW** | `requirement` or `best_practice` |
| `priority` | Yes | Yes | `low`, `medium`, `high`, `critical` |
| `dueDate` | When known | Yes | ISO date or description |
| `recurringSchedule` | When applicable | **YES — NEW** | `annual`, `quarterly`, `monthly` |
| `reminderDays` | When applicable | **YES — NEW** | Days before due date |
| `evidenceRequired` | Yes | Yes | |
| `evidenceType` | Yes | Yes | `document`, `link`, `form`, etc. |
| `evidenceInstructions` | When evidence required | **YES — NEW** | What to upload |
| `sortOrder` | Yes | Yes | Ordering within parent |

### Cross-Regulation Comparison (Current State)

| Field | Clery | FERPA | Title IX | MCP Updates | MCP Create |
|-------|:-----:|:-----:|:--------:|:-----------:|:----------:|
| Hierarchy (parent/child) | ✅ | ✅ | ✅ | ✅ | ✅ |
| title, description | ✅ | ✅ | ✅ | ✅ | ✅ |
| assignedRole | ✅ | ✅ | ✅ | ✅ | ✅ |
| priority | ✅ | ✅ | ✅ | ✅ | ✅ |
| evidenceRequired/Type | ✅ | ✅ | ✅ | ✅ | ✅ |
| dueDate | ✅ | ✅ | ✅ | ✅ | ✅ |
| sortOrder | ✅ | ✅ | ✅ | ❌ | ✅ |
| **taskId** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **instructions** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **category** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **statutoryRole** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **statutoryCitation** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **requirementType** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **recurringSchedule** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **reminderDays** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **evidenceInstructions** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **escalationEmail** | ❌ | ❌ | ❌ | ❌ | ❌ |

**Bottom line:** No regulation — not even Clery — currently uses the full task
schema. And the MCP Engine's two endpoints accept different subsets. This needs
to converge on ONE complete standard.

---

## 10. Updated Coordination Plan

### Phase A: Define the Standard (Week 1)

1. **Publish the Canonical Task Schema** (above) as the contract between MCP
   Engine and EdSteward. Every regulation's tasks must include ALL required
   fields.

2. **Publish the Canonical EO Schema** — expand to include `publishedDate`,
   `federalRegisterCitation`, `topics`, `summary`, `pdfUrl`, injunction fields,
   revocation fields.

3. **Agree on a single identifier system**: `regKey` (REG-001) for regulations,
   `taskId` (CLERY-001, CLERY-001-A) for tasks.

### Phase B: MCP Engine Changes (Week 2)

4. **Unify task output format** — MCP Engine must produce tasks with ALL
   fields in the standard, for EVERY regulation. No more sparse tasks.

5. **Include Executive Orders in every applicable regulation update** —
   especially Title IX. Send EO-only updates when EO status changes.

6. **Expand EO payload** to include all fields in the schema.

7. **Unify MCP endpoint schemas** — both Create/Sync and Updates must accept
   the same complete field set.

### Phase C: EdSteward Changes (Week 2-3)

8. **Expand both endpoint schemas** to accept the full task standard
   (add `category`, `statutoryRole`, `statutoryCitation`, `escalationEmail`,
   `escalationName` to both).

9. **Unify field naming** across endpoints (pick camelCase, stick to it).

10. **Unify auth** to a single mechanism (API key recommended).

11. **Update seed scripts** to use the full standard as reference
    implementations.

### Phase D: Verify (Week 3)

12. **Integration tests** — send a full payload through each endpoint, verify
    every field lands in the DB.

13. **Cross-regulation audit** — verify Clery, FERPA, Title IX, GLBA, OSHA,
    and all other regulations have complete task sets with all required fields.

14. **EO audit** — verify all known EOs are linked to their affected
    regulations.

---

## 11. Implementation Status (Phase 6 — EdSteward Changes)

**Completed February 12, 2026** — All 5 categories from the MCP Engine team
brief have been implemented.

### Changes Made

#### 1. `shared/schema.ts` — New Database Columns

| Table | New Columns |
|-------|------------|
| `regulations` | `publicLaw`, `purpose`, `scope`, `reportingRequirements` (jsonb), `riskAssessment` (jsonb) |
| `compliance_tasks` | `estimatedEffort`, `deliverable`, `deliverableTemplateUrl` |
| `eo_regulation_impacts` | `affectedSections` (jsonb) |

**Note:** A database migration is required to add these columns. Run:

```sql
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS public_law TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS reporting_requirements JSONB;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS risk_assessment JSONB;

ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS estimated_effort TEXT;
ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS deliverable TEXT;
ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS deliverable_template_url TEXT;

ALTER TABLE eo_regulation_impacts ADD COLUMN IF NOT EXISTS affected_sections JSONB;
```

#### 2. `server/regulation-updates-api.ts` — Updates Endpoint

- **`mcpEngineUpdateSchema`** expanded from ~15 to 48+ fields
- Accepts `mcpRegKey` as alias for `regKey`
- Accepts all regulation fields with camelCase canonical + snake_case fallback
- New fields: `statuteIds`, `publicLaw`, `purpose`, `scope`, `complianceNotes`,
  `verificationMethod`, `nextReviewDate`, `applicableForms`, `sources`,
  `sections`, `relatedRegulations`, `reportingRequirements`, `riskAssessment`,
  `lovvLevel`, `versionHash`, `stateCode`, all agency fields, all URL fields
- **Task schema**: Canonical 21-field `mcpComplianceTaskSchemaCanonical`
  (shared at module level)
- **EO schema**: Canonical 22-field `mcpExecutiveOrderSchemaCanonical`
- All new fields stored in `metadata.regulationFields` for processing on
  approval
- **Auth**: Now accepts `X-MCP-API-Key` header in addition to Basic Auth

#### 3. `server/mcp-integration-api.ts` — Create/Sync Endpoint

- **`createRegulationWithTasksSchema`** expanded to full 48-field parity
- Accepts `regKey` and `mcpRegKey`
- New fields match Updates endpoint exactly
- **Task schema**: Canonical 21 fields including `taskId`, `category`,
  `statutoryRole`, `statutoryCitation`, `requirementType`,
  `recurringSchedule`, `reminderDays`, `evidenceInstructions`,
  `estimatedEffort`, `deliverable`, `deliverableTemplateUrl`
- **EO schema**: Full 22-field schema with `publishedDate`,
  `federalRegisterCitation`, `topics`, `pdfUrl`, `affectedSections`,
  injunction/revocation fields
- **EO processing**: Create endpoint now upserts EOs and impact records
  directly (previously only handled on Update approval)
- **Auth**: Unified — accepts `X-MCP-API-Key` (preferred), env-configured
  Basic Auth, or legacy credentials (deprecated, logged as warning)
- **Task insert**: Uses `buildTaskValues()` helper with all 21 fields
  (Create) and `buildSyncTaskValues()` (Sync)

#### 4. Auth Unification

All three MCP endpoint groups now accept `X-MCP-API-Key` header:

| Endpoint | Auth Method |
|----------|------------|
| `/api/mcp/regulations/create` | X-MCP-API-Key (preferred) + Basic Auth fallback |
| `/api/mcp/regulations/sync` | X-MCP-API-Key (preferred) + Basic Auth fallback |
| `/api/regulation-updates` | X-MCP-API-Key (preferred) + Basic Auth fallback |
| `/api/mcp/versions/*` (orchestrator) | X-MCP-API-Key (unchanged) |

Legacy hardcoded credentials in Create/Sync are deprecated and log a warning.

### Completed Work (Feb 12, 2026)

- [x] **Database migration** — `scripts/migrate-mcp-schema-alignment.cjs`
  ran successfully on all 6 tenant databases (DATABASE_URL, MORAVIAN,
  STAGING, DEV, WOSSAMOTTA, TEMPLATE). 8/9 columns verified on tenants
  without EO tables; 9/9 on main/Moravian. Also expanded `reg_key`
  VARCHAR(10)→VARCHAR(100) and `eo_number` VARCHAR(20)→VARCHAR(50).
- [x] **`storage.ts` `acceptRegulationUpdate()`** — Updated to:
  - Apply all expanded regulation fields from `metadata.regulationFields`
    when CCO approves (Section 2.5)
  - Use full 21-field task schema for task INSERT/UPDATE (including
    `estimated_effort`, `deliverable`, `deliverable_template_url`,
    `recurring_schedule`, `evidence_instructions`)
  - Use full 22-field EO schema for Executive Order upsert (including
    `summary`, `pdfUrl`, `federalRegisterCitation`, `topics`,
    `affectedSections`, injunction/revocation fields)
- [x] **Integration tests** — `scripts/test-mcp-schema-alignment.cjs`
  passes all 45 assertions across all 3 MCP endpoints:
  - Create: 33 checks (regulation fields, tasks, EOs + impacts)
  - Sync: 10 checks (create + upsert with field updates)
  - Updates: 2 checks (MCP payload acceptance + auto-create)
- [x] **Bug fixes discovered during testing:**
  - `autoCreateRegulationIfNotExists()` passed non-numeric `itemId` to
    `getRegulationById()` causing NaN error → fixed with parseInt guard
  - Drizzle `db.execute()` result was destructured incorrectly for EO
    insert (`(intermediate value) is not iterable`) → fixed to use
    `.rows` accessor
  - PostgreSQL `text[]` array columns can't receive JS arrays through
    Drizzle's `sql` template → fixed by passing PG array literal strings
  - `eori_unique_idx` constraint doesn't exist → fixed to use
    `ON CONFLICT (eo_id, regulation_id)` column-based conflict detection

### MCP Engine Team — Confirmed Aligned (Feb 12, 2026)

The MCP Engine team completed all 7 items from `docs/MCP-ENGINE-BRIEF.md`:

1. **9 missing fields added** to payload builder: `submissionGuidelines`,
   `reportingFrequency`, `agencyDepartment`, `regulationUrl`,
   `requirementsUrl`, `submissionGuideUrl`, `formsUrl`,
   `applicableInstitutions`, `filingDeadlines`
2. **`reportingRequirements` restructured** from raw text to EdSteward's
   expected object format: `{frequency, deadline, format, recipient, rawText}`
3. **Auth migrated** from Basic Auth to `X-MCP-API-Key` across all 4 delivery
   paths (8 call sites): `push-regulation-to-edsteward.js`,
   `delivery-server.js` (3 endpoints), `edsteward-integration.js` (4 sites).
   Graceful fallback to Basic Auth when `MCP_API_KEY` not set.
4. **Task quality improved** — all 10 rules engine patterns now emit
   `estimatedEffort` and `deliverable` on every task
5. **EO sweep executed** — 153 new EO-regulation links across 80 regulations
6. **Task generation executed** — 198 new compliance tasks across 175
   regulations
7. **Final verification**: 57/57 expected fields present — **FULLY ALIGNED**

**Remaining action:** Set `MCP_API_KEY` env var in EdSteward production/staging
once provisioned.

### Remaining EdSteward Work

- [ ] **Provision `MCP_API_KEY`** — Generate API key, set in `.env` and AWS
  Parameter Store, share with MCP Engine team
- [ ] **Seed script updates** — Update Clery/FERPA/Title IX seeds to use full
  21-field task standard
- [ ] **Run `eo_regulation_impacts` migration** on STAGING, DEV, WOSSAMOTTA,
  TEMPLATE databases (they lack the EO tables entirely)
- [ ] **End-to-end verification** — Run `test-mcp-schema-alignment.cjs` against
  staging after MCP Engine deploys their changes
- [ ] **Deploy to production** — Tag, deploy staging, verify, deploy production

---

_Schema alignment between MCP Engine and EdSteward is now complete on both
sides. The dual-system philosophy is fully operational — MCP Engine provides
regulatory knowledge, EdSteward handles institutional operations._
