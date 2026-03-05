# Beta Environment Deployment Guide

*Created: January 13, 2025*  
*Target: beta.edsteward.ai*

## 🎯 Overview

This guide will create a **fully functional second instance** of EdSteward at `beta.edsteward.ai` using the exact same configuration as your working production environment at `moravian.edsteward.ai`.

## 📋 Prerequisites

- ✅ AWS CLI configured with appropriate permissions
- ✅ Production EdSteward working at `moravian.edsteward.ai`
- ✅ Access to `edsteward.ai` domain DNS settings
- ✅ macOS with zsh shell [[memory:3071253]]
- ✅ Scripts fixed for zsh compatibility (not bash)

## 🚀 Deployment Steps

### Step 0: Test zsh Compatibility (Optional)

Test that scripts work correctly with zsh:

```bash
./scripts/test-zsh-compatibility.sh
```

### Step 1: Deploy Beta ECS Infrastructure

Run the beta deployment script:

```bash
./scripts/deploy-beta.sh
```

**What this does:**

- Creates `edsteward-beta-cluster` ECS cluster
- Creates `edsteward-beta-service` ECS service
- Registers beta task definition using the same working Docker image
- Sets up security groups and networking
- Deploys container with same configuration as production

**Expected output:**

```
✅ Beta deployment completed!
🌐 Beta instance is running at: http://54.XXX.XXX.XXX:3000
```

### Step 2: Configure Application Load Balancer

Run the ALB setup script:

```bash
./scripts/setup-beta-alb.sh
```

**What this does:**

- Creates beta target group for load balancing
- Sets up ALB listener rules for `beta.edsteward.ai`
- Requests SSL certificate for the domain
- Configures health checks and routing

**Expected output:**

```
✅ ALB setup completed!
🌐 ALB DNS: edsteward-alb-1234567890.us-east-1.elb.amazonaws.com
🔗 Next steps:
  1. Add CNAME record: beta.edsteward.ai -> edsteward-alb-1234567890.us-east-1.elb.amazonaws.com
  2. Validate SSL certificate (add DNS validation records)
  3. Test: https://beta.edsteward.ai
```

### Step 3: Configure DNS Settings

#### 3.1 Add Beta Domain CNAME Record

In your DNS provider (wherever `edsteward.ai` is hosted):

```
Type: CNAME
Name: beta
Value: [ALB_DNS from step 2]
TTL: 300
```

#### 3.2 Validate SSL Certificate

The script will output DNS validation records. Add them to your DNS:

```
Type: CNAME
Name: _acme-challenge.beta
Value: [validation record from script output]
TTL: 300
```

### Step 4: Test Beta Environment

Wait 5-10 minutes for DNS propagation, then test:

```bash
# Test health endpoint
curl https://beta.edsteward.ai/health

# Test main page
curl https://beta.edsteward.ai/
```

**Expected results:**

- Health endpoint returns "OK"
- Main page returns HTML with EdSteward content
- Login page accessible at <https://beta.edsteward.ai/login>

### Step 5: Test Authentication

**Login credentials (same as production):**

- Username: `dvdbrnds`
- Password: `gabadh`

**Test login:**

1. Navigate to <https://beta.edsteward.ai>
2. Login with credentials above
3. Verify dashboard shows regulations and features

## 📊 Environment Details

### Beta Configuration

- **URL**: <https://beta.edsteward.ai>
- **ECS Cluster**: `edsteward-beta-cluster`
- **ECS Service**: `edsteward-beta-service`
- **Docker Image**: Same as production (`single-tenant-production-fix-v3`)
- **Database**: Same Neon PostgreSQL as production
- **Authentication**: Same scrypt-based system

### Environment Variables

```
NODE_ENV=production
PORT=3000
MULTI_TENANT=false
DATABASE_URL=postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
SESSION_SECRET=beta-session-secret-edsteward-2025
```

## 🔧 Management Commands

### Check Beta Status

```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --region us-east-1

# Check service logs
aws logs tail /aws/ecs/edsteward-beta --follow --region us-east-1

# Check target group health
aws elbv2 describe-target-health --target-group-arn [TARGET_GROUP_ARN] --region us-east-1
```

### Update Beta Deployment

```bash
# Redeploy beta with latest changes
./scripts/deploy-beta.sh

# Force new deployment
aws ecs update-service --cluster edsteward-beta-cluster --service edsteward-beta-service --force-new-deployment --region us-east-1
```

### Stop Beta Environment

```bash
# Scale down to 0 tasks
aws ecs update-service --cluster edsteward-beta-cluster --service edsteward-beta-service --desired-count 0 --region us-east-1

# Delete service (if needed)
aws ecs delete-service --cluster edsteward-beta-cluster --service edsteward-beta-service --region us-east-1
```

## 🛠️ Troubleshooting

### Common Issues

**1. Service won't start**

```bash
# Check service events
aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --region us-east-1
```

**2. Health check failures**

```bash
# Check logs for errors
aws logs tail /aws/ecs/edsteward-beta --follow --region us-east-1

# Test health endpoint directly
curl http://[TASK_PUBLIC_IP]:3000/health
```

**3. DNS not resolving**

```bash
# Check DNS propagation
dig beta.edsteward.ai

# Test ALB directly
curl http://[ALB_DNS]/health
```

**4. SSL certificate issues**

```bash
# Check certificate status
aws acm list-certificates --region us-east-1
aws acm describe-certificate --certificate-arn [CERT_ARN] --region us-east-1
```

## 💰 Cost Estimate

**Monthly costs for beta environment:**

- **ECS Fargate**: ~$20/month (512 CPU, 1024 Memory)
- **ALB**: ~$16/month (shared with production)
- **Data transfer**: ~$5/month
- **Total**: ~$25/month additional

## 🔄 Development Workflow

**Testing new features:**

1. Deploy to beta first: `./scripts/deploy-beta.sh`
2. Test thoroughly at <https://beta.edsteward.ai>
3. When satisfied, deploy to production

**Database considerations:**

- Beta uses same database as production
- Changes in beta affect production data
- Consider separate beta database for destructive testing

## ✅ Success Criteria

Beta environment is successfully deployed when:

- ✅ <https://beta.edsteward.ai> loads successfully
- ✅ Login with dvdbrnds/gabadh works
- ✅ Dashboard shows 354 regulations and 21 users
- ✅ All functionality mirrors production exactly
- ✅ SSL certificate is valid and working

---

## 🔧 macOS/zsh Compatibility Fixes

The following fixes were made for macOS/zsh compatibility:

### 1. AWS CLI Pager Fix

- Added `export AWS_PAGER=""` to prevent AWS CLI commands from hanging
- Common issue on macOS where AWS CLI tries to use `less` pager

### 2. Array Syntax Fix

- Changed from bash syntax: `SUBNET_ARRAY=($=SUBNET_IDS)`
- To zsh syntax: `SUBNET_ARRAY=(${=SUBNET_IDS})`
- zsh arrays start at index 1, not 0

### 3. Shell Compatibility

- All scripts use `#!/bin/zsh` shebang
- Use macOS-compatible commands (brew, not apt-get)
- Proper error handling with `set -e`

---

**Ready to deploy? Run:**

```bash
./scripts/deploy-beta.sh
```
