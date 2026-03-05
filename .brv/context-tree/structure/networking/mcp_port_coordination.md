MCP Engine Port Coordination Directive - CONFIRMED:

**CURRENT MCP ENGINE PORTS (KEEP AS-IS):**
- Port 3050: Frontend (React/Vite) ✅ RUNNING
- Port 3010: Registry API Server ✅ RUNNING  
- Port 3002: LLM Gateway ✅ RUNNING
- Port 3051: Delivery System
- Port 3052: TUF Repository
- Port 3003: WebSocket Service (EdSteward integration)
- Port 3099: System Monitor Dashboard
- Port 3200-3330+: MCP Regulation Servers (dynamic range)

**SHARED INFRASTRUCTURE:**
- Port 5432: PostgreSQL (shared, use schema: mcp_engine)
- Port 6379: Redis (shared, use prefixes: mcp:*, regulation:*, delivery:*)

**RESERVED PORTS (DO NOT USE):**
- Port 3000: EdSteward main application (OCCUPIED)

**INTEGRATION STATUS:**
- EdSteward integration on port 3003 unchanged
- EDSTEWARD_URL=http://localhost:3000 for sending regulation updates
- WebSocket service ready for EdSteward connections

System is currently operational with REG-66 compliance processing active, including live data fetching from government sources (uscode.house.gov, copyright.gov, api.congress.gov).