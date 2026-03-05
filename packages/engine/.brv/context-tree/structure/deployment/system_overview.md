EdSteward + MCP Engine Cursor AI Context Prompt (November 2025)

**System Overview:**
- EdSteward.ai: React/TypeScript frontend, Express.js backend, NeonDB
- MCP Engine: Node.js backend validation engine with WebSocket
- Production: moravian.edsteward.ai with 24+ users, 355+ regulations

**Port Configuration:**
- EdSteward API: 3000
- MCP Engine: 3051 (WebSocket + API)
- Vite Dev Server: 5173

**Startup Commands:**
```bash
# EdSteward
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
npm install && npm run dev

# MCP Engine
lsof -ti:3051 | xargs kill -9 2>/dev/null || true
npm install && npm run dev
```

**Critical ENV:**
- VITE_MCP_WS_URL=ws://localhost:3051 (EdSteward connects to MCP Engine)
- DATABASE_URL=postgresql://...@neondb...

**L.O.V.V. Framework (Patent Pending):**
- Level A: Web scraping (low impact, TEACH Act)
- Level B: API integration (Federal Register)
- Level C: AI analysis (complex regulations)
- Level D: Human intervention (Clery Act)

**Common Issues:**
- Hot reload unreliable - use npm run build
- WebSocket fails - verify port 3051 and VITE_MCP_WS_URL
- Port conflicts - use lsof -ti:PORT | xargs kill -9