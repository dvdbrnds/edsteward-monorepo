# EdSteward — New Agent Session

When this file is referenced, follow these instructions to orient yourself.

## 1. Understand the Project

Read these files:

- `CLAUDE.md` — project overview, tech stack, structure, dev setup, deployment
- `ROADMAP.md` — current priorities, completed milestones, planned features

Then run `git log --oneline -15` to see what's been happening recently.

## 2. Check Current State

The dev servers may already be running from a previous session. Check before
doing anything — do NOT start or kill processes unless asked.

| Port | Service | Health Check |
|------|---------|-------------|
| 3000 | Main app | `curl -s http://localhost:3000/api/health` |
| 3001 | Admin frontend | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` |
| 4000 | Admin backend | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` |

Run the health checks to see what's up. Report what's running and what isn't.

**If services are running and healthy, leave them alone.**

Only offer to start missing services if the user asks you to, or if the task
requires them. Don't start or restart anything proactively.

## 3. Report and Wait

Briefly report:
- What you learned from CLAUDE.md / ROADMAP.md / git log
- Which services are running
- Then ask the user what they'd like to work on

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema (Drizzle ORM) — single source of truth |
| `server/index.ts` | Main server entry point |
| `server/routes/api/compliance-tasks.ts` | Compliance tasks + attestation API |
| `client/src/pages/attestation-page.tsx` | Public attestation page (magic link) |
| `.env` | Environment variables (secrets — never commit) |
| `docs/AWS-DEPLOYMENT-GUIDE.md` | Full deployment: tag, staging, production, rollback |

### Architecture

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| Backend | Express.js, TypeScript (tsx), Drizzle ORM |
| Database | Neon Serverless PostgreSQL (database-per-tenant) |
| Auth | Passport.js (Local + SAML/Okta), MFA (TOTP) |
| Hosting | AWS ECS Fargate, ALB, ECR, Route53 |
| Docker | Colima on macOS (not Docker Desktop) |
| Admin | Separate app in `admin-console/` (port 3001 frontend, port 4000 backend) |

### Starting Services (only if needed)

```zsh
# Main app (port 3000) — from project root
npm run dev

# Admin console frontend (port 3001) — from admin-console/
npm run dev

# Admin console backend (port 4000) — from admin-console/server/
npx tsx watch index.ts
```

### Deployment

```
Commit & Push → Tag → Deploy Staging → Verify → Deploy Production
```

| Step | Command |
|------|---------|
| Tag release | `git tag -a v1.X.X -m "msg" && git push origin v1.X.X` |
| Deploy staging | `./scripts/deploy-staging.sh v1.X.X --yes` |
| Deploy production | `./scripts/deploy-production.sh v1.X.X --yes` |
| Rollback | `./scripts/rollback-production.sh` |

### Live URLs

- **Production:** https://moravian.edsteward.ai
- **Staging:** https://staging.edsteward.ai

### Gotchas

- Sessions are in-memory — deployments log out all users
- Colima must be running for Docker builds: `colima start`
- `.env` has secrets — never commit
- `shared/schema.ts` is the DB source of truth
- Deploy scripts are interactive unless you pass `--yes`
