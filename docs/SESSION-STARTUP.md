# EdSteward — Session Startup

When this file is referenced, follow these instructions to get up to speed.

## 1. Read Context Files

Read these files to understand the project:

- `CLAUDE.md` — project overview, tech stack, structure, dev setup, deployment flow
- `ROADMAP.md` — current priorities, completed milestones, planned features, known issues

Then run `git log --oneline -15` to see recent changes.

## 2. Check Dev Servers

Check if the dev servers are already running. **Do NOT kill processes unless they
are genuinely stale or erroring.** Only start services that aren't already up.

| Port | Service | Start Command | Health Check |
|------|---------|--------------|-------------|
| 3000 | Main app | `npm run dev` (from project root) | `curl http://localhost:3000/api/health` |
| 3001 | Admin frontend | `npm run dev` (from `admin-console/`) | `curl -o /dev/null -w "%{http_code}" http://localhost:3001/` |
| 4000 | Admin backend | `npx tsx watch index.ts` (from `admin-console/server/`) | `curl http://localhost:4000/api/dashboard/stats` |

For each port:
1. Check if the port is in use: `lsof -ti:PORT`
2. If in use, verify the service is healthy via its health check
3. If healthy, leave it alone
4. If not in use, start it
5. If in use but unhealthy/erroring, kill only that specific process and restart

## 3. Confirm Ready

Report which services are running and healthy before asking what to work on.

---

## Key Reference Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project overview, tech stack, structure, local dev, deployment |
| `ROADMAP.md` | Priorities, milestones, planned features, known issues |
| `CHANGELOG.md` | Release history (may lag — check git log for latest) |
| `docs/AWS-DEPLOYMENT-GUIDE.md` | Full deployment process: tag, staging, production, rollback |
| `shared/schema.ts` | Database schema (Drizzle ORM) — single source of truth |
| `server/index.ts` | Main server entry point |
| `server/routes/api/compliance-tasks.ts` | Compliance tasks + attestation API |
| `client/src/pages/attestation-page.tsx` | Public attestation page (magic link) |
| `.env` | Environment variables (secrets — never commit) |

## Architecture

| Component | Details |
|-----------|---------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| Backend | Express.js, TypeScript (tsx), Drizzle ORM |
| Database | Neon Serverless PostgreSQL (database-per-tenant) |
| Auth | Passport.js (Local + SAML/Okta), MFA (TOTP) |
| Hosting | AWS ECS Fargate, ALB, ECR, Route53 |
| Docker | Colima on macOS (not Docker Desktop) |
| Admin Console | Separate app in `admin-console/` (frontend + backend) |
| Real-time | WebSocket (MCP Engine for regulation updates) |

## Deployment

```
Commit & Push → Tag Version → Deploy Staging → Verify → Deploy Production
```

| Step | Command |
|------|---------|
| Tag release | `git tag -a v1.X.X -m "msg" && git push origin v1.X.X` |
| Deploy staging | `./scripts/deploy-staging.sh v1.X.X --yes` |
| Verify staging | `curl https://staging.edsteward.ai/api/health` |
| Deploy production | `./scripts/deploy-production.sh v1.X.X --yes` |
| Verify production | `curl https://moravian.edsteward.ai/api/health` |
| Rollback | `./scripts/rollback-production.sh` |

## Live URLs

- **Production:** https://moravian.edsteward.ai
- **Staging:** https://staging.edsteward.ai
- **Admin Console:** https://admin.edsteward.ai _(pending deployment)_

## Common Gotchas

- Sessions are in-memory — every deployment logs out all users
- Colima must be running for Docker builds: `colima start`
- AWS CLI must be configured: `aws sts get-caller-identity`
- `.env` has secrets — never commit it
- `shared/schema.ts` is the single source of truth for the DB schema
- Deploy scripts are interactive unless you pass `--yes`
