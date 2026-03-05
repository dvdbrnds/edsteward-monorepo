Successfully resolved Clery Act full text display issue in EdSteward regulation detail page (Step 3.2 of manual testing checklist):

**Problem**: User reported missing Clery Act full text card when clicking "View Full Text" button on regulation 355 detail page. Investigation revealed complex multi-layer issue.

**Root Causes**:
1. **Database Content**: Clery Act `regulation_text` field was NULL (missing content)
2. **Drizzle ORM Query Issue**: `db.select().from(regulations)` was not including `regulation_text` field in results
3. **Field Mapping**: Database uses `regulation_text` (snake_case) but frontend expects `regulationText` (camelCase)

**Solution Applied**:
1. **Restored Full Text Content**: Added complete 8,780-character Clery Act text to database:
```sql
UPDATE regulations SET regulation_text = $1 WHERE name ILIKE '%clery%'
```

2. **Fixed Drizzle ORM Issue**: Modified `getRegulation()` method in `/server/storage.ts` to use raw SQL query:
```javascript
const result = await db.execute(sql`SELECT *, regulation_text FROM regulations WHERE id = ${id} LIMIT 1`);
regulation.regulationText = regulation.regulation_text; // Map snake_case to camelCase
```

3. **Added Required Import**: Added `sql` to Drizzle imports: `import { eq, desc, or, like, sql } from "drizzle-orm";`

**Technical Details**:
- **API Endpoint**: `/api/regulations/:id` now correctly returns `regulationText` field
- **Frontend Component**: `RegulationDetailPage.tsx` "View Full Text" button now displays complete Clery Act text
- **Database Schema**: Drizzle schema already had correct mapping: `regulationText: text("regulation_text")`
- **Issue**: Standard Drizzle `db.select()` was not including the field, required raw SQL

**Verification**: 
- API test: `curl -s "http://localhost:3000/api/regulations/355" | jq '.regulationText'` returns full text
- Frontend test: "View Full Text" button opens dialog with complete Clery Act content
- Server logs show: "🔍 DEBUG: Has regulationText: true" and "🔍 DEBUG: regulationText value: HAS_TEXT"

**Key Learning**: When Drizzle ORM `db.select()` doesn't include expected fields, use raw SQL with `db.execute(sql`...`)` as fallback. Always verify API responses match frontend expectations for field names (camelCase vs snake_case).