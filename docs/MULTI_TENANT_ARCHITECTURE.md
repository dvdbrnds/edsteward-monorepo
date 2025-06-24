# Multi-Tenant Architecture Documentation

## Overview

RegulatoryTrackr implements a **database-per-tenant** multi-tenancy model that ensures complete data isolation between customers. Each tenant operates with their own dedicated database, providing maximum security, compliance, and performance isolation.

## Architecture Components

### 1. Tenant Detection and Routing

The system identifies tenants through subdomain-based routing:

- **Admin Console**: `admin.edsteward.local` / `admin.edsteward.ai`
- **Moravian University**: `moravian.edsteward.local` / `moravian.edsteward.ai`
- **Test Environment**: `test.edsteward.local` / `test.edsteward.ai`

#### Tenant Middleware (`server/middleware/tenant.ts`)

```typescript
// Extracts tenant information from request subdomain
export function extractTenantFromRequest(req: Request): TenantInfo {
  const host = req.get('host') || '';
  const subdomain = host.split('.')[0];
  
  return {
    subdomain,
    tenantId: mapSubdomainToTenantId(subdomain),
    isValid: VALID_SUBDOMAINS.includes(subdomain)
  };
}
```

### 2. Database-Per-Tenant Model

Each tenant has a completely isolated database with dedicated connection pools:

#### Database Configuration

```bash
# Environment Variables
ADMIN_DATABASE_URL=postgresql://user:pass@host/edsteward_admin
MORAVIAN_DATABASE_URL=postgresql://user:pass@host/edsteward_moravian  
TEST_DATABASE_URL=postgresql://user:pass@host/edsteward_test
```

#### Multi-Tenant Database Service (`server/services/multi-tenant-database.ts`)

```typescript
export class MultiTenantDatabaseService {
  static getTenantStorage(tenantId: string): DatabaseStorage {
    // Returns tenant-specific database connection and storage
    const pool = this.getTenantPool(tenantId);
    const db = drizzle(pool);
    return new DatabaseStorage(db);
  }
}
```

### 3. **Tenant-Aware Authentication System**

#### Complete User Isolation

All user authentication and management operations are now tenant-aware, ensuring complete isolation:

**Authentication Features:**
- **Local Authentication**: Username/password login isolated per tenant
- **SAML Authentication**: Tenant-specific SAML configurations and user provisioning
- **User Registration**: Users created within tenant boundaries only
- **Session Management**: Tenant context preserved in user sessions

#### Updated Authentication Flow (`server/auth.ts`)

```typescript
// Tenant-aware storage selection
function getTenantAwareStorage(req: any) {
  const tenantId = req.tenantId || req.tenant?.id;
  return tenantId ? getTenantStorage(tenantId) : storage;
}

// Local authentication with tenant isolation
passport.use(new LocalStrategy({ passReqToCallback: true }, 
  async (req: any, username: string, password: string, done) => {
    const tenantStorage = getTenantAwareStorage(req);
    const user = await tenantStorage.getUserByUsername(username);
    // Authentication logic with tenant context
  }
));
```

#### SAML Authentication Isolation

**Tenant-Specific SAML** (`server/auth/tenant-saml.ts`):
- Each tenant has independent SAML configuration
- User provisioning scoped to tenant databases
- Attribute mapping per tenant requirements
- Domain validation for tenant access control

**Regular SAML** (`server/auth/saml.ts`):
- Updated to use tenant-aware storage
- User lookup and creation within tenant boundaries
- Tenant context preserved throughout SAML flow

#### User Management API Isolation

**Admin Routes** (`server/routes/api/admin.ts`):
```typescript
// All user operations are tenant-scoped
router.get('/users', requireAdmin, async (req, res) => {
  const tenantStorage = getTenantAwareStorage(req);
  const users = await tenantStorage.getAllUsers(); // Only tenant users
});

router.post('/create-user', requireAdmin, async (req, res) => {
  const tenantStorage = getTenantAwareStorage(req);
  // User created in tenant-specific database
  const newUser = await tenantStorage.createUser(userData);
});
```

#### Session and Security Features

- **Tenant Context in Sessions**: `req.session.tenantId` preserves tenant context
- **Cross-Tenant Protection**: Users cannot access other tenant data
- **Password Isolation**: Password resets scoped to tenant users
- **Role-Based Access**: Admin roles effective only within tenant scope

### 4. Admin Console Architecture

The admin console runs on the `admin` subdomain and provides vendor-level management:

#### Admin-Specific Routing (`client/src/App.tsx`)

```typescript
function isAdminSubdomain() {
  return window.location.hostname.startsWith('admin.');
}

// Admin console shows VendorAdminPage instead of tenant interface
if (isAdminSubdomain()) {
  return <VendorAdminPage />;
}
```

#### Admin Features

- **Tenant Management**: Create, configure, and monitor tenants
- **System Metrics**: Cross-tenant analytics and health monitoring  
- **Database Management**: Tenant database operations and maintenance
- **User Administration**: Vendor-level user management
- **Configuration**: System-wide settings and feature flags

### 5. Tenant Configuration

#### Tenant Registry (`server/middleware/tenant.ts`)

```typescript
const FALLBACK_TENANTS = {
  'admin': { id: 'admin', name: 'EdSteward Admin' },
  'moravian': { id: 'moravian', name: 'Moravian University' },
  'test': { id: 'test', name: 'Test Environment' }
};
```

#### NGINX Configuration (`nginx.conf`)

```nginx
# Tenant subdomain routing
server_name admin.edsteward.local moravian.edsteward.local test.edsteward.local;

location / {
  proxy_pass http://localhost:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Tenant-Subdomain $subdomain;
}
```

## Security and Isolation Guarantees

### 1. **Complete User Isolation**
- ✅ **Database Separation**: Each tenant has dedicated database
- ✅ **Authentication Isolation**: Users exist only within tenant scope
- ✅ **Session Isolation**: Tenant context preserved in sessions
- ✅ **SAML Isolation**: Tenant-specific identity provider configurations
- ✅ **Admin Isolation**: User management scoped to tenant boundaries

### 2. **Data Protection**
- ✅ **No Cross-Tenant Access**: Users cannot access other tenant data
- ✅ **Regulation Isolation**: Tenant-specific regulation storage
- ✅ **Evidence Files**: Tenant-scoped file storage and access
- ✅ **Audit Logs**: Tenant-specific logging and monitoring

### 3. **Network Security**
- ✅ **Subdomain Isolation**: Clear tenant boundaries via DNS
- ✅ **SSL/TLS**: Individual certificates per tenant subdomain
- ✅ **Firewall Rules**: Tenant-specific network access controls

## Development Setup

### 1. Local Environment Configuration

```bash
# Clone repository
git clone <repo-url>
cd RegulatoryTrackr

# Set up environment variables
cp .env.example .env

# Configure tenant databases
ADMIN_DATABASE_URL=postgresql://user:pass@localhost/edsteward_admin
MORAVIAN_DATABASE_URL=postgresql://user:pass@localhost/edsteward_moravian
TEST_DATABASE_URL=postgresql://user:pass@localhost/edsteward_test
```

### 2. Local Domain Setup

Add to `/etc/hosts`:
```
127.0.0.1 admin.edsteward.local
127.0.0.1 moravian.edsteward.local  
127.0.0.1 test.edsteward.local
```

### 3. Docker Development

```bash
# Start multi-tenant development environment
docker-compose -f docker-compose.dev.yml up

# Access tenant environments
# Admin: http://admin.edsteward.local
# Moravian: http://moravian.edsteward.local
# Test: http://test.edsteward.local
```

## Production Deployment

### 1. AWS ECS Configuration

Each tenant can be deployed with:
- Dedicated ECS tasks and services
- Independent auto-scaling policies
- Tenant-specific environment variables
- Isolated CloudWatch logging

### 2. Database Strategy

**Option A: Separate RDS Instances**
```bash
# Production tenant databases
ADMIN_DATABASE_URL=postgresql://admin:pass@admin-db.region.rds.amazonaws.com/edsteward
MORAVIAN_DATABASE_URL=postgresql://moravian:pass@moravian-db.region.rds.amazonaws.com/edsteward
```

**Option B: Single RDS with Multiple Databases**
```bash
# Shared RDS instance with tenant databases
ADMIN_DATABASE_URL=postgresql://user:pass@shared-db.region.rds.amazonaws.com/edsteward_admin
MORAVIAN_DATABASE_URL=postgresql://user:pass@shared-db.region.rds.amazonaws.com/edsteward_moravian
```

### 3. DNS and SSL

```bash
# Route 53 DNS records
admin.edsteward.ai -> ALB -> ECS Service
moravian.edsteward.ai -> ALB -> ECS Service
test.edsteward.ai -> ALB -> ECS Service

# ACM SSL certificates
*.edsteward.ai (wildcard certificate)
```

## Monitoring and Observability

### 1. Per-Tenant Metrics

```typescript
// Database connection health per tenant
const stats = await MultiTenantDatabaseService.getTenantDatabaseStats();
// Returns: { admin: { connections: 5, healthy: true }, ... }
```

### 2. Logging Strategy

- **Application Logs**: Tenant ID included in all log entries
- **Database Logs**: Separate log streams per tenant database
- **Authentication Logs**: Tenant-scoped auth events and security monitoring
- **Performance Metrics**: Per-tenant response times and resource usage

### 3. Health Checks

```typescript
// Test all tenant database connections
await MultiTenantDatabaseService.initializeAllTenants();

// Individual tenant health check
const isHealthy = await MultiTenantDatabaseService.testTenantConnection('moravian');
```

## Troubleshooting

### Common Issues

**1. Tenant Detection Problems**
```bash
# Check tenant middleware logs
grep "Tenant detected" logs/app.log

# Verify subdomain configuration
curl -H "Host: moravian.edsteward.local" http://localhost:3000/api/user
```

**2. Database Connection Issues**
```bash
# Test tenant database connectivity
node -e "
const { getTenantStorage } = require('./server/services/multi-tenant-database');
getTenantStorage('moravian').testConnection();
"
```

**3. Authentication Problems**
```bash
# Check tenant-aware auth logs
grep "tenant.*auth" logs/app.log

# Verify user isolation
psql $MORAVIAN_DATABASE_URL -c "SELECT id, username, email FROM users;"
psql $ADMIN_DATABASE_URL -c "SELECT id, username, email FROM users;"
```

### Performance Optimization

**1. Connection Pool Tuning**
```typescript
// Adjust per-tenant pool sizes based on usage
const TENANT_DATABASE_CONFIGS = {
  'admin': { poolConfig: { max: 10 } },      // High admin usage
  'moravian': { poolConfig: { max: 5 } },    // Medium usage  
  'test': { poolConfig: { max: 3 } }         // Low usage
};
```

**2. Query Optimization**
- Index tenant-specific queries appropriately
- Monitor slow queries per tenant database
- Implement tenant-specific caching strategies

## Migration and Scaling

### Adding New Tenants

1. **Database Setup**:
   ```sql
   CREATE DATABASE edsteward_newtenant;
   -- Run schema migrations
   ```

2. **Configuration**:
   ```typescript
   // Add to tenant registry
   MultiTenantDatabaseService.addTenantConfig('newtenant', DATABASE_URL);
   ```

3. **DNS Configuration**:
   ```bash
   # Add subdomain routing
   newtenant.edsteward.ai -> ALB -> ECS Service
   ```

### Tenant Migration

```typescript
// Migrate tenant between database instances
const sourceTenant = getTenantStorage('moravian');
const targetTenant = getTenantStorage('moravian-new');

await migrateTenantData(sourceTenant, targetTenant);
```

## Best Practices

### 1. **Security**
- ✅ Always validate tenant context in API requests
- ✅ Use tenant-aware storage for all data operations  
- ✅ Implement proper SAML validation per tenant
- ✅ Log all cross-tenant access attempts
- ✅ Regular security audits of tenant isolation

### 2. **Performance**
- ✅ Monitor database connections per tenant
- ✅ Implement tenant-specific caching
- ✅ Use appropriate connection pool sizes
- ✅ Scale tenant databases independently

### 3. **Development**
- ✅ Test with multiple tenant contexts
- ✅ Validate tenant isolation in all features
- ✅ Use tenant-aware development tools
- ✅ Document tenant-specific configurations

### 4. **Operations**
- ✅ Monitor tenant health independently  
- ✅ Implement tenant-specific backup strategies
- ✅ Plan for tenant-specific scaling needs
- ✅ Maintain tenant configuration documentation

---

This architecture ensures complete isolation between tenants while providing a scalable, maintainable multi-tenant SaaS platform with enterprise-grade security and compliance capabilities. 