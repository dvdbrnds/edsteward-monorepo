# EdSteward Coolify Deployment — Step-by-Step Guide

This is the complete walkthrough for getting the full EdSteward stack running on Coolify with Sentry, Axiom, Engine, Admin, SAML, and email. Follow the steps in order.

## Prerequisites

- Coolify server running at `10.232.1.50` with the existing project
- The `coolify` branch has all the code changes (compose, instrumentation, Dockerfiles)
- You're on the Moravian internal network (or VPN) to access `10.232.1.50`

---

## Step 1: Push Code Changes to Coolify Branch

All the code changes are on the local `coolify` branch. Push them so Coolify can build.

```zsh
cd ~/Desktop/Products/EdSteward/code
git add -A
git commit -m "feat: full stack compose with Sentry, Axiom OTel, engine, admin console"
git push origin coolify
```

If Coolify has auto-deploy enabled, it will start building immediately. If not, trigger a deploy manually in the Coolify UI.

**IMPORTANT**: The full stack has 11 containers. The first deploy will take 5-10 minutes to build all the Docker images. Watch the Coolify deployment logs — don't panic if it takes a while.

---

## Step 2: Create Axiom Datasets and API Token

The Axiom MCP couldn't create datasets automatically (insufficient permissions). Do this manually:

1. Go to https://app.axiom.co
2. Click **Datasets** in the left sidebar
3. Click **New Dataset** and create these three:

| Dataset Name | Description |
|---|---|
| `edsteward-traces` | OpenTelemetry traces from EdSteward app |
| `edsteward-logs` | OpenTelemetry logs from EdSteward app |
| `edsteward-metrics` | OpenTelemetry metrics from EdSteward app |

4. Create an API token:
   - Go to **Settings** (gear icon) → **API Tokens**
   - Click **New API Token**
   - Name: `edsteward-coolify`
   - Permissions: **Ingest** on all three datasets above
   - Copy the token — you'll need it in Step 3

---

## Step 3: Set Environment Variables in Coolify UI

Open the Coolify UI at `http://10.232.1.50:8000` (or wherever your Coolify dashboard is).

Navigate to your EdSteward project → click the compose resource → **Environment Variables**.

### 3a. App Service Variables

These are the critical variables. Set them ALL before deploying.

**Core secrets (copied from AWS ECS):**

| Variable | Value |
|---|---|
| `SESSION_SECRET` | `QBVfQWgymRfqXPHubc+9Sj3bSlgJr52O0WubpzEzw2yoJJ5G18dGsPoYegk5urs0sZ8U+1i+Z+rMnnzQpt8gjQ==` |
| `MFA_ENCRYPTION_KEY` | `d19eda2bb9690e5fd937b52804803efffcff9ffd2f4acd7512f5a9ea4fb94ad7` |
| `ATTESTATION_JWT_SECRET` | `af0c064bf64136db3008ed3ffda1b825dad9d18139b17ade1c7e82a9c56f250b` |

**Institution:**

| Variable | Value |
|---|---|
| `INSTITUTION_NAME` | `Moravian University` |
| `INSTITUTION_DOMAIN` | `moravian.edu` |
| `BASE_URL` | `https://edsteward.moravian.edu` (or `http://10.232.1.50:9000` if no DNS yet) |

**Sentry:**

| Variable | Value |
|---|---|
| `SENTRY_DSN` | `https://ab022acbb1272dba87ceadebc73392ba@o4511224468275200.ingest.us.sentry.io/4511224474763264` |
| `VITE_SENTRY_DSN` | `https://ab022acbb1272dba87ceadebc73392ba@o4511224468275200.ingest.us.sentry.io/4511224474763264` |

**Axiom:**

| Variable | Value |
|---|---|
| `AXIOM_API_TOKEN` | `xaat-ab2165ad-6357-4424-bec3-8d203e1fe27a` |
| `AXIOM_DATASET` | `edsteward-traces` |

**Engine integration (generate a shared password):**

Run this on your local machine to generate the shared password:
```zsh
openssl rand -hex 32
```

| Variable | Value |
|---|---|
| `MCP_ENGINE_USERNAME` | `mcp-engine` |
| `MCP_ENGINE_PASSWORD` | *(the hex string you just generated)* |

### 3b. Engine Service Variables

**engine-delivery** — set these:

| Variable | Value |
|---|---|
| `EDSTEWARD_URL` | `http://app:3000` |
| `EDSTEWARD_USERNAME` | `mcp-engine` |
| `EDSTEWARD_PASSWORD` | *(same hex string as MCP_ENGINE_PASSWORD above)* |

**engine-llm** — set these (get your API keys from your accounts):

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | *(your Anthropic API key)* |
| `OPENAI_API_KEY` | *(your OpenAI API key)* |
| `CONGRESS_API_KEY` | *(your Congress.gov API key)* |

### 3c. Admin Console Variables

**admin-backend** — generate two secrets:

```zsh
openssl rand -hex 32  # For SESSION_SECRET
openssl rand -hex 32  # For REGISTRY_API_SECRET
```

| Variable | Value |
|---|---|
| `SESSION_SECRET` | *(first hex string)* |
| `REGISTRY_API_SECRET` | *(second hex string)* |

---

## Step 4: Deploy and Wait for Health

After setting all env vars, click **Deploy** (or it auto-deploys if you pushed code).

Watch the deployment logs in Coolify. The services start in dependency order:
1. `postgres`, `redis`, `engine-postgres`, `engine-redis`, `admin-redis` (databases start first)
2. `app`, `engine-registry`, `admin-backend` (depend on databases)
3. `engine-llm`, `engine-delivery`, `admin-frontend` (depend on other services)

**What to check:**
- All containers should show **Running** (green) in the Coolify dashboard
- The `app` health check at `http://10.232.1.50:9000/api/health` should return `{"status":"ok"}`
- The `engine-registry` health check at `http://10.232.1.50:9010/health` should respond

**If a container keeps restarting:**
1. Click the container in Coolify → **Logs** to see what's wrong
2. Most likely cause: missing env var (check Step 3 again)
3. Engine services will crash if engine-postgres is empty (fix in Step 5)

---

## Step 5: Seed the Engine Database

The engine-postgres container starts empty — it needs regulation data. Two options:

### Option A: Via Exposed Port (simpler)

1. In the compose file, temporarily uncomment the engine-postgres port:
   ```yaml
   engine-postgres:
     # ...
     ports:
       - "9433:5432"
   ```

2. Redeploy (just click Deploy in Coolify — this only restarts the port mapping)

3. Run the seed script from your local machine:
   ```zsh
   cd ~/Desktop/Products/EdSteward/code/packages/engine/coolify
   ./seed-engine-db.sh "postgresql://mcp_user:mcp_secure_2026@10.232.1.50:9433/mcp_engine"
   ```

4. Verify it worked — the script prints row counts at the end. You should see:
   - `regulations`: ~244 rows
   - `regulation_tasks`: ~3000+ rows
   - `regulation_deadlines`: ~680 rows

5. **Re-comment the port** and redeploy:
   ```yaml
   engine-postgres:
     # ...
     # ports:
     #   - "9433:5432"
   ```

### Option B: Via Coolify Terminal

1. In Coolify, click your resource → **Terminal**
2. Select the `engine-postgres` container
3. Upload `mcp_engine_seed.dump` to the container (or use `docker cp`)
4. Run:
   ```bash
   pg_restore --clean --if-exists --no-owner -U mcp_user -d mcp_engine /tmp/mcp_engine_seed.dump
   ```

After seeding, restart the engine services (engine-registry, engine-llm, engine-delivery) so they pick up the data.

---

## Step 6: Verify Everything Works

Open these URLs from your browser (must be on Moravian network):

| Service | URL | Expected |
|---|---|---|
| App | `http://10.232.1.50:9000` | Login page |
| App Health | `http://10.232.1.50:9000/api/health` | `{"status":"ok"}` |
| Engine Registry | `http://10.232.1.50:9010/health` | Health response |
| Engine LLM | `http://10.232.1.50:9004/api/llm/health` | Health response |
| Engine Delivery | `http://10.232.1.50:9003/health` | Health response |
| Admin Backend | `http://10.232.1.50:9400/api/health` | Health response |
| Admin Frontend | `http://10.232.1.50:9001` | Admin UI |

**Check Sentry:**
- Go to https://moravian-university.sentry.io → **Projects** → **node**
- You should see a test event within a few minutes of the app starting
- If nothing appears, check that `SENTRY_DSN` is set correctly in Coolify

**Check Axiom:**
- Go to https://app.axiom.co → **Stream** → select `edsteward-traces`
- You should see trace data flowing in after making a few requests to the app
- If nothing appears, verify `AXIOM_API_TOKEN` and `AXIOM_DATASET` in Coolify env vars
- Check app logs for `[AXIOM] Telemetry setup complete` (success) or `[AXIOM] AXIOM_API_TOKEN not set` (missing token)

---

## Step 7: Set Up DNS (Requires Moravian IT)

This step needs Moravian IT to create a DNS record. Send them this request:

> **Subject: DNS Record Request — edsteward.moravian.edu**
>
> Please create an internal DNS A record:
>
> ```
> edsteward.moravian.edu → 10.232.1.50
> ```
>
> This is for the EdSteward compliance platform running on our internal Coolify server.
> Please set the TTL to 300 seconds (5 minutes) initially so we can verify quickly.

**After DNS is set up:**

1. Verify DNS resolves:
   ```zsh
   nslookup edsteward.moravian.edu
   # Should show 10.232.1.50
   ```

2. In Coolify, click the `app` service → **Domains** tab
   - Set FQDN to: `http://edsteward.moravian.edu`
   - (Use `http://` not `https://` initially — see Step 8 for SSL)

3. Update `BASE_URL` env var in Coolify:
   ```
   BASE_URL=http://edsteward.moravian.edu
   ```

4. Redeploy

5. Test: `http://edsteward.moravian.edu` should load the login page

---

## Step 8: Set Up HTTPS/SSL

Since `10.232.1.50` is internal-only, Let's Encrypt won't work (it needs the server reachable from the public internet for the ACME challenge).

**Options (pick one):**

### Option A: No HTTPS (simplest for internal beta)

If the app is only accessed from the Moravian internal network, HTTP is fine for a beta. The app works without HTTPS — it just means:
- Cookies won't have the `secure` flag
- No `upgrade-insecure-requests` CSP header
- SAML callbacks use HTTP

This is acceptable for an internal beta with trusted users.

### Option B: Moravian Internal CA Certificate

Ask Moravian IT if they have an internal Certificate Authority (most universities do). If so:

1. Request a certificate for `edsteward.moravian.edu` from their CA
2. In Coolify: **Settings** → **SSL** → upload the cert and private key
3. Change the FQDN to `https://edsteward.moravian.edu`
4. Update `BASE_URL` to `https://edsteward.moravian.edu`
5. Redeploy

### Option C: Self-Signed Certificate

Generate a self-signed cert (browsers will show a warning but it works):

```zsh
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout edsteward.key -out edsteward.crt \
  -subj "/CN=edsteward.moravian.edu"
```

Upload the cert and key to Coolify's SSL settings, then change FQDN to HTTPS.

### Option D: Public DNS + Let's Encrypt

If Moravian IT can point a public DNS record to the Coolify server (or set up port forwarding for 80/443):
1. Point public DNS `edsteward.moravian.edu` to the server's public IP
2. Set FQDN to `https://edsteward.moravian.edu` in Coolify
3. Coolify auto-provisions a Let's Encrypt certificate

---

## Step 9: Configure Okta SAML

**Only do this step after DNS is working** (Step 7). The SAML callback URL must match the domain exactly.

### 9a. Update Okta Admin Console

1. Log in to https://login.moravian.edu as an Okta admin
2. Go to **Applications** → find **EdSteward** → click it
3. Go to **General** tab → **SAML Settings** section → click **Edit**
4. Click **Next** to get to the SAML configuration page
5. Update these three fields (they should all be the same URL):

| Field | New Value |
|---|---|
| **Single Sign-On URL** | `https://edsteward.moravian.edu/auth/saml/callback/okta` |
| **Recipient URL** | `https://edsteward.moravian.edu/auth/saml/callback/okta` |
| **Destination URL** | `https://edsteward.moravian.edu/auth/saml/callback/okta` |

6. **DO NOT** change the Audience URI — it stays as `urn:edsteward:sp`
7. Click **Next** → **Finish**

If you're using HTTP (no SSL), use `http://` instead of `https://` in the URLs above.

### 9b. Set SAML Environment Variables in Coolify

Set these on the `app` service:

| Variable | Value |
|---|---|
| `AUTH_SAML_ENABLED` | `true` |
| `AUTH_SAML_SSO_URL` | `https://login.moravian.edu/app/moravian_edsteward_1/exk1e0p7l67i9eQBu0x8/sso/saml` |
| `AUTH_SAML_ENTITY_ID` | `https://edsteward.moravian.edu` (or `http://` if no SSL) |
| `SAML_SP_ENTITY_ID` | `urn:edsteward:sp` |
| `SAML_CALLBACK_URL` | `https://edsteward.moravian.edu/auth/saml/callback` (match your protocol) |
| `SAML_SLO_URL` | `https://edsteward.moravian.edu/auth/saml/logout` (match your protocol) |
| `AUTH_SAML_CERT` | *(the full PEM certificate — see COOLIFY-ENV-VARS.md for the value)* |

### 9c. Redeploy and Test SAML

1. Redeploy the app service
2. Go to `https://edsteward.moravian.edu` (or the HTTP URL)
3. Click **Sign in with SSO**
4. You should be redirected to Okta, then back to EdSteward
5. If it fails, check the app logs in Coolify for SAML errors

**Common SAML issues:**
- `InResponseTo` mismatch → `BASE_URL` doesn't match the actual URL
- Certificate error → `AUTH_SAML_CERT` is wrong or has extra whitespace
- 404 on callback → `SAML_CALLBACK_URL` path doesn't match the route

---

## Step 10: Configure Email (Requires Moravian IT)

Email needs an SMTP server. The AWS version didn't have SMTP configured either, so this is new.

### 10a. Get SMTP Credentials from Moravian IT

Send this request:

> **Subject: SMTP Relay Access for EdSteward**
>
> We need SMTP relay access for the EdSteward compliance platform to send notification emails.
>
> - **From address**: `edsteward@moravian.edu`
> - **Server**: our internal server at `10.232.1.50`
> - **Volume**: ~20-50 emails/day (compliance task notifications)
> - **Need**: SMTP host, port, username, and password (or app password)
>
> If you use Office 365, we need an SMTP relay connector or an app password for the `edsteward@moravian.edu` mailbox.

### 10b. Set Email Environment Variables

Once you have the SMTP credentials:

| Variable | Value |
|---|---|
| `EMAIL_HOST` | *(from Moravian IT — e.g., `smtp.office365.com` or `smtp.moravian.edu`)* |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | *(from Moravian IT — e.g., `edsteward@moravian.edu`)* |
| `EMAIL_PASS` | *(from Moravian IT)* |
| `EMAIL_FROM` | `edsteward@moravian.edu` |

### 10c. Test Email Before Enabling the Scheduler

**DO NOT** set `ENABLE_TASK_SCHEDULER=true` yet. First test that email works:

1. Set the email env vars and redeploy
2. In the app, go to a compliance task
3. Try sending a manual test notification (or check the admin API)
4. Verify the email arrives

### 10d. Enable the Task Scheduler

Only after email is confirmed working:

1. Set `ENABLE_TASK_SCHEDULER=true` in the Coolify env vars
2. Redeploy
3. The scheduler runs every 6 hours (checks at ~8 AM and ~2 PM) and sends overdue task notifications
4. Monitor the first cycle to make sure it's working correctly

---

## Step 11: Set Up Backups

### App PostgreSQL Backups

1. In Coolify, click the `postgres` service
2. Go to the **Backups** tab
3. Click **Add**
4. Set schedule: `0 */4 * * *` (every 4 hours)
5. Optionally enable S3-compatible storage for off-site backups
6. Test by clicking **Backup Now**

### Engine PostgreSQL Backups

1. In Coolify, click the `engine-postgres` service
2. Go to the **Backups** tab
3. Click **Add**
4. Set schedule: `0 3 * * *` (daily at 3 AM — engine data changes less frequently)

---

## Step 12: Verify Observability Is Working

### Sentry

1. Go to https://moravian-university.sentry.io
2. Click **Projects** → **node**
3. You should see events (errors, transactions) flowing in
4. To verify error tracking: intentionally trigger an error (e.g., visit a bad URL that causes a 500)
5. Check that the error appears in Sentry within 1-2 minutes

### Axiom

1. Go to https://app.axiom.co
2. Click **Stream** tab → select `edsteward-traces`
3. You should see trace data (HTTP requests, database queries)
4. Click **Dashboards** → **OpenTelemetry Traces** for a visual overview
5. Check `edsteward-logs` for application logs
6. Check `edsteward-metrics` for metrics (request counts, latencies)

**If no data in Axiom:**
- Check app logs for `[AXIOM] Telemetry setup complete` — if missing, the token isn't set
- Check for `[AXIOM] AXIOM_API_TOKEN not set` — means the env var is missing in Coolify
- Check for `[AXIOM] No TracerProvider with addSpanProcessor found` — means Sentry isn't configured (traces won't flow without Sentry managing the TracerProvider)
- Verify the Axiom API token has **Ingest** permission on the datasets

---

## Troubleshooting

### Container keeps restarting

1. Click the container in Coolify → **Logs**
2. Look for the error message
3. Common causes:
   - Missing required env var (e.g., `SESSION_SECRET`, `ATTESTATION_JWT_SECRET`)
   - Database not ready (check postgres health check)
   - Port conflict (another service using the same port)

### Engine services crash on startup

The engine services need data in engine-postgres to start properly. If engine-postgres is empty, the registry API may fail. Complete Step 5 (seeding) first.

### Admin frontend returns 404

The admin-frontend uses `serve` to host static files. If the build failed, there are no files to serve. Check the build logs in Coolify for TypeScript or Vite errors.

### SAML redirect fails

1. Check that `BASE_URL` matches exactly what's in the browser URL bar
2. Check that the Okta callback URLs match (Step 9a)
3. Check `AUTH_SAML_CERT` doesn't have extra whitespace or missing lines
4. Check the app logs for the specific SAML error message

### Emails not sending

1. Verify `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` are all set
2. Check app logs for SMTP errors
3. Try a telnet test: `telnet <EMAIL_HOST> <EMAIL_PORT>` from the Coolify server
4. If Office 365: make sure the account has SMTP AUTH enabled and isn't blocked by security defaults

---

## Quick Reference: Service Ports

| Service | Internal Port | External Port | URL |
|---|---|---|---|
| App | 3000 | 9000 | `http://10.232.1.50:9000` |
| App PostgreSQL | 5432 | *(internal only)* | — |
| App Redis | 6379 | *(internal only)* | — |
| Engine Registry | 3010 | 9010 | `http://10.232.1.50:9010` |
| Engine LLM | 3004 | 9004 | `http://10.232.1.50:9004` |
| Engine Delivery | 3003 | 9003 | `http://10.232.1.50:9003` |
| Engine PostgreSQL | 5432 | *(internal only)* | — |
| Engine Redis | 6379 | *(internal only)* | — |
| Admin Backend | 4000 | 9400 | `http://10.232.1.50:9400` |
| Admin Frontend | 3001 | 9001 | `http://10.232.1.50:9001` |
| Admin Redis | 6379 | *(internal only)* | — |

---

## What's Left After This Guide

Once you complete all 12 steps:
- Full stack is running with 11 containers
- Sentry catches errors + traces
- Axiom receives OTel traces, logs, and metrics
- Engine can process regulations and push to the app
- Admin console is accessible for management
- SAML/Okta SSO works for Moravian users
- Email notifications work for compliance tasks
- Backups run on schedule
- AWS is fully decommissioned (ALBs, health checks, alarms all deleted; ECS at 0)
