# New Tenant Setup Guide
## Adding Tenants to EdSteward Platform

---

## 🎯 **Quick Answer**

**For new tenants**: You only need to add a **single CNAME record**. The application handles the rest automatically through your existing multi-tenant architecture.

---

## 🏗️ **EdSteward Multi-Tenant Architecture**

### **How It Works**
```
New Tenant Request → Add CNAME → Tenant Config → Ready!
```

Your platform already supports unlimited tenants through:
1. **Subdomain-based routing** (`{tenant}.edsteward.ai`)
2. **Dynamic tenant detection** (automatic)
3. **Shared ALB infrastructure** (efficient)
4. **Row-level security** (data isolation)

---

## 🚀 **Adding a New Tenant (3 Steps)**

### **Step 1: Add CNAME Record**

```bash
# For a new tenant called "university-xyz"
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0186546264I8JDBHPSR7 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "university-xyz.edsteward.ai",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "edsteward-alb-554701445.us-east-1.elb.amazonaws.com"}]
      }
    }]
  }'
```

**Or use the automated script:**
```bash
# Modify the script to add new tenant
./scripts/setup-cname-records.sh
```

### **Step 2: Configure Tenant in Database**

Your application will auto-detect the tenant, but you can pre-configure:

```sql
-- Connect to your database
INSERT INTO tenants (
  id, name, subdomain, domain, status, settings, created_at, updated_at
) VALUES (
  'university-xyz',
  'University XYZ',
  'university-xyz',
  'university-xyz.edu',
  'active',
  '{
    "allowedDomains": ["university-xyz.edu"],
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

### **Step 3: Test & Configure SAML (Optional)**

```bash
# Test the new tenant
curl -I https://university-xyz.edsteward.ai/health

# Should return HTTP 200 with tenant headers:
# x-tenant-id: university-xyz
# x-tenant-subdomain: university-xyz
# x-tenant-name: University XYZ
```

---

## 🎯 **What Happens Automatically**

### **✅ Already Working**
- **DNS Resolution**: CNAME → ALB → Application
- **SSL Certificate**: Wildcard `*.edsteward.ai` covers all subdomains
- **Load Balancing**: ALB routes based on Host header
- **Tenant Detection**: Middleware extracts tenant from subdomain
- **Data Isolation**: Row-level security in database

### **✅ No Additional Infrastructure Needed**
- Same ALB serves all tenants
- Same ECS cluster handles all traffic
- Same database with tenant isolation
- Same GitHub Actions pipeline

---

## 📊 **Tenant Management Workflow**

### **Current Tenants**
```bash
# Production tenants
✅ staging.edsteward.ai    (staging environment)
✅ moravian.edsteward.ai   (Moravian University)
✅ admin.edsteward.ai      (admin console)
✅ dev.edsteward.ai        (development environment)
```

### **Adding New Tenant**
```bash
# 1. Add CNAME (1 minute)
aws route53 change-resource-record-sets ...

# 2. Test immediately (DNS propagates in ~5 minutes)
curl -I https://newtenant.edsteward.ai/health

# 3. Configure SAML if needed
# 4. Done! Tenant is live
```

---

## 🔧 **Automated Tenant Onboarding Script**

Let's create an enhanced version of your existing script:

### **Enhanced Tenant Setup**

```bash
#!/bin/zsh
# Usage: ./scripts/add-new-tenant.sh <tenant-id> <tenant-name> <domain>

TENANT_ID="$1"
TENANT_NAME="$2"
TENANT_DOMAIN="$3"

# 1. Add CNAME record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0186546264I8JDBHPSR7 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "'$TENANT_ID'.edsteward.ai",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "edsteward-alb-554701445.us-east-1.elb.amazonaws.com"}]
      }
    }]
  }'

# 2. Wait for DNS propagation
echo "Waiting for DNS propagation..."
sleep 30

# 3. Test tenant access
echo "Testing tenant access..."
curl -I https://$TENANT_ID.edsteward.ai/health

echo "✅ Tenant $TENANT_NAME is ready at https://$TENANT_ID.edsteward.ai"
```

---

## 💰 **Cost Implications**

### **Per New Tenant**
- **DNS**: $0.50/month per hosted zone (if using custom domain)
- **CNAME**: $0 (unlimited CNAME records)
- **ALB**: $0 additional (shared infrastructure)
- **ECS**: $0 additional (shared compute)
- **SSL**: $0 additional (wildcard certificate)

### **Total Additional Cost per Tenant**: ~$0
*(Using subdomains of edsteward.ai)*

---

## 🎯 **Best Practices**

### **Tenant Naming Convention**
```bash
# Good examples
university-abc.edsteward.ai
college-xyz.edsteward.ai
school-district-123.edsteward.ai

# Avoid
university_abc.edsteward.ai  # underscores
UniversityABC.edsteward.ai   # uppercase
university.abc.edsteward.ai  # multiple dots
```

### **DNS TTL Settings**
- **Production tenants**: 300 seconds (5 minutes)
- **Testing tenants**: 60 seconds (1 minute)

### **Tenant Configuration**
- Always set `allowedDomains` for security
- Configure appropriate `maxUsers` and `maxRegulations`
- Enable `autoProvisioning` for SSO environments

---

## 🚨 **Important Notes**

### **1. No Pipeline Changes Required**
Adding tenants **never requires**:
- GitHub Actions modifications
- ECS service updates
- ALB configuration changes
- Application code changes

### **2. Automatic Tenant Detection**
Your middleware automatically:
- Extracts tenant from subdomain
- Loads tenant configuration
- Applies row-level security
- Sets tenant context

### **3. SAML Configuration**
Each tenant gets unique SAML endpoints:
```bash
# Metadata URL
https://{tenant}.edsteward.ai/auth/saml/metadata

# Callback URL  
https://{tenant}.edsteward.ai/auth/saml/callback

# Entity ID
urn:regulatorytrackr:sp:{tenant-id}
```

---

## 🎉 **Summary**

### **For Each New Tenant**
1. ✅ **Add 1 CNAME record** (1 minute)
2. ✅ **Test access** (5 minutes for DNS propagation)
3. ✅ **Configure SAML** (optional, tenant-specific)
4. ✅ **Done!** Tenant is live

### **What You Don't Need**
- ❌ New infrastructure
- ❌ Pipeline changes
- ❌ Additional SSL certificates
- ❌ Load balancer modifications
- ❌ Application deployments

### **Scalability**
Your current architecture supports **unlimited tenants** with:
- **Shared infrastructure** (cost-effective)
- **Automatic routing** (zero configuration)
- **Data isolation** (security compliant)
- **Independent SAML** (enterprise ready)

**Result**: Adding tenants is now a **1-minute DNS operation**! 🚀 