# EdSteward AI Assistant Guidelines

> **Last Updated:** February 12, 2026
> **Current Version:** v1.4.10
> **Production:** https://moravian.edsteward.ai
> **Staging:** https://staging.edsteward.ai

## Project Overview

EdSteward is a regulatory compliance platform for higher education accreditation
management. It features multi-tenant architecture, real-time WebSocket updates
from an MCP Engine, AI-powered regulation analysis, compliance task management
with email-based attestation workflows, and evidence upload/management.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix) |
| Backend | Express.js, Node.js, TypeScript (tsx) |
| Database | PostgreSQL (Neon Serverless), Drizzle ORM |
| Auth | Passport.js (Local + SAML/Okta), JWT, MFA (TOTP) |
| Hosting | AWS ECS Fargate, ALB, ECR, Route53 |
| Container | Docker (multi-stage build via Colima on macOS) |
| Real-time | WebSocket (MCP Engine integration) |
| Admin | Separate React app (admin-console/) on port 3001/4000 |

## Key Architecture

- **Multi-tenant**: Database-per-tenant (Neon Serverless PostgreSQL), subdomain routing
- **Single-tenant mode**: Default for local dev (uses DATABASE_URL from .env)
- **Attestation system**: Magic link tokens for external users to upload evidence and sign attestations
- **Compliance tasks**: Assigned to regulations, with evidence requirements, DRI assignment, email notifications
- **Deployment**: Staging-first with gated production (see docs/AWS-DEPLOYMENT-GUIDE.md)

## Project Structure

```
EdSteward/
├── client/src/           # React frontend
│   ├── pages/            # ~30 page components
│   ├── components/       # UI components (shadcn/ui based)
│   └── hooks/            # Custom React hooks
├── server/               # Express backend
│   ├── index.ts          # Main server entry point
│   ├── routes/api/       # ~32 API route files
│   └── services/         # Business logic (notifications, scheduling, etc.)
├── shared/
│   └── schema.ts         # Drizzle ORM database schema (single source of truth)
├── admin-console/        # Separate admin app
│   ├── src/              # React frontend (port 3001)
│   └── server/           # Express backend (port 4000)
├── scripts/              # ~90 deployment, migration, and utility scripts
├── deployments/          # JSON records of staging/production deployments
├── docs/                 # Documentation (AWS-DEPLOYMENT-GUIDE.md, etc.)
├── infrastructure/       # Terraform configs
├── .env                  # Environment variables (DO NOT commit secrets)
└── docker-compose.*.yml  # Various Docker Compose configs
```

## Important Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema definitions (Drizzle ORM) |
| `server/index.ts` | Main server entry point |
| `server/routes/api/compliance-tasks.ts` | Compliance tasks + attestation API |
| `client/src/pages/attestation-page.tsx` | Public attestation page (magic link) |
| `client/src/pages/regulations-page.tsx` | Main regulations list |
| `.env` | All environment variables |
| `docs/AWS-DEPLOYMENT-GUIDE.md` | Step-by-step deployment process |
| `ROADMAP.md` | Project roadmap and priorities |
| `CHANGELOG.md` | Release history |

## Local Development

### Starting the System

```zsh
# Kill any stale processes first
lsof -ti:3000,3001,4000 | xargs kill -9 2>/dev/null

# Main app (port 3000)
cd /path/to/EdSteward && npm run dev

# Admin console frontend (port 3001)
cd admin-console && npm run dev

# Admin console backend (port 4000)
cd admin-console/server && npx tsx watch index.ts
```

### Key Ports

| Port | Service |
|------|---------|
| 3000 | Main EdSteward app (Express + Vite) |
| 3001 | Admin console frontend (Vite) |
| 4000 | Admin console backend (Express) |

### Common Issues

- **EADDRINUSE on port 3000**: Kill stale tsx processes: `pkill -f "tsx server/index.ts"`
- **Admin console DB error "database dvdbrnds does not exist"**: The dotenv path in `admin-console/server/config/database-connections.ts` was fixed in v1.4.8
- **MFA warnings on startup**: Expected in dev — set `MFA_ENCRYPTION_KEY` env var to persist MFA data

## Deployment

All deployments follow: **Code -> Commit -> Push -> Tag -> Staging -> Verify -> Production**

```zsh
# Full deployment flow
git add -A && git commit -m "description" && git push
git tag -a v1.4.X -m "description" && git push origin v1.4.X
./scripts/deploy-staging.sh v1.4.X --yes
curl https://staging.edsteward.ai/api/health
./scripts/deploy-production.sh v1.4.X --yes
curl https://moravian.edsteward.ai/api/health
```

See `docs/AWS-DEPLOYMENT-GUIDE.md` for full details.

## Development Guidelines

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use zsh shell (macOS with Homebrew)
- Test changes locally before deploying
- Always deploy to staging first, verify, then production
- Update CHANGELOG.md for notable changes
