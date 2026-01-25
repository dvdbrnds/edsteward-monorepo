# EdSteward Integration: Executive Order Impact Tracking

**From:** MCP Engine  
**To:** EdSteward AI  
**Date:** January 24, 2026  
**Subject:** Adding Executive Order Impact Tracking to Regulations

---

## Overview

MCP Engine now tracks Presidential Executive Orders and their impact on federal regulations. We need EdSteward to:
1. Store Executive Order data
2. Display EO impacts on regulation detail pages
3. Alert compliance officers when EOs affect their regulations

---

## 1. DATABASE SCHEMA

### Table: `executive_orders`

```sql
CREATE TABLE executive_orders (
  id SERIAL PRIMARY KEY,
  eo_number VARCHAR(20) NOT NULL UNIQUE,        -- e.g., "EO 14322"
  title VARCHAR(500) NOT NULL,
  signed_date DATE NOT NULL,
  published_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, enjoined, revoked, superseded
  president VARCHAR(100),                        -- e.g., "Donald Trump"
  term VARCHAR(20),                              -- e.g., "Trump-2", "Biden-1"
  summary TEXT,                                  -- Federal Register abstract
  full_text_url VARCHAR(500),                   -- Link to Federal Register
  pdf_url VARCHAR(500),
  federal_register_citation VARCHAR(100),       -- e.g., "90 FR 12345"
  topics TEXT[],                                 -- Array of keywords
  -- Court actions
  enjoined_date DATE,
  enjoined_by VARCHAR(255),                     -- Court that issued injunction
  revoked_date DATE,
  revoked_by VARCHAR(20),                       -- EO number that revoked this
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eo_status ON executive_orders(status);
CREATE INDEX idx_eo_signed_date ON executive_orders(signed_date DESC);
CREATE INDEX idx_eo_president ON executive_orders(president);
```

### Table: `eo_regulation_impacts`

```sql
CREATE TABLE eo_regulation_impacts (
  id SERIAL PRIMARY KEY,
  eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  
  -- Impact classification
  impact_type VARCHAR(20) NOT NULL,             -- modifies, reinforces, conflicts, supersedes
  impact_severity VARCHAR(20) NOT NULL,         -- critical, high, medium, low
  impact_summary TEXT,                          -- AI-generated analysis (from MCP Engine)
  
  -- Assessment metadata
  assessed_by VARCHAR(100),                     -- "MCP Engine AI" or "Manual Review"
  assessment_date DATE,
  confidence_score DECIMAL(3,2),                -- 0.00-1.00
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(eo_id, regulation_id)
);

CREATE INDEX idx_eori_regulation ON eo_regulation_impacts(regulation_id);
CREATE INDEX idx_eori_severity ON eo_regulation_impacts(impact_severity);
```

### Table: `eo_status_history` (Optional - for tracking court actions)

```sql
CREATE TABLE eo_status_history (
  id SERIAL PRIMARY KEY,
  eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  change_date DATE NOT NULL,
  change_reason TEXT,                           -- e.g., "Enjoined by 5th Circuit Court"
  source_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. UPDATED REGULATION PAYLOAD

MCP Engine will now include `executiveOrders` in the regulation update payload:

```json
{
  "regulationId": 7,
  "name": "Title IX of the Education Amendments of 1972",
  "status": "pending",
  "updatedContent": "...",
  "summary": "...",
  "requirements": "...",
  "filingDeadlines": "...",
  "complianceTasks": [...],
  
  "executiveOrders": [
    {
      "eoNumber": "EO 14322",
      "title": "Saving College Sports",
      "signedDate": "2025-07-24",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "impactType": "modifies",
      "impactSeverity": "high",
      "impactSummary": "This Executive Order does not directly impact Title IX's anti-retaliation provisions, as EO 14322 focuses on preserving college sports through addressing athlete compensation and transfer rules rather than modifying civil rights protections. However, institutions should monitor for potential indirect effects if the Executive Order's emphasis on preserving 'non-revenue sports' and women's sports leads to future policy changes that could intersect with Title IX's gender equity requirements in athletics.",
      "fullTextUrl": "https://www.federalregister.gov/documents/2025/07/29/2025-14392/saving-college-sports",
      "confidenceScore": 0.9
    },
    {
      "eoNumber": "EO 14281",
      "title": "Restoring Equality of Opportunity and Meritocracy",
      "signedDate": "2025-04-23",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "impactType": "modifies",
      "impactSeverity": "critical",
      "impactSummary": "EO 14281 could indirectly affect Title IX enforcement by directing agencies to 'deprioritize enforcement' of regulations involving disparate-impact liability. Higher education institutions should continue maintaining robust Title IX policies but monitor for OCR guidance changes.",
      "fullTextUrl": "https://www.federalregister.gov/documents/2025/04/28/2025-07378/restoring-equality-of-opportunity-and-meritocracy",
      "confidenceScore": 0.9
    }
  ],
  
  "metadata": {
    "source_attribution": "eCFR + Federal Register",
    "eo_count": 2,
    "eo_critical_count": 1,
    "processing_metadata": {
      "processed_at": "2026-01-24T22:00:00.000Z",
      "mcp_engine_version": "2.2"
    }
  }
}
```

---

## 3. IMPACT TYPES & SEVERITIES

### Impact Types
| Type | Description |
|------|-------------|
| `modifies` | EO changes how this regulation is enforced or interpreted |
| `reinforces` | EO strengthens or supports this regulation |
| `conflicts` | EO may conflict with this regulation's requirements |
| `supersedes` | EO effectively replaces or overrides this regulation |

### Impact Severities
| Severity | Description | UI Color |
|----------|-------------|----------|
| `critical` | Immediate compliance review required | Red |
| `high` | Significant impact, review within 30 days | Orange |
| `medium` | Moderate impact, monitor for guidance | Yellow |
| `low` | Minimal direct impact | Gray |

---

## 4. API ENDPOINTS (EdSteward should implement)

### Receive EO Updates with Regulations
```
POST /api/regulation-updates
```
(Existing endpoint - now accepts `executiveOrders` array in payload)

### Get EOs for a Regulation
```
GET /api/regulations/:regulationId/executive-orders
```

### Get All Active EOs
```
GET /api/executive-orders?status=active&limit=50
```

### Update EO Status (for court actions)
```
PATCH /api/executive-orders/:eoNumber/status
Body: {
  "status": "enjoined",
  "reason": "Enjoined by 5th Circuit Court of Appeals",
  "sourceUrl": "https://..."
}
```

---

## 5. UI RECOMMENDATIONS

### Regulation Detail Page
Add a section "Executive Orders Affecting This Regulation":

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Executive Orders Affecting This Regulation (2)           │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL: EO 14281 - Restoring Equality of Opportunity   │
│    Signed: Apr 23, 2025 | Status: Active                    │
│    Impact: May affect enforcement methodology               │
│    [View Full Text →] [View Analysis →]                     │
├─────────────────────────────────────────────────────────────┤
│ 🟠 HIGH: EO 14322 - Saving College Sports                   │
│    Signed: Jul 24, 2025 | Status: Active                    │
│    Impact: Monitor for women's sports implications          │
│    [View Full Text →] [View Analysis →]                     │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Widget
Add an "EO Alerts" widget showing:
- Count of regulations affected by recent EOs
- Critical/High severity impacts requiring attention
- EOs with status changes (enjoined, revoked)

### Notification Triggers
Send notifications when:
1. New EO impacts a regulation the user is responsible for
2. EO status changes (enjoined, revoked, superseded)
3. Impact severity is `critical`

---

## 6. EXAMPLE: FULL REGULATION WITH EOs

```json
{
  "regulationId": 7,
  "name": "Title IX of the Education Amendments of 1972",
  "status": "pending",
  "summary": "Title IX prohibits sex-based discrimination in education programs receiving federal funding...",
  "requirements": "• Designate Title IX Coordinator\n• Publish non-discrimination policy\n• Establish grievance procedures...",
  "filingDeadlines": "[{\"type\":\"Annual Report\",\"date\":\"October 1\",\"frequency\":\"annual\"}]",
  "complianceTasks": [],
  
  "executiveOrders": [
    {
      "eoNumber": "EO 14281",
      "title": "Restoring Equality of Opportunity and Meritocracy",
      "signedDate": "2025-04-23",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "impactType": "modifies",
      "impactSeverity": "critical",
      "impactSummary": "EO 14281 does not directly target Title IX's anti-retaliation provisions, but it could indirectly affect Title IX enforcement by directing agencies to 'deprioritize enforcement' of regulations involving disparate-impact liability. Higher education institutions should continue maintaining robust Title IX anti-retaliation policies but should monitor forthcoming OCR guidance.",
      "fullTextUrl": "https://www.federalregister.gov/documents/2025/04/28/2025-07378/restoring-equality-of-opportunity-and-meritocracy",
      "confidenceScore": 0.9
    },
    {
      "eoNumber": "EO 14322",
      "title": "Saving College Sports",
      "signedDate": "2025-07-24",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "impactType": "modifies",
      "impactSeverity": "high",
      "impactSummary": "This Executive Order focuses on preserving college sports through addressing athlete compensation. Monitor for potential indirect effects on women's sports that could intersect with Title IX's gender equity requirements in athletics.",
      "fullTextUrl": "https://www.federalregister.gov/documents/2025/07/29/2025-14392/saving-college-sports",
      "confidenceScore": 0.9
    },
    {
      "eoNumber": "EO 14280",
      "title": "Reinstating Commonsense School Discipline Policies",
      "signedDate": "2025-04-23",
      "status": "active",
      "president": "Donald Trump",
      "term": "Trump-2",
      "impactType": "modifies",
      "impactSeverity": "low",
      "impactSummary": "No direct impact on higher education Title IX. This EO focuses on K-12 school discipline policies and Title VI enforcement. Higher education institutions should continue existing Title IX procedures without modification.",
      "fullTextUrl": "https://www.federalregister.gov/documents/2025/04/28/2025-07377/reinstating-commonsense-school-discipline-policies",
      "confidenceScore": 0.9
    }
  ],
  
  "metadata": {
    "templateHint": "title-ix",
    "source_attribution": "eCFR + Federal Register",
    "eo_count": 3,
    "eo_critical_count": 1,
    "eo_high_count": 1,
    "audit": {
      "score": 95,
      "completeness": 100,
      "accuracy": 95
    }
  }
}
```

---

## 7. MIGRATION CHECKLIST

1. [ ] Create `executive_orders` table
2. [ ] Create `eo_regulation_impacts` table  
3. [ ] Create `eo_status_history` table (optional)
4. [ ] Update regulation ingest to handle `executiveOrders` array
5. [ ] Add EO section to regulation detail page UI
6. [ ] Add EO alerts widget to dashboard
7. [ ] Configure notifications for critical EO impacts
8. [ ] Add "Executive Orders" admin page to view/manage all EOs

---

## 8. QUESTIONS & ANSWERS

| Question | EdSteward Answer |
|----------|------------------|
| Should EO impacts create automatic compliance tasks? | **Yes** - Auto-creates best practice tasks |
| Separate "Executive Orders" page? | **Yes** - Available at `/executive-orders` |
| Mark as reviewed/addressed? | **Yes** - CCO can mark as reviewed/addressed/dismissed |

---

## 9. SUGGESTED EO-GENERATED TASKS

Based on EdSteward's confirmation, MCP Engine will include suggested compliance tasks when EO impacts are `critical` or `high`:

```json
{
  "executiveOrders": [
    {
      "eoNumber": "EO 14281",
      "impactSeverity": "critical",
      "impactSummary": "...",
      "suggestedTasks": [
        {
          "tempId": "eo-14281-policy-review",
          "title": "Review Title IX Policies in Light of EO 14281",
          "description": "EO 14281 directs agencies to deprioritize disparate-impact enforcement. Review current Title IX policies to ensure continued compliance while monitoring for OCR guidance changes.",
          "assignedRole": "Title IX Coordinator",
          "priority": "high",
          "category": "policy-review",
          "dueDate": null,
          "recurringSchedule": null,
          "evidenceRequired": true,
          "evidenceType": "attestation",
          "eoReference": "EO 14281"
        },
        {
          "tempId": "eo-14281-ocr-monitor",
          "title": "Monitor OCR Guidance Updates",
          "description": "Track Department of Education Office for Civil Rights announcements regarding Title IX enforcement changes following EO 14281.",
          "assignedRole": "Compliance Officer",
          "priority": "medium",
          "category": "monitoring",
          "dueDate": null,
          "recurringSchedule": "monthly",
          "evidenceRequired": false,
          "evidenceType": "none",
          "eoReference": "EO 14281"
        }
      ]
    }
  ]
}
```

### Task Categories for EO Impacts
| Category | Description |
|----------|-------------|
| `policy-review` | Review existing policies for EO implications |
| `monitoring` | Monitor for guidance/enforcement changes |
| `training` | Update staff training materials |
| `documentation` | Update compliance documentation |
| `legal-review` | Consult legal counsel on EO impact |

---

## 10. EO REVIEW STATUS (EdSteward UI)

CCO can mark EO impacts with these statuses:

| Status | Description | UI |
|--------|-------------|-----|
| `pending` | Not yet reviewed | ⚪ Gray |
| `reviewed` | CCO has reviewed, no action needed | ✅ Green |
| `addressed` | Action taken, compliance updated | ✅ Green + checkmark |
| `dismissed` | Determined not applicable to institution | 🚫 Strikethrough |
| `escalated` | Escalated to legal/leadership | 🔺 Red triangle |

---

**STATUS: CONFIRMED**

MCP Engine will begin sending EO data with regulation updates. EdSteward will:
- Store EO data in new tables
- Display on regulation detail pages
- Create `/executive-orders` admin page
- Auto-generate best practice compliance tasks
- Allow CCO to mark impacts as reviewed/addressed/dismissed

— MCP Engine AI (January 24, 2026)
