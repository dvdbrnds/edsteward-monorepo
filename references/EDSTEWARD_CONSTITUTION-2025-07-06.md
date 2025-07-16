# 📜 EdSteward Constitution
**The Definitive Reference Document**

*Version: 2.0*  
*Last Updated: July 1, 2025*  
*Status: ✅ AUTHORITATIVE - Always reference this document*

---

## 🎯 **MISSION STATEMENT**

**EdSteward is a multi-tenant SaaS platform that provides regulatory compliance tracking for higher education institutions, built on a database-per-tenant architecture with complete data isolation.**

---

## 🏛️ **ARCHITECTURAL FOUNDATIONS**

### **Core Architecture: Database-Per-Tenant**
- **Pattern**: Complete physical database isolation per tenant
- **Security**: Maximum data isolation and compliance guarantee
- **Scalability**: Dedicated resources per tenant
- **Compliance**: Meets highest security and privacy standards

### **Technology Stack**
```
Frontend: React + TypeScript + Tailwind CSS + Vite
Backend: Node.js + Express + TypeScript
Database: PostgreSQL (AWS RDS + Neon) 
Auth: Passport.js + SAML + Local Authentication
Infrastructure: AWS ECS + Docker + GitHub Actions
Monitoring: Structured logging + Health checks
```

### **Domain Architecture**
```
Production: https://edsteward.ai
  ├── admin.edsteward.ai     → Admin Console
  ├── moravian.edsteward.ai  → Moravian University
  └── staging.edsteward.ai   → Staging Environment

Development: https://edsteward.local
  ├── admin.edsteward.local  → Local Admin
  ├── moravian.edsteward.local → Local Moravian
  └── test.edsteward.local   → Test Environment
```

---

## 🏢 **CURRENT TENANT REGISTRY**

### **Configured Tenants**

#### **1. Admin Tenant** (`admin`)
```json
{
  "id": "admin",
  "name": "EdSteward Admin Console",
  "subdomain": "admin",
  "domain": "edsteward.ai",
  "databaseName": "edsteward_admin",
  "status": "active",
  "features": {
    "maxUsers": 1000,
    "maxRegulations": 10000,
    "apiAccess": true,
    "customDomain": true,
    "ssoEnabled": true
  },
  "role": "Vendor admin console for system management"
}
```

#### **2. Moravian University** (`moravian`)
```json
{
  "id": "moravian",
  "name": "Moravian University", 
  "subdomain": "moravian",
  "domain": "moravian.edu",
  "databaseName": "edsteward_moravian",
  "status": "active",
  "features": {
    "maxUsers": 500,
    "maxRegulations": 5000,
    "ssoEnabled": true,
    "institutionType": ["private-universities", "religious-institutions"]
  },
  "role": "Production customer - Private university"
}
```

#### **3. Staging Environment** (`staging`)
```json
{
  "id": "staging",
  "name": "EdSteward Staging Environment",
  "subdomain": "staging", 
  "domain": "staging.edsteward.ai",
  "databaseName": "edsteward_staging",
  "status": "active",
  "features": {
    "maxUsers": 1000,
    "maxRegulations": 10000,
    "ssoEnabled": false
  },
  "role": "Pre-production testing environment"
}
```

#### **4. Test Environment** (`test`)
```json
{
  "id": "test",
  "name": "EdSteward Test Environment",
  "subdomain": "test",
  "domain": "test.edsteward.local", 
  "databaseName": "edsteward_test",
  "status": "active",
  "features": {
    "maxUsers": 100,
    "maxRegulations": 1000,
    "ssoEnabled": false
  },
  "role": "Development and integration testing"
}
```

---

## 🔐 **AUTHENTICATION ARCHITECTURE**

### **Tenant-Aware Authentication System**
- **Local Authentication**: Username/password per tenant database
- **SAML SSO**: Tenant-specific Identity Provider configurations
- **User Isolation**: Complete user separation by tenant
- **Session Management**: Tenant context preserved in sessions

### **SAML Configuration**
```typescript
// Each tenant has unique SAML configuration
interface SamlConfig {
  entityId: string;           // "urn:edsteward:sp:{tenant-id}"
  ssoUrl: string;            // IdP SSO endpoint
  sloUrl?: string;           // IdP logout endpoint  
  certificate: string;       // IdP certificate
  attributeMapping: {        // Attribute mappings
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
}
```

### **Tenant Detection Flow**
```
1. Request → Extract Host → Detect Subdomain 
2. Database Lookup → Registry Fallback
3. Set Tenant Context → Validate Status
4. Continue with Authentication
```

---

## 🚀 **DEPLOYMENT ARCHITECTURE**

### **Environment Strategy**
```
Branch: main → Production (edsteward.ai)
Branch: ES-clientside → Staging (staging.edsteward.ai)
Local: Development (*.edsteward.local)
```

### **Infrastructure Components**
- **AWS ECS**: Container orchestration
- **AWS RDS**: Production PostgreSQL databases
- **Neon Database**: Development and staging databases
- **GitHub Actions**: AWS-only deployment pipeline
- **Docker**: Containerization
- **NGINX**: Reverse proxy and SSL termination

### **Deployment Pipeline**
```
1. Code Push → GitHub Actions Trigger
2. Docker Build → Push to ECR
3. ECS Service Update → Rolling Deployment
4. Health Checks → Traffic Routing
5. Monitoring → Rollback if needed
```

---

## 🛡️ **SECURITY & ISOLATION GUARANTEES**

### **Complete Data Isolation**
- ✅ **Database Separation**: Each tenant has dedicated database
- ✅ **User Isolation**: Users exist only within tenant scope
- ✅ **Session Isolation**: Tenant context preserved in sessions
- ✅ **File Isolation**: Tenant-scoped file storage and access
- ✅ **Network Isolation**: Subdomain-based routing

### **Authentication Security**
- ✅ **SAML Security**: Tenant-specific Identity Provider configs
- ✅ **Password Security**: Bcrypt hashing with salt
- ✅ **Session Security**: Secure session cookies with tenant context
- ✅ **CSRF Protection**: Cross-site request forgery protection
- ✅ **Input Validation**: SQL injection and XSS prevention

### **Infrastructure Security**
- ✅ **SSL/TLS**: HTTPS enforced for all tenant domains
- ✅ **Database Security**: Encrypted connections and credentials
- ✅ **Container Security**: Minimal Docker images with security patches
- ✅ **Network Security**: AWS VPC with security groups
- ✅ **Access Control**: IAM roles and policies

---

## 🔧 **OPERATIONAL PROCEDURES**

### **Adding New Tenants**
```bash
# 1. Add tenant to database
INSERT INTO tenants (id, name, subdomain, domain, status, settings)
VALUES ('new-tenant', 'New Tenant', 'new-tenant', 'new-tenant.com', 'active', '{}');

# 2. Create tenant database
CREATE DATABASE edsteward_new_tenant;

# 3. Configure DNS
aws route53 change-resource-record-sets --hosted-zone-id <zone-id> --change-batch '{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "new-tenant.edsteward.ai",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "<alb-dns-name>"}]
    }
  }]
}'

# 4. Configure SAML (if needed)
# Update tenant record with SAML configuration
```

### **Deployment Commands**
```bash
# Deploy to staging
git push origin ES-clientside

# Deploy to production  
git push origin main

# Check deployment status
kubectl get deployments
docker ps
```

### **Monitoring & Health Checks**
```bash
# Check tenant health
curl -s https://tenant.edsteward.ai/api/health | jq

# View logs
docker logs container-name

# Database health
psql $DATABASE_URL -c "SELECT 1"
```

---

## 📋 **DEVELOPMENT PRINCIPLES**

### **What Works ✅**
1. **Single Tenant Middleware**: Consolidated `server/middleware/tenant.ts`
2. **Database-Per-Tenant**: Complete isolation with dedicated databases
3. **Context7 Patterns**: Proper tenant detection and fallback chains
4. **Tenant-Aware Authentication**: SAML and local auth with tenant context
5. **Subdomain Routing**: Clean tenant identification via subdomains
6. **Docker Deployment**: Consistent containerized environments
7. **Health Monitoring**: Comprehensive system health checks

### **What Doesn't Work ❌** 
1. **Multiple Middleware Systems**: Dual middleware causes conflicts
2. **Shared Database with Tenant ID**: Logical isolation is insufficient
3. **Session Without Tenant Context**: Breaks multi-tenant functionality
4. **Hardcoded Tenant Logic**: Makes adding new tenants difficult
5. **Manual Configuration**: Increases deployment complexity
6. **Missing Health Checks**: Makes debugging difficult

### **Key Architectural Decisions**
- **Favor Physical Isolation**: Database-per-tenant over shared database
- **Prioritize Security**: Complete data isolation over convenience
- **Choose Simplicity**: Single middleware over complex routing
- **Embrace Standards**: SAML, OAuth2, and industry patterns
- **Document Everything**: Comprehensive documentation and logging

---

## 🔄 **FEATURE MANAGEMENT**

### **Tenant Feature Flags**
```typescript
interface TenantFeatures {
  maxUsers: number;
  maxRegulations: number;
  apiAccess: boolean;
  customDomain: boolean;
  ssoEnabled: boolean;
  institutionConfig?: {
    primaryTypes: string[];
    hideNonApplicable: boolean;
    allowUsersToToggle: boolean;
  };
}
```

### **Institution Types**
```typescript
const INSTITUTION_TYPES = [
  'public-universities',
  'private-universities', 
  'community-colleges',
  'religious-institutions',
  'for-profit-institutions',
  'vocational-schools'
];
```

---

## 📈 **SCALING CONSIDERATIONS**

### **Current Capacity**
- **Tenants**: 4 configured, easily expandable
- **Users**: Up to 1000 per tenant
- **Regulations**: Up to 10,000 per tenant
- **Concurrent Sessions**: Horizontally scalable

### **Scaling Strategy**
1. **Horizontal Scaling**: Add more ECS tasks
2. **Database Scaling**: Read replicas for high-traffic tenants
3. **CDN Integration**: Static asset caching
4. **Microservices**: Break out specific services if needed
5. **Multi-Region**: Geographic distribution for global tenants

---

## 🏆 **SUCCESS METRICS**

### **System Health**
- **Uptime**: 99.9%+ availability
- **Response Time**: <200ms for API calls
- **Database Performance**: <50ms query response
- **Authentication**: <500ms for SAML/local auth

### **Tenant Metrics**
- **User Growth**: Tracked per tenant
- **Feature Adoption**: Monitored via feature flags
- **Compliance Coverage**: Regulation tracking effectiveness
- **Customer Satisfaction**: NPS scores and feedback

---

## 🔮 **FUTURE ROADMAP**

### **Phase 1: Enhancement**
- Multi-region deployment
- Advanced analytics dashboard
- Bulk regulation import/export
- Enhanced SAML attribute mapping

### **Phase 2: Expansion**
- API-first architecture
- Webhook integrations
- Third-party compliance systems
- Mobile application

### **Phase 3: Scale**
- Multi-thousand tenant support
- Advanced AI/ML features
- Enterprise SSO integrations
- Compliance automation

---

## 🚨 **CRITICAL REMINDERS**

### **Always Remember**
1. **Every user belongs to exactly one tenant**
2. **Database queries must be tenant-aware**
3. **Sessions must maintain tenant context**
4. **SAML configurations are tenant-specific**
5. **Health checks must verify tenant isolation**

### **Never Do**
1. **Mix tenant data in queries**
2. **Ignore tenant context in middleware**
3. **Hardcode tenant-specific logic**
4. **Deploy without health checks**
5. **Modify production without staging tests**

---

## 📚 **REFERENCE LINKS**

### **Key Files**
- `server/middleware/tenant.ts` - Tenant detection and management
- `server/auth/tenant-saml.ts` - SAML authentication
- `server/config/database.ts` - Database configuration
- `client/src/components/admin/tenant-feature-manager.tsx` - Feature management
- `scripts/add-new-tenant.sh` - Tenant onboarding

### **Documentation**
- Architecture diagrams in `docs/`
- API documentation in `docs/api/`
- Deployment guides in `scripts/`
- Environment setup in `DEPLOYMENT_GUIDE.md`

---

**🎉 EdSteward Constitution - The foundation of our multi-tenant architecture**

*This document represents the current authoritative state of EdSteward's architecture. When in doubt, consult this constitution first.* 