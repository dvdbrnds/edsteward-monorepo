# RegulatoryTrackr Staged Deployment Pipeline

This deployment pipeline ensures **no direct AWS deployment** without proper local verification and human approval. Every deployment goes through rigorous local testing and manual verification before reaching production.

## 🛡️ Safety-First Approach

**Key Principle**: Never deploy to AWS without local verification and explicit approval.

### Pipeline Stages

1. **Stage 1**: Local Docker Build & Automated Tests
2. **Stage 2**: Local Staging Environment & Manual Verification
3. **🚨 HUMAN APPROVAL GATE** 🚨
4. **Stage 3**: AWS Production Deployment

## 🚀 Quick Start

### Complete Pipeline (Recommended)
```bash
make pipeline
```
This runs the entire pipeline with approval gates.

### Individual Stages
```bash
# Stage 1: Build and test locally
make stage1-build

# Stage 2: Start local staging environment
make stage2-local-staging

# Manual verification and approval
make stage2-approve

# Stage 3: Deploy to production (only after approval)
make stage3-production-deploy
```

## 📋 What Happens in Each Stage

### Stage 1: Local Docker Build & Test
- ✅ Validates Dockerfile and package.json exist
- ✅ Builds Docker image with production settings
- ✅ Runs container health checks
- ✅ Tests application startup
- ✅ Verifies TypeScript compilation

**Pipeline continues automatically if all tests pass.**

### Stage 2: Local Staging Environment
- ✅ Starts complete local environment (app + database + Redis)
- ✅ Runs comprehensive integration tests
- ✅ Tests API endpoints, authentication, performance
- ✅ Sets up environment at `http://localhost:3000`

**🛑 Pipeline PAUSES here for human verification**

### Human Verification Checklist

When the staging environment is ready, you should manually verify:

- [ ] **UI/UX**: Open http://localhost:3000 and test the interface
- [ ] **Authentication**: Test login/logout functionality  
- [ ] **Core Features**: Verify all application features work correctly
- [ ] **Performance**: Check response times and loading speeds
- [ ] **Browser Console**: Ensure no JavaScript errors
- [ ] **Database Operations**: Test data creation, updates, queries
- [ ] **API Endpoints**: Verify API responses are correct

### Stage 3: Production Deployment (Post-Approval)
- ✅ Validates AWS credentials and permissions
- ✅ Tags and pushes Docker image to ECR
- ✅ Updates ECS service with new task definition
- ✅ Monitors deployment progress
- ✅ Runs production smoke tests
- ✅ Provides rollback capability if issues detected

## 🔧 Management Commands

### Staging Environment Control
```bash
# Open staging app in browser
make open-staging

# View application logs
make logs-staging

# View all service logs (app, database, Redis)
make logs-staging-all

# Check environment status
make staging-status

# Restart staging environment
make restart-staging

# Stop staging environment
make stop-staging
```

### Quick Approval (if already verified)
```bash
# If you've already tested staging and want to approve quickly
make approve-staging
```

### Emergency Controls
```bash
# Emergency stop all containers
make emergency-stop

# Clean up all resources
make clean
```

## 🚨 Human Approval Process

### When Pipeline Pauses
The pipeline will pause after Stage 2 with a message like:
```
⚠️  HUMAN APPROVAL REQUIRED
===============================

📋 The staging environment is ready for your review:
  🌐 Application URL: http://localhost:3000
  📊 All automated tests have passed

Please thoroughly test the application and confirm:
  ✓ UI/UX works correctly
  ✓ All features function as expected
  ✓ Performance is acceptable
  ✓ No errors in browser console
  ✓ Database operations work
  ✓ Authentication flows work

📋 To view logs while testing: make logs-staging
```

### Approval Decision
You'll be prompted:
```
👤 HUMAN APPROVAL CHECKPOINT
=============================

You have manually tested the staging environment.
Do you approve proceeding to production deployment? (y/N)

⚠️  This will deploy to AWS production environment!
```

- **Type 'y'**: Proceeds to AWS production deployment
- **Type 'n' or Enter**: Halts pipeline, keeps staging environment running for more testing

## 🔍 Troubleshooting

### Staging Environment Issues
```bash
# Check what's running
make staging-status

# View detailed logs
make logs-staging-all

# Restart if needed
make restart-staging
```

### Build Issues
```bash
# Clean up and retry
make clean
make stage1-build
```

### AWS Deployment Issues
The pipeline includes automatic rollback capabilities:
- Failed deployments will offer automatic rollback
- Health checks run after deployment
- Comprehensive error reporting and logging

### Manual Rollback
If production deployment fails, use:
```bash
./scripts/rollback-deployment.sh
```

## 📊 Environment Configuration

### Local Staging Environment
- **Application**: http://localhost:3000
- **Database**: PostgreSQL on localhost:5432
- **Redis**: localhost:6379
- **Environment**: `NODE_ENV=staging`

### Production Environment
- **AWS Region**: us-east-1
- **ECS Cluster**: edsteward-cluster
- **ECS Service**: edsteward-service
- **ECR Repository**: edsteward-repo

## 🛠️ Prerequisites

### Required Tools
- Docker & Docker Compose
- Node.js & npm
- AWS CLI (configured)
- curl
- jq (for JSON processing)

### Check Prerequisites
```bash
make check-tools
```

### AWS Configuration
Ensure AWS credentials are configured:
```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

## 🔐 Security Features

1. **No Direct AWS Deployment**: Must pass local verification first
2. **Human Approval Gates**: Explicit approval required before production
3. **Comprehensive Testing**: Automated + manual verification
4. **Rollback Capabilities**: Automatic rollback on deployment failures
5. **Health Monitoring**: Continuous health checks during deployment
6. **Error Isolation**: Failed stages don't affect production

## 📝 Pipeline Flow Diagram

```
┌─────────────────┐
│   Stage 1       │
│ Local Build     │ ✅ Automated
│ & Unit Tests    │
└─────────┬───────┘
          │
┌─────────▼───────┐
│   Stage 2       │
│ Local Staging   │ ✅ Automated
│ & Integration   │
│ Tests           │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ 🚨 HUMAN        │
│ APPROVAL        │ 👤 Manual
│ GATE 🚨         │
└─────────┬───────┘
          │
          │ ✅ Approved
          │
┌─────────▼───────┐
│   Stage 3       │
│ AWS Production  │ ✅ Automated
│ Deployment      │
└─────────────────┘
```

## 🏃 Example Workflow

1. **Start Pipeline**:
   ```bash
   make pipeline
   ```

2. **Wait for Staging Ready**:
   ```
   ✅ Stage 2 local staging environment ready
   🌐 Your application is now running at: http://localhost:3000
   ```

3. **Manual Testing**:
   - Open http://localhost:3000
   - Test all functionality
   - Check browser console for errors
   - Verify performance

4. **Approve or Reject**:
   ```
   Do you approve proceeding to production deployment? (y/N)
   ```

5. **Production Deployment** (if approved):
   - Automatic deployment to AWS
   - Health monitoring
   - Smoke tests
   - Success confirmation

## 🆘 Support

If you encounter issues:

1. Check staging logs: `make logs-staging`
2. Verify environment status: `make staging-status`  
3. Review AWS credentials: `./scripts/validate-aws-credentials.sh`
4. Emergency stop: `make emergency-stop`

The pipeline is designed to fail safely - if anything goes wrong, your production environment remains unaffected. 