# Single-Tenant Transition Plan

## 🎯 **Current Multi-Tenant Architecture Analysis**

### **What We Have:**
- **Database-per-tenant**: Each tenant has isolated database (edsteward_admin, edsteward_moravian, etc.)
- **Subdomain routing**: moravian.edsteward.ai, admin.edsteward.ai
- **Multi-tenant middleware**: Tenant detection via subdomain
- **SAML + Username/Password**: Both auth methods supported
- **Feature flags**: Per-tenant customization
- **Working Moravian tenant**: Fully functional at moravian.edsteward.ai

### **What You Want:**
- **Single-tenant on-premises**: Complete isolation per deployment
- **Customizable UI**: Institution-specific branding and features
- **Flexible authentication**: SAML, username/password, or other methods
- **Complete independence**: No shared infrastructure

---

## 🚀 **Transition Options (Safest → Riskiest)**

### **Option 1: Gradual Branch-Based Transition (RECOMMENDED)**

**Time**: 1-2 weeks | **Risk**: Low | **Rollback**: Easy

```bash
# 1. Create single-tenant branch
git checkout -b single-tenant-extraction
git push -u origin single-tenant-extraction

# 2. Extract Moravian configuration
./scripts/extract-moravian-config.sh

# 3. Remove multi-tenant complexity
./scripts/convert-to-single-tenant.sh

# 4. Test thoroughly
./scripts/test-single-tenant.sh

# 5. Package for deployment
./scripts/package-on-premises.sh
```

**Pros:**
- ✅ Keep existing multi-tenant system intact
- ✅ Can develop and test in parallel
- ✅ Easy rollback if issues arise
- ✅ Gradual validation of each step

**Cons:**
- ⚠️ Maintains two codebases temporarily
- ⚠️ Requires testing both versions

### **Option 2: Environment-Based Single-Tenant**

**Time**: 3-5 days | **Risk**: Medium | **Rollback**: Moderate

Create a single-tenant environment variable that disables multi-tenant features:

```bash
# Set single-tenant mode
export SINGLE_TENANT_MODE=true
export TENANT_NAME="Moravian University"
export TENANT_DATABASE_URL="postgresql://..."
```

**Pros:**
- ✅ Minimal code changes
- ✅ Can toggle between modes
- ✅ Faster implementation

**Cons:**
- ⚠️ Code complexity remains
- ⚠️ Not truly single-tenant

### **Option 3: Clean Slate Approach**

**Time**: 2-4 weeks | **Risk**: High | **Rollback**: Difficult

Start fresh with single-tenant architecture from day one.

**Pros:**
- ✅ Clean, simple codebase
- ✅ No multi-tenant baggage

**Cons:**
- ❌ High risk of breaking existing functionality
- ❌ Significant development time
- ❌ Difficult to validate against working system

---

## 🔧 **Recommended Implementation: Option 1**

### **Phase 1: Preparation (1-2 days)**

#### **1.1 Backup Current State**
```bash
# Backup databases
pg_dump edsteward_moravian > moravian_backup.sql
pg_dump edsteward_admin > admin_backup.sql

# Backup configuration
cp -r server/config server/config.backup
cp -r server/middleware server/middleware.backup
```

#### **1.2 Create Development Branch**
```bash
git checkout -b single-tenant-v1
git push -u origin single-tenant-v1
```

#### **1.3 Extract Moravian Configuration**
```bash
# Extract all Moravian-specific settings
./scripts/extract-moravian-config.sh
```

### **Phase 2: Core Simplification (3-5 days)**

#### **2.1 Remove Multi-Tenant Middleware**
Remove or simplify:
- `server/middleware/tenant.ts`
- `server/services/multi-tenant-database.ts`
- `server/services/tenantStorage.ts`

#### **2.2 Simplify Database Layer**
Replace multi-tenant database service with single connection:
```typescript
// Instead of: MultiTenantDatabaseService.getTenantStorage(tenantId)
// Use: DatabaseService.getConnection()
```

#### **2.3 Simplify Authentication**
Keep both SAML and username/password but remove tenant context:
- Simplify `server/auth/saml.ts`
- Remove tenant-specific SAML routing
- Keep flexible auth configuration

### **Phase 3: Configuration System (2-3 days)**

#### **3.1 Environment-Based Configuration**
```bash
# Institution Configuration
INSTITUTION_NAME="Moravian University"
INSTITUTION_DOMAIN="moravian.edu"
INSTITUTION_LOGO_URL="https://..."
INSTITUTION_PRIMARY_COLOR="#003366"

# Authentication Configuration
AUTH_SAML_ENABLED=true
AUTH_SAML_ENTITY_ID="https://..."
AUTH_SAML_SSO_URL="https://..."
AUTH_USERNAME_PASSWORD_ENABLED=true

# Database Configuration
DATABASE_URL="postgresql://..."
```

#### **3.2 UI Customization System**
```typescript
// Single configuration file
export const institutionConfig = {
  name: process.env.INSTITUTION_NAME,
  domain: process.env.INSTITUTION_DOMAIN,
  branding: {
    logo: process.env.INSTITUTION_LOGO_URL,
    primaryColor: process.env.INSTITUTION_PRIMARY_COLOR,
    // ... other branding options
  },
  features: {
    samlEnabled: process.env.AUTH_SAML_ENABLED === 'true',
    usernamePasswordEnabled: process.env.AUTH_USERNAME_PASSWORD_ENABLED === 'true',
    // ... other features
  }
};
```

### **Phase 4: Deployment Package (1-2 days)**

#### **4.1 Docker Compose for On-Premises**
```yaml
version: '3.8'
services:
  app:
    image: edsteward-single-tenant:latest
    environment:
      - INSTITUTION_NAME=Moravian University
      - DATABASE_URL=postgresql://postgres:password@db:5432/edsteward
      - AUTH_SAML_ENABLED=true
      # ... other config
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=edsteward
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### **4.2 Configuration Management**
```bash
# .env.example for institutions
INSTITUTION_NAME="Your Institution"
INSTITUTION_DOMAIN="yourdomain.edu"
INSTITUTION_LOGO_URL="https://yourdomain.edu/logo.png"
INSTITUTION_PRIMARY_COLOR="#003366"

# Authentication
AUTH_SAML_ENABLED=true
AUTH_SAML_ENTITY_ID="https://your-saml-provider.com"
AUTH_SAML_SSO_URL="https://your-saml-provider.com/sso"
AUTH_USERNAME_PASSWORD_ENABLED=true

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/edsteward"
```

---

## 📦 **Deployment Package Structure**

```
edsteward-onpremises/
├── docker-compose.yml
├── .env.example
├── README.md
├── scripts/
│   ├── setup.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── update.sh
├── config/
│   ├── nginx.conf
│   ├── ssl/
│   └── branding/
├── data/
│   ├── postgres/
│   ├── uploads/
│   └── backups/
└── docs/
    ├── INSTALLATION.md
    ├── CONFIGURATION.md
    └── MAINTENANCE.md
```

---

## 🔒 **Security & Backup Considerations**

### **Data Migration**
```bash
# Export Moravian data
pg_dump edsteward_moravian > moravian_export.sql

# Import to single-tenant database
psql -d edsteward_single < moravian_export.sql
```

### **Authentication Migration**
- Keep existing SAML configuration
- Maintain username/password fallback
- Ensure admin access is preserved

### **Rollback Plan**
```bash
# Quick rollback to multi-tenant
git checkout main
./scripts/deploy-app.sh

# Or restore from backup
./scripts/restore-backup.sh moravian_backup.sql
```

---

## 🎯 **Success Criteria**

### **Phase 1 Complete When:**
- ✅ Moravian configuration extracted
- ✅ Development branch created
- ✅ Backups completed

### **Phase 2 Complete When:**
- ✅ Application runs without tenant middleware
- ✅ Database connections simplified
- ✅ Authentication works for single institution

### **Phase 3 Complete When:**
- ✅ UI customization via environment variables
- ✅ Branding system working
- ✅ Feature toggles functional

### **Phase 4 Complete When:**
- ✅ Docker Compose deployment working
- ✅ Full on-premises package ready
- ✅ Documentation complete

---

## 🚀 **Next Steps**

1. **Review this plan** and confirm approach
2. **Start with Phase 1** (preparation and backup)
3. **Create development branch** for single-tenant work
4. **Extract Moravian configuration** as baseline
5. **Begin systematic simplification**

**Estimated Timeline:** 1-2 weeks for complete transition
**Risk Level:** Low (with proper backup and branch strategy)
**Rollback Time:** < 1 hour if issues arise 