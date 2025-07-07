# GitHub Actions Setup Guide

## 🚨 Current Issue
GitHub Actions workflow is not running automatically. The repository needs proper configuration.

## ✅ Required Setup Steps

### 1. Enable GitHub Actions
1. Go to https://github.com/dvdbrnds/EdSteward/settings/actions
2. Ensure "Actions permissions" is set to "Allow all actions and reusable workflows"
3. Enable "Allow GitHub Actions to create and approve pull requests" if needed

### 2. Add AWS Secrets
Go to https://github.com/dvdbrnds/EdSteward/settings/secrets/actions

Add these repository secrets:
- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

### 3. Create Environments
Go to https://github.com/dvdbrnds/EdSteward/settings/environments

Create two environments:
- **staging**: For ES-clientside branch deployments
- **production**: For main branch deployments

### 4. Verify Workflow Triggers
The workflow should trigger on:
- Push to `main` → Production deployment
- Push to `ES-clientside` → Staging deployment  
- Push to `staging` → Staging deployment

## 🔍 Troubleshooting

### Check if GitHub Actions is running:
1. Go to https://github.com/dvdbrnds/EdSteward/actions
2. Look for recent workflow runs
3. Check for any error messages

### Common Issues:
- **404 errors**: Repository might be private, check access permissions
- **Missing secrets**: AWS credentials not configured
- **Environment protection**: Environments might require approval

## 🚀 Test the Setup

After configuration, test by:
```bash
# Make a small change and push
echo "# Test deployment" >> test-deployment.md
git add test-deployment.md
git commit -m "Test GitHub Actions deployment"
git push origin ES-clientside
```

Then check: https://github.com/dvdbrnds/EdSteward/actions

## 📋 Current Workflow Status

**Branch**: ES-clientside  
**Expected**: Staging deployment should trigger  
**Target**: edsteward-multi-tenant-staging-cluster  
**Image**: staging-latest tag in ECR

## 🔄 Fallback Option

If GitHub Actions continues to have issues, use the manual deployment:
```bash
./scripts/deploy-manual.sh staging
```

This provides immediate deployment while GitHub Actions is being configured. 