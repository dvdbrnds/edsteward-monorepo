## MCP Engine Updates - January 20, 2026 (Commit 76e0473)

### Requirements & Risk Score Fixes
- **Requirements field** now populated from AI-extracted `keyRequirements` (was 0.4% coverage)
- **Risk scores** now included in EdSteward delivery payload (was 16.7% coverage)
- Registry API converts `keyRequirements[]` to structured markdown text with `##` section headers

### Legal Citation Embedding
- New script: `scripts/embed-legal-citations.cjs`
- Embeds USC/CFR citations at top of `regulation_text` for all 251 regulations
- Format: `LEGAL CITATION: 20 U.S.C. § 1092; 34 CFR Part 668, Subpart D`
- Run with: `node scripts/embed-legal-citations.cjs`

### AI Quality Auditor Enhancements
- Enhanced UI shows: score breakdown, detailed metrics, negative/positive factors, action items
- Clery Act achieves **100/100 Grade A** with proper citations and 4-section requirements
- Inquisitor expects `##` markdown headers in requirements field (minimum 3 sections)

### Hot-Loading Fix (Cache Invalidation)
- **Issue**: LLM Gateway caches regulation data, causing stale data after DB updates
- **Fix**: Registry API's `/api/regulations/workflow-update` now calls `POST /api/llm/cache/clear` after saving
- Manual cache clear: `curl -X POST http://localhost:3004/api/llm/cache/clear -H "Content-Type: application/json" -d '{}'`

### Port Configuration (EdSteward Alignment)
- LLM Gateway: **3004** (moved from 3002 to avoid EdSteward conflict)
- Delivery Server: **3003** (EdSteward expects WebSocket here)
- Registry API: **3010**
- Inquisitor: **3061**

### To Achieve 100/100 Audit Score for a Regulation:
1. Run workflow to generate AI summary and extract requirements
2. Ensure requirements has 4+ `##` section headers
3. Run `node scripts/embed-legal-citations.cjs` to embed USC/CFR citations
4. Cache is auto-invalidated after workflow-update