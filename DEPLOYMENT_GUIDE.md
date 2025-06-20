# EdSteward Deployment Guide

## 🎯 **Hybrid Deployment Strategy**

EdSteward uses a **two-tier deployment approach** optimized for both infrastructure stability and rapid application updates:

### **Tier 1: Infrastructure (Terraform) - Infrequent**
- **Use for**: VPC, ECS Cluster, RDS, Load Balancer, Security Groups
- **Frequency**: Monthly/Quarterly or when infrastructure changes needed
- **Time**: 20-30 minutes
- **Command**: `cd infrastructure/terraform && terraform apply`

### **Tier 2: Application (Docker + ECS) - Frequent**
- **Use for**: Code changes, bug fixes, new features
- **Frequency**: Daily/Weekly deployments
- **Time**: 3-5 minutes
- **Command**: `./scripts/deploy-app.sh`

---

## 🚀 **Fast Application Deployment**

### **For Regular Updates (Recommended)**

```bash
# Deploy application updates (3-5 minutes)
./scripts/deploy-app.sh
```

**What this does:**
1. 📦 Builds Docker image
2. 🏷️ Tags for ECR
3. 🔐 Logs into AWS ECR
4. ⬆️ Pushes image to ECR
5. 🔄 Updates ECS service
6. ⏳ Waits for deployment
7. 🏥 Runs health check

### **Rollback (If Needed)**

```bash
# Rollback to previous version (2-3 minutes)
./scripts/rollback-app.sh
```

---

## 🏗️ **Infrastructure Deployment (When Needed)**

### **Initial Setup or Infrastructure Changes**

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

**Use Terraform when you need to:**
- Add new AWS resources
- Modify security groups
- Change RDS configuration
- Update load balancer settings
- Modify VPC networking

---

## 📋 **Deployment Workflows**

### **Daily Development Workflow**
```bash
# 1. Make code changes
git add .
git commit -m "Feature: Add new compliance feature"

# 2. Test locally
npm run dev

# 3. Deploy to production
./scripts/deploy-app.sh

# 4. Verify deployment
curl https://edsteward.ai/health
```

### **Emergency Rollback Workflow**
```bash
# If something goes wrong after deployment
./scripts/rollback-app.sh

# Verify rollback
curl https://edsteward.ai/health
```

### **Infrastructure Change Workflow**
```bash
# 1. Make infrastructure changes
cd infrastructure/terraform
vim main.tf

# 2. Plan and apply
terraform plan
terraform apply

# 3. Update application if needed
cd ../..
./scripts/deploy-app.sh
```

---

## 🔧 **Configuration**

### **AWS Configuration Required**
```bash
# Ensure AWS CLI is configured
aws configure list

# Required permissions:
# - ECR: push/pull images
# - ECS: update services, describe services
# - ELB: describe load balancers
```

### **Environment Variables**
The deployment scripts use these configurations:
- **AWS Account**: `259661441422`
- **Region**: `us-east-1`
- **ECR Repository**: `edsteward`
- **ECS Cluster**: `edsteward-cluster`
- **ECS Service**: `edsteward-service`

---

## 📊 **Deployment Comparison**

| Method | Use Case | Time | Complexity | Rollback |
|--------|----------|------|------------|----------|
| **Fast Deploy** | Code changes, features | 3-5 min | Low | Easy |
| **Terraform** | Infrastructure changes | 20-30 min | Medium | Complex |
| **Manual ECS** | Emergency fixes | 2-3 min | High | Manual |

---

## 🔍 **Monitoring & Health Checks**

### **Deployment Status**
```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service

# Check load balancer health
curl http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health
```

### **Application Health**
```bash
# Production health check
curl https://edsteward.ai/health

# Multi-tenant API test
curl https://edsteward.ai/api/tenants/current
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Docker Build Fails**
```bash
# Check Docker daemon
docker ps

# Clean Docker cache
docker system prune -f
```

#### **ECR Push Fails**
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
```

#### **ECS Deployment Stuck**
```bash
# Check ECS service events
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].events'

# Force new deployment
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment
```

#### **Health Check Fails**
```bash
# Check ECS task logs
aws logs tail /ecs/edsteward --follow

# Check load balancer targets
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

---

## 🎯 **Best Practices**

### **Before Deployment**
- ✅ Test changes locally with `npm run dev`
- ✅ Ensure all tests pass
- ✅ Commit changes to git
- ✅ Check AWS credentials are valid

### **During Deployment**
- ✅ Monitor deployment progress
- ✅ Don't interrupt the deployment process
- ✅ Wait for health checks to pass

### **After Deployment**
- ✅ Verify application functionality
- ✅ Check multi-tenant features
- ✅ Monitor logs for errors
- ✅ Update team on deployment status

### **Rollback Strategy**
- ✅ Always test rollback process in staging
- ✅ Keep previous versions available
- ✅ Document rollback procedures
- ✅ Have monitoring alerts in place

---

## 📈 **CI/CD Integration (Future)**

For automated deployments, consider integrating with:

### **GitHub Actions**
```yaml
name: Deploy EdSteward
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to AWS
        run: ./scripts/deploy-app.sh
```

### **AWS CodePipeline**
- Source: GitHub repository
- Build: CodeBuild with Docker
- Deploy: ECS service update

---

## 🎉 **Summary**

**Your deployment strategy is now optimized for:**
- ⚡ **Fast application updates** (3-5 minutes)
- 🛡️ **Stable infrastructure** (Terraform managed)
- 🔄 **Easy rollbacks** (automated)
- 📊 **Zero-downtime deployments** (ECS rolling updates)
- 💰 **Cost-effective** (single ECS service for all tenants)

**Use `./scripts/deploy-app.sh` for 90% of your deployments!** 