# 🚨 CRITICAL PRODUCTION RUNBOOK - EdSteward

## Emergency Contact Information
**Date Created**: January 6, 2025  
**Last Updated**: January 6, 2025  
**Critical Issue**: 48-hour production outage resolved

---

## 🔥 EMERGENCY DEPLOYMENT PROCESS (PROVEN WORKING)

If `moravian.edsteward.ai` returns 500 errors with "No database configuration found for tenant", follow this exact process:

### 1. Immediate Diagnosis
```bash
# Check error format - if missing "(normalized: ...)" text, deployment failed
# Error: "No database configuration found for tenant: 3a1cbce2-0cf8-4c4f-ab96-4023eca4977d"
# Should be: "No database configuration found for tenant: 3a1cbce2-0cf8-4c4f-ab96-4023eca4977d (normalized: moravian)"
```

### 2. Emergency Deployment (3-5 minutes)
```bash
# Step 1: Build and push fixed image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker build --platform linux/amd64 -t 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest .
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest

# Step 2: Deploy emergency fix
python3 emergency-deploy.py
```

### 3. Verification (2-3 minutes after deployment)
```bash
# Test authentication should work
curl -X POST https://moravian.edsteward.ai/api/auth/login

# Test API should return data
curl https://moravian.edsteward.ai/api/regulations
```

---

## 🎯 CRITICAL CONFIGURATION VALUES

### ✅ CORRECT Neon Database Password
```
npg_foSr6ixkzw7W
```

### ❌ WRONG Password (caused 48-hour outage)
```
npg_ZhQkQoD3Oo2I  # This was in Terraform and broke everything
```

### ✅ CORRECT UUID Mapping
```typescript
const UUID_TENANT_MAPPING: Record<string, string> = {
  '3a1cbce2-0cf8-4c4f-ab96-4023eca4977d': 'moravian'
};
```

### ✅ CORRECT Database URL
```
postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## 📋 WORKING TASK DEFINITION

File: `production-emergency-deploy.json`
- **Image**: `259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest`
- **Cluster**: `edsteward-cluster`
- **Service**: `edsteward-service`
- **Environment**: `NODE_ENV=production`, `MULTI_TENANT=true`
- **Database**: Correct Neon URL with `npg_foSr6ixkzw7W` password

---

## 🚨 WHAT NEVER TO CHANGE

### 1. Database Password
- **NEVER** change `npg_foSr6ixkzw7W` without testing locally first
- **ALWAYS** verify in multiple config files (Terraform, task definitions, Docker Compose)

### 2. UUID Mapping
- **NEVER** remove UUID `3a1cbce2-0cf8-4c4f-ab96-4023eca4977d` → `moravian` mapping
- This UUID is embedded in production authentication tokens

### 3. Multi-Tenant Architecture
- **NEVER** disable `MULTI_TENANT=true` in production
- **NEVER** remove tenant database isolation

---

## 🔍 TROUBLESHOOTING GUIDE

### Symptom: 500 Authentication Error
```json
{"error":"Authentication error","details":"No database configuration found for tenant: 3a1cbce2-0cf8-4c4f-ab96-4023eca4977d"}
```

**Root Cause**: Either wrong Neon password or UUID mapping not working

**Solution**: Run emergency deployment process above

### Symptom: Login Page Loads but Login Fails
**Root Cause**: Database connection issue or wrong password

**Solution**: Check Neon password in task definition

### Symptom: GitHub Actions Not Deploying
**Root Cause**: Deployment pipeline stuck

**Solution**: Use manual emergency deployment, not GitHub Actions

---

## 📊 MONITORING

### Health Check URLs
- **Main**: https://moravian.edsteward.ai/health
- **Auth**: https://moravian.edsteward.ai/api/auth/status
- **API**: https://moravian.edsteward.ai/api/regulations

### AWS Monitoring
```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1

# Check task health
aws ecs list-tasks --cluster edsteward-cluster --service-name edsteward-service --region us-east-1
```

---

## 📝 LESSONS LEARNED

1. **GitHub Actions Can Fail**: Don't rely solely on GitHub Actions for emergency deployments
2. **Password Mismatches Kill Production**: Always verify passwords across all config files
3. **UUID Mapping is Critical**: The specific UUID must map to moravian tenant
4. **Manual Deployment Works**: Docker build + ECR push + ECS update is fastest recovery
5. **Test Immediately**: Production authentication should work within 3 minutes of deployment

---

## ⚡ QUICK REFERENCE

**Emergency Deployment**: `python3 emergency-deploy.py`  
**Correct Password**: `npg_foSr6ixkzw7W`  
**Cluster**: `edsteward-cluster`  
**Service**: `edsteward-service`  
**Test URL**: `https://moravian.edsteward.ai`

---

**🔥 REMEMBER: This exact process restored production after 48 hours of downtime. Do not deviate from it unless absolutely necessary.** 