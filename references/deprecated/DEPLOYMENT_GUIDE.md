# EdSteward Comprehensive Deployment Guide

## 🎯 Overview

This guide consolidates all deployment procedures for EdSteward into a single reference. Choose your deployment strategy based on your needs:

- **🚀 Development Deployment**: For local development with hot reload
- **🎭 Staging Deployment**: For testing before production
- **🏭 Production Deployment**: For live production environments
- **🚨 Emergency Procedures**: For rollbacks and incident response

## 📋 Quick Reference

| Scenario | Command | Time | Risk Level |
|----------|---------|------|------------|
| **Development** | `make dev` | 30s | None |
| **Safe Production** | `make pipeline` | 15min | Low |
| **Fast Production** | `./scripts/deploy-app.sh` | 3min | Medium |
| **Emergency Rollback** | `./scripts/rollback-app.sh` | 2min | Low |

---

## 🚀 Development Deployment

### Quick Start
```bash
# Start development environment
make dev

# View logs
make dev-logs

# Open shell in container
make dev-shell
```

### What You Get
- **Hot Reload**: Code changes reflect instantly
- **Full Stack**: App + Database + Redis
- **Debug Mode**: Source maps and detailed logging
- **URLs**: 
  - Main app: http://localhost:3000
  - Vite dev server: http://localhost:5173

### Development Commands
```bash
# Environment Management
make dev-stop          # Stop development environment
make dev-restart       # Restart development environment
make dev-status        # Check development status

# Ready for Production
make dev-ready         # Lock in development and deploy to production
```

---

## 🎭 Staging Deployment

### Safe Staged Pipeline (Recommended)
```bash
# Complete staged pipeline with approval gates
make pipeline
```

### What Happens
1. **Stage 1**: Local Docker build & automated tests
2. **Stage 2**: Local staging environment setup  
3. **🚨 Human Approval Gate**: Manual verification required
4. **Stage 3**: Production deployment

### Manual Verification Checklist
When staging is ready, verify:
- [ ] **UI/UX**: Test http://localhost:3000
- [ ] **Authentication**: Login/logout functionality
- [ ] **Core Features**: All features work correctly
- [ ] **Performance**: Response times acceptable
- [ ] **Browser Console**: No JavaScript errors
- [ ] **Database**: Data operations work
- [ ] **API**: All endpoints respond correctly

### Staging Commands
```bash
# Staging Environment Control
make open-staging       # Open staging app in browser
make logs-staging       # View application logs
make logs-staging-all   # View all service logs
make staging-status     # Check environment status
make restart-staging    # Restart staging environment
make stop-staging       # Stop staging environment

# Quick approval (if already tested)
make approve-staging
```

---

## 🏭 Production Deployment

### Method 1: Safe Pipeline (Recommended)
```bash
# Complete pipeline with human approval
make pipeline
```
- **Time**: 15 minutes
- **Risk**: Low
- **Includes**: Local testing + manual verification

### Method 2: Fast Deploy (Experienced Users)
```bash
# Direct production deployment
./scripts/deploy-app.sh
```
- **Time**: 3-5 minutes
- **Risk**: Medium
- **Use for**: Bug fixes, small changes

### Method 3: Infrastructure Changes
```bash
# For AWS infrastructure changes
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# Then deploy application
cd ../..
./scripts/deploy-app.sh
```

### Production Health Check
```bash
# Verify deployment
curl https://edsteward.ai/health

# Check multi-tenant API
curl https://edsteward.ai/api/tenants/current
```

---

## 🚨 Emergency Procedures

### Emergency Rollback
```bash
# Immediate rollback to previous version
./scripts/rollback-app.sh

# Verify rollback
curl https://edsteward.ai/health
```

### Emergency Stop
```bash
# Stop all local containers immediately
make emergency-stop

# Clean up all resources
make clean
```

### Production Issue Response
1. **Immediate**: Run rollback script
2. **Investigate**: Check logs and monitoring
3. **Fix**: Apply fix in development
4. **Test**: Run through staging pipeline
5. **Deploy**: Use safe pipeline for fix

---

## 🔧 Configuration & Setup

### Prerequisites
```bash
# Required tools (macOS)
brew install awscli terraform docker jq

# AWS CLI configuration
aws configure
```

### Environment Variables
```bash
# Production environment
export AWS_REGION=us-east-1
export BASE_DOMAIN=edsteward.ai

# AWS resources
AWS_ACCOUNT=259661441422
ECR_REPOSITORY=edsteward
ECS_CLUSTER=edsteward-cluster
ECS_SERVICE=edsteward-service
```

### Local Environment Files
- `.env.local`: Development configuration
- `.env.staging`: Staging configuration  
- `.env.production`: Production configuration

---

## 🏗️ Infrastructure Management

### AWS Resources
- **ECS Cluster**: `edsteward-cluster`
- **ECS Service**: `edsteward-service`
- **ECR Repository**: `edsteward`
- **Load Balancer**: `edsteward-alb`
- **RDS Database**: `edsteward-db`
- **Redis Cache**: `edsteward-redis`

### Terraform Commands
```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply

# Get outputs
terraform output
```

### When to Use Terraform
- VPC/Networking changes
- Database configuration
- Security group updates
- Load balancer modifications
- New AWS resources

---

## 📊 Monitoring & Troubleshooting

### Deployment Status
```bash
# ECS service status
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service

# Check ECS task logs
aws logs tail /aws/ecs/edsteward --follow

# Load balancer health
curl http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health
```

### Common Issues

#### Docker Build Fails
```bash
# Check Docker daemon
docker ps

# Clean Docker cache
docker system prune -f

# Rebuild
make stage1-build
```

#### ECR Push Fails
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  259661441422.dkr.ecr.us-east-1.amazonaws.com
```

#### ECS Deployment Stuck
```bash
# Check ECS service events
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --query 'services[0].events'

# Force new deployment
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --force-new-deployment
```

#### Health Check Fails
```bash
# Check application logs
make logs-staging

# Check ECS logs
aws logs tail /aws/ecs/edsteward --follow

# Check load balancer targets
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-load-balancers \
    --names edsteward-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)
```

---

## 📚 Additional Resources

### Related Documentation
- **[AWS Deployment Guide](references/AWS_DEPLOYMENT_GUIDE.md)**: Detailed AWS setup
- **[Deployment Workflow](references/DEPLOYMENT_WORKFLOW.md)**: Step-by-step workflows
- **[Deployment Checklist](references/DEPLOYMENT_CHECKLIST.md)**: Pre-deployment verification
- **[Terraform Documentation](infrastructure/terraform/README.md)**: Infrastructure as code

### Scripts Reference
- `./scripts/deploy-app.sh`: Fast application deployment
- `./scripts/rollback-app.sh`: Emergency rollback
- `./scripts/wait-for-health.sh`: Health check utility
- `./scripts/deploy-aws.sh`: AWS-specific deployment

### Support Commands
```bash
# Show all available commands
make help

# Check system requirements
make check-tools

# Clean up everything
make clean
```

---

## 🎯 Best Practices

### Development Workflow
1. **Use `make dev`** for active development
2. **Test locally** before any deployment
3. **Use staging pipeline** for production changes
4. **Keep environment files** updated

### Production Deployment
1. **Always use staging** for major changes
2. **Test rollback procedure** before deploying
3. **Monitor deployment** progress
4. **Keep deployment notes** for troubleshooting

### Emergency Response
1. **Rollback first**, investigate later
2. **Document incidents** and fixes
3. **Test fixes** in staging before re-deployment
4. **Update monitoring** based on incidents

---

## 🆘 Getting Help

### Internal Resources
- **Makefile**: `make help` for all commands
- **Scripts**: Check `./scripts/` for automation
- **Logs**: Use `make logs-staging` for debugging

### AWS Console Quick Links
- **ECS**: https://console.aws.amazon.com/ecs/
- **ECR**: https://console.aws.amazon.com/ecr/
- **RDS**: https://console.aws.amazon.com/rds/
- **CloudWatch**: https://console.aws.amazon.com/cloudwatch/

### Emergency Contacts
- **AWS Support**: Available through AWS Console
- **Domain Registrar**: For DNS issues
- **Monitoring Alerts**: Check CloudWatch alarms

---

*Last updated: December 2024* 