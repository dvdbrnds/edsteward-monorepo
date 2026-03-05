# EdSteward Version Guide

## Current Version: v1.2.4

## Quick Commands

### Find version from any commit hash:
```bash
git describe --tags <commit-hash>
```

### Find version from Docker image tag:
```bash
# Image tags contain commit hash, e.g.: deploy-20260115-093937-60bcd955
# Extract the hash (last part after hyphen) and run:
git describe --tags 60bcd955
```

### Check what version is in production:
```bash
# Get the running task definition image
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].taskDefinition' --output text | xargs -I{} aws ecs describe-task-definition --task-definition {} --query 'taskDefinition.containerDefinitions[0].image' --output text
# Extract commit hash from image tag and use git describe
```

### List all versions:
```bash
git tag -l 'v*' --sort=-v:refname | head -20
```

## Version Scheme

| Range | Period | Description |
|-------|--------|-------------|
| v0.1.x | Feb 2025 | Initial development |
| v0.2.x | Feb 2025 | ETL & notifications |
| v0.3.x | Jul 2025 | Single-tenant & fixes |
| v0.4.x | Aug 2025 | MCP Engine integration |
| v0.5.x | Sep 2025 | SAML/SSO authentication |
| v0.6.x | Oct 2025 | Audit trail & MFA |
| v0.7.x | Nov 2025 | Pre-deployment |
| v0.8.x | Dec 2025 | Features & compliance tasks |
| v0.9.x | Dec 2025 | Analytics & dark mode |
| v1.0.x | Jan 2026 | Production features |
| v1.1.x | Jan 5-6, 2026 | Multi-tenant architecture |
| v1.2.x | Jan 7-15, 2026 | Demo prep & fixes |

## Total: 146 version tags

Each patch version (X.Y.Z) corresponds to a specific deployable commit.
