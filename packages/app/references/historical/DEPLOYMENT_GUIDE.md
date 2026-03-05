# EdSteward Deployment Guide - Single-Tenant On-Premises

## 🎯 **Single-Tenant On-Premises Strategy**

EdSteward uses a **per-customer deployment approach** where each institution gets their own dedicated server installation:

### **Development Phase: Docker Containers**
- **Use for**: Feature development, testing, debugging
- **Environment**: Single-tenant Docker configuration
- **Time**: Instant hot reloading
- **Command**: `docker-compose -f single-tenant-config/docker-compose.single-tenant.yml up -d`

### **Packaging Phase: Customer-Specific Builds**
- **Use for**: Preparing customer deployments
- **Environment**: Docker image with customer branding/config
- **Time**: 5-10 minutes
- **Command**: `./scripts/package-for-customer.sh [customer-name]`

### **Deployment Phase: Customer On-Premises**
- **Use for**: Production installation at customer site
- **Environment**: Customer's own infrastructure
- **Time**: 15-30 minutes (customer runs installer)
- **Command**: Customer runs `./install.sh` from deployment package

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

### **Daily Development Workflow (Docker-First)**
```bash
# 1. Start Docker local development environment
make -f Makefile.local dev

# 2. Make code changes (hot reload enabled in Docker)
# Edit files in your IDE - changes appear instantly at http://localhost:3000

# 3. Test in production-like staging environment
make -f Makefile.local staging

# 4. Commit changes for version control
git add .
git commit -m "Feature: Add new compliance feature"
./scripts/deploy-production.sh

# 5. Deploy to production using AWS ECS/ECR
./scripts/deploy-app.sh

# 6. Verify deployment
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
- ✅ Test changes locally with `make -f Makefile.local dev` (Docker environment)
- ✅ Verify in staging with `make -f Makefile.local staging`
- ✅ Ensure all tests pass
- ✅ Commit changes to git for version control
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

## 🎉 **Summary**

**Your deployment strategy is now optimized for:**
- ⚡ **Fast application updates** (3-5 minutes)
- 🛡️ **Stable infrastructure** (Terraform managed)
- 🔄 **Easy rollbacks** (automated)
- 📊 **Zero-downtime deployments** (ECS rolling updates)
- 💰 **Cost-effective** (single ECS service for all tenants)

**Use `./scripts/deploy-app.sh` for 90% of your deployments!** 