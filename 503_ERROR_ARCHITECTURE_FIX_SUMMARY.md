# 503 Error Resolution: Architecture Mismatch Fix

## Issue Summary
**Date:** July 11, 2025  
**Status:** IN PROGRESS - Docker rebuild running in background  
**Root Cause:** Docker architecture mismatch (ARM64 vs x86_64)

## Problem Discovery

### Initial Troubleshooting
1. **Target Group Mismatch Fixed**: Previously corrected ALB listener rule to point to correct target group (`edsteward-tg-alb/664e01592a97845a`)
2. **ECS Service Health**: Service configuration correct but tasks continuously failing health checks
3. **Task Pattern**: Tasks start → register with target group → fail health check → deregister → drain connections → repeat

### Root Cause Analysis
**Container Logs Analysis:**
```
Error: Error loading shared library /app/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node: Exec format error
```

**Issue:** Docker image was built on Apple Silicon (ARM64) but being deployed to x86_64 ECS instances.

**Impact:** 
- Container immediately crashes on startup
- Health checks fail before application can start
- No healthy targets available for ALB
- Results in 503 Service Unavailable

## Technical Details

### Current Infrastructure
- **ALB**: `edsteward-alb` with DNS `edsteward-alb-554701445.us-east-1.elb.amazonaws.com`
- **Target Group**: `edsteward-tg-alb/664e01592a97845a`
- **ECS Cluster**: `edsteward-cluster`
- **ECS Service**: `edsteward-service`
- **Task Definition**: `edsteward-fixed:1`
- **Problem Image**: `259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:fixed-1752264632`

### Issue Details
- **Architecture**: Container built for ARM64, deployed to x86_64
- **Failing Component**: bcrypt native library
- **Error Code**: `ERR_DLOPEN_FAILED`
- **Container Status**: Crashes immediately on startup

## Solution Applied

### Fix Strategy
**Script:** `scripts/fix-architecture-mismatch.sh`

**Steps:**
1. **Architecture-Specific Build**: Use `docker buildx build --platform linux/amd64`
2. **New Image Tag**: `fixed-architecture-{timestamp}`
3. **ECR Push**: Push corrected image to repository
4. **Task Definition Update**: Create new task definition with corrected image
5. **Service Deployment**: Update ECS service and force new deployment

### Fix Command
```bash
docker buildx build \
    --platform linux/amd64 \
    --no-cache \
    --tag 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:fixed-architecture-{timestamp} \
    .
```

## Status Tracking

### ✅ Completed
- [x] AWS CLI pager issue resolved (`export AWS_PAGER=""`)
- [x] Target group routing fixed (ALB → correct target group)
- [x] Root cause identified (architecture mismatch)
- [x] Solution script created and executed

### 🔄 In Progress
- [ ] Docker image rebuild with x86_64 architecture
- [ ] ECR push of corrected image
- [ ] New task definition creation
- [ ] ECS service update and deployment

### 📋 Next Steps
1. **Monitor Build Progress**: Check Docker build completion
2. **Verify Deployment**: Confirm ECS tasks achieve healthy state
3. **Test Health Endpoint**: Verify `/health` returns 200 OK
4. **Validate ALB Routing**: Confirm https://moravian.edsteward.ai resolves properly

## Verification Commands

### Check Build Progress
```bash
docker images | grep edsteward
```

### Monitor ECS Deployment
```bash
export AWS_PAGER=""
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].{Running:runningCount,Pending:pendingCount,Desired:desiredCount}'
```

### Check Target Group Health
```bash
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a --region us-east-1
```

### Test Application
```bash
curl -I https://moravian.edsteward.ai/health
```

## Expected Outcome
- **ECS Tasks**: Healthy and running
- **Target Group**: Healthy targets registered
- **ALB**: Routes traffic to healthy targets
- **Application**: Returns 200 OK instead of 503

## Lessons Learned
1. **Cross-Platform Building**: Always build Docker images for target architecture
2. **Native Dependencies**: Libraries like bcrypt require architecture-specific binaries
3. **AWS CLI Pager**: Environment variable `AWS_PAGER=""` prevents shell issues
4. **Systematic Debugging**: Layer-by-layer troubleshooting (ALB → ECS → Container → Logs)

---
**Last Updated:** July 11, 2025 20:25 EDT  
**Expected Resolution:** Within 15-20 minutes (Docker build + deployment time) 