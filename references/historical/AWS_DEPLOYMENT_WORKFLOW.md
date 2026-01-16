# 🚀 EdSteward AWS-Only Deployment Workflow

This streamlined deployment workflow deploys EdSteward to AWS production using direct Amazon services (no GitHub Actions).

## ✅ Prerequisites

1. **AWS CLI** configured with proper credentials
2. **Docker Desktop** running locally  
3. **Node.js/npm** for building frontend assets
4. **AWS Infrastructure** already deployed (ECS cluster, ECR repository, etc.)

## 📋 Quick Commands

### Deploy to Production
```bash
./scripts/deploy-production.sh
```

### Check Production Status  
```bash
./scripts/check-production-status.sh
```

## 🔄 Complete Deployment Workflow

### 1. Pre-deployment Checks
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Docker is running
docker info

# Check ECS infrastructure exists
aws ecs describe-clusters --clusters edsteward-cluster
```

### 2. Deploy New Features
```bash
# Deploy latest code to production
./scripts/deploy-production.sh
```

**The script automatically:**
- ✅ Kills any processes on port 3000
- ✅ Builds frontend assets (`npm run build`)  
- ✅ Creates Docker image with timestamp tag
- ✅ Pushes to ECR repository
- ✅ Updates ECS service with new image
- ✅ Monitors deployment progress
- ✅ Provides deployment status and URLs

### 3. Verify Deployment
```bash
# Check deployment status
./scripts/check-production-status.sh

# Monitor logs (optional)
aws logs tail /aws/ecs/edsteward --follow
```

## 📊 What Gets Deployed

### New Branding Features
- ✨ **Automatic favicon generation** from uploaded logos
- 🎨 **Configurable hero colors** for login screens
- 🖼️ **Enhanced image upload** with blob URL support
- ⚡ **Improved React Query caching** for real-time updates
- 🔒 **Updated Content Security Policy** for image previews

### Technical Improvements
- 🐛 **Fixed CSP blob URL support** for image previews
- 🔧 **Enhanced favicon generation logic** with better detection  
- 💾 **Improved cache management** for branding updates
- 🛡️ **Security middleware updates** for production compatibility

## 🏗️ Architecture Overview

```
Local Development → Docker Build → ECR Push → ECS Update → Production
```

### AWS Services Used
- **ECR**: Container registry for Docker images
- **ECS Fargate**: Serverless container hosting
- **Application Load Balancer**: Traffic routing with SSL
- **CloudWatch**: Logging and monitoring
- **Route53**: DNS management (if configured)

## 🔧 Configuration

### Environment Variables (ECS Task)
- `NODE_ENV=production`
- `DATABASE_URL`: PostgreSQL connection
- `SESSION_SECRET`: Session encryption
- `MULTI_TENANT=true`: Multi-tenant mode

### Container Configuration
- **Image**: `edsteward-multi-tenant:latest`
- **CPU**: 1024 units (1 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Port**: 3000

## 🚨 Troubleshooting

### Common Issues

**1. Port 3000 in use**
```bash
lsof -ti:3000 | xargs kill -9
```

**2. Docker not running**
```bash
# Start Docker Desktop
open /Applications/Docker.app
```

**3. AWS credentials not configured**
```bash
aws configure
# Enter your AWS Access Key, Secret Key, and Region
```

**4. ECS service not found**
```bash
# Check if infrastructure is deployed
aws ecs describe-clusters --clusters edsteward-cluster
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service
```

### Deployment Monitoring

**Check ECS Service:**
```bash
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service
```

**View Application Logs:**
```bash
aws logs tail /aws/ecs/edsteward --follow
```

**Check Task Health:**
```bash
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service
```

## 📈 Monitoring & Health Checks

### Application Health Endpoint
- **URL**: `https://your-alb-dns/health`
- **Expected Response**: HTTP 200 with health status

### Key Metrics to Monitor
- **ECS Service**: Running vs Desired task count
- **ALB**: Target health and response times  
- **CloudWatch**: Application logs and errors
- **Database**: Connection health and performance

## 🔄 Rollback Process

If a deployment fails:

```bash
# Check recent deployments
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service

# Rollback to previous task definition if needed
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --task-definition <previous-task-def>
```

## 📚 Additional Resources

- **ECS Console**: Monitor deployments and logs
- **ECR Console**: View container images and tags
- **CloudWatch**: Application metrics and logs
- **Application URL**: Available in deployment output

---

## 🎯 Quick Reference

| Command | Purpose |
|---------|---------|
| `./scripts/deploy-production.sh` | Deploy to production |
| `./scripts/check-production-status.sh` | Check deployment status |
| `aws ecs describe-services --cluster edsteward-cluster --services edsteward-service` | ECS service details |
| `aws logs tail /aws/ecs/edsteward --follow` | View live logs |

**🚀 Ready to deploy your new branding features to production!** 