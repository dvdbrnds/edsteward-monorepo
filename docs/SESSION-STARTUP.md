# EdSteward — New Session Startup Prompt

Copy and paste this into a new Cursor chat to get the AI up to speed.

---

## Startup Prompt

```
Read CLAUDE.md and ROADMAP.md to understand the project.
Check git log --oneline -15 for recent changes.

Then check if the dev servers are already running before starting anything:
- Port 3000: Main EdSteward app (npm run dev)
- Port 3001: Admin console frontend (cd admin-console && npm run dev)
- Port 4000: Admin console backend (cd admin-console/server && npx tsx watch index.ts)

For each port, check if it's in use and if the service is healthy.
Only start services that aren't already running. Do NOT kill processes
unless they are genuinely stale or erroring.

Verify all running services are healthy before proceeding.
```

---

## Key Reference Files

| File | What It Contains |
|------|-----------------|
| `CLAUDE.md` | Project overview, tech stack, structure, dev setup, deployment flow |
| `ROADMAP.md` | Current priorities, completed milestones, planned features, known issues |
| `CHANGELOG.md` | Release history (may lag behind — check git log for latest) |
| `docs/AWS-DEPLOYMENT-GUIDE.md` | Full deployment process: tag, staging, production, rollback |
| `shared/schema.ts` | Database schema (Drizzle ORM) — single source of truth for all tables |
| `server/index.ts` | Main server entry point |
| `server/routes/api/compliance-tasks.ts` | Compliance tasks + attestation API routes |
| `client/src/pages/attestation-page.tsx` | Public attestation page (magic link, evidence upload) |
| `client/src/pages/regulations-page.tsx` | Main regulations list page |
| `.env` | Environment variables (DB URLs, auth config, MCP engine, etc.) |
| `package.json` | Dependencies and npm scripts |
| `admin-console/package.json` | Admin console frontend dependencies |
| `admin-console/server/package.json` | Admin console backend dependencies |

---

## Architecture Quick Reference

| Component | Details |
|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind, shadcn/ui (Radix) |
| **Backend** | Express.js, TypeScript (tsx), Drizzle ORM |
| **Database** | Neon Serverless PostgreSQL (database-per-tenant) |
| **Auth** | Passport.js (Local + SAML/Okta), MFA (TOTP) |
| **Hosting** | AWS ECS Fargate, ALB, ECR, Route53 |
| **Docker** | Colima on macOS (not Docker Desktop) |
| **Admin Console** | Separate React+Express app in `admin-console/` |
| **Real-time** | WebSocket (MCP Engine for regulation updates) |

---

## Ports

| Port | Service | Health Check |
|------|---------|-------------|
| 3000 | Main app | `curl http://localhost:3000/api/health` |
| 3001 | Admin frontend | `curl -o /dev/null -w "%{http_code}" http://localhost:3001/` |
| 4000 | Admin backend | `curl http://localhost:4000/api/dashboard/stats` (needs auth token) |

---

## Deployment Flow

```
Commit & Push → Tag Version → Deploy Staging → Verify → Deploy Production
```

| Step | Command |
|------|---------|
| Tag patch release | `./scripts/tag-release.sh patch` or `git tag -a v1.X.X -m "msg" && git push origin v1.X.X` |
| Deploy staging | `./scripts/deploy-staging.sh v1.X.X --yes` |
| Verify staging | `curl https://staging.edsteward.ai/api/health` |
| Deploy production | `./scripts/deploy-production.sh v1.X.X --yes` |
| Verify production | `curl https://moravian.edsteward.ai/api/health` |
| Rollback | `./scripts/rollback-production.sh` |

---

## Live URLs

| Environment | URL |
|-------------|-----|
| Production | https://moravian.edsteward.ai |
| Staging | https://staging.edsteward.ai |
| Admin Console | https://admin.edsteward.ai _(pending deployment)_ |

---

## Common Gotchas

- **Sessions are in-memory** — every deployment logs out all users
- **Colima must be running** for Docker builds: `colima status` / `colima start`
- **AWS CLI must be configured**: `aws sts get-caller-identity`
- **Don't kill running dev servers** unless they're actually broken
- **`.env` has secrets** — never commit it (it's in `.gitignore`)
- **`shared/schema.ts`** is the single source of truth for the DB schema
- **Deploy scripts are interactive** unless you pass `--yes`
