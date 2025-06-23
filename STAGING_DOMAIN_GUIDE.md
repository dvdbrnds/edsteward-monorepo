# 🌐 Staging Domain Setup Guide

This guide helps you set up domain access to your staging environment.

## 🚀 Quick Setup Options

### Option 1: Subdomain Routing (Recommended)
**Best for**: Production-like testing with proper domain

```bash
# Run the automated setup script
./scripts/setup-staging-domain.sh
# Choose option 1

# Then add DNS record:
# staging.yourdomain.com → edsteward-alb-554701445.us-east-1.elb.amazonaws.com
```

**Pros**: ✅ Production-like setup, ✅ SSL/HTTPS support, ✅ Professional  
**Cons**: ❌ Requires DNS management, ❌ SSL certificate update

### Option 2: Local Testing (Fastest)
**Best for**: Quick testing without DNS setup

```bash
# Run the automated setup script
./scripts/setup-staging-domain.sh
# Choose option 4

# Or manually get the staging IP:
aws ecs describe-tasks \
  --cluster edsteward-multi-tenant-staging-cluster \
  --tasks $(aws ecs list-tasks --cluster edsteward-multi-tenant-staging-cluster --service-name edsteward-multi-tenant-staging-service --query 'taskArns[0]' --output text) \
  --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
  --output text

# Then access directly: http://STAGING_IP:3000
```

**Pros**: ✅ Immediate access, ✅ No DNS needed  
**Cons**: ❌ IP changes on redeploy, ❌ No HTTPS

### Option 3: Separate Load Balancer
**Best for**: Complete isolation from production

```bash
./scripts/setup-staging-domain.sh
# Choose option 3
```

**Pros**: ✅ Complete isolation, ✅ Own SSL certificate  
**Cons**: ❌ Extra AWS costs, ❌ More complex setup

## 🔧 Manual Setup Steps

If you prefer manual setup, here's what the script does:

### 1. Create Staging Target Group
```bash
aws elbv2 create-target-group \
  --name "edsteward-staging-tg" \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxxxxxx \
  --health-check-path "/health"
```

### 2. Register ECS Tasks with Target Group
```bash
# Get staging task IP
TASK_IP=$(aws ecs describe-tasks --cluster edsteward-multi-tenant-staging-cluster --tasks TASK_ARN --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text)

# Register with target group
aws elbv2 register-targets \
  --target-group-arn TARGET_GROUP_ARN \
  --targets Id=$TASK_IP,Port=3000
```

### 3. Add Load Balancer Rules
```bash
# Add staging routing rule
aws elbv2 create-rule \
  --listener-arn LISTENER_ARN \
  --priority 100 \
  --conditions Field=host-header,Values=staging.yourdomain.com \
  --actions Type=forward,TargetGroupArn=STAGING_TARGET_GROUP_ARN
```

## 🌍 DNS Configuration

### For Route 53:
```bash
# Create CNAME record
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "staging.yourdomain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "edsteward-alb-554701445.us-east-1.elb.amazonaws.com"}]
      }
    }]
  }'
```

### For Other DNS Providers:
- **Type**: CNAME
- **Name**: staging (or staging.yourdomain.com)
- **Value**: `edsteward-alb-554701445.us-east-1.elb.amazonaws.com`
- **TTL**: 300 seconds

## 🔒 SSL Certificate Update

If using HTTPS, update your SSL certificate to include the staging subdomain:

### AWS Certificate Manager:
1. Go to AWS Certificate Manager
2. Request new certificate or update existing
3. Add `staging.yourdomain.com` to domains
4. Update load balancer listener to use new certificate

### Let's Encrypt:
```bash
certbot certonly --dns-route53 -d yourdomain.com -d staging.yourdomain.com
```

## 🧪 Testing Your Staging Environment

Once set up, test your staging environment:

```bash
# Test staging deployment
curl -H "Host: staging.yourdomain.com" http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com

# Or visit in browser
https://staging.yourdomain.com
```

**Expected Results:**
- ✅ Orange "STAGING ENVIRONMENT" banner visible
- ✅ Login works with: dvdbrnds/gabadh
- ✅ Shows 5 conservatory regulations
- ✅ Admin settings accessible

## 🔄 Staging Workflow

Once your staging domain is set up:

```bash
# 1. Make changes locally
# Edit files...

# 2. Deploy to staging
git add .
git commit -m "Your changes"
git push origin ES-clientside  # → Deploys to staging

# 3. Test at staging.yourdomain.com

# 4. Promote to production
git checkout main
git merge ES-clientside
git push origin main  # → Deploys to production
```

## 🚨 Troubleshooting

### Staging site not accessible:
1. Check ECS service is running: `aws ecs describe-services --cluster edsteward-multi-tenant-staging-cluster --services edsteward-multi-tenant-staging-service`
2. Check target group health: `aws elbv2 describe-target-health --target-group-arn TARGET_GROUP_ARN`
3. Check DNS resolution: `nslookup staging.yourdomain.com`

### 502 Bad Gateway:
- ECS tasks may be unhealthy
- Check application logs: `aws logs tail /ecs/edsteward-multi-tenant-staging`

### SSL/Certificate issues:
- Ensure certificate includes staging subdomain
- Check certificate is attached to HTTPS listener

## 📞 Quick Commands

```bash
# Get staging service status
aws ecs describe-services --cluster edsteward-multi-tenant-staging-cluster --services edsteward-multi-tenant-staging-service --query 'services[0].{Status:status,RunningCount:runningCount}'

# Get staging task IP
aws ecs describe-tasks --cluster edsteward-multi-tenant-staging-cluster --tasks $(aws ecs list-tasks --cluster edsteward-multi-tenant-staging-cluster --service-name edsteward-multi-tenant-staging-service --query 'taskArns[0]' --output text) --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text

# Check target group health
aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --names edsteward-staging-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
``` 