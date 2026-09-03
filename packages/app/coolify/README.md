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

## Persistent Storage

Coolify Docker Compose volumes **persist across redeployments** by default. The compose defines four named volumes:

| Volume | Mount Point | Contents |
|--------|-------------|----------|
| `postgres_data` | `/var/lib/postgresql/data` | All database data (regulations, users, tasks, etc.) |
| `redis_data` | `/data` | Redis AOF persistence (sessions, cache) |
| `app_uploads` | `/app/uploads` | File uploads (if any bypass DB storage) |
| `app_logs` | `/app/logs` | Application logs |

**These survive container restarts, service restarts, and code redeployments.** The only thing that destroys them is explicitly deleting the volumes in Coolify or purging the resource.

You can also verify volumes in the Coolify UI: click the resource → **Persistent Storage** in the left sidebar. Coolify will show the Docker volumes attached to each service.

### PostgreSQL Replaces Neon

The Coolify PostgreSQL container fully replaces Neon:
- Connection is internal via Docker networking (`postgres:5432`), no SSL needed
- Data lives on the Coolify server's disk in a Docker volume
- Back up via Coolify's built-in backup scheduler (see Backups section below)
- No Neon console, no branching — use `pg_dump`/`pg_restore` for manual snapshots

## Setting Up HTTPS (SSL)

Coolify uses **Traefik + Let's Encrypt** for automatic SSL. To enable HTTPS:

1. **Point DNS to your Coolify server** — create an A record for your domain:
   ```
   moravian.edsteward.ai → 10.232.1.50   (or your Coolify server's public IP)
   ```
   Lower TTL to 60 seconds before cutover, raise back to 3600 after verifying.

2. **Set the domain in Coolify** — click on the `app` service → **Domains**:
   - Change from `http://10.232.1.50` to `https://moravian.edsteward.ai`
   - Coolify auto-provisions a Let's Encrypt certificate

3. **Update `BASE_URL` env var** — in Coolify Environment Variables:
   ```
   BASE_URL=https://moravian.edsteward.ai
   ```
   This controls SAML callback URLs, CSP, secure cookies, and CORS.

4. **Redeploy** — the app detects `https://` in `BASE_URL` and automatically enables:
   - Secure cookies (`secure: true`, `sameSite: none`)
   - `upgrade-insecure-requests` CSP directive
   - HTTPS-aware SAML callback URLs

## Okta SAML Reconfiguration

When the domain or protocol changes, Okta's SAML integration must be updated to match.

### What Changes in Okta

| Okta Setting | Old Value (AWS) | New Value (Coolify) |
|---|---|---|
| Single Sign-On URL (ACS) | `https://moravian.edsteward.ai/auth/saml/callback/okta` | Same if keeping domain, or update to new domain |
| Audience URI (SP Entity ID) | `urn:edsteward:sp` | Same (no change needed) |
| Default Relay State | _(empty or `/dashboard`)_ | Same |
| Name ID format | `EmailAddress` | Same |

**If keeping the same domain** (`moravian.edsteward.ai`), you only need to re-point DNS. No Okta changes required — the ACS URL stays the same.

**If using a new domain**, update in Okta Admin Console:
1. Go to **Applications** → **EdSteward** → **General** → **SAML Settings** → **Edit**
2. Update **Single Sign-On URL** to: `https://NEW-DOMAIN/auth/saml/callback/okta`
3. Update **Recipient URL** and **Destination URL** if shown (same as SSO URL)
4. Click **Save**

### Environment Variables for SAML

Set these in Coolify's Environment Variables for the `app` service:

```
AUTH_SAML_ENABLED=true
BASE_URL=https://moravian.edsteward.ai
SAML_SP_ENTITY_ID=urn:edsteward:sp
OKTA_SSO_URL=https://your-okta-domain.okta.com/app/your-app-id/sso/saml
OKTA_SLO_URL=https://your-okta-domain.okta.com/app/your-app-id/slo/saml
OKTA_CERT=<base64 x509 certificate from Okta>
```

### Verifying SAML After Migration

1. Access `https://your-domain/auth/saml/metadata/okta` — should return valid SP metadata XML
2. Try logging in via SSO — should redirect to Okta and back
3. Check Coolify runtime logs for any SAML errors

### Preserving MFA Enrollments

If you copy the **same `MFA_ENCRYPTION_KEY`** from the AWS ECS task definition, existing MFA enrollments carry over. If you generate a new key, all users must re-enroll in MFA.

To get the current key from AWS:
```zsh
aws ecs describe-task-definition --task-definition edsteward-saml-production \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`MFA_ENCRYPTION_KEY`].value' \
  --output text
```

## Migrating from AWS ECS (Neon)

Use the migration script to move data from Neon to Coolify's PostgreSQL.

### Accessing Coolify's PostgreSQL

The PostgreSQL container is internal to Docker by default. Two options to access it for migration:

**Option A: Use Coolify's Terminal** (recommended)
1. In Coolify, click on your resource → **Terminal** in the left sidebar
2. Select the `postgres` container
3. Run: `pg_dump` / `psql` commands directly inside the container

**Option B: Temporarily expose the port**
1. Uncomment the `ports` section on the `postgres` service in `docker-compose.yaml`:
   ```yaml
   ports:
     - "5432:5432"
   ```
2. Redeploy, run migration, then **re-comment the ports and redeploy** (don't leave PG exposed)

### Running the Migration

```zsh
# 1. Deploy the Coolify compose stack first (empty database)

# 2. Export from Neon production (run from your local machine)
./scripts/migrate-to-coolify.sh export "postgresql://...@ep-weathered-term.../neondb"

# 3. Import into Coolify PostgreSQL
#    If using exposed port (Option B):
./scripts/migrate-to-coolify.sh import "postgresql://edsteward:edsteward_secure_2026@10.232.1.50:5432/edsteward" migration-dumps/edsteward-*.dump

# 4. Verify
./scripts/migrate-to-coolify.sh verify "postgresql://edsteward:edsteward_secure_2026@10.232.1.50:5432/edsteward"

# Or do it all at once:
./scripts/migrate-to-coolify.sh full "postgresql://...@neon-url" "postgresql://edsteward:edsteward_secure_2026@10.232.1.50:5432/edsteward"
```

**Important:** After migration, re-comment the `ports` line on the postgres service and redeploy to close external access.

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
