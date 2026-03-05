## MCP Engine PM2 Process Management Implementation (January 21, 2026)

### PM2 Setup for Service Supervision
MCP Engine now uses PM2 for process management, ensuring services auto-restart on crash.

**Configuration:** `ecosystem.config.cjs`
```javascript
module.exports = {
  apps: [
    { name: 'registry-api', script: 'start-registry-postgres.js', env: { PORT: 3010 } },
    { name: 'llm-gateway', script: 'src/llm-gateway/start-llm-gateway-phase4.js', env: { PORT: 3004 } },
    { name: 'delivery-server', script: 'src/delivery-system/delivery-server.js', env: { PORT: 3003 } },
    { name: 'inquisitor', script: 'src/inquisitor-mcp/inquisitor-server.js', env: { INQUISITOR_PORT: 3061 } },
    { name: 'frontend', script: 'npx', args: 'vite --port 3050 --host', cwd: 'src/client' }
  ]
};
```

**NPM Commands:**
- `npm start` - Start all services with PM2
- `npm stop` - Stop all services
- `npm restart` - Restart all services
- `npm run status` - View service status
- `npm run logs` - View all logs
- `npm run monit` - Live monitoring dashboard

**PM2 Direct Commands:**
- `pm2 status` - See all services
- `pm2 logs <service>` - Logs for specific service
- `pm2 restart <service>` - Restart specific service
- `pm2 save` - Save process list
- `pm2 startup` - Generate auto-start script for reboots

**Key Fix:** delivery-server.js module detection updated to detect PM2 environment:
```javascript
const isPM2 = process.env.PM2_HOME || process.env.pm_id !== undefined;
const shouldStart = isPM2 || isDirectRun;
```

### Enhanced Risk Assessment in EdSteward Payload
EdSteward now receives complete risk breakdown including:
- Full factor objects with score, rationale, maxPenaltyReference, precedentCases
- Factor scores summary for quick reference
- Enforcement trend (INCREASING/STABLE/DECREASING)
- Recent enforcement actions array
- Assessment metadata (date, version, isPreliminary)

### Service Ports (Current)
- Registry API: 3010
- LLM Gateway: 3004
- Delivery Server: 3003
- Inquisitor: 3061
- Frontend: 3050

Commit: 47f3297