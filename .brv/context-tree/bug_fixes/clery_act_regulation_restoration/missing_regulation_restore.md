Successfully restored missing Clery Act regulation in EdSteward:

**Problem**: User reported missing Clery Act regulation from their EdSteward instance despite extensive references in codebase and CSV exports.

**Root Cause**: Clery Act regulation (ID: REG1812) was present in CSV export but missing from active database.

**Solution**: Created restoration script `scripts/restore-clery-act-simple.cjs` that:
- Uses direct SQL insertion with @neondatabase/serverless
- Includes all required fields: deadlines, agency info, submission guidelines
- Properly formatted JSON arrays for filing_deadlines and actions
- Handles duplicate detection to prevent conflicts

**Restoration Details**:
```javascript
// Key restoration data
const cleryData = {
  item_id: 'REG1812',
  name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
  topic: 'Campus Safety and Security',
  statute: '20 U.S.C. § 1092(f)',
  category: 'Campus Safety',
  jurisdiction: 'federal',
  agency_name: 'Clery Center',
  agency_url: 'https://clerycenter.org',
  submission_guidelines: 'By October 1st of each year...',
  filing_deadlines: '[{"date": "October 1", "type": "submission", "frequency": "Annually"}]'
};
```

**Verification**: 
- Database ID: 355
- API endpoint returns regulation correctly
- Available in dashboard search and filtering

**Git Commit**: 720d9f2 - "Restore missing Clery Act regulation"

This pattern can be used to restore other missing regulations from CSV exports when database sync issues occur.