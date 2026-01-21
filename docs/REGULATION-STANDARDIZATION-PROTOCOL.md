# Regulation Standardization Protocol

## Overview
This protocol ensures each regulation in the MCP Engine meets quality standards before content curation begins. It's a checklist-driven process that applies our infrastructure improvements systematically.

---

## Phase 1: Infrastructure Setup (Before Content)

### 1.1 Console HTML File
Each regulation needs a dedicated console with all our improvements.

**Template Location:** `src/client/public/regulations/`

**Required Features:**
- [ ] Inquisitor AI Audit integration
- [ ] Workflow execution with confirmation dialog
- [ ] Delivery system integration (port 3003)
- [ ] LLM Gateway integration (port 3004)
- [ ] Registry API integration (port 3010)
- [ ] Fixed UI/UX layout (no drift, contained cards)

**Action:** Copy from Clery template and update regulation-specific values.

### 1.2 Source Data Validator Signature
Add regulation to `src/services/source-data-validator.js`

**Required Fields:**
```javascript
'regulation-slug': {
  name: 'Regulation Short Name',
  requiredKeywords: ['keyword1', 'keyword2', ...],  // MUST appear in valid content
  forbiddenKeywords: ['wrong-data-indicator', ...], // Triggers REJECT if found
  expectedCitations: ['XX U.S.C. § XXXX', 'XX CFR Part XX'],
  minContentLength: 500,
  topics: ['topic1', 'topic2', ...]
}
```

### 1.3 CFR Mapping (Workflow Engine)
Add/verify in `src/llm-gateway/services/comprehensive-workflow-engine.js`

**Required Fields:**
```javascript
'regulation-slug': { 
  title: 'XX',           // CFR Title number
  part: 'XXX',           // CFR Part number
  section: 'XX',         // SPECIFIC section if applicable (prevents wrong data)
  searchTerms: ['term1', 'term2'],  // For targeted eCFR searches
  name: 'Regulation Name'
}
```

---

## Phase 2: Content Curation

### 2.1 Regulation Text
- [ ] Embed legal citation block at top
- [ ] Include full CFR/USC text or comprehensive summary
- [ ] Structure with clear sections
- [ ] Minimum 500 characters

### 2.2 Requirements
- [ ] Format with `##` markdown headers for sections
- [ ] List specific compliance requirements
- [ ] Include deadlines/timelines where applicable
- [ ] Reference specific CFR sections

### 2.3 Summary
- [ ] Business-focused (what institutions must DO)
- [ ] Include key stakeholders
- [ ] Mention enforcement agency
- [ ] 200-500 characters

### 2.4 Tasks
- [ ] Create parent task categories
- [ ] Add subtasks with priorities
- [ ] Include assigned roles
- [ ] Set appropriate deadlines

### 2.5 Deadlines
- [ ] Annual reporting deadlines
- [ ] Event-triggered deadlines
- [ ] Ongoing compliance requirements

---

## Phase 3: Quality Assurance

### 3.1 Run Inquisitor Audit
```bash
curl http://localhost:3004/api/inquisitor/audit/REGULATION-SLUG
```

**Target Score:** 90+ (Grade A)

### 3.2 Verify Source Validator
```bash
# Test with intentionally bad data - should be REJECTED
curl -X POST http://localhost:3010/api/regulations/workflow-update \
  -H "Content-Type: application/json" \
  -d '{"item_id": "SLUG", "regulation_text": "Wrong data test"}'
```

### 3.3 Lock Curated Fields
```sql
UPDATE regulations 
SET data_locked = true,
    locked_fields = ARRAY['regulation_text', 'requirements'],
    locked_reason = 'Manually curated - [DATE]'
WHERE reg_key = 'REG-XXX';
```

---

## Phase 4: Documentation

### 4.1 Update Tracking
- [ ] Mark regulation as standardized in tracking system
- [ ] Record Inquisitor score
- [ ] Note any special considerations

### 4.2 Commit
```bash
git add -A
git commit -m "Standardize REG-XXX: [Regulation Name]

- Console HTML with full infrastructure
- Source validator signature added
- CFR mapping with specific sections
- Content curated and formatted
- Data protection enabled
- Inquisitor score: XX/100"
```

---

## Quick Reference: Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Registry API | 3010 | PostgreSQL data |
| LLM Gateway | 3004 | AI/Workflow |
| Delivery Server | 3003 | Customer push |
| Frontend | 3050 | Console UI |
| Inquisitor | 3004 | Quality audit (via LLM Gateway) |

---

## Checklist Template

Copy this for each regulation:

```
## REG-XXX: [Name]

### Phase 1: Infrastructure
- [ ] Console HTML created/updated
- [ ] Source validator signature added
- [ ] CFR mapping verified

### Phase 2: Content
- [ ] Regulation text with citations
- [ ] Requirements formatted
- [ ] Summary written
- [ ] Tasks created
- [ ] Deadlines set

### Phase 3: QA
- [ ] Inquisitor score: __/100
- [ ] Validator test passed
- [ ] Fields locked

### Phase 4: Complete
- [ ] Committed to git
- [ ] Recorded to Byterover
```

---

## Automation Scripts (Future)

TODO: Create scripts to automate parts of this process:
- `npm run standardize:new <slug>` - Creates console from template
- `npm run standardize:validate <slug>` - Runs all QA checks
- `npm run standardize:lock <slug>` - Locks curated fields
