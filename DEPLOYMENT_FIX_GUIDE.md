# 🚨 ECS DEPLOYMENT SYSTEM FIX GUIDE

## Problem Summary

The ECS deployment system has been failing with these symptoms:
- ✅ Docker images build and push successfully to ECR
- ✅ New task definitions are created successfully  
- ❌ **ECS services NEVER use the new task definitions**
- ❌ Services keep running old code indefinitely
- ❌ New endpoints return 404 errors (proving old code is running)

## Root Cause Analysis

Based on AWS documentation and research, this is a **classic ECS deployment deadlock** caused by:

1. **Deployment Configuration Issues**: Services with `minimumHealthyPercent=50` and `desiredCount=1` can get stuck
2. **Task Placement Failures**: New tasks fail to start due to resource constraints or configuration issues
3. **Health Check Failures**: New tasks fail health checks, preventing deployment completion
4. **Service Update Not Forcing**: Updates don't actually force new deployments

## The Fix

The solution is to **break the deployment deadlock** by:
1. Force stopping current tasks
2. Updating service with explicit task definition
3. Using `forceNewDeployment=true`
4. Setting `minimumHealthyPercent=0` to allow complete replacement
5. Monitoring deployment until completion

## 🛠️ AUTOMATED FIX (Recommended)

### Option 1: Python Script (Most Comprehensive)

```bash
# Install dependencies
pip3 install boto3 requests

# Run the automated fix
python3 fix-deployment-system.py
```

This script will:
- ✅ Analyze current deployment state
- ✅ Find latest Docker image in ECR
- ✅ Create new task definition with latest image
- ✅ Force stop current tasks (breaks deadlock)
- ✅ Update service with force deployment
- ✅ Monitor deployment progress
- ✅ Verify new code is actually running

### Option 2: Manual Bash Script

```bash
# Make executable and run
chmod +x manual-deployment-fix.sh
./manual-deployment-fix.sh
```

## 🔧 MANUAL FIX (If Scripts Fail)

### Step 1: Force Stop Current Tasks
```bash
# List current tasks
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --region us-east-1

# Stop each task (replace TASK_ARN with actual ARN)
aws ecs stop-task --cluster edsteward-cluster --task TASK_ARN --reason "Breaking deployment deadlock" --region us-east-1
```

### Step 2: Update Service with Force Deployment
```bash
aws ecs update-service \
    --cluster edsteward-cluster \
    --service edsteward-service \
    --force-new-deployment \
    --deployment-configuration maximumPercent=200,minimumHealthyPercent=0 \
    --region us-east-1
```

### Step 3: Monitor Deployment
```bash
# Check deployment status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].deployments'
```

### Step 4: Verify New Code
```bash
# Test endpoints
curl https://edsteward.ai/api/test
curl https://edsteward.ai/api/db-direct
curl https://edsteward.ai/api/db-stats
```

## 🎯 Success Criteria

The fix is successful when:
- ✅ `/api/test` returns JSON (not HTML)
- ✅ `/api/db-direct` returns JSON (not 404 HTML)
- ✅ `/api/db-stats` returns JSON (not 404 HTML)
- ✅ ECS service shows 1/1 tasks running
- ✅ New deployment is marked as PRIMARY

## 🚨 Emergency Endpoints Added

The latest code includes these new emergency database endpoints:

### `/api/db-direct`
- Tests direct database connection
- Returns user count and connection status
- Bypasses all middleware/auth issues

### `/api/db-stats` 
- Returns complete database statistics
- Shows counts for users, regulations, notes
- Used by the database management UI

### `/api/db-import`
- Ready for database import functionality
- Currently returns success message

## 📊 Monitoring Commands

```bash
# Check service status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDefinition:taskDefinition}'

# Check deployment status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].deployments[0].{Status:status,Running:runningCount,Desired:desiredCount,CreatedAt:createdAt}'

# List task definitions
aws ecs list-task-definitions --family-prefix edsteward-task --region us-east-1 --sort DESC --max-items 5

# Check running tasks
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --region us-east-1
```

## 🔍 Troubleshooting

### If Deployment Still Fails:

1. **Check Task Definition**: Ensure the latest task definition has the correct image
2. **Check Resource Limits**: Verify CPU/memory requirements can be met
3. **Check Health Checks**: Look for health check failures in task logs
4. **Check Network Configuration**: Ensure subnets and security groups are correct
5. **Check IAM Permissions**: Verify task execution role has necessary permissions

### Common Issues:

- **Image Pull Errors**: Check ECR permissions and image exists
- **Resource Constraints**: Increase cluster capacity or reduce task requirements  
- **Network Issues**: Check VPC configuration and security groups
- **Health Check Failures**: Check application startup and health endpoints

## 📝 Prevention

To prevent future deployment issues:

1. **Always use `forceNewDeployment=true`** when updating services
2. **Set appropriate deployment configuration** (`minimumHealthyPercent=0` for single-task services)
3. **Monitor deployments** until completion
4. **Test endpoints** after deployment to verify new code
5. **Use circuit breakers** to automatically rollback failed deployments

## 🎉 Expected Results

After running the fix:
- ✅ Database management UI will work
- ✅ Admin settings will show database statistics  
- ✅ Database import/export functionality will be available
- ✅ All API endpoints will return JSON (not HTML errors)
- ✅ Future deployments will work reliably 