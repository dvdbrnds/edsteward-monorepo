# MCP Engine — New Agent Session

When this file is referenced, follow these instructions to orient yourself.

## 1. Understand the Project

Read these files:

- `README.md` — project overview, architecture, phase evolution, setup

Then run `git log --oneline -15` to see what's been happening recently.

## 2. Check Current State

The dev servers may already be running from a previous session. Check before
doing anything — do NOT start or kill processes unless asked.

| Port | Service | Health Check |
|------|---------|-------------|
| 3010 | Registry API (PostgreSQL) | `curl -s http://localhost:3010/health` |
| 3004 | LLM Gateway | `curl -s http://localhost:3004/api/llm/health` |
| 3050 | Frontend (Vite) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3050/` |
| 3003 | Delivery Server (EdSteward) | `curl -s http://localhost:3003/health` |
| 3060 | Customer API | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3060/` |
| 3061 | Inquisitor MCP | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3061/` |

Run the health checks to see what's up. Report what's running and what isn't.

**If services are running and healthy, leave them alone.**

Only offer to start missing services if the user asks you to, or if the task
requires them. Don't start or restart anything proactively.

## 3. Report and Wait

Briefly report:
- What you learned from README.md / docs / git log
- Which services are running
- Then ask the user what they'd like to work on

---

## Quick Reference

### Project Layout

| Directory | Contents |
|-----------|----------|
| `src/` | Application source code (server, client, services, LLM gateway, etc.) |
| `scripts/` | Utility scripts — test, generate, fix, deploy, migrate, shell scripts |
| `docs/` | All documentation (architecture, EdSteward, features, plans, reports, prompts) |
| `config/` | Runtime config (customers, integrations) |
| `data/` | Registry data, EdSteward mappings, session DB |
| `enhanced-regulations/` | 242 per-regulation JSON files (federal + state) |
| `archive/` | Deprecated code, old CSV backups, one-off JSON reports |
| `backups/` | Console HTML backups (timestamped) |
| `console-versions/` | Versioned console content with metadata |
| `logs/` | Component log files |
| `k8s/` | Kubernetes manifests |
| `server/` | MCP Inspector server |

### Key Files

| File | Purpose |
|------|---------|
| `mcp-start.js` | Unified startup — starts all services with health checks |
| `mcp-stop.js` | Graceful shutdown of all services |
| `start-registry-postgres.js` | Registry API entry point (PostgreSQL mode) |
| `ecosystem.config.cjs` | PM2 process management config |
| `config/customers.json` | Customer/tenant config (moravian-dev, moravian-prod) |
| `data/edsteward-regkey-bulk-mapping.json` | REG-key to EdSteward ID mapping (242 entries) |
| `.env` | Environment variables (secrets — never commit) |

### Architecture

| Layer | Stack |
|-------|-------|
| Runtime | Node.js (ESM modules) |
| Backend | Express.js |
| Frontend | React 18, Vite 5, Ant Design, styled-components |
| Database | PostgreSQL (source of truth) |
| Cache | Redis (with in-memory fallback) |
| LLM | OpenAI API, Anthropic SDK |
| MCP | @modelcontextprotocol/sdk |
| Deploy | Docker Compose, PM2 |

### Services

| Service | Port | Entry Point |
|---------|------|-------------|
| Registry API | 3010 | `start-registry-postgres.js` |
| LLM Gateway | 3004 | `src/llm-gateway/start-llm-gateway-phase4.js` |
| Frontend | 3050 | Vite dev server (`src/client/`) |
| Delivery Server | 3003 | `src/delivery-system/delivery-server.js` |
| Customer API | 3060 | `src/server/customer-management-api.js` |
| Inquisitor | 3061 | `src/inquisitor-mcp/inquisitor-server.js` |

### Regulation Data

- **Total regulations**: 242 (240 federal, 9 PA state, 6 NJ state)
- **Jurisdictions**: federal, state (PA, NJ)
- **LOVV levels**: A (17), B (183), C (40)
- **Enhanced JSON files**: `enhanced-regulations/*.json`
- **Console pages**: `src/client/public/regulations/*-console.html`
- **Gold-certified consoles**: ~15 (Clery, Title IX, FERPA, PA Act 55, etc.)

### State Regulation Pipeline

State regulations use a different source-fetching pipeline than federal:

| Component | Federal | State (PA) |
|-----------|---------|------------|
| Statute text | eCFR API | Enhanced JSON + Open States API |
| Rulemaking | Federal Register API | PA General Assembly + PA Code & Bulletin |
| Source client | `ecfr-api-client.js` | `state-legislature-api-client.js` |
| Mappings | `CFR_MAPPINGS` | `STATE_STATUTE_MAPPINGS` |
| Task templates | Federal templates | State-specific templates (e.g. `pennsylvania-act-55-of-2022`) |

Key files for state support:
- `src/llm-gateway/state-legislature-api-client.js` — PA statute fetcher
- `src/llm-gateway/services/comprehensive-workflow-engine.js` — routes federal vs state
- `src/llm-gateway/services/regulation-task-extractor.js` — state-specific task templates

### EdSteward Integration

MCP Engine delivers regulation data to EdSteward:

| Environment | URL | Auth |
|-------------|-----|------|
| Production | https://moravian.edsteward.ai | Basic `mcp-engine:[REDACTED]` |
| Development | http://localhost:3000 | Basic `dvdbrnds:gabadhgabadh` |

Delivery flow:
1. Console page "Push to Selected Target" or "Send to Moravian Production" button
2. Hits delivery server at `localhost:3003/api/customers/push`
3. Delivery server builds payload from Registry API data
4. POSTs to `moravian.edsteward.ai/api/regulation-updates` (pending CCO review)
5. Direct sync available via `/api/mcp/regulations/sync` (bypasses approval queue)

Key delivery files:
- `src/delivery-system/delivery-server.js` — push logic, payload building
- `config/customers.json` — target URLs and auth

### Starting Services

```zsh
# All at once
node mcp-start.js

# Or individually:
node start-registry-postgres.js              # Registry API (3010)
node src/llm-gateway/start-llm-gateway-phase4.js  # LLM Gateway (3004)
npx vite src/client --port 3050              # Frontend (3050)
node src/delivery-system/delivery-server.js  # Delivery (3003)

# Infrastructure
docker-compose up -d   # PostgreSQL, Redis, Kafka
```

### Database

PostgreSQL `mcp_engine` database. Key tables:
- `regulations` — 242 regulations with jurisdiction metadata
- `regulation_tasks` — compliance tasks per regulation
- `regulation_deadlines` — filing deadlines per regulation
- `risk_assessments` — institutional risk scores per regulation
- `regulation_versions` — version history
- `executive_orders` — EO tracking and regulation impact
- `transmission_log` — delivery audit trail

Quick queries:
```sql
-- Regulation count by jurisdiction
SELECT jurisdiction_source, state_code, COUNT(*) FROM regulations
GROUP BY jurisdiction_source, state_code;

-- Check a regulation's tasks
SELECT assigned_role, COUNT(*) FROM regulation_tasks
WHERE regulation_id = (SELECT id FROM regulations WHERE item_id = 'YOUR-SLUG')
GROUP BY assigned_role;
```

### Gotchas

- **ESM only** — `"type": "module"` — use `import` not `require`
- **PostgreSQL is source of truth** — old CSV registry is deprecated
- **`mcp-start.js` kills conflicting processes** — frees ports on startup
- **Docker required** — `docker-compose up -d` for PostgreSQL, Redis, Kafka
- **`.env` has secrets** — never commit; copy `env.example` for setup
- **macOS + zsh** — Homebrew packages, Colima for Docker (`colima start`)
- **State regs use different pipeline** — don't use CFR/eCFR for PA/NJ regulations
- **EdSteward deadlines** — `filing_deadlines` JSON is metadata only; actual deadlines are separate records in EdSteward's `deadlines` table
- **Task extractor matching** — templates match by slug first, then keywords; requires 2+ keyword matches to prevent false positives
- **Console pages are static HTML** — served from `src/client/public/regulations/`; each regulation gets its own page
