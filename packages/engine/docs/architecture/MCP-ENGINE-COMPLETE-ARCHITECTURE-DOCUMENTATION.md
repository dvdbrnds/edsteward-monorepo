# MCP Engine Complete Architecture Documentation

**Version:** 5.3.0  
**Last Updated:** January 2026  
**Purpose:** EdSteward Integration & System Alignment

---

## 1. DATABASE SCHEMA

### Primary Tables

#### `regulations` Table (Core)
```sql
CREATE TABLE regulations (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  regulation_id VARCHAR(100) NOT NULL UNIQUE,      -- Slug identifier
  name VARCHAR(255) NOT NULL,                       -- Human-readable name
  description TEXT,
  source_id INTEGER REFERENCES regulatory_sources(id),
  item_id INTEGER,                                  -- CSV source item ID
  topic_id INTEGER REFERENCES topics(id),
  statute_name VARCHAR(500),
  statute_1 VARCHAR(500),
  statute_2 VARCHAR(500),
  statute_3 VARCHAR(500),
  statute_4 VARCHAR(500),
  statute_ids VARCHAR(500),
  regulation_1 VARCHAR(500),                        -- CFR citations
  regulation_2 VARCHAR(500),
  regulation_3 VARCHAR(500),
  regulation_4 VARCHAR(500),
  regulation_5 VARCHAR(500),
  statutory_summary TEXT,
  reporting_requirements TEXT,
  deadlines VARCHAR(500),                           -- Raw deadline text
  additional_resources_1 TEXT,
  additional_resources_2 TEXT,
  sortable_month VARCHAR(50),
  topic_id_original INTEGER,
  last_updated_original VARCHAR(100),
  enforcement_agency_id INTEGER REFERENCES enforcement_agencies(id),
  compliance_focus VARCHAR(255),
  regulation_slug VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Primary Key Structure:** Auto-increment `id` (internal) + unique `regulation_id` (slug, used for API lookups)

**Example Row:**
```json
{
  "id": 1,
  "tenant_id": "default",
  "regulation_id": "family-educational-rights-and-privacy-act-ferpa",
  "name": "Family Educational Rights and Privacy Act (FERPA)",
  "item_id": 1792,
  "statute_name": "FERPA",
  "statute_1": "20 U.S.C. § 1232g",
  "regulation_1": "34 C.F.R. § 99",
  "statutory_summary": "Protects the privacy of student education records...",
  "deadlines": "Not Applicable",
  "enforcement_agency_id": 1,
  "compliance_focus": "Privacy & Information Security"
}
```

#### `regulation_versions` Table (Version History)
```sql
CREATE TABLE regulation_versions (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  version VARCHAR(50) NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE,
  publish_date TIMESTAMP WITH TIME ZONE NOT NULL,
  document_number VARCHAR(100),
  content JSONB NOT NULL,                           -- Full regulation content
  source_url VARCHAR(500),
  source_update_id INTEGER REFERENCES source_updates(id),
  change_notes TEXT,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(regulation_id, version)
);
```

#### `requirements` Table (Compliance Requirements)
```sql
CREATE TABLE requirements (
  id SERIAL PRIMARY KEY,
  requirement_id VARCHAR(100) NOT NULL UNIQUE,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  regulation_version_id INTEGER NOT NULL REFERENCES regulation_versions(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  requirement_type VARCHAR(50) NOT NULL,
  validation_rule JSONB,                            -- Patterns, semantic rules
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### `regulatory_sources` Table (Government Sources)
```sql
CREATE TABLE regulatory_sources (
  id SERIAL PRIMARY KEY,
  source_code VARCHAR(50) NOT NULL UNIQUE,         -- e.g., 'ECFR_GOV', 'FEDERAL_REGISTER'
  name VARCHAR(255) NOT NULL,
  authority VARCHAR(255) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  description TEXT,
  contact_info JSONB,
  refresh_interval INTEGER NOT NULL DEFAULT 86400, -- Seconds (default: daily)
  collector_type VARCHAR(100) NOT NULL,
  collector_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Pre-populated Sources:**
- `FEDERAL_REGISTER` - https://www.federalregister.gov/api/v1
- `ED_GOV` - https://www2.ed.gov
- `ECFR_GOV` - https://www.ecfr.gov/api/versioner/v1

---

## 2. MCP STRUCTURE

### Zeus Orchestrator (Main Router)
**File:** `mcp-start.js`

Zeus orchestrates all services:
```
┌─────────────────────────────────────────────────────────┐
│                    ZEUS ORCHESTRATOR                     │
│                     (mcp-start.js)                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Registry API│  │ LLM Gateway │  │ Delivery System │  │
│  │   :3010     │  │   :3002     │  │     :3051       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │Customer API │  │  Frontend   │                       │
│  │   :3060     │  │   :3050     │                       │
│  └─────────────┘  └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### Individual Regulation MCPs
Each regulation has a console page and can be validated individually:
- **Location:** `src/client/public/regulations/{slug}-console.html`
- **Total:** 285 regulation console pages
- **Features:** Linear Engine workflow, AI Quality Auditor, EdSteward push

### L.O.V.V. Levels Implementation

| Level | Name | Method | Speed | Certainty Output |
|-------|------|--------|-------|------------------|
| **A** | WebScrape | Basic text/pattern matching | <100ms | A or D only |
| **B** | API | Government API integration | 200-500ms | A, B, or D |
| **C** | AI-Collection | GPT-4/Claude analysis | 2-5s | A, B, C, or D |
| **D** | Human Intervention | Expert review | Hours-days | A (after confirmation) |

**Certainty Grades:**
```javascript
const CERTAINTY_LEVELS = {
  A: 'HIGH',       // 95-100% - Exact match to government source
  B: 'MEDIUM',     // 80-94% - Strong semantic match
  C: 'LOW',        // 60-79% - Inference from incomplete data
  D: 'UNCERTAIN'   // <60% - Insufficient data
};
```

---

## 3. DATA EXTRACTION & INTERPRETATION

### Source Data Collection

**Primary Sources:**
| Source | API URL | Data Type |
|--------|---------|-----------|
| eCFR (Code of Federal Regulations) | `https://www.ecfr.gov/api/versioner/v1` | CFR text |
| Federal Register | `https://www.federalregister.gov/api/v1` | Rules, notices |
| RECAP (CourtListener) | `https://www.courtlistener.com/api/rest/v3` | Case law |
| USC (House) | `https://uscode.house.gov/` | Statute text |
| Cornell LII | `https://www.law.cornell.edu/` | Academic reference |

**Refresh Schedule:** Configurable per source (default: daily - 86400 seconds)

### Content Interpretation
**File:** `src/llm-gateway/government-source-fetcher.js`

1. Fetch raw content from government API
2. Parse XML/JSON/HTML based on source format
3. Extract regulation sections and subsections
4. Map to internal regulation structure

### Deadline Extraction
**Current Implementation:** Deadlines are stored as text in the `deadlines` VARCHAR field from the CSV source.

**Example Values:**
- `"Not Applicable"`
- `"October 1 annually"`
- `"14-No Deadline"` (sortable format)
- `"13-Multiple Deadlines"`

**Future Enhancement:** Structured deadline extraction via `extractFilingDeadlines()` function that normalizes to:
```json
{
  "deadlineId": "ferpa-annual-notification",
  "name": "Annual FERPA Notification",
  "dueDate": null,
  "recurringSchedule": "annual",
  "frequency": "annual",
  "description": "Students must be notified annually of their FERPA rights"
}
```

---

## 4. TRANSMISSION TO EDSTEWARD

### Transmission Triggers
1. **Manual Push** - User clicks "PUSH UPDATE" button on console
2. **Customer Dashboard** - Bulk push from `customer-delivery-dashboard.html`
3. **CDC Detection** - Automatic when change detected (configurable)

### EdSteward Payload Structure

```json
{
  "regulationId": 42,                    // EdSteward integer ID (1-500 range)
  "name": "Family Educational Rights and Privacy Act (FERPA)",
  "status": "pending",
  "originalContent": "",                 // Previous version (if available)
  "updatedContent": "Full USC/CFR text from government sources...",
  "summary": "FERPA protects the privacy of student education records...",
  "requirements": "• Notify students annually of their FERPA rights\n• ...",
  "filingDeadlines": "[{\"type\":\"Annual Notification\",\"date\":\"Start of academic year\",\"frequency\":\"annual\"}]",
  "complianceTasks": [                   // Only for Tier 1/2 regulations
    {
      "tempId": "ferpa-coordinator",
      "title": "FERPA Coordinator Designation",
      "description": "Designate FERPA compliance coordinator",
      "assignedRole": "Registrar",
      "priority": "critical",
      "evidenceRequired": true,
      "evidenceType": "document"
    }
  ],
  "metadata": {
    "templateHint": "ferpa",             // For template regulations
    "source_attribution": "eCFR + Federal Register",
    "audit": {
      "score": 93,
      "completeness": 95,
      "accuracy": 90
    },
    "processing_metadata": {
      "processed_at": "2026-01-16T19:00:00.000Z",
      "mcp_engine_id": "family-educational-rights-and-privacy-act-ferpa",
      "mcp_engine_version": "2.1"
    }
  }
}
```

### Field Naming Convention
- **MCP Engine Internal:** `kebab-case` slugs (e.g., `family-educational-rights-and-privacy-act-ferpa`)
- **EdSteward Transmission:** `camelCase` for JSON fields
- **EdSteward regulationId:** Integer 1-500 (mapped from slug via `REGULATION_ID_MAP`)

### Transmission Protocol
| Method | Endpoint | Purpose |
|--------|----------|---------|
| REST POST | `/api/regulation-updates` | Send regulation updates |
| REST POST | `/api/mcp/regulations/create` | Create new regulations |
| REST GET | `/api/mcp/regulations/lookup?name=X` | Check if regulation exists |
| WebSocket | `/ws` | Real-time notifications |

### Authentication
```javascript
// Basic Auth
headers: {
  'Authorization': 'Basic [REDACTED-BASE64]',
  'Content-Type': 'application/json'
}
```

### Customer Configuration
**File:** `config/customers.json`
```json
{
  "customers": [
    {
      "id": "moravian-dev",
      "name": "Moravian (Local Dev)",
      "url": "http://localhost:3000",
      "apiEndpoint": "/api/regulation-updates",
      "type": "development",
      "auth": { "method": "basic", "username": "dvdbrnds", "password": "gabadhgabadh" }
    },
    {
      "id": "moravian-prod",
      "name": "Moravian University (Production)",
      "url": "https://moravian.edsteward.ai",
      "apiEndpoint": "/api/regulation-updates",
      "type": "production"
    }
  ]
}
```

---

## 5. COMPLETE FIELD LIST

| Field Name | Data Type | Required | Transmitted | Description |
|------------|-----------|----------|-------------|-------------|
| `regulationId` (MCP) | string | yes | transformed | Slug identifier |
| `regulationId` (EdSteward) | integer | yes | yes | EdSteward integer ID (1-500) |
| `name` | string | yes | yes | Human-readable regulation name |
| `status` | string | yes | yes | Always "pending" for updates |
| `originalContent` | string | no | yes | Previous content version |
| `updatedContent` | string | yes | yes | Full regulation text |
| `summary` | string | yes | yes | Plain English summary |
| `requirements` | string | no | yes | Bullet-pointed compliance requirements |
| `filingDeadlines` | JSON string | no | yes | Array of deadline objects |
| `complianceTasks` | array | no | yes | Task objects (Tier 1/2 only) |
| `metadata` | object | yes | yes | Audit scores, source info, processing |
| `statute_1..4` | string | no | no | USC citations |
| `regulation_1..5` | string | no | no | CFR citations |
| `statutory_summary` | string | no | transformed→summary | Source summary |
| `reporting_requirements` | string | no | transformed | Deadline info |
| `topic_id` | integer | no | no | Internal topic reference |
| `enforcement_agency_id` | integer | no | no | Internal agency reference |
| `item_id` | integer | no | no | Legacy CSV item ID |
| `tenant_id` | string | yes | no | Multi-tenant isolation |

---

## 6. DEADLINE STRUCTURE

**Current Raw Format (from CSV):**
```
"Reporting due by the last day of 7th month after end of plan year."
```

**Structured Format (transmitted to EdSteward):**
```json
[
  {
    "type": "Primary Deadline",
    "date": "7th month after plan year end",
    "frequency": "annual",
    "description": "Reporting due by the last day of 7th month after end of plan year"
  }
]
```

**Recurring Schedule Values:**
- `annual`
- `biennial`
- `quarterly`
- `monthly`
- `as-needed`

---

## 7. TASK STRUCTURE

**For Tier 1/2 Regulations (ADA, OSHA, Title IV, etc.):**
```json
{
  "tempId": "ada-coordinator",
  "parentTempId": null,
  "title": "ADA Coordinator Designation",
  "description": "Designate and publicize an ADA/Section 504 Coordinator",
  "instructions": "Coordinator must have authority to ensure compliance...",
  "assignedRole": "President / Provost",
  "priority": "critical",
  "evidenceRequired": true,
  "evidenceType": "document",
  "evidenceInstructions": "Upload official designation letter naming ADA Coordinator",
  "sortOrder": 1,
  "dueDate": null,
  "recurringSchedule": null
}
```

**Priority Values:** `critical`, `high`, `medium`, `low`

**Evidence Types:**
- `none` - No evidence required
- `document` - File upload required
- `link` - URL required
- `screenshot` - Image upload required
- `attestation` - Checkbox confirmation
- `form` - Form completion

**Template Regulations (Clery, FERPA, Title IX):**
- No tasks transmitted
- `templateHint` field provided instead
- EdSteward generates tasks from built-in template

---

## 8. API ENDPOINTS

### MCP Engine Internal APIs

| Endpoint | Port | Description |
|----------|------|-------------|
| `GET /api/regulations` | 3010 | List all regulations |
| `GET /api/regulations/:slug` | 3010 | Get regulation by slug |
| `GET /api/llm/usc/:title/:section` | 3002 | Fetch USC text |
| `GET /api/llm/cfr/:slug` | 3002 | Fetch CFR text |
| `GET /api/llm/compliance/:slug` | 3002 | Get compliance analysis |
| `POST /api/inquisitor/audit` | 3060 | AI quality audit |
| `GET /api/customers` | 3051 | List customers |
| `POST /api/customers/push` | 3051 | Push to customers |
| `POST /api/trigger-update` | 3051 | Manual update trigger |

### EdSteward Integration APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/regulation-updates` | POST | Update existing regulation |
| `/api/mcp/regulations/create` | POST | Create new regulation |
| `/api/mcp/regulations/lookup` | GET | Check if regulation exists |
| `/api/regulation-updates/bulk-import/health` | GET | Health check |

---

## 9. KEY CODE LOCATIONS

| Component | File Path |
|-----------|-----------|
| Database Schema | `database/migrations/001_regulatory_sources_schema.sql` |
| Tenant Isolation | `database/migrations/002_tenant_isolation.sql` |
| Metadata Schema | `database/migrations/003_regulation_metadata_schema.sql` |
| EdSteward Integration | `src/delivery-system/edsteward-integration.js` |
| Compliance Task Generator | `src/services/compliance-task-generator.js` |
| Delivery Engine (CDC) | `src/delivery-system/regulation-delivery-engine.js` |
| Delivery Server | `src/delivery-system/delivery-server.js` |
| LLM Gateway | `src/llm-gateway/start-llm-gateway-phase4.js` |
| Government Fetcher | `src/llm-gateway/government-source-fetcher.js` |
| eCFR API Client | `src/llm-gateway/ecfr-api-client.js` |
| Cross-Reference | `src/llm-gateway/services/real-cross-reference.js` |
| MCP Validation Protocol | `src/protocol/mcp-validation-protocol.js` |
| Customer Config | `config/customers.json` |
| Regulation ID Map | `src/delivery-system/edsteward-integration.js:58-135` |
| Console Pages | `src/client/public/regulations/*.html` |

---

## 10. CURRENT REGULATION INVENTORY

### Summary Statistics
| Metric | Count |
|--------|-------|
| **Total Regulations (CSV Source)** | 1041 rows |
| **Regulation Console Pages** | 285 |
| **Template Regulations** | 3 (Clery, FERPA, Title IX) |
| **Tier 1 Regulations (Complex)** | 10 |
| **Tier 2 Regulations (Reporting)** | 15 |
| **Regulations with Tasks** | 25+ |
| **Regulations with Deadlines** | ~50% |

### L.O.V.V. Distribution (Estimated)
| Level | Approx. Count | Notes |
|-------|---------------|-------|
| Level A (WebScrape) | 200+ | Basic validation |
| Level B (API) | 50+ | Government API available |
| Level C (AI) | 20+ | AI analysis enabled |
| Level D (Human) | 10+ | Expert review required |

### Sample Regulations

**Simple Regulation:**
```json
{
  "regulationId": "age-discrimination-act-of-1975",
  "name": "Age Discrimination Act of 1975",
  "item_id": 1785,
  "statute_1": "42 U.S.C. §§ 6101-6107",
  "regulation_1": "34 C.F.R. § 110",
  "statutory_summary": "Prohibits discrimination based on age in educational programs...",
  "deadlines": "Not Applicable",
  "topic": "Academic Programs",
  "enforcement_agency": "ED"
}
```

**Complex Regulation (Multiple Deadlines/Tasks):**
```json
{
  "regulationId": "clery-act",
  "name": "Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act",
  "item_id": 9,
  "statute_1": "20 U.S.C. § 1092(f)",
  "regulation_1": "34 C.F.R. § 668.46",
  "statutory_summary": "Requires institutions to disclose campus security policies and crime statistics...",
  "deadlines": "Annual Security Report: October 1",
  "topic": "Academic Programs",
  "enforcement_agency": "ED",
  "templateHint": "clery",
  "tasks": "Generated by EdSteward template"
}
```

---

## 11. VALIDATION & CERTIFICATION

### What Makes Data "Validated"
1. **Source Verification:** Content fetched from official government API
2. **Hash Comparison:** Content hash compared against previous version
3. **AI Analysis:** Optional Claude/GPT-4 completeness check
4. **Human Review:** Level D regulations require expert confirmation

### Certification Process
1. **Automated Audit** - AI Quality Auditor scores content, summary, accuracy
2. **Certainty Grade** - A/B/C/D assigned based on validation level
3. **Timestamp** - `lastAudit` field in metadata

### Version Hash
```javascript
// Hash generated from content for change detection
const contentHash = createHash('md5')
  .update(regulation.content)
  .digest('hex');
```

---

## 12. KNOWN GAPS & ISSUES

### Data Gaps
| Issue | Status | Notes |
|-------|--------|-------|
| Many regulations have "Not Applicable" deadlines | Known | Need deadline extraction |
| Some regulations lack structured requirements | Known | AI extraction planned |
| Task definitions only for Tier 1/2 | Intentional | Simple regs use attestation |

### Technical Debt
- [ ] Deadline extraction from text not fully automated
- [ ] No database persistence currently (in-memory/CSV)
- [ ] Task templates hardcoded (could be database-driven)
- [ ] L.O.V.V. validation levels not fully implemented for all regulations

### Integration Notes
- EdSteward expects integer `regulationId` (1-500)
- MCP Engine uses string slugs internally
- Mapping maintained in `REGULATION_ID_MAP` constant

---

## APPENDIX: EdSteward Regulation ID Mapping

**Core Education Regulations:**
| MCP Slug | EdSteward ID |
|----------|--------------|
| `family-educational-rights-and-privacy-act-ferpa` | 42 |
| `clery-act` | 9 |
| `title-ix-of-the-education-amendment-of-1972` | 7 |
| `higher-education-act-title-iv-student-financial-a` | 3 |
| `section-504-of-the-rehabilitation-act-of-1973` | 6 |
| `americans-with-disabilities-act-of-1990` | 2 |
| `title-vi-of-the-civil-rights-act-of-1964` | 8 |
| `technology-education-and-copyright-harmonization-a` | 55 |

**Unmapped Regulations:**
For regulations not in the mapping, a hash-based ID is generated:
```javascript
const hash = createHash('md5').update(regulationSlug).digest('hex');
const generatedId = 1 + (parseInt(hash.substring(0, 8), 16) % 500);
```

---

*Document generated by MCP Engine v5.3.0 - January 2026*
