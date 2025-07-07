# Docker Platform Issue Prevention Guide

## 🚨 CRITICAL: Platform Compatibility Issue

**This document exists because the Docker platform issue has occurred 5+ times in the last 72 hours. READ AND FOLLOW THESE GUIDELINES TO PREVENT RECURRING ISSUES.**

## The Problem

Docker images built on Apple Silicon (M1/M2) Macs default to `linux/arm64` architecture, but AWS ECS Fargate requires `linux/amd64`. This causes:
- ECS tasks fail to start with "platform mismatch" errors
- Application becomes inaccessible
- Deployment rollbacks required

## ✅ ALWAYS USE THESE COMMANDS

### For Building Docker Images:
```bash
# ✅ CORRECT - Always specify platform
docker buildx build --platform linux/amd64 --load -t edsteward:TAG .

# ❌ WRONG - Platform not specified (defaults to host architecture)
docker build -t edsteward:TAG .
```

### For Running the Build Script:
```bash
# ✅ PREFERRED - Use the comprehensive build script
python3 build-and-deploy.py

# ✅ ALTERNATIVE - Use the AWS deployment script
./scripts/deploy-aws.sh
```

## 🛠️ Fixed Files

The following files have been updated to use the correct platform specification:

### Dockerfiles:
- ✅ `Dockerfile` - All FROM statements now specify `--platform=linux/amd64`
- ✅ `Dockerfile.fixed` - Already had correct platform specification
- ✅ `Dockerfile.simple` - Already had correct platform specification

### Shell Scripts:
- ✅ `deploy-database-fix.sh`
- ✅ `deploy-ssl-fix.sh`
- ✅ `deploy-with-ssl.sh`
- ✅ `deploy-aggressive-fix.sh`
- ✅ `deploy-with-new-rds.sh`
- ✅ `final-rds-deployment.sh`
- ✅ `final-fix-and-deploy.sh`
- ✅ `scripts/deploy-aws.sh` (was already correct)

### Python Scripts:
- ✅ `build-and-deploy.py` - Comprehensive build and deployment script

## 🔧 Verification Steps

### 1. Verify Image Architecture
After building, always verify the architecture:
```bash
docker inspect edsteward:TAG --format '{{.Architecture}}'
# Should output: amd64
```

### 2. Test Locally Before Deployment
```bash
# Test the image locally
docker run --platform linux/amd64 -p 3000:3000 edsteward:TAG
```

### 3. Check ECS Task Logs
After deployment, check that tasks start successfully:
```bash
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service
```

## 📋 Deployment Checklist

Before any deployment:
- [ ] Dockerfile uses `--platform=linux/amd64` in all FROM statements
- [ ] Build command uses `docker buildx build --platform linux/amd64`
- [ ] Image architecture verified as `amd64`
- [ ] ECS service updated successfully
- [ ] Tasks are running (not stuck in PENDING)

## 🎯 Recommended Workflow

### Option 1: Use the Comprehensive Script (Recommended)
```bash
# This script handles everything correctly
python3 build-and-deploy.py --force-rebuild
```

### Option 2: Manual Build Process
```bash
# 1. Build with correct platform
docker buildx build --platform linux/amd64 --load -t edsteward:v$(date +%Y%m%d-%H%M%S) .

# 2. Verify architecture
docker inspect edsteward:v$(date +%Y%m%d-%H%M%S) --format '{{.Architecture}}'

# 3. Tag for ECR
docker tag edsteward:v$(date +%Y%m%d-%H%M%S) 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v$(date +%Y%m%d-%H%M%S)

# 4. Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v$(date +%Y%m%d-%H%M%S)

# 5. Update ECS service
./scripts/deploy-aws.sh production v$(date +%Y%m%d-%H%M%S)
```

## 🚫 Never Do This

### ❌ DON'T:
```bash
# These commands will cause platform issues
docker build -t edsteward:TAG .
docker run edsteward:TAG
```

### ❌ DON'T:
- Create new shell scripts without platform specification
- Use `docker build` without `--platform linux/amd64`
- Skip architecture verification
- Deploy without testing the image first

## 🔍 Troubleshooting

### If Tasks Are Stuck in PENDING:
1. Check stopped tasks: `aws ecs describe-tasks --cluster edsteward-cluster --tasks TASK_ID`
2. Look for "platform mismatch" errors in the stopped reason
3. Rebuild with correct platform specification

### If Application Won't Start:
1. Check CloudWatch logs: `aws logs tail /ecs/edsteward --follow`
2. Verify image architecture: `docker inspect IMAGE --format '{{.Architecture}}'`
3. Test image locally: `docker run --platform linux/amd64 -p 3000:3000 IMAGE`

## 📝 Development Notes

### For New Team Members:
- Always use `docker buildx build --platform linux/amd64` on Mac
- Never use plain `docker build` for production deployments
- Verify architecture before pushing to ECR

### For CI/CD:
- Add platform specification to all build steps
- Include architecture verification in pipeline
- Test images before deployment

## 🔧 Emergency Fix

If the platform issue occurs again:
1. Run: `python3 build-and-deploy.py --force-rebuild`
2. Wait for deployment to complete
3. Verify application is accessible
4. Update this document if new issues are discovered

## 📞 Contact

If you encounter platform issues not covered in this guide, document them here and notify the team immediately.

---

**Last Updated:** $(date)
**Issue Count:** 5+ occurrences in 72 hours (as of this documentation)
**Status:** FIXED with comprehensive prevention measures 