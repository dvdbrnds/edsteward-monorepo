# EdSteward: Universal Regulation Key (REG-XXX) Alignment

## Overview

MCP Engine has implemented a universal regulation key field (`reg_key`) that assigns each regulation a unique identifier from **REG-001** to **REG-251**, numbered in order of **Institutional Risk Score** (highest risk = lowest number).

**REG-001 = Clery Act (Risk Score: 96, CRITICAL)**  
**REG-251 = Textbook Information (Risk Score: 29, LOW)**

This key field should be used as the **primary identifier** for all MCP Engine ↔ EdSteward communication.

---

## Implementation Tasks for EdSteward

### Task 1: Add `reg_key` Column to Regulations Table

```sql
-- Add the reg_key column
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS reg_key VARCHAR(10) UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_regulations_reg_key ON regulations(reg_key);
```

### Task 2: Update All Regulations with REG-XXX Keys

Run this update script to assign the correct `reg_key` to each regulation based on the master mapping from MCP Engine:

```sql
-- Update regulations with their assigned reg_keys
-- This mapping is ordered by Institutional Risk Score (highest risk = REG-001)

UPDATE regulations SET reg_key = 'REG-001' WHERE item_id = 'jeanne-clery-disclosure-of-campus-security-policy-';
UPDATE regulations SET reg_key = 'REG-002' WHERE item_id = 'title-ix';
UPDATE regulations SET reg_key = 'REG-003' WHERE item_id = 'title-ix-of-the-education-amendment-of-1972';
UPDATE regulations SET reg_key = 'REG-004' WHERE item_id = 'family-educational-rights-and-privacy-act-ferpa';
UPDATE regulations SET reg_key = 'REG-005' WHERE item_id = 'new-jersey-campus-sex-assault-victim-bill-of-rights';
UPDATE regulations SET reg_key = 'REG-006' WHERE item_id = 'pennsylvania-sexual-violence-education-act';
UPDATE regulations SET reg_key = 'REG-007' WHERE item_id = 'campus-sex-crimes-prevention-act-1601-of-the-victi';
UPDATE regulations SET reg_key = 'REG-008' WHERE item_id = 'title-vi-of-the-civil-rights-act-of-1964';
UPDATE regulations SET reg_key = 'REG-009' WHERE item_id = 'title-vi-of-the-civil-rights-act-of-1964-42-u-s-c-';
UPDATE regulations SET reg_key = 'REG-010' WHERE item_id = 'title-vii-of-the-civil-rights-act-of-1964';
UPDATE regulations SET reg_key = 'REG-011' WHERE item_id = 'false-claims-act';
UPDATE regulations SET reg_key = 'REG-012' WHERE item_id = 'higher-education-act-recognition-of-accrediting-ag';
UPDATE regulations SET reg_key = 'REG-013' WHERE item_id = 'new-jersey-licensure-accreditation-standards';
UPDATE regulations SET reg_key = 'REG-014' WHERE item_id = 'pennsylvania-institutional-accreditation';
UPDATE regulations SET reg_key = 'REG-015' WHERE item_id = 'americans-with-disabilities-act';
UPDATE regulations SET reg_key = 'REG-016' WHERE item_id = 'americans-with-disabilities-act-of-1990';
UPDATE regulations SET reg_key = 'REG-017' WHERE item_id = 'equity-in-athletics-disclosure-act-eada';
UPDATE regulations SET reg_key = 'REG-018' WHERE item_id = 'section-504-of-the-rehabilitation-act-of-1973';
UPDATE regulations SET reg_key = 'REG-019' WHERE item_id = 'emergency-planning-and-community-right-to-know-act';
UPDATE regulations SET reg_key = 'REG-020' WHERE item_id = 'hipaa';
UPDATE regulations SET reg_key = 'REG-021' WHERE item_id = 'new-jersey-law-against-discrimination';
UPDATE regulations SET reg_key = 'REG-022' WHERE item_id = 'new-jersey-security-officer-registration-act-sora-';
UPDATE regulations SET reg_key = 'REG-023' WHERE item_id = 'pennsylvania-human-relations-act';
UPDATE regulations SET reg_key = 'REG-024' WHERE item_id = 'pennsylvania-workers-compensation-act';
UPDATE regulations SET reg_key = 'REG-025' WHERE item_id = 'student-right-to-know-and-campus-security-act';
```

### Task 3: Generate Full SQL Update Script

Use this Node.js script to generate the complete SQL:

```javascript
// generate-regkey-updates.js
const mapping = require('./reg-key-mapping.json');

console.log('-- EdSteward REG-KEY Update Script');
console.log('-- Generated from MCP Engine master mapping');
console.log('-- Total regulations: ' + mapping.length);
console.log('');

mapping.forEach(reg => {
  console.log(`UPDATE regulations SET reg_key = '${reg.reg_key}' WHERE item_id = '${reg.item_id}';`);
});

console.log('');
console.log('-- Verify the update');
console.log('SELECT reg_key, item_id, name FROM regulations ORDER BY reg_key LIMIT 20;');
```

### Task 4: Update API Endpoints

All EdSteward API endpoints that return regulation data should include `regKey`:

```typescript
// In regulation response transformation
const response = {
  regKey: regulation.reg_key,     // ADD THIS - Universal key (REG-001 to REG-251)
  regulationId: regulation.item_id,
  id: regulation.id,
  name: regulation.name,
  // ... other fields
};
```

### Task 5: Update `/api/regulation-updates` Endpoint

The regulation updates endpoint should accept `regKey` as a lookup field:

```typescript
// In regulation-updates-api.ts

async function resolveRegulationId(body: any): Promise<number | null> {
  // Priority: regKey > itemId > numeric regulationId
  
  // 1. Try regKey lookup (REG-001 format)
  if (body.regKey) {
    const result = await db.query(
      'SELECT id FROM regulations WHERE reg_key = $1',
      [body.regKey]
    );
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  }
  
  // 2. Try itemId lookup (slug format)
  if (body.itemId) {
    const result = await db.query(
      'SELECT id FROM regulations WHERE item_id = $1',
      [body.itemId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  }
  
  // 3. Use numeric regulationId directly
  if (typeof body.regulationId === 'number') {
    return body.regulationId;
  }
  
  return null;
}
```

### Task 6: Update `/api/mcp/regulations/sync` Endpoint

Include `regKey` in the sync payload handling:

```typescript
// In the sync endpoint
const { regKey, regulationId, itemId, name, statute, ... } = req.body;

// If regKey provided, use it for matching
let existingReg;
if (regKey) {
  existingReg = await db.query(
    'SELECT * FROM regulations WHERE reg_key = $1',
    [regKey]
  );
}

// Update or insert with reg_key
if (existingReg?.rows?.length > 0) {
  await db.query(
    'UPDATE regulations SET name = $1, statute = $2, ..., reg_key = $3 WHERE id = $4',
    [name, statute, regKey, existingReg.rows[0].id]
  );
} else {
  await db.query(
    'INSERT INTO regulations (item_id, name, statute, reg_key, ...) VALUES ($1, $2, $3, $4, ...)',
    [itemId, name, statute, regKey]
  );
}
```

---

## Complete REG-KEY Mapping

| REG-KEY | Risk Score | Risk Level | Name | item_id |
|---------|------------|------------|------|---------|
| REG-001 | 96 | CRITICAL | Clery Act / VAWA | jeanne-clery-disclosure-of-campus-security-policy- |
| REG-002 | 88 | SEVERE | Title IX | title-ix |
| REG-003 | 88 | SEVERE | Title IX of the Education Amendment of 1972 | title-ix-of-the-education-amendment-of-1972 |
| REG-004 | 85 | SEVERE | FERPA | family-educational-rights-and-privacy-act-ferpa |
| REG-005 | 78 | SEVERE | NJ Campus Sex Assault Bill of Rights | new-jersey-campus-sex-assault-victim-bill-of-rights |
| REG-006 | 78 | SEVERE | PA Sexual Violence Education Act | pennsylvania-sexual-violence-education-act |
| REG-007 | 77 | SEVERE | Campus Sex Crimes Prevention Act | campus-sex-crimes-prevention-act-1601-of-the-victi |
| REG-008 | 77 | SEVERE | Title VI (Civil Rights 1964) | title-vi-of-the-civil-rights-act-of-1964 |
| REG-009 | 77 | SEVERE | Title VI (42 U.S.C.) | title-vi-of-the-civil-rights-act-of-1964-42-u-s-c- |
| REG-010 | 77 | SEVERE | Title VII | title-vii-of-the-civil-rights-act-of-1964 |
| REG-011 | 75 | SEVERE | False Claims Act | false-claims-act |
| REG-012 | 75 | SEVERE | HEA Accreditation Recognition | higher-education-act-recognition-of-accrediting-ag |
| REG-013 | 75 | SEVERE | NJ Licensure Accreditation Standards | new-jersey-licensure-accreditation-standards |
| REG-014 | 75 | SEVERE | PA Institutional Accreditation | pennsylvania-institutional-accreditation |
| REG-015 | 74 | SEVERE | Americans with Disabilities Act | americans-with-disabilities-act |
| REG-016 | 74 | SEVERE | ADA of 1990 | americans-with-disabilities-act-of-1990 |
| REG-017 | 74 | SEVERE | EADA | equity-in-athletics-disclosure-act-eada |
| REG-018 | 74 | SEVERE | Section 504 Rehabilitation Act | section-504-of-the-rehabilitation-act-of-1973 |
| REG-019 | 72 | SEVERE | EPCRA | emergency-planning-and-community-right-to-know-act |
| REG-020 | 72 | SEVERE | HIPAA | hipaa |
| REG-021 | 72 | SEVERE | NJ Law Against Discrimination | new-jersey-law-against-discrimination |
| REG-022 | 72 | SEVERE | NJ SORA | new-jersey-security-officer-registration-act-sora- |
| REG-023 | 72 | SEVERE | PA Human Relations Act | pennsylvania-human-relations-act |
| REG-024 | 72 | SEVERE | PA Workers Compensation Act | pennsylvania-workers-compensation-act |
| REG-025 | 72 | SEVERE | Student Right to Know Act | student-right-to-know-and-campus-security-act |

*... (see data/reg-key-mapping.csv for complete list of all 251 regulations)*

---

## JSON Mapping File

The complete mapping is available at: `data/reg-key-mapping.json`

This file contains all 251 regulations with:
- `reg_key`: Universal key (REG-001 to REG-251)
- `mcp_db_id`: MCP Engine database ID
- `item_id`: Slug identifier
- `name`: Full regulation name
- `statute`: Legal citation
- `category`: Compliance category
- `topic`: Topic area
- `jurisdictionSource`: federal or state
- `stateCode`: PA, NJ, or null
- `riskScore`: 1-100 institutional risk score
- `riskLevel`: CRITICAL, SEVERE, HIGH, MODERATE, or LOW

---

## Verification Query

After implementing the updates, run this query to verify alignment:

```sql
-- Count regulations with reg_key assigned
SELECT 
  COUNT(*) as total,
  COUNT(reg_key) as with_reg_key,
  COUNT(*) - COUNT(reg_key) as missing_reg_key
FROM regulations;

-- Should show:
-- total: 251
-- with_reg_key: 251
-- missing_reg_key: 0

-- Show distribution by risk level
SELECT 
  CASE 
    WHEN reg_key <= 'REG-001' THEN 'CRITICAL'
    WHEN reg_key <= 'REG-025' THEN 'SEVERE'
    WHEN reg_key <= 'REG-137' THEN 'HIGH'
    WHEN reg_key <= 'REG-250' THEN 'MODERATE'
    ELSE 'LOW'
  END as risk_tier,
  COUNT(*) as count
FROM regulations
WHERE reg_key IS NOT NULL
GROUP BY risk_tier
ORDER BY risk_tier;
```

---

## MCP Engine → EdSteward Payload Format

All regulation updates from MCP Engine will now include `regKey`:

```json
{
  "regKey": "REG-001",
  "itemId": "jeanne-clery-disclosure-of-campus-security-policy-",
  "regulationId": 67,
  "name": "Clery Act Update",
  "originalContent": "...",
  "updatedContent": "...",
  "status": "pending",
  "riskScore": 96,
  "riskLevel": "CRITICAL",
  "summary": "Update to Clery Act reporting requirements",
  "requirements": "...",
  "filingDeadlines": [...],
  "complianceTasks": [...]
}
```

EdSteward should:
1. Look up the regulation by `regKey` (preferred) or `itemId`
2. Create the pending update linked to the correct regulation
3. Include `regKey` in all API responses for consistency

---

## Summary

| Field | Purpose | Example |
|-------|---------|---------|
| `regKey` | Universal identifier (primary) | REG-001 |
| `itemId` | Slug identifier (backup) | jeanne-clery-disclosure-of-campus-security-policy- |
| `regulationId` | Database ID (legacy) | 67 |

**Use `regKey` as the primary identifier for all MCP Engine ↔ EdSteward communication.**

---

*Generated: January 20, 2026*  
*MCP Engine Alignment Document v1.0*
