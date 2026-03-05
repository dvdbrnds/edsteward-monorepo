MCP Engine Source Data Validator - The Moat (commit bca8bc0, Jan 21 2026)

PROBLEM SOLVED: Workflow engine was fetching wrong data from eCFR API (e.g., "Student Assistance General Provisions" instead of Clery Act) and overwriting manually curated database content.

SOLUTION: Source Data Validator (`src/services/source-data-validator.js`)

VALIDATION CHECKS:
1. Content Length - Minimum 500 chars required
2. Required Keywords - Must contain regulation-specific terms
3. Forbidden Keywords - CRITICAL: Detects wrong data (e.g., "governmental auditing" in Clery)
4. Citation Match - Checks for expected legal citations (20 U.S.C. § 1092, 34 CFR 668)
5. Name/Title Match - Validates regulation name consistency
6. Significant Change Detection - Flags >80% length differences

REGULATION SIGNATURES DEFINED FOR:
- Clery Act (campus security, crime statistics, annual security report)
- FERPA (educational records, student privacy)
- Title IX (sex discrimination, sexual harassment)
- ADA (disability, reasonable accommodation)
- HIPAA (health information, protected health)

RECOMMENDATIONS OUTPUT:
- ALLOW: 60%+ confidence - proceed with update
- REVIEW: 30-60% confidence - allow but log warning
- REJECT: <30% confidence - BLOCK update, log to audit trail

INTEGRATION: Called in `/api/regulations/workflow-update` endpoint before any data is saved

AUDIT LOGGING: Rejections logged to `regulation_audit_log` table with:
- action: 'WORKFLOW_REJECTED'
- performed_by: 'source-validator'
- new_values: JSON with confidence, errors, warnings

Combined with DATA PROTECTION (data_locked, locked_fields) for defense in depth:
1. First: Source validator checks if data is correct
2. Second: Data protection prevents overwriting locked fields

```javascript
// Example validation result for bad data
{
  confidence: 0,
  recommendation: 'REJECT',
  errors: [
    { check: 'FORBIDDEN_KEYWORDS', message: 'WRONG DATA DETECTED! Found: governmental auditing' }
  ]
}
```