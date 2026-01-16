# 🚨 Production Crisis Prevention - Quick Reference

## Emergency Contact Information
**Last Updated**: January 6, 2025  
**Status**: Production restored after 48-hour outage

---

## 🔥 EMERGENCY RESPONSE (If production is down)

### Step 1: Quick Diagnosis
```bash
# If you see this error, production is broken:
# "No database configuration found for tenant: 3a1cbce2-0cf8-4c4f-ab96-4023eca4977d"
```

### Step 2: Emergency Deployment (5 minutes)
```bash
python3 emergency-deploy.py
```

### Step 3: Verify Fix
Visit: https://moravian.edsteward.ai (should work within 3 minutes)

---

## 📚 Critical Documentation

| File | Purpose |
|------|---------|
| [`CRITICAL_PRODUCTION_RUNBOOK.md`](./CRITICAL_PRODUCTION_RUNBOOK.md) | Complete emergency procedures and troubleshooting |
| [`verify-production-config.py`](./verify-production-config.py) | Verification script - run before ANY deployment |
| [`production-emergency-deploy.json`](./production-emergency-deploy.json) | Working task definition with correct configuration |
| [`emergency-deploy.py`](./emergency-deploy.py) | Emergency deployment script (proven working) |

---

## ⚡ Pre-Deployment Checklist

**ALWAYS run this before ANY production changes:**
```bash
python3 verify-production-config.py
```

If it fails, **DO NOT DEPLOY** until issues are fixed.

---

## 🎯 Critical Values (NEVER CHANGE)

| Item | Value | Notes |
|------|-------|-------|
| Neon Password | `npg_foSr6ixkzw7W` | Changing this breaks production |
| UUID Mapping | `3a1cbce2-0cf8-4c4f-ab96-4023eca4977d` → `moravian` | Embedded in auth tokens |
| Cluster | `edsteward-cluster` | ECS cluster name |
| Service | `edsteward-service` | ECS service name |

---

## 📞 Emergency Commands

```bash
# Verify configuration
python3 verify-production-config.py

# Emergency deployment
python3 emergency-deploy.py

# Check ECS status
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1

# Test production
curl https://moravian.edsteward.ai/health
```

---

**🔥 Remember: This documentation was created after a 48-hour production outage. Follow it exactly to prevent future incidents.** 