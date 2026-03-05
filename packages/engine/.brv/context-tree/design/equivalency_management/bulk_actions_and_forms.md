## TransferIQ - Bulk Approve + Manual Add Form (Jan 10, 2026)

### New Features Built
1. **Bulk Approve/Reject**:
   - Select all checkbox + individual checkboxes for pending items
   - Bulk action bar showing count + Approve All / Reject All buttons
   - API endpoint: `POST /api/admin/equivalencies/bulk` with `{ids: [], action: 'approve'|'reject'}`
   - Successfully approved all 50 AI-generated equivalencies

2. **Manual Equivalency Form** (`/admin/equivalencies/new`):
   - School selectors (Source + Destination)
   - Source course inputs (Code + Title)
   - Equivalency type buttons (Direct, Elective, No Credit, Review)
   - Direct: Course picker with search
   - Elective: Category input
   - Additional options: Credits, Min Grade, Confidence slider, Notes
   - API endpoint: `POST /api/admin/equivalencies`

3. **Courses API**: `GET /api/admin/courses?schoolId=X&search=Y&limit=N`

### Bug Fixes
- Fixed school slugs: Millersville had `moravian` slug, Moravian had auto-generated slug
- Now: Lehigh=`lehigh`, Moravian=`moravian`, Millersville=`millersville`

### Full Pipeline Test
- NCCC transcript (16 courses) → Lehigh: 52 credits awarded as electives
- Pattern matching working correctly for unknown course codes
- 81ms total processing time