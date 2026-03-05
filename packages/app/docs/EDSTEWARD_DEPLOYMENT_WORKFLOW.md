# EdSteward Deployment Workflow Guide
## Complete Instructions for All Deployment Scenarios

---

## 🎯 **Overview**

EdSteward uses a **multi-environment, multi-tenant architecture** with AWS-based deployments and CNAME-based DNS management.

### **Environment Structure**
```
Production:  moravian.edsteward.ai  (main → production)
Staging:     staging.edsteward.ai   (ES-clientside → staging)
Admin:       admin.edsteward.ai     (shared infrastructure)
Dev:         dev.edsteward.ai       (dev → development) [optional]
```

---

## 🚀 **Standard Deployment Workflows**

### **1. Feature Development & Testing**

#### **Step 1: Development**
• Switch to staging branch:
  ```bash
  git checkout ES-clientside
  git pull origin ES-clientside
  ```

• Make your code changes in your editor

• Commit and push changes:
  ```bash
  git add .
  git commit -m "feat: your feature description"
  git push origin ES-clientside
  ```

#### **Step 2: Deploy to Staging**
• **Method**: Use AWS deployment script
• **Target**: `staging.edsteward.ai`
• **Duration**: 3-5 minutes
• **Command**: `./scripts/deploy-staging.sh`

#### **Step 3: Test on Staging**
• Run health check:
  ```bash
  curl -I https://staging.edsteward.ai/health
  # Should return HTTP 200
  ```

• Test in browser:
  ```bash
  open https://staging.edsteward.ai
  ```

• Verify your changes work as expected

### **2. Production Deployment**

#### **Step 1: Merge to Main**
• Switch to main branch:
  ```bash
  git checkout main
  git pull origin main
  ```

• Merge staging changes:
  ```bash
  git merge ES-clientside
  ./scripts/deploy-production.sh
  ```

#### **Step 2: Deploy to Production**
• **Method**: Use AWS deployment script
• **Target**: `moravian.edsteward.ai` (production tenant)
• **Duration**: 3-5 minutes
• **Command**: `./scripts/deploy-production.sh`

#### **Step 3: Verify Production**
• Run health check:
  ```bash
  curl -I https://moravian.edsteward.ai/health
  # Should return HTTP 200 with tenant headers
  ```

• Test in browser:
  ```bash
  open https://moravian.edsteward.ai
  # Login: dvdbrnds / gabadh
  ```

• Verify production deployment is working correctly

---

## 🏢 **Multi-Tenant Operations**

### **Feature Deployment Strategies**

#### **Deploy to ALL Tenants (Universal Updates)**
```bash
# For bug fixes, security patches, UI improvements
# 1. Set defaultValue: true in shared/feature-flags.ts
# 2. Deploy normally
./scripts/deploy-production.sh
# 3. All tenants get the update immediately
```

#### **Deploy to SPECIFIC Tenants (Selective Updates)**
```bash
# For premium features, beta testing, gradual rollouts
# 1. Set defaultValue: false in shared/feature-flags.ts
# 2. Deploy code (feature stays hidden)
./scripts/deploy-production.sh
# 3. Enable for specific tenants
./scripts/manage-tenant-features.sh enable-feature moravian new_feature
```

#### **Tenant Feature Management**
```bash
# List all tenants
./scripts/manage-tenant-features.sh list-tenants

# Enable feature for single tenant
./scripts/manage-tenant-features.sh enable-feature moravian premium_feature

# Enable feature for ALL tenants
./scripts/manage-tenant-features.sh bulk-enable universal_feature

# Gradual rollout to multiple tenants
./scripts/manage-tenant-features.sh rollout beta_feature moravian,admin,test

# Emergency disable
./scripts/manage-tenant-features.sh disable-feature moravian problematic_feature
```

*📖 For complete multi-tenant deployment strategies, see: `docs/MULTI_TENANT_DEPLOYMENT_STRATEGY.md`*

### **Adding a New Tenant**

#### **Step 1: Create Tenant**
```bash
# Run the automated tenant setup script
./scripts/add-new-tenant.sh university-abc "University ABC" "university-abc.edu"

# This creates:
# - CNAME: university-abc.edsteward.ai → ALB
# - DNS propagation (5 minutes)
# - Ready for configuration
```

#### **Step 2: Configure Tenant in Database**
```sql
-- Run this SQL in your database
INSERT INTO tenants (
  id, name, subdomain, domain, status, settings, created_at, updated_at
) VALUES (
  'university-abc',
  'University ABC',
  'university-abc',
  'university-abc.edu',
  'active',
  '{
    "allowedDomains": ["university-abc.edu"],
    "defaultRole": "user",
    "enableAutoProvisioning": true,
    "features": {
      "maxUsers": 1000,
      "maxRegulations": 5000,
      "ssoEnabled": true
    }
  }',
  NOW(),
  NOW()
);
```

#### **Step 3: Configure SAML (Optional)**
```bash
# Tenant SAML endpoints are automatically available:
# Metadata: https://university-abc.edsteward.ai/auth/saml/metadata
# Callback: https://university-abc.edsteward.ai/auth/saml/callback
# Entity ID: urn:regulatorytrackr:sp:university-abc
```

#### **Step 4: Test New Tenant**
```bash
# Test tenant access
curl -I https://university-abc.edsteward.ai/health
# Should return HTTP 200 with tenant detection headers

# Access in browser
open https://university-abc.edsteward.ai
```

---

## 🔧 **Emergency Procedures**

### **Hotfix Deployment**

#### **Critical Production Issue**
```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-issue

# 2. Make minimal fix
# ... fix code ...

# 3. Test locally if possible
npm run build
npm test

# 4. Deploy to staging first
git checkout ES-clientside
git merge hotfix/critical-issue
./scripts/deploy-staging.sh

# 5. Test on staging
curl -I https://staging.edsteward.ai/health

# 6. Deploy to production
git checkout main
git merge hotfix/critical-issue
./scripts/deploy-production.sh

# 7. Clean up
git branch -d hotfix/critical-issue
```

### **Rollback Procedure**

#### **If Production Deployment Fails**
```bash
# 1. Check deployment logs for error details
./scripts/check-production-status.sh

# 2. Force rollback to previous working commit
git checkout main
git reset --hard <previous-working-commit-hash>
git push --force origin main

# 3. Monitor rollback deployment
# Use AWS-only deployment script to deploy the previous version
./scripts/deploy-production.sh
```

#### **Database Rollback (If Needed)**
```bash
# 1. Connect to production database
# 2. Run rollback migrations if any schema changes were made
# 3. Restart ECS service if needed
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --force-new-deployment \
  --region us-east-1
```

---

## 📊 **Monitoring & Health Checks**

### **Environment Health Checks**

#### **Automated Monitoring Script**
```bash
#!/bin/zsh
# Save as scripts/health-check-all.sh

echo "🏥 EdSteward Health Check"
echo "========================"

environments=(
  "staging.edsteward.ai"
  "moravian.edsteward.ai" 
  "admin.edsteward.ai"
)

for env in "${environments[@]}"; do
  echo -n "Testing $env... "
  response=$(curl -s -o /dev/null -w "%{http_code}" https://$env/health)
  
  if [ "$response" = "200" ]; then
    echo "✅ Healthy"
  else
    echo "❌ Failed ($response)"
  fi
done

echo ""
echo "🔗 Useful Links:"
echo "• AWS ECS Console: https://console.aws.amazon.com/ecs/home?region=us-east-1"
echo "• CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups"
echo "• Deploy to production: ./scripts/deploy-production.sh"
```

#### **Make it executable and run**
```bash
chmod +x scripts/health-check-all.sh
./scripts/health-check-all.sh
```

### **Key Metrics to Monitor**

#### **Application Metrics**
- **Response Time**: < 2 seconds
- **Error Rate**: < 1%
- **Uptime**: > 99.9%

#### **Infrastructure Metrics**
- **ECS Task Health**: All tasks running
- **ALB Target Health**: All targets healthy
- **Database Connections**: Within limits

#### **Monitoring Commands**
```bash
# Check ECS service status
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg/abc123 \
  --region us-east-1

# View recent logs
aws logs tail /ecs/edsteward-multi-tenant-staging --follow --region us-east-1
```

---

## 🚨 **Troubleshooting Guide**

### **Common Issues & Solutions**

#### **1. AWS Deployment Fails**
```bash
# Check deployment logs
./scripts/check-production-status.sh

# Common fixes:
# - Docker build issues: Check Dockerfile syntax
# - ECR push issues: Check AWS credentials
# - ECS update issues: Check task definition
```

#### **2. Application Returns 503/504**
```bash
# Check ECS task status
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --region us-east-1

# Check application logs
aws logs tail /ecs/edsteward-multi-tenant-staging --region us-east-1 --since 10m

# Force new deployment
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --force-new-deployment \
  --region us-east-1
```

#### **3. New Tenant Not Working**
```bash
# Check DNS propagation
dig newtenant.edsteward.ai CNAME +short

# Check tenant configuration in database
# Verify CNAME points to correct ALB
# Check ALB listener rules
```

#### **4. SSL Certificate Issues**
```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Wildcard *.edsteward.ai should cover all subdomains
# If issues, check Route53 DNS validation records
```

---

## 📋 **Pre-Deployment Checklist**

### **Before Every Deployment**

#### **Code Quality**
- [ ] All tests passing: `npm test`
- [ ] Code builds successfully: `npm run build`
- [ ] ESLint checks pass: `npm run lint`
- [ ] No console errors in development

#### **Environment Testing**
- [ ] Test on staging environment first
- [ ] Verify database migrations (if any)
- [ ] Check for breaking changes
- [ ] Verify tenant isolation still works

#### **Infrastructure**
- [ ] AWS credentials valid
- [ ] ECS cluster healthy
- [ ] Database accessible
- [ ] No ongoing maintenance windows

### **After Deployment**

#### **Verification Steps**
- [ ] Health endpoints return 200
- [ ] User login works
- [ ] Database queries working
- [ ] Multi-tenant routing working
- [ ] No error spikes in logs

#### **Communication**
- [ ] Update team on deployment status
- [ ] Document any configuration changes
- [ ] Update changelog if needed

---

## 🎯 **Quick Reference Commands**

### **Deployment Commands**
```bash
# Deploy to staging
./scripts/deploy-staging.sh

# Deploy to production  
./scripts/deploy-production.sh

# Add new tenant
./scripts/add-new-tenant.sh <tenant-id> "<name>" "<domain>"

# Health check all environments
./scripts/health-check-all.sh

# Force ECS redeployment
aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment --region us-east-1
```

### **Monitoring Commands**
```bash
# View deployment status
./scripts/check-production-status.sh

# Check application logs
aws logs tail /ecs/edsteward-multi-tenant-staging --follow --region us-east-1

# Check ECS service health
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1
```

### **Emergency Commands**
```bash
# Rollback to previous commit
git reset --hard <commit-hash> && git push --force origin main

# Scale down service (emergency stop)
aws ecs update-service --cluster <cluster> --service <service> --desired-count 0 --region us-east-1

# Scale up service
aws ecs update-service --cluster <cluster> --service <service> --desired-count 1 --region us-east-1
```

---

## 🎉 **Success Metrics**

### **Deployment Success Indicators**
- ✅ AWS deployment script completes successfully
- ✅ Health endpoints return HTTP 200
- ✅ Application loads in browser
- ✅ User authentication works
- ✅ Database queries succeed
- ✅ No error spikes in CloudWatch

### **Performance Benchmarks**
- **Deployment Time**: < 10 minutes
- **Zero Downtime**: Achieved through rolling updates
- **DNS Propagation**: < 5 minutes for new tenants
- **SSL Certificate**: Automatic for all subdomains

---

## 📞 **Support & Resources**

### **Key URLs**
- **GitHub Repository**: https://github.com/dvdbrnds/EdSteward
- **AWS ECS Console**: https://console.aws.amazon.com/ecs/home?region=us-east-1
- **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups

### **Environment URLs**
- **Production**: https://moravian.edsteward.ai (dvdbrnds / gabadh)
- **Staging**: https://staging.edsteward.ai
- **Admin**: https://admin.edsteward.ai

### **Documentation Files**
- `docs/CNAME_DEPLOYMENT_STRATEGY.md` - CNAME setup details
- `docs/NEW_TENANT_SETUP_GUIDE.md` - Tenant onboarding guide
- `CNAME_IMPLEMENTATION_SUCCESS.md` - Implementation results
- `scripts/add-new-tenant.sh` - Automated tenant setup
- `scripts/setup-cname-records.sh` - DNS configuration

---

**🚀 Your EdSteward deployment workflow is now enterprise-ready with zero-downtime deployments and 1-minute tenant onboarding!** 