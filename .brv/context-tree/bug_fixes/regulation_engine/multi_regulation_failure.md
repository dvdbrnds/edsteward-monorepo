# MCP Engine Friday Demo Crisis - Root Cause Analysis (Dec 1, 2025)

## Critical Discovery

Comprehensive diagnostic analysis revealed the MCP Engine is **NOT a general-purpose regulation platform** - it was built specifically for the TEACH Act only. Of the 10 regulations needed for the Friday counsel demo, only 1 (TEACH Act) works.

## Root Causes

1. **Registry API Hard Limit**: `registry-server.js` line 170 has `.slice(0, 50)` limiting API to first 50 regulations. FERPA and Title IV are beyond this limit in the CSV.

2. **LLM Gateway TEACH-Act-Only**: Only 3 endpoints exist:
   - `GET /api/llm/usc/17/110` (TEACH Act USC)
   - `GET /api/llm/cfr/teach-act` (TEACH Act CFR)  
   - `POST /api/llm/compliance/teach-act`
   
   Missing: CFR endpoints for FERPA (34 CFR 99), Title IX (34 CFR 106), Clery (34 CFR 668), etc.

3. **Special-Case Architecture**: `regulation-delivery-engine.js` has hard-coded if/else logic for REG-66/TEACH Act. Other regulations fall into broken generic fallback.

4. **No Government API Integration**: Except for TEACH Act, there's no integration with eCFR.gov, uscode.house.gov, or Federal Register APIs for other regulations.

## What Actually Works

TEACH Act (REG-66): 16,027 chars USC text, Federal Register integration, 1,214 chars structured requirements, real-time CDC, WebSocket delivery, EdSteward POST integration.

## What Doesn't Work

All other 9 regulations: No data sources, no CFR/USC endpoints, no full text, no structured requirements, complete delivery pipeline failure.

## Solution Paths

**Option B (Recommended for Friday)**: 3 hours work - Remove `.slice(0, 50)` limit, add static full text files for 10 regulations, update CSV deadlines, test delivery. Demo-ready with curated data, honest about scaling architecture post-demo.

**Option C (Post-Demo)**: 8-10 hours - Implement general CFR/USC endpoint router, dynamic government API fetching, automated requirement extraction. Full live integration for all regulations.

## Files to Fix

- `src/server/registry-api/registry-server.js` - Remove line 170 `.slice(0, 50)`
- `src/llm-gateway/simple-usc-gateway.js` - Add CFR routing for all regulations
- `compmat.csv` - Update Deadlines column with accurate dates
- Create: `data/regulations/static-fulltext/` for Option B static files
