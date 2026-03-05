EdSteward MCP Engine Port Coordination implemented on September 1, 2025.

**PORT ALLOCATION FINALIZED**:

**EdSteward Active Ports**:
- Port 3000: Main application (HTTP/WebSocket) ✅ ACTIVE
- Port 3003: MCP Engine integration endpoint ✅ ACTIVE INTEGRATION

**MCP Engine Reserved Ports (DO NOT USE)**:
- Port 3002: MCP Engine LLM Gateway 🚫 RESERVED
- Port 3010: MCP Engine Registry API 🚫 RESERVED  
- Port 3050: MCP Engine Frontend 🚫 RESERVED
- Port 3051: MCP Engine Delivery System 🚫 RESERVED
- Port 3052: MCP Engine TUF Repository 🚫 RESERVED
- Port 3053: MCP Engine TUF WebSocket 🚫 RESERVED
- Port 3099: MCP Engine System Monitor 🚫 RESERVED
- Port 3200-3330+: MCP Engine Dynamic Regulation Servers 🚫 RESERVED

**Shared Resources**:
- Port 5432: PostgreSQL (shared, default schema)
- Port 6379: Redis (shared, prefixed keys: session:*, cache:*)

**Integration Configuration**:
```bash
# Active MCP Engine Integration
MCP_ENGINE_URL=http://localhost:3003
VITE_MCP_WS_URL=ws://localhost:3003/regulation-updates

# TUF Services (Reserved for MCP Engine)
MCP_ENGINE_TUF_URL=http://localhost:3052
TUF_WEBSOCKET_URL=ws://localhost:3053
```

**Circuit Breaker Status**: TUF service automatically disabled when MCP Engine ports 3052-3053 unavailable. EdSteward operates independently without MCP Engine TUF integration.

**Critical**: Never use MCP Engine reserved ports. Only port 3003 is for active EdSteward-MCP Engine integration. Complete documentation in PORT_COORDINATION.md.