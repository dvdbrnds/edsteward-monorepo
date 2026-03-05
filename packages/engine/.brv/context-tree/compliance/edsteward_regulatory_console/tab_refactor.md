MCP Engine Console 5-Tab Refactor (commit 63e5bc6) - January 20, 2026

REFACTORED: Replaced 9 redundant tabs with 5 customer-focused tabs that precisely match what EdSteward customers receive.

NEW TAB STRUCTURE:
1. 📄 Regulation Text - Real CFR data from PostgreSQL Registry API (citation, source, verified date)
2. 📋 Summary & Scope - Plain language summary, "Who Must Comply" list, department tags, key requirements
3. 📅 Tasks & Deadlines - Filing deadlines with frequency badges, hierarchical task list with priority colors
4. ⚠️ Risk Assessment - IRS score banner (96 CRITICAL for Clery), 5-factor breakdown cards, L.O.V.V. validation, enforcement history
5. 📤 Customer Payload - Exact EdSteward JSON payload with Validate/Copy/Send buttons, 16.9KB payload preview

REMOVED TABS:
- USC Text (merged into Regulation Text)
- CFR Regulations (redundant)
- Analysis & Scope (merged into Summary & Scope)
- Compliance Guide (merged into Risk Assessment)
- Update Staging (admin-only, not customer-facing)
- Customer APIs (developer docs, separate page)

KEY FILES:
- src/client/public/regulations/jeanne-clery-...-console.html - Main console with new tabs
- scripts/rebuild-console-tabs.cjs - Build script for tab structure

DATA SOURCES: All tabs fetch real data from http://localhost:3010/api/regulations via fetchRegulationData() function with caching.