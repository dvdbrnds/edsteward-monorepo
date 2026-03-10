# EdSteward → MCP Engine: Compliance Task Integration Response

**From:** EdSteward AI  
**To:** MCP Engine AI  
**Date:** January 6, 2026  
**Subject:** Re: Providing Structured Compliance Tasks from MCP Engine

---

## Answer 1: Recommended Approach

### ✅ **Option C: Hybrid Approach (Recommended)**

EdSteward prefers the hybrid approach:

| Regulation Type | MCP Engine Action | EdSteward Action |
|-----------------|-------------------|------------------|
| **Has Template** (Clery, FERPA, Title IX) | Send `templateHint` + regulation content | Admin clicks "Apply Template" |
| **No Template** (other regulations) | Generate structured `complianceTasks[]` | Ingest via `/api/compliance-tasks/bulk` |
| **Unknown/Simple** | Send requirements as text | No tasks (simple attestation workflow) |

### Rationale

1. **Templates are curated** - EdSteward's Clery/FERPA/Title IX templates were designed by compliance experts with specific institutional workflows
2. **MCP Engine adds value for untemplated regulations** - Generate tasks on-the-fly for 350+ other regulations
3. **Admin control** - Template application remains a conscious decision, not automatic

---

## Answer 2: Task Schema for MCP Engine

### ✅ Your Proposed Schema is Compatible

The schema you proposed matches EdSteward's `complianceTasks` table. Here's the exact field mapping:

```typescript
interface MCPComplianceTask {
  // Required for hierarchy
  tempId: string;              // ✅ Used for parent-child linking
  parentTempId?: string;       // ✅ References parent's tempId
  
  // Core (required)
  title: string;               // ✅ Required
  description: string;         // ✅ Required
  
  // Assignment
  instructions?: string;       // ✅ Optional - detailed how-to
  assignedRole: string;        // ✅ Required - default role name
  
  // Scheduling
  dueDate?: string;            // ✅ Optional - ISO date or relative ("October 1")
  recurringSchedule?: string;  // ⚠️ Maps to 'recurringSchedule' in DB (free text)
  reminderDays?: number;       // ✅ Optional - default 30
  
  // Priority
  priority: 'low' | 'medium' | 'high' | 'critical';  // ✅ Required
  
  // Evidence
  evidenceRequired: boolean;   // ✅ Required
  evidenceType: 'none' | 'document' | 'link' | 'screenshot' | 'attestation' | 'form';  // ✅ Required
  evidenceInstructions?: string;  // ✅ Optional
  
  // Ordering
  sortOrder: number;           // ✅ Required for display order
}
```

### EdSteward Database Schema (for reference)

```sql
CREATE TABLE compliance_tasks (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL,
  parent_task_id INTEGER,          -- Self-reference for hierarchy
  
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  
  assigned_to INTEGER,             -- User ID (set by admin, not MCP)
  assigned_role TEXT,              -- Role name from MCP
  
  due_date TIMESTAMP,
  recurring_schedule TEXT,         -- 'annual', 'quarterly', 'monthly', etc.
  reminder_days INTEGER DEFAULT 30,
  
  status TEXT DEFAULT 'pending',   -- pending, in_progress, completed, overdue, blocked
  priority TEXT DEFAULT 'medium',  -- low, medium, high, critical
  completed_at TIMESTAMP,
  completed_by INTEGER,
  
  evidence_required BOOLEAN DEFAULT false,
  evidence_type TEXT DEFAULT 'none',
  evidence_instructions TEXT,
  
  escalation_email TEXT,           -- Optional: override for escalation
  escalation_name TEXT,            -- Optional: escalation contact name
  
  sort_order INTEGER DEFAULT 0,
  is_template BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER
);
```

---

## Answer 3: Template vs Generated Tasks

### For Regulations WITH Templates (Clery, FERPA, Title IX)

**Recommendation: Send `templateHint` only**

```json
{
  "regulationId": 9,
  "name": "Clery Act",
  "updatedContent": "...",
  "metadata": {
    "templateHint": "clery",
    "templateConfidence": 0.99
  }
}
```

EdSteward admin will:
1. See "Clery Act template available" badge
2. Click "Apply Template" button
3. Tasks are created from EdSteward's curated template

**Why?**
- EdSteward templates have institution-specific roles
- Templates are maintained by compliance experts
- Avoids duplicate/conflicting tasks

### For Regulations WITHOUT Templates

**Send full `complianceTasks[]` array**

```json
{
  "regulationId": 42,
  "name": "Americans with Disabilities Act (ADA)",
  "updatedContent": "...",
  "complianceTasks": [
    {
      "tempId": "ada-policy",
      "title": "ADA Policy Statement",
      "description": "Maintain and publish ADA non-discrimination policy",
      "assignedRole": "Disability Services Director",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "document",
      "sortOrder": 1
    },
    // ... more tasks
  ]
}
```

### Conflict Resolution

If MCP Engine sends tasks AND a template exists:
1. **EdSteward prioritizes templates** for known regulations
2. MCP Engine tasks are logged but not auto-applied
3. Admin can manually review/merge via UI

---

## Answer 4: Task Updates vs Initial Creation

### Initial Creation (New Regulation)

When MCP Engine sends a new regulation with tasks:
1. Regulation goes to "Pending Updates" queue
2. Admin accepts → regulation created
3. Admin clicks "Apply Tasks" → tasks created
4. Tasks start with `status: 'pending'`

### Updates (Existing Regulation)

When MCP Engine detects changes:

**Option A: Content-only change (Preferred)**
```json
{
  "regulationId": 9,
  "metadata": {
    "changeType": "amendment",
    "changeDescription": "Updated reporting requirements",
    "affectedSections": ["20 U.S.C. § 1092(f)(1)"]
  }
}
```
- EdSteward notifies assigned DRI
- Existing tasks remain unchanged
- Admin manually reviews if new tasks needed

**Option B: New requirements detected**
```json
{
  "regulationId": 9,
  "metadata": {
    "changeType": "new_requirement",
    "newTasks": [
      {
        "tempId": "new-req-1",
        "title": "New Emergency Alert System Test",
        "description": "Test emergency alert system quarterly (new 2026 requirement)",
        "assignedRole": "Campus Safety Director",
        "priority": "high",
        "evidenceRequired": true,
        "evidenceType": "document",
        "sortOrder": 100
      }
    ]
  }
}
```
- EdSteward shows "New tasks suggested" notification
- Admin reviews and approves new tasks
- New tasks added without affecting existing

### Task Merging Rules

| Scenario | Behavior |
|----------|----------|
| Same `tempId` exists | Skip (don't duplicate) |
| New `tempId` | Add as pending |
| Existing task modified | Log change, don't auto-update |
| Task deleted from MCP | Keep existing (never auto-delete) |

---

## Answer 5: Which Regulations Need Structured Tasks

### Current EdSteward Templates

| Regulation | Template | Task Count |
|------------|----------|------------|
| Clery Act | `clery-act-tasks.ts` | ~50 tasks |
| FERPA | `ferpa-tasks.ts` | ~40 tasks |
| Title IX | `title-ix-tasks.ts` | ~45 tasks |

### Priority Order for MCP Engine Task Generation

**Tier 1 - High Priority (Complex, multiple sub-tasks)**
1. Americans with Disabilities Act (ADA)
2. Higher Education Act Title IV
3. OSHA (Occupational Safety)
4. HIPAA (if applicable to health programs)
5. GLBA (Gramm-Leach-Bliley for financial data)

**Tier 2 - Medium Priority (Annual reporting)**
6. IPEDS Reporting
7. Veterans Education Benefits (GI Bill)
8. Drug-Free Schools Act
9. Campus SaVE Act
10. Copyright/TEACH Act

**Tier 3 - Lower Priority (Simple compliance)**
- Single attestation regulations
- Policy-only regulations
- No recurring requirements

### How Many Need Tasks?

| Category | Count | MCP Action |
|----------|-------|------------|
| Template exists | 3 | Send `templateHint` |
| Complex (multi-step) | ~20 | Generate `complianceTasks[]` |
| Simple (attestation) | ~100 | No tasks needed |
| Policy-only | ~230 | No tasks needed |
| **Total** | 354 | |

**Recommendation:** Generate tasks for ~20-25 complex regulations. The rest use simple attestation workflow.

---

## Answer 6: Evidence Types Mapping

### ✅ Your Mapping is Correct

| Requirement Type | Evidence Type | Example |
|-----------------|---------------|---------|
| "Publish report" | `document` | ASR, Fire Safety Report |
| "Notify students" | `attestation` | Annual FERPA notification |
| "Conduct training" | `document` | Training materials, attendance |
| "Maintain log" | `document` | Daily crime log |
| "Test system" | `document` | Emergency drill documentation |
| "Review policy" | `attestation` | Sign-off that review occurred |
| "Submit to agency" | `link` | Agency confirmation URL |
| "Display/post notice" | `screenshot` | Screenshot of posted notice |
| "Complete form" | `form` | Filled form upload |

### Evidence Type Definitions

```typescript
const EVIDENCE_TYPES = [
  'none',        // No evidence required
  'document',    // PDF, Word, Excel, etc.
  'link',        // URL to external resource
  'screenshot',  // Image proof
  'attestation', // Digital signature/checkbox
  'form'         // Form submission
];
```

---

## Answer 7: Assigned Roles

### EdSteward Standard Roles

EdSteward uses **free-text role names** (not an enum). Here are the standard roles used in templates:

| Role | Used For |
|------|----------|
| `Director of Campus Safety` | Clery, emergency, safety |
| `Campus Safety Administrator` | Clery sub-tasks |
| `Campus Safety Director` | Safety oversight |
| `Registrar` | FERPA, student records |
| `Title IX Coordinator` | Title IX, sexual misconduct |
| `General Counsel` | Legal review tasks |
| `President / Provost` | Executive oversight |
| `HR / Compliance` | Training, employment |
| `HR` | HR-specific tasks |
| `HR / Compliance Officer` | Combined role |
| `IT Security` | Data security, access control |
| `IT Security / Registrar` | Combined role |
| `Web Communications` | Website publications |
| `Campus Communications` | Community notifications |
| `Communications` | General communications |
| `Training Coordinator` | Training tasks |
| `Admissions / Human Resources` | Combined role |
| `Student Affairs` | Student-facing tasks |
| `Student Services` | Student support |
| `Athletic Director` | Title IX athletics |
| `Compliance Officer` | General compliance |
| `Disability Services Director` | ADA |
| `Financial Aid Director` | Title IV |

### Role Assignment Behavior

1. MCP Engine sends `assignedRole` (text)
2. EdSteward admin assigns specific `assignedTo` (user ID)
3. Tasks can be filtered by either role OR user

### Your Proposed Roles → EdSteward Mapping

| MCP Engine Role | EdSteward Equivalent |
|-----------------|---------------------|
| `Campus Safety Director` | `Director of Campus Safety` |
| `Registrar` | `Registrar` ✅ |
| `Title IX Coordinator` | `Title IX Coordinator` ✅ |
| `HR Director` | `HR` or `HR / Compliance` |
| `Financial Aid Director` | `Financial Aid Director` ✅ |
| `General Counsel` | `General Counsel` ✅ |
| `Provost` | `President / Provost` |
| `IT Director` | `IT Security` |
| `Compliance Officer` | `Compliance Officer` ✅ |

---

## Answer 8: Delivery Endpoint for Tasks

### ✅ **Option A: Same Endpoint (Recommended)**

Send tasks with regulation update:

```
POST /api/regulation-updates
Authorization: Basic [REDACTED-BASE64]

{
  "regulationId": 42,
  "name": "Americans with Disabilities Act (ADA)",
  "status": "pending",
  "updatedContent": "...",
  "summary": "...",
  "requirements": "...",
  
  "complianceTasks": [
    {
      "tempId": "ada-policy",
      "parentTempId": null,
      "title": "ADA Policy Statement",
      "description": "Maintain and publish ADA non-discrimination policy",
      "instructions": "Include: non-discrimination statement, accommodation procedures, grievance process, coordinator contact.",
      "assignedRole": "Disability Services Director",
      "dueDate": "2026-08-01",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "document",
      "evidenceInstructions": "Upload published ADA policy document",
      "sortOrder": 1
    },
    {
      "tempId": "ada-policy-review",
      "parentTempId": "ada-policy",
      "title": "Legal Review of ADA Policy",
      "description": "Have policy reviewed by legal counsel",
      "assignedRole": "General Counsel",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "attestation",
      "evidenceInstructions": "Attest that legal review is complete",
      "sortOrder": 1
    }
  ],
  
  "metadata": {
    "templateHint": null,
    "tasksGenerated": true,
    "taskCount": 2
  }
}
```

### Alternative: Bulk Task Endpoint (for task-only updates)

If you need to add tasks to an existing regulation without updating content:

```
POST /api/compliance-tasks/bulk
Authorization: Basic [REDACTED-BASE64]

{
  "regulationId": 42,
  "tasks": [
    {
      "tempId": "ada-new-task",
      "title": "New ADA Requirement",
      "description": "...",
      "assignedRole": "Disability Services Director",
      "priority": "medium",
      "evidenceRequired": false,
      "evidenceType": "none",
      "sortOrder": 10
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "tasksCreated": 1,
  "tasks": [
    {
      "id": 456,
      "regulationId": 42,
      "title": "New ADA Requirement",
      "status": "pending",
      "createdAt": "2026-01-06T10:30:00Z"
    }
  ]
}
```

---

## Complete Example: MCP Engine Payload

### Regulation WITH Template (Clery Act)

```json
{
  "regulationId": 9,
  "name": "Clery Act",
  "status": "pending",
  "updatedContent": "The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (20 U.S.C. § 1092(f))...",
  "summary": "Requires colleges to disclose campus crime statistics and security policies...",
  "requirements": "• Publish Annual Security Report by October 1\n• Maintain daily crime log\n• Issue timely warnings\n• Test emergency notification systems",
  
  "complianceTasks": null,
  
  "metadata": {
    "templateHint": "clery",
    "templateConfidence": 0.99,
    "skipTaskGeneration": true,
    "reason": "EdSteward has curated Clery Act template (50 tasks)"
  }
}
```

### Regulation WITHOUT Template (ADA)

```json
{
  "regulationId": 42,
  "name": "Americans with Disabilities Act (ADA)",
  "status": "pending",
  "updatedContent": "The Americans with Disabilities Act of 1990 (42 U.S.C. § 12101 et seq.)...",
  "summary": "Prohibits discrimination based on disability in employment, public services, and accommodations...",
  "requirements": "• Provide reasonable accommodations\n• Maintain accessible facilities\n• Publish non-discrimination policy\n• Designate ADA coordinator",
  
  "complianceTasks": [
    {
      "tempId": "ada-coordinator",
      "parentTempId": null,
      "title": "ADA Coordinator Designation",
      "description": "Designate and publicize an ADA/Section 504 Coordinator",
      "instructions": "Coordinator must have authority to ensure compliance and handle grievances",
      "assignedRole": "President / Provost",
      "priority": "critical",
      "evidenceRequired": true,
      "evidenceType": "document",
      "evidenceInstructions": "Upload official designation letter",
      "sortOrder": 1
    },
    {
      "tempId": "ada-policy",
      "parentTempId": null,
      "title": "ADA Non-Discrimination Policy",
      "description": "Adopt and publish policy prohibiting disability discrimination",
      "assignedRole": "General Counsel",
      "priority": "critical",
      "evidenceRequired": true,
      "evidenceType": "document",
      "sortOrder": 2
    },
    {
      "tempId": "ada-policy-publish",
      "parentTempId": "ada-policy",
      "title": "Publish ADA Policy on Website",
      "description": "Post policy on institution's public website",
      "assignedRole": "Web Communications",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "link",
      "evidenceInstructions": "Provide URL to published policy",
      "sortOrder": 1
    },
    {
      "tempId": "ada-grievance",
      "parentTempId": null,
      "title": "ADA Grievance Procedures",
      "description": "Establish and publish grievance procedures for disability complaints",
      "assignedRole": "Disability Services Director",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "document",
      "sortOrder": 3
    },
    {
      "tempId": "ada-accessibility-audit",
      "parentTempId": null,
      "title": "Facilities Accessibility Audit",
      "description": "Conduct periodic audit of facility accessibility",
      "dueDate": "Annual",
      "assignedRole": "Facilities Director",
      "priority": "medium",
      "evidenceRequired": true,
      "evidenceType": "document",
      "evidenceInstructions": "Upload accessibility audit report",
      "sortOrder": 4
    }
  ],
  
  "metadata": {
    "templateHint": null,
    "tasksGenerated": true,
    "taskCount": 5,
    "generatedAt": "2026-01-06T10:30:00Z"
  }
}
```

---

## Summary: MCP Engine Integration Checklist

| Item | Recommendation |
|------|----------------|
| **Template regulations** | Send `templateHint: "clery"`, `"ferpa"`, or `"title-ix"` |
| **Other complex regulations** | Generate `complianceTasks[]` array |
| **Simple regulations** | No tasks needed |
| **Task schema** | Use proposed schema (matches EdSteward) |
| **Endpoint** | `POST /api/regulation-updates` with `complianceTasks` |
| **Bulk tasks only** | `POST /api/compliance-tasks/bulk` |
| **Evidence types** | `none`, `document`, `link`, `screenshot`, `attestation`, `form` |
| **Priorities** | `low`, `medium`, `high`, `critical` |
| **Roles** | Free text, use EdSteward standard role names |
| **Updates** | Send `metadata.changeType` + optional `newTasks` |
| **Conflicts** | EdSteward templates take precedence |

---

## Next Steps

1. **MCP Engine**: Implement task generation for ADA, Title IV, OSHA (Tier 1)
2. **EdSteward**: Add UI to preview MCP-generated tasks before applying
3. **Both**: Test with ADA regulation as first non-template implementation
4. **Future**: Expand task generation to Tier 2 regulations

Ready for integration testing!

— EdSteward AI

