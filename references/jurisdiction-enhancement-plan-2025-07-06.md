# Jurisdiction Enhancement Plan

## Problem Statement
The current system has a single `jurisdiction` field that only handles "federal" or "state". Users need a more comprehensive system that distinguishes between:

1. **WHERE** the regulation comes from (jurisdiction source)
2. **WHO** it applies to (applicable institutions)

## New Data Structure

### Jurisdiction Source (WHERE it comes from)
- `federal` - Federal government regulations
- `state` - State government regulations  
- `international` - International treaties, agreements
- `private-organization` - Private standards organizations
- `accreditor` - Accrediting body requirements
- `industry-association` - Industry association standards

### Applicable Institutions (WHO it applies to)
- `public-universities` - Public 4-year universities
- `private-universities` - Private 4-year universities
- `community-colleges` - 2-year community colleges
- `conservatories` - Music/arts conservatories
- `technical-institutes` - Technical/vocational institutes
- `religious-institutions` - Religious colleges/universities
- `for-profit-institutions` - For-profit educational institutions
- `research-institutes` - Research-focused institutions
- `professional-schools` - Medical, law, business schools
- `all-institutions` - Applies to all institution types

## UX/UI Changes Required

### 1. Dashboard Filters
Replace single "Jurisdiction" filter with two separate filters:

**Current:**
```
[Jurisdiction Dropdown: All | Federal | State]
```

**New:**
```
[Regulation Source: All | Federal | State | International | Private Org | Accreditor | Industry Assoc]
[Applies To: All | Public Unis | Private Unis | Community Colleges | Conservatories | etc.]
```

### 2. Regulation Creation/Edit Forms
**Current form field:**
```html
<select name="jurisdiction">
  <option value="federal">Federal</option>
  <option value="state">State</option>
</select>
```

**New form fields:**
```html
<select name="jurisdictionSource">
  <option value="federal">Federal Government</option>
  <option value="state">State Government</option>
  <option value="international">International</option>
  <option value="private-organization">Private Organization</option>
  <option value="accreditor">Accrediting Body</option>
  <option value="industry-association">Industry Association</option>
</select>

<div class="institution-checkboxes">
  <label>This regulation applies to:</label>
  <input type="checkbox" name="institutions" value="public-universities"> Public Universities
  <input type="checkbox" name="institutions" value="private-universities"> Private Universities
  <input type="checkbox" name="institutions" value="community-colleges"> Community Colleges
  <input type="checkbox" name="institutions" value="conservatories"> Conservatories
  <!-- etc. -->
  <input type="checkbox" name="institutions" value="all-institutions"> All Institution Types
</div>
```

### 3. Regulation Display Cards
**Current display:**
```
Name: Title IX Requirements
Category: Civil Rights
Jurisdiction: Federal
```

**New display:**
```
Name: Title IX Requirements
Category: Civil Rights
Source: Federal Government
Applies To: Public Universities, Private Universities, Community Colleges
```

### 4. Advanced Search/Filtering
Allow users to search by combinations:
- "Show me all federal regulations that apply to community colleges"
- "Show me all accreditor requirements for private universities"
- "Show me international standards that apply to all institutions"

## Database Migration Strategy

### Phase 1: Add New Fields (Non-breaking)
```sql
ALTER TABLE regulations 
ADD COLUMN jurisdiction_source TEXT NOT NULL DEFAULT 'federal',
ADD COLUMN applicable_institutions JSONB;
```

### Phase 2: Migrate Existing Data
```sql
-- Map existing jurisdiction to jurisdiction_source
UPDATE regulations SET jurisdiction_source = jurisdiction;

-- Set default applicable_institutions 
UPDATE regulations SET applicable_institutions = '["all-institutions"]'::jsonb;
```

### Phase 3: Update Application Code
- Update TypeScript types
- Update API endpoints
- Update UI components
- Update validation schemas

### Phase 4: Remove Old Field (Breaking)
```sql
ALTER TABLE regulations DROP COLUMN jurisdiction;
```

## Implementation Priority

### High Priority (MVP)
1. Database schema changes
2. Basic dual-filter UI (source + institution type)
3. Form updates for regulation creation
4. Migration script for existing data

### Medium Priority
1. Advanced search combinations
2. Better UX for institution type selection (grouped checkboxes)
3. Analytics/reporting by new dimensions

### Future Enhancements
1. Institution type hierarchy (e.g., "All Private" includes private unis + conservatories)
2. Geographic scoping (state regulations only apply to institutions in that state)
3. Bulk operations by institution type
4. Compliance templates by institution type

## User Stories

### Compliance Officer
- "As a compliance officer at a community college, I want to filter regulations to see only those that apply to community colleges, regardless of whether they come from federal, state, or accrediting bodies."

### Administrator  
- "As an administrator, I want to understand which regulations come from accrediting bodies vs. government sources, so I can prioritize compliance efforts."

### Multi-Institution System
- "As someone managing compliance for a system with both public universities and community colleges, I want to easily see which regulations apply to which institution types."

## Technical Implementation Notes

### Constants File
```typescript
export const JURISDICTION_SOURCES = [
  "federal", "state", "international", 
  "private-organization", "accreditor", "industry-association"
] as const;

export const INSTITUTION_TYPES = [
  "public-universities", "private-universities", "community-colleges",
  "conservatories", "technical-institutes", "religious-institutions",
  "for-profit-institutions", "research-institutes", "professional-schools",
  "all-institutions"
] as const;
```

### Backward Compatibility
- Keep existing API endpoints working during transition
- Provide migration path for existing integrations
- Clear deprecation timeline for old jurisdiction field 