# 🚀 EdSteward Deployment Workflow

## Quick Development → Production Pipeline

### 1. **Local Development** (Instant feedback)
```bash
# Start development environment with hot reloading
docker-compose -f docker-compose.dev.yml up -d

# Make your changes - they appear instantly!
# No rebuilds needed for code changes
```

### 2. **Deploy to Staging** (2 options)

#### Option A: Automatic (when GitHub Actions works)
```bash
git add .
git commit -m "Your feature description"
git push origin ES-clientside
```
- ✅ **URL**: https://staging.edsteward.ai/
- ⏱️ **Time**: ~3-4 minutes
- 🔍 **Monitor**: Check GitHub Actions tab

#### Option B: Manual (immediate deployment)
```bash
./scripts/deploy-manual.sh staging
```
- ✅ **URL**: https://staging.edsteward.ai/
- ⏱️ **Time**: ~2-3 minutes (faster than GitHub Actions)
- 🔍 **Monitor**: Terminal output + AWS console

### 3. **Deploy to Production** (2 options)

#### Option A: Automatic (when GitHub Actions works)
```bash
git checkout main
git merge ES-clientside
git push origin main
```
- ✅ **URL**: https://edsteward.ai/
- ⏱️ **Time**: ~3-4 minutes

#### Option B: Manual (immediate deployment)
```bash
./scripts/deploy-manual.sh production
```
- ✅ **URL**: https://edsteward.ai/
- ⏱️ **Time**: ~2-3 minutes

## 🛠️ Current Status & Recommendations

### GitHub Actions Issue
- **Problem**: Workflow not triggering automatically
- **Likely cause**: Missing AWS secrets or permissions
- **Solution**: Use manual deployment script until fixed

### Recommended Workflow (Right Now)
1. **Develop**: Use `docker-compose.dev.yml` for instant feedback
2. **Test**: Deploy to staging with `./scripts/deploy-manual.sh staging`
3. **Ship**: Deploy to production with `./scripts/deploy-manual.sh production`

## 📋 Prerequisites
- Docker Desktop running
- AWS CLI configured with proper credentials
- Access to ECR repository: `259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant`

## 🔧 Monitoring Deployments
```bash
# Check staging deployment
aws ecs describe-services --cluster edsteward-multi-tenant-staging-cluster --services edsteward-multi-tenant-staging-service --region us-east-1

# Check production deployment  
aws ecs describe-services --cluster edsteward-multi-tenant-cluster --services edsteward-multi-tenant-service --region us-east-1
```

## 🎯 Complete Example: Feature → Production

```bash
# 1. Develop locally
docker-compose -f docker-compose.dev.yml up -d
# Make your changes...

# 2. Test in staging
git add .
git commit -m "Add new feature"
./scripts/deploy-manual.sh staging
# Test at https://staging.edsteward.ai/

# 3. Deploy to production
git checkout main
git merge ES-clientside
git push origin main
./scripts/deploy-manual.sh production
# Live at https://edsteward.ai/
```

**Total time from code change to production: ~5-6 minutes** 🚀 