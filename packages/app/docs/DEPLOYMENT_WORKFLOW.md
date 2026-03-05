# EdSteward Deployment Workflow

This document describes the safe deployment workflow for EdSteward, designed to
prevent accidental production incidents.

## Overview

The deployment system uses a **staging-first approach** with multiple safety
gates:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │────▶│   Deploy    │────▶│    Test     │────▶│   Deploy    │
│   Version   │     │  to Staging │     │  on Staging │     │ to Prod     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
tag-release.sh     deploy-staging.sh    Manual Testing   deploy-production.sh
```

## Quick Reference

| Task                 | Command                                 |
| -------------------- | --------------------------------------- |
| Create new version   | `./scripts/tag-release.sh minor`        |
| Deploy to staging    | `./scripts/deploy-staging.sh v1.2.3`    |
| Deploy to production | `./scripts/deploy-production.sh v1.2.3` |
| Rollback production  | `./scripts/rollback-production.sh`      |
| List recent deploys  | See `deployments/production/*.json`     |

## First-Time Setup

Before using the deployment scripts for the first time:

### 1. Set Up Secrets Manager

Migrate hardcoded credentials to AWS Secrets Manager:

```bash
./scripts/setup-secrets.sh --dry-run  # Preview what will be created
./scripts/setup-secrets.sh            # Create secrets
```

This creates:

- `edsteward/staging/database-url`
- `edsteward/staging/session-secret`
- `edsteward/production/database-url`
- `edsteward/production/session-secret`
- `edsteward/production/saml-config`

### 2. Set Up Staging Infrastructure

Create the staging environment (one-time):

```bash
./scripts/setup-staging-infra.sh --dry-run  # Preview resources
./scripts/setup-staging-infra.sh            # Create staging infra
```

This creates:

- ECS Cluster: `edsteward-staging-cluster`
- ECS Service: `edsteward-staging-service`
- Application Load Balancer for staging
- CloudWatch log groups

### 3. Configure DNS

Point `staging.edsteward.ai` to the staging ALB DNS name.

## Deployment Workflow

### Step 1: Create a Version Tag

Use semantic versioning to tag releases:

```bash
# For bug fixes (v1.2.3 → v1.2.4)
./scripts/tag-release.sh patch

# For new features (v1.2.3 → v1.3.0)
./scripts/tag-release.sh minor

# For breaking changes (v1.2.3 → v2.0.0)
./scripts/tag-release.sh major

# Or specify exact version
./scripts/tag-release.sh v1.5.0
```

The script will:

1. Create a git tag
2. Optionally push to remote
3. Optionally build and push Docker image

### Step 2: Deploy to Staging

Deploy the version to staging for testing:

```bash
./scripts/deploy-staging.sh v1.2.3
```

This will:

1. Build the Docker image
2. Push to ECR with version tag
3. Update ECS task definition
4. Deploy to staging cluster
5. Wait for healthy deployment
6. Record deployment in `deployments/staging/`

### Step 3: Test on Staging

Manually verify your changes work at: https://staging.edsteward.ai

**Important:** Take time to test thoroughly. Production deployment requires
staging success.

### Step 4: Deploy to Production

Once staging is verified, deploy to production:

```bash
./scripts/deploy-production.sh v1.2.3
```

**Safety Gates** (all must pass):

1. ✅ Version must have been deployed to staging
2. ✅ Docker image must exist in ECR
3. ✅ Staging health check must pass
4. ✅ No deployment already in progress
5. ✅ Interactive confirmation required

The script will show:

- Current production version
- Version being deployed
- Recent commits/changes
- Require typing `deploy production` to confirm

### Step 5: Monitor Production

After deployment:

```bash
# Watch logs
aws logs tail /ecs/edsteward-saml-production --follow

# Check health
curl https://moravian.edsteward.ai/api/health
```

## Rollback

If something goes wrong, rollback quickly:

```bash
# Interactive - select from recent versions
./scripts/rollback-production.sh

# Direct rollback to specific version
./scripts/rollback-production.sh v1.2.2
```

The rollback will:

1. Verify the target image exists
2. Require confirmation
3. Update ECS to the previous task definition
4. Wait for healthy deployment
5. Record the rollback

## Directory Structure

```
scripts/
├── lib/
│   ├── deploy-common.sh      # Shared functions
│   └── safety-checks.sh      # Safety gate functions
├── setup-secrets.sh          # One-time secrets setup
├── setup-staging-infra.sh    # One-time staging setup
├── tag-release.sh            # Version tagging
├── deploy-staging.sh         # Staging deployment
├── deploy-production.sh      # Production deployment (gated)
└── rollback-production.sh    # Production rollback

deployments/
├── staging/
│   ├── infrastructure.json   # Staging infra details
│   └── 2024-01-29-v1.2.3.json # Deployment records
└── production/
    └── 2024-01-29-v1.2.3.json # Deployment records
```

## Deployment Records

Each deployment is recorded in JSON format:

```json
{
  "version": "v1.2.3",
  "timestamp": "2024-01-29T14:30:00Z",
  "deployer": "dvdbrnds",
  "commitSha": "abc1234",
  "gitBranch": "main",
  "taskDefinitionArn": "arn:aws:ecs:...",
  "previousVersion": "v1.2.2",
  "status": "success",
  "environment": "production"
}
```

These records are used for:

- Audit trail
- Rollback targeting
- Production gate (requiring staging deploy first)

## Environment Configuration

### Staging Environment

| Resource    | Name                         |
| ----------- | ---------------------------- |
| ECS Cluster | `edsteward-staging-cluster`  |
| ECS Service | `edsteward-staging-service`  |
| Task Family | `edsteward-staging-task`     |
| Log Group   | `/ecs/edsteward-staging`     |
| URL         | https://staging.edsteward.ai |

### Production Environment

| Resource    | Name                             |
| ----------- | -------------------------------- |
| ECS Cluster | `edsteward-cluster`              |
| ECS Service | `edsteward-service`              |
| Task Family | `edsteward-saml-production`      |
| Log Group   | `/ecs/edsteward-saml-production` |
| URL         | https://moravian.edsteward.ai    |

## Secrets Management

Secrets are stored in AWS Secrets Manager and injected at runtime:

| Secret Path                           | Environment | Description              |
| ------------------------------------- | ----------- | ------------------------ |
| `edsteward/staging/database-url`      | Staging     | Neon database connection |
| `edsteward/staging/session-secret`    | Staging     | Session encryption key   |
| `edsteward/production/database-url`   | Production  | Neon database connection |
| `edsteward/production/session-secret` | Production  | Session encryption key   |
| `edsteward/production/saml-config`    | Production  | SAML/SSO configuration   |

**Never** hardcode credentials in scripts or task definitions.

## Troubleshooting

### Deployment stuck or slow

```bash
# Check ECS service events
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --query 'services[0].events[0:5]'

# Check running tasks
aws ecs list-tasks \
  --cluster edsteward-cluster \
  --service-name edsteward-service
```

### Health check failing

```bash
# Check application logs
aws logs tail /ecs/edsteward-saml-production --since 10m

# Test health endpoint directly
curl -v https://moravian.edsteward.ai/api/health
```

### Can't deploy to production

Make sure:

1. Version was deployed to staging first
2. Image exists in ECR:
   `aws ecr describe-images --repository-name edsteward-multi-tenant --image-ids imageTag=v1.2.3`
3. Staging is healthy: `curl https://staging.edsteward.ai/api/health`

### Rollback not working

1. Check the target version exists in ECR
2. Look for the deployment record in `deployments/production/`
3. Manually rollback via AWS Console if needed

## Best Practices

1. **Always deploy to staging first** - No exceptions
2. **Test thoroughly on staging** - Take your time
3. **Deploy during low-traffic periods** - Avoid peak hours
4. **Monitor after deployment** - Watch logs for 10-15 minutes
5. **Document significant changes** - Update CHANGELOG.md
6. **Don't skip safety gates** - They exist for a reason
7. **Keep deployments small** - Easier to rollback and debug

## Migration from Old Scripts

The old deployment scripts have been preserved:

- `deploy-production.sh.old` - Original direct-to-production script

These should NOT be used. Use the new workflow instead.

## Contact

If you encounter issues with the deployment system:

1. Check this documentation
2. Review the script source code
3. Check AWS Console for infrastructure issues
