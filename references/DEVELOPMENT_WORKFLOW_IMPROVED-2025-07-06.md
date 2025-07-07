# 🛡️ **EdSteward Development Workflow - Post Auth Crisis**

> **Lessons Learned**: Emergency fixes can break more than they solve. This workflow prevents future crises through proper testing and staged deployment.

## 🎯 **Core Principles**

1. **Never skip local testing** - Catch issues before they reach AWS
2. **Test authentication patterns** - Prevent auth inconsistencies 
3. **Always have rollback plans** - Emergency procedures documented
4. **Check server logs first** - Debug systematically, not frantically
5. **Simple solutions preferred** - Avoid complex fixes under pressure

## 🚀 **The Five-Stage Development Process**

### **Stage 1: Local Development** (Hot Reloading)
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Your app runs at: http://localhost:3000
# Changes appear instantly - no rebuilds needed!
```

**What to do:**
- ✅ Make your code changes
- ✅ Test in browser immediately
- ✅ Verify functionality works
- ✅ Check browser console for errors

### **Stage 2: Local Staging** (Production-like Testing)
```bash
# Test in production-like environment
make -f Makefile.local staging

# Wait for: "✅ Staging environment ready for testing!"
# Test at: http://localhost:3000
```

**Critical Testing Checklist:**
- [ ] **Authentication flows work correctly**
- [ ] **API endpoints return expected responses**
- [ ] **No 401 errors in browser console**
- [ ] **Database queries succeed**
- [ ] **Multi-tenant functionality works**

```bash
# Run automated API tests
npm run test:api

# If tests pass, approve for AWS deployment
make -f Makefile.local staging-approve
```

### **Stage 3: Dev Environment** (AWS Integration Testing)
```bash
# Deploy to dev environment
git add .
git commit -m "Feature: your description"
git push origin dev

# Monitor deployment
# URL: https://dev.edsteward.ai
```

**Verification Steps:**
- ✅ GitHub Actions completes successfully
- ✅ Health check returns 200 OK
- ✅ Authentication works with real AWS infrastructure
- ✅ Database connections stable
- ✅ No errors in CloudWatch logs

### **Stage 4: Staging Environment** (Final Verification)
```bash
# Deploy to staging
git checkout ES-clientside
git merge dev
git push origin ES-clientside

# Monitor deployment
# URL: https://staging.edsteward.ai
```

**Final Testing Checklist:**
- [ ] **All critical user paths work**
- [ ] **Performance is acceptable**
- [ ] **Security checks pass**
- [ ] **Multi-tenant isolation verified**
- [ ] **Rollback plan confirmed**

### **Stage 5: Production Deployment** (Live Release)
```bash
# Deploy to production
git checkout main
git merge ES-clientside
git push origin main

# Monitor deployment
# URL: https://moravian.edsteward.ai
```

**Post-Deployment Monitoring:**
- ✅ Health checks passing
- ✅ No error spikes in logs
- ✅ User authentication working
- ✅ Database performance stable

## 🚨 **Emergency Procedures**

### **If Deployment Fails:**
```bash
# Option 1: Quick rollback via GitHub
git revert HEAD
git push origin main

# Option 2: Manual rollback via AWS
./scripts/deploy-manual.sh production

# Option 3: Emergency rollback script
./emergency-rollback.sh
```

### **If Authentication Issues Occur:**
1. **Check server logs FIRST**: `aws logs tail /ecs/edsteward --region us-east-1`
2. **Compare working vs broken endpoints**
3. **Look for authentication middleware inconsistencies**
4. **Apply simple fixes, not complex ones**

### **Health Check Commands:**
```bash
# Check all environments
curl -I https://dev.edsteward.ai/health
curl -I https://staging.edsteward.ai/health  
curl -I https://moravian.edsteward.ai/health

# Check API endpoints
npm run test:api TEST_URL=https://staging.edsteward.ai
```

## 🛠️ **Development Commands Reference**

### **Local Development:**
```bash
# Start development
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop development
docker-compose -f docker-compose.dev.yml down
```

### **Local Staging:**
```bash
# Start staging
make -f Makefile.local staging

# Run tests
npm run test:api

# Approve for AWS
make -f Makefile.local staging-approve

# Stop staging
make -f Makefile.local staging-stop
```

### **AWS Deployments:**
```bash
# Dev environment
git push origin dev

# Staging environment  
git push origin ES-clientside

# Production environment
git push origin main

# Manual deployment (fallback)
./scripts/deploy-manual.sh [staging|production]
```

## 📊 **Quality Gates**

### **Before Each Stage:**
- [ ] All tests pass: `npm test`
- [ ] Code builds successfully: `npm run build`
- [ ] API endpoints tested: `npm run test:api`
- [ ] No linting errors: `npm run lint`

### **Before Production:**
- [ ] Staging environment fully tested
- [ ] Performance verified
- [ ] Security checks complete
- [ ] Rollback plan documented
- [ ] Team notification sent

## 🎯 **Success Metrics**

- **Zero emergency fixes** - All issues caught in testing
- **< 5 minute deployments** - Automated pipeline efficiency
- **100% uptime** - Proper testing prevents outages
- **No authentication inconsistencies** - Comprehensive API testing

## 🔄 **Continuous Improvement**

### **Weekly Reviews:**
- Analyze any deployment issues
- Update tests based on new features
- Review and improve documentation
- Test emergency procedures

### **Monthly Assessments:**
- Pipeline performance analysis
- Security audit of workflow
- Team training on new procedures
- Tool and process improvements

---

## 🎉 **Benefits of This Workflow**

✅ **Prevents Emergency Situations** - Issues caught early
✅ **Maintains Code Quality** - Multiple testing stages  
✅ **Enables Rapid Development** - Hot reloading + automation
✅ **Provides Safety Nets** - Rollback procedures at every stage
✅ **Builds Team Confidence** - Reliable, predictable process

---

**Remember**: The authentication crisis taught us that rushing leads to bigger problems. This workflow prioritizes safety and quality while still enabling rapid feature development. 