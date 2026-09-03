# EdSteward on Coolify

Deployment guide for running EdSteward on Coolify instead of AWS ECS.

## Architecture

Each customer gets their own Coolify **Project** containing a Docker Compose stack:

- **app** -- EdSteward Node.js application (port 3000)
- **postgres** -- PostgreSQL 15 database
- **redis** -- Redis 7 cache

Coolify provides SSL (Let's Encrypt via Traefik), domain routing, environment variable management, health monitoring, and database backups.

The MCP Engine runs as a separate Coolify project and pushes regulation updates to each customer's EdSteward instance via HTTPS.

## GitHub Integration Setup

Coolify deploys from the `coolify` branch of the GitHub repo. Each project points to the same repo but uses a different Docker Compose file path.

### Creating a Deployment

For each project (EdSteward app, MCP Engine, Admin Console):

1. Create a **Project** (e.g., "EdSteward - Moravian")
2. Add Resource -> **Public Repository**
3. Repository URL: `https://github.com/dvdbrnds/edsteward-monorepo`
4. Branch: `coolify`
4. Build Pack: **Docker Compose**
5. **Base Directory** -- set to the `coolify/` folder for the project:
   - EdSteward App: `packages/app/coolify`
   - MCP Engine: `packages/engine/coolify`
   - Admin Console: `packages/app/admin-console/coolify`
   Coolify auto-discovers `docker-compose.yaml` in the base directory.
6. Deploy

Build contexts in the compose files use `context: ..` to point up to the package directory where the Dockerfile and source code live. Coolify resolves these relative to the compose file location.

### Auto-Deploy on Push

Once connected, enable **Auto Deploy** in the resource settings. Any push to the `coolify` branch triggers a rebuild and redeploy automatically.

## Quick Start: New Customer

1. In Coolify, create a new **Project** (e.g., "EdSteward - Acme University")
2. Add Resource -> **Public Repository**
3. Repository URL: `https://github.com/dvdbrnds/edsteward-monorepo`, branch: `coolify`
4. Build Pack: **Docker Compose**
5. Base Directory: `packages/app/coolify` (uses `docker-compose.yaml` automatically)
6. Go to the **Environment Variables** tab and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | `openssl rand -hex 32` |
| `MFA_ENCRYPTION_KEY` | Recommended | `openssl rand -hex 32` |
| `INSTITUTION_NAME` | Yes | e.g., "Acme University" |
| `INSTITUTION_DOMAIN` | Yes | e.g., "acme.edu" |
| `BASE_URL` | Yes (if SAML) | e.g., "https://acme.edsteward.ai" |
| `INSTITUTION_PRIMARY_COLOR` | No | Hex color, e.g., "#003366" |
| `INSTITUTION_SECONDARY_COLOR` | No | Hex color |
| `INSTITUTION_LOGO_URL` | No | Path or URL to logo |
| `AUTH_SAML_ENABLED` | No | "true" or "false" |
| `AUTH_SAML_ENTITY_ID` | If SAML | SAML entity ID |
| `AUTH_SAML_SSO_URL` | If SAML | SAML SSO endpoint |
| `MCP_ENGINE_USERNAME` | Yes | e.g., "mcp-engine" |
| `MCP_ENGINE_PASSWORD` | Yes | Unique per customer |
| `EMAIL_HOST` | Recommended | SMTP host |
| `EMAIL_PORT` | No | Default: 587 |
| `EMAIL_USER` | Recommended | SMTP username |
| `EMAIL_PASS` | Recommended | SMTP password |
| `EMAIL_FROM` | Recommended | From address |

7. Click on the **app** service -> set **FQDN** to the customer's domain (e.g., `https://acme.edsteward.ai`)
8. Deploy
9. Configure **PostgreSQL backups**: Click on the **postgres** service -> Backups tab -> Add schedule (e.g., `0 3 * * *` for daily at 3 AM) -> optionally enable S3 storage
10. Import regulation seed data or wait for MCP Engine to push
11. Add the customer to `packages/engine/config/customers.json`

## Migrating from AWS ECS (Neon)

Use the migration script to move data from Neon to Coolify's PostgreSQL:

```zsh
# 1. Deploy the Coolify compose stack first (empty database)

# 2. Export from Neon production
./scripts/migrate-to-coolify.sh export "postgresql://...@ep-weathered-term.../neondb"

# 3. Import into Coolify PostgreSQL (find the URL in Coolify's postgres service config)
./scripts/migrate-to-coolify.sh import "postgresql://edsteward:pass@<coolify-host>:5432/edsteward" migration-dumps/edsteward-*.dump

# 4. Verify
./scripts/migrate-to-coolify.sh verify "postgresql://edsteward:pass@<coolify-host>:5432/edsteward"

# Or do it all at once:
./scripts/migrate-to-coolify.sh full "postgresql://...@neon-url" "postgresql://...@coolify-url"
```

### Migration Checklist

- [ ] Deploy Coolify compose stack
- [ ] Export Neon database
- [ ] Import into Coolify PostgreSQL
- [ ] Verify row counts (regulations, tasks, users)
- [ ] Set environment variables in Coolify UI
- [ ] Copy `MFA_ENCRYPTION_KEY` from ECS task definition (preserves MFA enrollments)
- [ ] Set FQDN on app service
- [ ] Lower DNS TTL to 60 seconds (72 hours before cutover)
- [ ] Switch DNS to Coolify server IP
- [ ] Verify Let's Encrypt SSL cert issued
- [ ] Test SAML login
- [ ] Test MCP Engine regulation push
- [ ] Monitor for 24-48 hours
- [ ] Stop AWS ECS services (keep as rollback for 2 weeks)
- [ ] After 30 days: decommission AWS resources

## Deploying Updates

### Option A: Git Auto-Deploy (Recommended)

Connect the GitHub repo to Coolify, pointed at the `coolify` branch. Pushes trigger auto-build and deploy.

```zsh
# Make changes, commit, push
git checkout coolify
git add -A && git commit -m "feat: your changes"
git push origin coolify
# Coolify auto-deploys
```

### Option B: Manual Deploy Script

```zsh
./scripts/deploy-coolify.sh --push v1.6.0
```

### Option C: Coolify API

```zsh
export COOLIFY_API_TOKEN="your-token"
export COOLIFY_WEBHOOK_URL="https://coolify.moravian.edu/api/v1/deploy"
./scripts/deploy-coolify.sh --api
```

## Merging Main Branch Updates

The `coolify` branch should be regularly synced with `main` to pick up app features:

```zsh
git checkout coolify
git merge main
# Resolve conflicts if any
git push origin coolify
```

## Environment Variable Reference

### Deployment Mode

`DEPLOYMENT_MODE=coolify` disables:
- AWS Secrets Manager (uses env vars directly)
- S3 file storage (uses database `file_storage` table)
- Neon-specific backup branching

### Database

The compose file sets `DATABASE_URL` automatically to the internal PostgreSQL service. No Neon connection needed.

### Email

Uses standard SMTP (nodemailer). Set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`. AWS SES is not used.

### File Uploads

Evidence files are stored in the PostgreSQL `file_storage` table (binary data). S3 is not used. No additional storage configuration needed.

## Backups

Coolify has built-in PostgreSQL backup support:

1. Navigate to the **postgres** service in your Coolify project
2. Go to the **Backups** tab
3. Click **Add** to create a backup schedule
4. Set frequency (e.g., `0 3 * * *` for daily at 3 AM)
5. Optionally configure S3-compatible storage for off-site backups
6. Enable "Backup All Databases"

Recommended schedule:
- Production: Every 4 hours (`0 */4 * * *`), retain 7 days
- Staging: Daily at 3 AM (`0 3 * * *`), retain 3 days

## Troubleshooting

### App won't start
- Check Coolify deployment logs for the `app` service
- Verify `DATABASE_URL` is correct (should point to internal `postgres` service)
- Verify `SESSION_SECRET` is set

### SAML login fails
- Verify `BASE_URL` matches the FQDN exactly (including `https://`)
- Verify `AUTH_SAML_ENTITY_ID` and `AUTH_SAML_SSO_URL` are correct
- Check that the SAML certificate is bundled in the Docker image (`certs/okta-cert.pem`)

### MCP Engine can't push updates
- Verify the app's FQDN is accessible from the engine
- Verify `MCP_ENGINE_USERNAME` and `MCP_ENGINE_PASSWORD` match between engine and app
- Check the engine's `customers.json` has the correct URL

### Database connection fails
- Verify PostgreSQL health check is passing in Coolify
- Check that the `postgres` service is running
- The `DATABASE_URL` in the compose file uses `sslmode=disable` (internal Docker network)

## Files

| File | Purpose |
|------|---------|
| `coolify/docker-compose.yaml` | Main EdSteward compose for Coolify |
| `coolify/docker-compose.customer-template.yaml` | Template for new customers |
| `scripts/migrate-to-coolify.sh` | Database migration script (Neon -> Coolify PG) |
| `scripts/deploy-coolify.sh` | Deployment script (git push or API) |
| `server/config/environment.ts` | `DEPLOYMENT_MODE` configuration |
