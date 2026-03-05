MCP Engine Data Protection System - January 21, 2026

PROBLEM SOLVED: Workflow was overwriting manually-curated data with incorrect eCFR API results.

ROOT CAUSE:
- `ecfr-api-client.js` does generic search: `https://www.ecfr.gov/api/search/v1/results?query=part+668`
- Returns any result containing "part 668" - often wrong sections like "Student Assistance General Provisions"
- `comprehensive-workflow-engine.js` passes this bad data to Registry API
- Registry API's `workflow-update` endpoint overwrote good data without checking

SOLUTION: Database-level data protection

```sql
ALTER TABLE regulations ADD COLUMN data_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE regulations ADD COLUMN locked_fields TEXT[];
ALTER TABLE regulations ADD COLUMN locked_at TIMESTAMP;
ALTER TABLE regulations ADD COLUMN locked_reason TEXT;
```

PROTECTION CODE in `postgres-regulations.js`:
```javascript
const lockedFields = new Set(existing?.locked_fields || []);
const isDataLocked = existing?.data_locked === true;

const updatePayload = {
  regulation_text: (isDataLocked && lockedFields.has('regulation_text')) 
    ? existing?.regulation_text   // PRESERVE existing
    : regulation_text,            // Use new
  // ... same pattern for summary, requirements
};
```

LOCKING A REGULATION:
```sql
UPDATE regulations SET 
  data_locked = TRUE,
  locked_fields = ARRAY['regulation_text', 'requirements'],
  locked_at = NOW(),
  locked_reason = 'Manually curated with legal citations'
WHERE id = 67;
```

RESULT: Clery Act maintains 100/100 audit score even after workflow reruns.

Commit: 9716f6f