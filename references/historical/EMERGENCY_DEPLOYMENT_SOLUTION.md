# 🚨 EdSteward 503 Error - Emergency Fix Solution

## Problem Summary

**moravian.edsteward.ai** returns **503 Service Unavailable** because:

1. ALB has no healthy backend targets
2. ECS tasks are failing with exit code 1
3. Container crashes due to bcrypt architecture mismatch (ARM64 vs x86_64)

## Root Cause Analysis

- **Production Image**: `259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:fixed-architecture-1752279701`
- **Issue**: Contains native `bcrypt` built for wrong architecture
- **Development**: Works perfectly with `bcryptjs` (pure JavaScript implementation)

## Solution: Deploy bcryptjs-Fixed Image

### Option A: Quick Fix (Recommended)

Use existing working deployment script with Docker buildx:

```bash
# 1. Ensure colima is running with sufficient memory
colima stop
colima start --memory 8

# 2. Build production image with bcryptjs fix
docker buildx build --platform linux/amd64 --push \
  -t 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:bcryptjs-fix \
  -t 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest \
  .

# 3. Update ECS service
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --force-new-deployment \
  --region us-east-1
```

### Option B: Manual Docker Build

If buildx fails, build manually:

```bash
# 1. Create emergency Dockerfile
cat > Dockerfile.fix << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
RUN npm uninstall bcrypt && npm install bcryptjs @types/bcryptjs --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF

# 2. Build and push
docker build -f Dockerfile.fix -t edsteward-fix .
docker tag edsteward-fix 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:fix
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:fix

# 3. Update ECS
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region us-east-1
```

### Option C: AWS CodeBuild (If local Docker fails)

Use AWS CodeBuild to build the image in the cloud:

```bash
# Run the emergency deployment script
chmod +x scripts/emergency-deploy.sh
./scripts/emergency-deploy.sh
```

## Verification Steps

1. **Check ECS Service Status:**

```bash
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].{runningCount:runningCount,desiredCount:desiredCount}'
```

2. **Check Application Response:**

```bash
curl -I https://moravian.edsteward.ai
# Should return: HTTP/1.1 200 OK
```

3. **Monitor Task Health:**

```bash
aws ecs describe-tasks --cluster edsteward-cluster --tasks $(aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --query 'taskArns[0]' --output text) --region us-east-1 --query 'tasks[0].healthStatus'
```

## Expected Timeline

- **Build Time**: 5-10 minutes
- **Push Time**: 2-3 minutes  
- **ECS Deployment**: 5-10 minutes
- **Total**: 12-23 minutes

## Success Indicators

✅ **ECS Service**: `runningCount: 1, desiredCount: 1`
✅ **Application**: `HTTP 200` response from moravian.edsteward.ai
✅ **Container**: No bcrypt-related errors in logs
✅ **Authentication**: Login works properly

## Post-Deployment Verification

```bash
# Check application logs
aws logs tail /ecs/edsteward-app --follow --region us-east-1

# Verify database connection
curl -s https://moravian.edsteward.ai/api/setup/status | jq '.isSetupComplete'
```

## Future Prevention

1. **Always use bcryptjs** in package.json (not native bcrypt)
2. **Test architecture compatibility** before production deployment
3. **Use consistent Docker platforms** (linux/amd64 for AWS ECS)
4. **Implement proper health checks** in task definitions

---

## Critical Configuration

**Current Production Setup:**

- **ECS Cluster**: `edsteward-cluster`
- **Service**: `edsteward-service`
- **Task Definition**: `edsteward-fixed:2`
- **ALB**: `edsteward-production-new-tg` (health check on `/`)
- **Image**: Needs bcryptjs fix

**Working Development Setup:**

- **Port**: 3000
- **Database**: Connected successfully
- **Authentication**: Username/Password working
- **bcryptjs**: ✅ Properly configured
