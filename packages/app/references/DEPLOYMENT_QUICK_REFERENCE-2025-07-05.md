# 🚀 EdSteward Deployment Quick Reference

## **Most Common Commands**

### **Deployments**
```bash
# Deploy to staging (ES-clientside branch)
git push origin ES-clientside

# Deploy to production (main branch)  
./scripts/deploy-production.sh

# Check deployment status
./scripts/check-production-status.sh
```

### **Health Checks**
```bash
# Check all environments
./scripts/health-check-all.sh

# Quick health check
curl -I https://staging.edsteward.ai/health
curl -I https://moravian.edsteward.ai/health
```

### **Multi-Tenant Feature Management**
```bash
# Deploy to ALL tenants (defaultValue: true)
./scripts/deploy-production.sh

# Deploy to SPECIFIC tenants (defaultValue: false)
./scripts/deploy-production.sh  # Deploy code (hidden)
./scripts/manage-tenant-features.sh enable-feature moravian new_feature

# List all tenants
./scripts/manage-tenant-features.sh list-tenants

# Enable for multiple tenants
./scripts/manage-tenant-features.sh rollout feature_name moravian,admin
```

### **New Tenant Setup**
```bash
# Add new tenant (1-minute setup)
./scripts/add-new-tenant.sh university-abc "University ABC" "university-abc.edu"

# Test new tenant
curl -I https://university-abc.edsteward.ai/health
```

### **Emergency Commands**
```bash
# Rollback production
git reset --hard <previous-commit> && git push --force origin main

# Force ECS restart
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region us-east-1

# View logs
aws logs tail /ecs/edsteward-multi-tenant-staging --follow --region us-east-1
```

---

## **Environment URLs**

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production** | https://moravian.edsteward.ai | Live Moravian tenant |
| **Staging** | https://staging.edsteward.ai | Testing environment |
| **Admin** | https://admin.edsteward.ai | Admin interface |
| **Dev** | https://dev.edsteward.ai | Development (optional) |

**Login**: `dvdbrnds` / `gabadhgabadh`

---

## **Branch → Environment Mapping**

| Branch | Environment | Deployment Method |
|--------|-------------|-------------------|
| `main` | Production (moravian.edsteward.ai) | `./scripts/deploy-production.sh` |
| `ES-clientside` | Staging (staging.edsteward.ai) | `./scripts/deploy-staging.sh` |
| `dev` | Dev (dev.edsteward.ai) | `./scripts/deploy-dev.sh` |

---

## **Deployment Workflow**

### **Standard Feature Development**
1. **Work on staging**: `git checkout ES-clientside`
2. **Make changes**: Code, test, commit
3. **Deploy to staging**: `./scripts/deploy-staging.sh` 
4. **Test staging**: Visit https://staging.edsteward.ai
5. **Deploy to production**: Merge to `main` and push

### **Hotfix Process**
1. **Create hotfix branch**: `git checkout -b hotfix/issue`
2. **Deploy to staging first**: Merge to `ES-clientside`
3. **Test on staging**: Verify fix works
4. **Deploy to production**: Merge to `main`

---

## **Monitoring & Troubleshooting**

### **Key Monitoring URLs**
- **AWS Deployment Status**: ./scripts/check-production-status.sh
- **AWS ECS Console**: https://console.aws.amazon.com/ecs/home?region=us-east-1
- **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups

### **Common Issues**
| Issue | Quick Fix |
|-------|-----------|
| 503/504 errors | Force ECS restart |
| Deployment fails | Check deployment script logs |
| New tenant not working | Verify CNAME and database config |
| SSL issues | Check ACM certificate status |

---

## **Success Indicators**
- ✅ AWS deployment script completes successfully
- ✅ Health endpoints return HTTP 200
- ✅ Application loads in browser
- ✅ Login works with `dvdbrnds` / `gabadhgabadh`

---

## **Support Files**
- **Full Guide**: `docs/EDSTEWARD_DEPLOYMENT_WORKFLOW.md`
- **CNAME Strategy**: `docs/CNAME_DEPLOYMENT_STRATEGY.md`
- **Tenant Setup**: `docs/NEW_TENANT_SETUP_GUIDE.md`
- **Health Script**: `scripts/health-check-all.sh`
- **Tenant Script**: `scripts/add-new-tenant.sh`

---

**🎯 Your deployment workflow is enterprise-ready with zero-downtime deployments!** 