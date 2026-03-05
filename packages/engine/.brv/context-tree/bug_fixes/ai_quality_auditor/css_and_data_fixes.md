MCP Engine Session January 20, 2026 - Part 2: AI Quality Auditor CSS & Data Fixes

COMMITS:
- 76e0473: Add automatic cache invalidation on workflow-update
- 5a4b9bf: Fix AI Quality Auditor CSS layout - prevent content overflow

CSS LAYOUT FIXES for inquisitorWidget (sidebar):
- Added `overflow: hidden; max-width: 100%; box-sizing: border-box;` to container
- Made header responsive with `flex-wrap: wrap` and reduced gap from 30px to 12px
- Reduced font sizes (48px→36px for score, 13px→11px for headers)
- Changed metrics grid from `repeat(2, 1fr)` to single column `1fr`
- Simplified factor/action rows with `text-overflow: ellipsis`

DATA PERSISTENCE ISSUE IDENTIFIED:
The Clery Act regulation_text and requirements keep getting overwritten to old values.
- Manually fixed: Added legal citations and 4 sections to regulation_text
- Result: 100/100 score when data is correct
- Problem: UI still shows 91/B - likely LLM Gateway cache not being invalidated properly

CACHE INVALIDATION ADDED:
Registry API's `/api/regulations/workflow-update` endpoint now calls:
```javascript
fetch('http://localhost:3004/cache/clear', { method: 'POST' })
```
after saving workflow results.

FIRST TASK TOMORROW:
Debug why AI Quality Auditor shows 91/B instead of 100/A:
1. Check if LLM Gateway cache is being properly cleared
2. Check if data in database is being overwritten by workflow
3. Ensure `/api/llm/cfr/:slug` fetches fresh data from PostgreSQL