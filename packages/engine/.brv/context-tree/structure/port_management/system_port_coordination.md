Port coordination between EdSteward and MCP Engine systems:

**MCP Engine Port Usage (EXISTING - MUST AVOID CONFLICTS):**
- Port 3050 - Frontend (React/Vite)
- Port 3010 - Registry API Server  
- Port 3002 - LLM Gateway
- Port 3051 - Delivery System
- Port 3052 - TUF Repository
- Port 3003 - WebSocket Service (EdSteward integration)
- Port 3099 - System Monitor Dashboard
- Port 3200+ - MCP Regulation Servers (dynamic range 3200-3330+)

**EdSteward Port Usage (EXISTING):**
- Port 3000 - Main application (HTTP/WebSocket)
- Port 3003 - MCP Engine integration (matches MCP Engine's WebSocket service)
- Port 3052-3053 - TUF services (disabled but reserved)
- Port 5432 - PostgreSQL (shared)
- Port 6379 - Redis (shared)

**Key Integration Point:**
- MCP Engine's WebSocket Service (Port 3003) connects to EdSteward's main app (Port 3000)
- EdSteward expects MCP Engine on Port 3003 for WebSocket regulation updates
- Both systems share database (5432) and Redis (6379) infrastructure

**Port Conflict Resolution Needed:**
- New Compliance Tracker MCP system needs ports that don't conflict with either existing system
- Should use port range 3004-3009, 3060-3099 (avoiding MCP Engine's 3010, 3050-3052, 3099)
- Must coordinate with MCP Engine's dynamic range 3200-3330+ for regulation-specific MCPs