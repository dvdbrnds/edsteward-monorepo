# 🏗️ Staging Environment Architecture & Tenant Versioning

## 📋 **What's in Staging vs Production**

### 🔍 **Code Deployment:**
- **Staging**: Uses the **SAME CODEBASE** as production
- **Difference**: Different Git branches trigger different environments
  - `ES-clientside` branch → **staging.edsteward.ai**
  - `main` branch → **edsteward.ai** (production)

### 🗄️ **Database Architecture:**
Your system uses **multi-tenant database isolation**:

```
🏢 TENANT REGISTRY (Code-level):
├── admin: EdSteward Admin (edsteward.ai)
├── moravian: Moravian University (moravian.edu) 
└── [Dynamic tenants can be added]

💾 DATABASE CONFIGS (Environment-level):
├── admin: Uses ADMIN_DATABASE_URL
├── moravian: Uses MORAVIAN_DATABASE_URL
├── test: Uses TEST_DATABASE_URL
└── staging: Uses STAGING_DATABASE_URL
```

## 🎯 **How Staging Works Currently**

### 🔧 **Staging Configuration:**
- **URL**: https://staging.edsteward.ai/
- **Tenant Detection**: Subdomain `staging` → Maps to `admin` tenant
- **Database**: Uses `STAGING_DATABASE_URL` (separate from production)
- **Code**: Latest from `ES-clientside` branch

### 🔄 **Update Flow:**
```
1. Push to ES-clientside → GitHub Actions builds → ECR staging-latest
2. ECS staging service updates automatically  
3. staging.edsteward.ai serves new code within ~3 minutes
```

## 🏢 **Tenant Versioning Capabilities**

### ✅ **What You CAN Do:**

1. **Environment-Level Versioning:**
   - Staging can run different code than production
   - Each environment gets separate Docker images
   - Database schemas can differ between environments

2. **Tenant-Specific Databases:**
   - Each tenant has its own database URL
   - Data is completely isolated between tenants
   - Can have different database schemas per tenant

3. **Feature Flags per Tenant:**
   - Tenant configs support custom settings
   - Can enable/disable features per tenant
   - SAML configs are tenant-specific

### ❌ **What You CANNOT Do (Currently):**

1. **Code-Level Tenant Versioning:**
   - All tenants in same environment run same code
   - Can't have moravian.edsteward.ai on v1.0 and admin.edsteward.ai on v2.0
   - Single Docker image serves all tenants

## 🚀 **How to Implement Tenant-Specific Versions**

If you want different tenants to run different code versions:

### Option 1: Environment-Based Separation
```
staging.edsteward.ai (v2.0-beta)
moravian-staging.edsteward.ai (v1.5-stable)  
admin.edsteward.ai (v2.0-production)
```

### Option 2: Feature Flag System
```typescript
// In your code
if (tenantConfig.features?.includes('newDashboard')) {
  return <NewDashboard />
} else {
  return <LegacyDashboard />
}
```

### Option 3: Microservice Architecture
```
tenant-router → moravian-service (v1.0)
              → admin-service (v2.0)
              → staging-service (v2.1-beta)
```

## 📊 **Current Deployment Summary**

| Environment | Branch | URL | Tenants | Database |
|-------------|--------|-----|---------|----------|
| **Staging** | ES-clientside | staging.edsteward.ai | admin (staging DB) | Separate staging DB |
| **Production** | main | edsteward.ai | admin, moravian | Production DBs |

## 🎯 **Recommended Workflow**

1. **Development**: Work on `ES-clientside` branch
2. **Testing**: Deploy automatically to staging.edsteward.ai
3. **Validation**: Test with staging database (isolated)
4. **Production**: Merge to `main` → Auto-deploy to production

## 🔧 **Adding New Tenants**

To add a new tenant with its own version:

1. **Add tenant config** in `tenantDetection.ts`
2. **Add database config** in `multi-tenant-database.ts`
3. **Set environment variables** for tenant's database URL
4. **Optional**: Create separate staging environment for tenant

Your current architecture is **environment-based versioning** - perfect for testing new features before production! 🎉 