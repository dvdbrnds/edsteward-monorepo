# EdSteward AWS Deployment Guide

This document describes the correct process for deploying EdSteward to AWS.

## Prerequisites

- **Colima** running (Docker runtime): `colima status` or `colima start`
- **AWS CLI** configured with correct credentials: `aws sts get-caller-identity`
- **Git** on the `main` branch with all changes committed and pushed
- Local **zsh** shell (macOS)

## Architecture Overview

| Component | Service | Details |
|-----------|---------|---------|
| Container Orchestration | ECS Fargate | Single-task service |
| Container Registry | ECR | `259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant` |
| Load Balancer | ALB | HTTPS termination, routes to ECS |
| Database | Neon Serverless PostgreSQL | Shared DB (single-tenant mode) |
| Staging Cluster | `edsteward-staging-cluster` | Service: `edsteward-staging-service` |
| Production Cluster | `edsteward-cluster` | Service: `edsteward-service` |
| Staging URL | https://staging.edsteward.ai | |
| Production URL | https://moravian.edsteward.ai | |

## Deployment Flow

All deployments follow a **staging-first, gated production** process:

```
Code Change → Commit & Push → Tag Version → Deploy Staging → Verify → Deploy Production
```

Production deployments are gated — the script verifies the version was deployed to
staging first and that staging is healthy before allowing production deployment.

---

## Step 1: Tag a Release

```zsh
# Auto-increment (recommended)
./scripts/tag-release.sh patch    # v1.4.3 → v1.4.4
./scripts/tag-release.sh minor    # v1.4.3 → v1.5.0
./scripts/tag-release.sh major    # v1.4.3 → v2.0.0

# Or set a specific version
./scripts/tag-release.sh v1.5.0
```

This creates a git tag and pushes it to the remote.

## Step 2: Deploy to Staging

```zsh
./scripts/deploy-staging.sh v1.5.0

# Non-interactive (skips all confirmation prompts)
./scripts/deploy-staging.sh v1.5.0 --yes
```

**What this does:**
1. Builds the frontend (`vite build`)
2. Builds the Docker image via Colima
3. Logs into ECR and pushes the image (tagged as `v1.5.0` and `staging-latest`)
4. Retrieves the active ECS task definition and updates the image tag
5. Registers a new task definition revision
6. Updates the ECS staging service to use the new task definition
7. Waits for healthy deployment
8. Runs health check against `https://staging.edsteward.ai/api/health`
9. Records the deployment in `deployments/staging/`

## Step 3: Verify on Staging

Before deploying to production:
- Open https://staging.edsteward.ai and test your changes
- Check logs: `aws logs tail /ecs/edsteward-staging --follow`

## Step 4: Deploy to Production

```zsh
./scripts/deploy-production.sh v1.5.0

# Non-interactive
./scripts/deploy-production.sh v1.5.0 --yes
```

**Safety gates (all must pass):**
1. Version must exist in staging deployment records
2. Docker image must exist in ECR
3. Staging health check must pass
4. Cooldown check (warns if deploying too frequently)
5. Interactive confirmation (unless `--yes` is passed)

**What this does:**
1. Runs all safety gates
2. Creates a new ECS task definition with the new image
3. Updates the production ECS service
4. Tags the image as `production-latest` in ECR
5. Waits for healthy deployment
6. Runs health check against `https://moravian.edsteward.ai/api/health`
7. Records the deployment in `deployments/production/`

## Rollback

If something goes wrong in production:

```zsh
# Interactive — shows recent deployments to choose from
./scripts/rollback-production.sh

# Rollback to a specific version
./scripts/rollback-production.sh v1.4.2
```

This re-deploys the specified older version's Docker image to the production ECS service.

---

## Monitoring

### CloudWatch Logs

```zsh
# Tail production logs (live)
aws logs tail /ecs/edsteward-saml-production --follow

# Search for errors in the last hour
aws logs tail /ecs/edsteward-saml-production --since 1h --filter-pattern "Error"

# Tail staging logs
aws logs tail /ecs/edsteward-staging --follow
```

### ECS Service Status

```zsh
# Production
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition}'

# Staging
aws ecs describe-services \
  --cluster edsteward-staging-cluster \
  --services edsteward-staging-service \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition}'
```

### Health Checks

```zsh
curl https://moravian.edsteward.ai/api/health
curl https://staging.edsteward.ai/api/health
```

---

## Important Notes

### Sessions Are In-Memory
After every deployment, all user sessions are invalidated because the session store
is in-memory. Users will need to log in again after a deployment. This is expected
behavior.

### Docker Runtime
This project uses **Colima**, not Docker Desktop. If the deploy script says
"Docker is not running", start Colima:

```zsh
colima start
```

### Database Migrations
Database schema changes are **not** automatically applied during deployment. If your
code changes include new columns or tables, you must apply migrations manually
against the production Neon database before deploying the new code.

### Environment Variables
Production environment variables are managed in the ECS task definition. The deploy
script preserves existing environment variables (including secrets) by fetching the
active task definition and only updating the image tag. **Never hard-code secrets
in the deploy scripts.**

### Deployment Records
Every deployment is recorded as a JSON file in the `deployments/` directory:
- `deployments/staging/YYYY-MM-DD-vX.Y.Z.json`
- `deployments/production/YYYY-MM-DD-vX.Y.Z.json`

These records are used by the production safety gate to verify staging deployment.

---

## Quick Reference

| Task | Command |
|------|---------|
| Tag a patch release | `./scripts/tag-release.sh patch` |
| Deploy to staging | `./scripts/deploy-staging.sh v1.5.0` |
| Deploy to production | `./scripts/deploy-production.sh v1.5.0` |
| Deploy (non-interactive) | `./scripts/deploy-staging.sh v1.5.0 --yes` |
| Rollback production | `./scripts/rollback-production.sh` |
| Tail production logs | `aws logs tail /ecs/edsteward-saml-production --follow` |
| Check production health | `curl https://moravian.edsteward.ai/api/health` |
| Start Docker runtime | `colima start` |

## Typical Full Deployment Example

```zsh
# 1. Make sure everything is committed and pushed
git add -A && git commit -m "fix: description of changes" && git push

# 2. Tag the release
./scripts/tag-release.sh patch

# 3. Deploy to staging (non-interactive)
./scripts/deploy-staging.sh v1.4.4 --yes

# 4. Verify staging works
curl https://staging.edsteward.ai/api/health

# 5. Deploy to production (non-interactive)
./scripts/deploy-production.sh v1.4.4 --yes

# 6. Verify production
curl https://moravian.edsteward.ai/api/health

# 7. Monitor logs for any issues
aws logs tail /ecs/edsteward-saml-production --since 5m
```
