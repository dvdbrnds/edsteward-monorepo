## Original Data Source & Deduplication Logic

### Source File
`compliance-matrix.xlsx` - Original compliance matrix from Moravian

### Row Counts Explained
- Original Excel: 295 rows
- Unique statute names: 237-238
- Same statute appears multiple times under different topics

### Why Deduplication Was Correct
MCP Engine correctly deduplicated:
- 295 rows → 237 unique federal regulations
- Added 8 PA state regulations
- Added 6 NJ state regulations
- Total: 251 regulations

### Why EdSteward Had 356 (then 603)
- Original EdSteward import did NOT deduplicate
- Kept all 295+ rows as separate regulations
- After first MCP sync: 356 + 251 = 603 (no UPSERT match)

### Solution Applied
- Deleted WHERE lovv_level IS NULL (pre-MCP data)
- Kept only the 251 MCP-validated regulations
- Result: Both systems at 251

### Topic Mappings Preserve Department Info
`regulation_topics` junction table maintains the many-to-many relationship:
- 251 unique regulations
- 292 topic mappings
- Preserves "Title IX applies to Academic Programs, Athletics, Housing, etc."

### Critical Insight
The multiple rows per regulation in original Excel were NOT duplicates - they represented department-specific compliance responsibilities. This data is preserved in `regulation_topics` table.