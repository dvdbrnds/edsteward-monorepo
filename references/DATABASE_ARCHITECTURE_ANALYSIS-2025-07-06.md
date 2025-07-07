# 🏗️ EdSteward Database Architecture Analysis

## 🎯 CORRECTED UNDERSTANDING

You're absolutely right! The architecture is:

### 🔧 **Tenant Registry Database** (What we need to fix)
- **Type**: Neon Database (PostgreSQL)
- **Purpose**: Stores tenant definitions and metadata
- **Location**: `DATABASE_URL` in environment
- **Contains**: `tenants` table with tenant configurations
- **Current Issue**: Staging tenant record has wrong ID

### 🏢 **Individual Tenant Databases** (Working correctly)
- **Type**: Separate databases per tenant (Neon for each)
- **Purpose**: Store each tenant's actual data (regulations, users, etc.)
- **Configuration**: `server/services/multi-tenant-database.ts`
- **Environment Variables**:
  - `ADMIN_DATABASE_URL` → Admin tenant data
  - `MORAVIAN_DATABASE_URL` → Moravian tenant data  
  - `STAGING_DATABASE_URL` → Staging tenant data
  - `TEST_DATABASE_URL` → Test tenant data

## 🔍 **Root Cause Clarification**

The issue is in the **Tenant Registry Database** (Neon), NOT the individual tenant databases:

```
Tenant Registry Database (Neon):
┌─────────────────────────────────────────┐
│ tenants table:                          │
│ ┌─────────────────────────────────────┐ │
│ │ id: "admin"          ❌ WRONG       │ │
│ │ subdomain: "staging" ✅ CORRECT     │ │
│ │ name: "EdSteward Staging Env"       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🛠️ **Corrected Fix Approach**

The database we need to fix is the **Neon tenant registry database**, not RDS.

### Current Environment Detection:
```bash
# Check what database is being used for tenant registry
curl -s https://staging.edsteward.ai/api/health | jq .tenant
```

Result:
```json
{
  "tenantId": "admin",           // ❌ Wrong (should be "staging")
  "subdomain": "staging",        // ✅ Correct  
  "tenantName": "EdSteward Staging Environment"
}
```

## 🎯 **Updated Fix Strategy**

Since we're using **Neon Database** for the tenant registry:

### Option 1: Neon Console (Recommended)
1. Go to [Neon Console](https://console.neon.tech/)
2. Find your tenant registry database
3. Use SQL Editor to execute:

```sql
-- Fix the staging tenant record
DELETE FROM tenants WHERE subdomain = 'staging' AND id != 'staging';

INSERT INTO tenants (
  id, name, domain, subdomain, database_name, status, settings, created_at, updated_at
) VALUES (
  'staging',
  'EdSteward Staging Environment', 
  'staging.edsteward.ai',
  'staging',
  'edsteward_staging',
  'active',
  '{"allowedDomains": ["edsteward.ai", "staging.edsteward.ai"], "defaultRole": "admin", "enableAutoProvisioning": true, "features": {"apiAccess": true, "customDomain": false, "ssoEnabled": false, "maxUsers": 1000, "maxRegulations": 10000}}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  updated_at = NOW();
```

### Option 2: Local Script with Correct Credentials
Update the database fix script to use the correct Neon credentials:

```javascript
// Use the actual Neon DATABASE_URL for tenant registry
const DATABASE_URL = process.env.DATABASE_URL; // Neon database
```

### Option 3: Production Server
SSH to production server and run the fix scripts there.

## 🔍 **Verification**

After fixing the tenant registry:

```bash
curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId
# Expected: "staging" ✅
```

## 📊 **Architecture Summary**

```
┌─────────────────────────────────────────────────────────────────┐
│                     EdSteward Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔧 Tenant Registry (Neon)     🏢 Individual Tenant DBs        │
│  ┌─────────────────────────┐   ┌─────────────────────────────┐  │
│  │ tenants table:          │   │ admin DB (Neon)             │  │
│  │ - id, subdomain, etc    │   │ moravian DB (Neon)          │  │
│  │ - tenant configs        │   │ staging DB (Neon)           │  │
│  │                         │   │ test DB (Neon)              │  │
│  │ ❌ NEEDS FIX HERE       │   │ ✅ Working correctly        │  │
│  └─────────────────────────┘   └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 **Next Steps**

1. **Access Neon Console** for the tenant registry database
2. **Execute SQL fix** in the tenant registry (not individual tenant DBs)
3. **Verify** that `staging.edsteward.ai` returns `tenantId: "staging"`

The individual tenant databases (where the 367 regulations live) are working perfectly. We just need to fix the tenant registry so the staging subdomain maps to the correct tenant ID.

---

**Key Insight**: We were trying to fix the wrong database! The issue is in the Neon tenant registry, not in RDS or the individual tenant data databases. 