#!/bin/zsh

# EdSteward Tenant Feature Management Script
# Manage feature flags across multiple tenants

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL=${DATABASE_URL:-"postgresql://user:pass@localhost:5432/edsteward"}

# Helper functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Show usage
show_usage() {
    cat <<EOF
${GREEN}EdSteward Tenant Feature Management${NC}

Usage: $0 <command> [options]

Commands:
  list-tenants                     List all tenants
  list-features <tenant-id>        List features for a tenant
  enable-feature <tenant-id> <feature-key>    Enable feature for tenant
  disable-feature <tenant-id> <feature-key>   Disable feature for tenant
  bulk-enable <feature-key>        Enable feature for ALL tenants
  bulk-disable <feature-key>       Disable feature for ALL tenants
  rollout <feature-key> <tenant-ids>  Enable feature for specific tenants

Examples:
  $0 list-tenants
  $0 list-features moravian
  $0 enable-feature moravian premium_analytics
  $0 bulk-enable new_dashboard
  $0 rollout beta_feature moravian,admin,test

EOF
}

# Database query helper
run_query() {
    local query="$1"
    psql "$DATABASE_URL" -t -c "$query" 2>/dev/null || error "Database query failed"
}

# List all tenants
list_tenants() {
    log "Listing all tenants..."
    
    local query="SELECT id, name, status FROM tenants ORDER BY id;"
    echo -e "${BLUE}ID${NC}\t${BLUE}Name${NC}\t${BLUE}Status${NC}"
    echo "----------------------------------------"
    
    run_query "$query" | while IFS='|' read -r id name status; do
        id=$(echo "$id" | xargs)
        name=$(echo "$name" | xargs)
        status=$(echo "$status" | xargs)
        
        if [ "$status" = "active" ]; then
            echo -e "${GREEN}$id${NC}\t$name\t✅ $status"
        else
            echo -e "${YELLOW}$id${NC}\t$name\t⚠️ $status"
        fi
    done
}

# List features for a tenant
list_features() {
    local tenant_id="$1"
    
    if [ -z "$tenant_id" ]; then
        error "Tenant ID required"
    fi
    
    log "Listing features for tenant: $tenant_id"
    
    local query="SELECT settings->'featureFlags' FROM tenants WHERE id = '$tenant_id';"
    local features=$(run_query "$query" | xargs)
    
    if [ "$features" = "" ] || [ "$features" = "null" ]; then
        warning "No custom feature flags set for tenant $tenant_id (using defaults)"
    else
        echo -e "${BLUE}Feature Flags for $tenant_id:${NC}"
        echo "$features" | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || echo "$features"
    fi
}

# Enable feature for a tenant
enable_feature() {
    local tenant_id="$1"
    local feature_key="$2"
    
    if [ -z "$tenant_id" ] || [ -z "$feature_key" ]; then
        error "Tenant ID and feature key required"
    fi
    
    log "Enabling feature '$feature_key' for tenant '$tenant_id'..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'true'
                 ),
                 updated_at = NOW()
                 WHERE id = '$tenant_id';"
    
    run_query "$query"
    success "Feature '$feature_key' enabled for tenant '$tenant_id'"
}

# Disable feature for a tenant
disable_feature() {
    local tenant_id="$1"
    local feature_key="$2"
    
    if [ -z "$tenant_id" ] || [ -z "$feature_key" ]; then
        error "Tenant ID and feature key required"
    fi
    
    log "Disabling feature '$feature_key' for tenant '$tenant_id'..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'false'
                 ),
                 updated_at = NOW()
                 WHERE id = '$tenant_id';"
    
    run_query "$query"
    success "Feature '$feature_key' disabled for tenant '$tenant_id'"
}

# Bulk enable feature for all tenants
bulk_enable() {
    local feature_key="$1"
    
    if [ -z "$feature_key" ]; then
        error "Feature key required"
    fi
    
    warning "This will enable '$feature_key' for ALL tenants. Continue? (y/N)"
    read -r confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        log "Operation cancelled"
        exit 0
    fi
    
    log "Enabling feature '$feature_key' for ALL tenants..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'true'
                 ),
                 updated_at = NOW()
                 WHERE status = 'active';"
    
    local count=$(run_query "$query" | grep -o 'UPDATE [0-9]*' | grep -o '[0-9]*' || echo "0")
    success "Feature '$feature_key' enabled for $count tenants"
}

# Bulk disable feature for all tenants
bulk_disable() {
    local feature_key="$1"
    
    if [ -z "$feature_key" ]; then
        error "Feature key required"
    fi
    
    warning "This will disable '$feature_key' for ALL tenants. Continue? (y/N)"
    read -r confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        log "Operation cancelled"
        exit 0
    fi
    
    log "Disabling feature '$feature_key' for ALL tenants..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'false'
                 ),
                 updated_at = NOW()
                 WHERE status = 'active';"
    
    local count=$(run_query "$query" | grep -o 'UPDATE [0-9]*' | grep -o '[0-9]*' || echo "0")
    success "Feature '$feature_key' disabled for $count tenants"
}

# Progressive rollout to specific tenants
rollout_feature() {
    local feature_key="$1"
    local tenant_list="$2"
    
    if [ -z "$feature_key" ] || [ -z "$tenant_list" ]; then
        error "Feature key and tenant list required (comma-separated)"
    fi
    
    log "Rolling out feature '$feature_key' to tenants: $tenant_list"
    
    # Convert comma-separated list to array
    IFS=',' read -ra tenants <<< "$tenant_list"
    
    for tenant_id in "${tenants[@]}"; do
        tenant_id=$(echo "$tenant_id" | xargs) # trim whitespace
        log "Enabling for tenant: $tenant_id"
        enable_feature "$tenant_id" "$feature_key"
    done
    
    success "Rollout completed for ${#tenants[@]} tenants"
}

# Main command handler
case "$1" in
    "list-tenants")
        list_tenants
        ;;
    "list-features")
        list_features "$2"
        ;;
    "enable-feature")
        enable_feature "$2" "$3"
        ;;
    "disable-feature")
        disable_feature "$2" "$3"
        ;;
    "bulk-enable")
        bulk_enable "$2"
        ;;
    "bulk-disable")
        bulk_disable "$2"
        ;;
    "rollout")
        rollout_feature "$2" "$3"
        ;;
    *)
        show_usage
        ;;
esac

# 🏢 Multi-Tenant Deployment Strategy
## How to Deploy Updates to All Tenants vs. Single Tenants Using Feature Flags

*Your question answered: "Moravian is just one of our tenants. How do I deploy updates to all tenants and also single tenants? Feature flags should be used I think."*

---

## 🎯 **Overview**

You're absolutely right! EdSteward uses **feature flags** to control deployments across multiple tenants. Here's how to deploy to all tenants vs. specific tenants safely.

### **Current Tenant Architecture**
```
🏢 Production Tenants:
├── moravian.edsteward.ai    (Moravian University)
├── admin.edsteward.ai       (Admin/Support)
└── [future tenants...]

🧪 Staging/Testing:
├── staging.edsteward.ai     (Testing environment)
└── dev.edsteward.ai         (Development)
```

---

## 🚀 **Deployment Strategies**

### **1. Universal Updates (All Tenants)**
*For features that should go to ALL tenants immediately*

#### **When to Use:**
- Bug fixes and security patches
- Core UI/UX improvements
- Performance optimizations
- Standard feature enhancements

#### **How to Deploy:**
```typescript
// 1. Set defaultValue: true in shared/feature-flags.ts
'universal_improvement': {
  key: 'universal_improvement',
  name: 'Universal Improvement',
  description: 'Improvement for all tenants',
  category: 'ui',
  defaultValue: true  // 👈 ALL TENANTS GET THIS
}

// 2. Use in components
const hasImprovement = useFeatureFlag('universal_improvement');
```

#### **Deployment Commands:**
```bash
# Deploy to staging (all staging tenants get it)
git push origin ES-clientside

# Deploy to production (all production tenants get it)
./scripts/deploy-production.sh
```

### **2. Tenant-Specific Updates (Selected Tenants)**
*For features that should only go to specific tenants*

#### **When to Use:**
- Premium features
- Beta testing
- Institution-specific functionality
- Gradual rollouts

#### **How to Deploy:**
```typescript
// 1. Set defaultValue: false in shared/feature-flags.ts
'premium_feature': {
  key: 'premium_feature',
  name: 'Premium Feature',
  description: 'Feature for specific tenants only',
  category: 'ui',
  defaultValue: false  // 👈 NO TENANTS GET THIS BY DEFAULT
}

// 2. Deploy code (feature remains hidden)
./scripts/deploy-production.sh

// 3. Enable for specific tenants
./scripts/manage-tenant-features.sh enable-feature moravian premium_feature
```

---

## 🛠️ **Practical Deployment Workflows**

### **Scenario 1: Deploy Bug Fix to All Tenants**

```bash
# 1. Fix the bug with defaultValue: true
# shared/feature-flags.ts
'security_fix_2025_01': {
  key: 'security_fix_2025_01',
  name: 'Security Fix January 2025',
  description: 'Critical security patch',
  category: 'api',
  defaultValue: true  // All tenants get this immediately
}

# 2. Deploy to staging for testing
git checkout ES-clientside
git add .
git commit -m "fix: critical security patch"
git push origin ES-clientside

# 3. Test on staging
curl -I https://staging.edsteward.ai/health
curl -I https://moravian.edsteward.ai/health  # Should work on staging

# 4. Deploy to production (all tenants get it)
git checkout main
git merge ES-clientside
./scripts/deploy-production.sh

# 5. Verify all tenants
./scripts/health-check-all.sh
```

### **Scenario 2: Deploy New Feature to Moravian Only**

```bash
# 1. Develop feature with defaultValue: false
# shared/feature-flags.ts
'advanced_analytics': {
  key: 'advanced_analytics',
  name: 'Advanced Analytics Dashboard',
  description: 'Enhanced analytics for premium tenants',
  category: 'ui',
  defaultValue: false  // Hidden by default
}

# 2. Deploy code (feature stays hidden)
git checkout ES-clientside
git add .
git commit -m "feat: advanced analytics dashboard"
git push origin ES-clientside

# Test on staging - feature should be hidden
curl -I https://staging.edsteward.ai/

# 3. Deploy to production (still hidden)
git checkout main
git merge ES-clientside
./scripts/deploy-production.sh

# 4. Enable for Moravian only
./scripts/manage-tenant-features.sh enable-feature moravian advanced_analytics

# 5. Verify Moravian has it, others don't
curl -I https://moravian.edsteward.ai/  # Should have feature
curl -I https://admin.edsteward.ai/     # Should NOT have feature
```

### **Scenario 3: Gradual Rollout to Multiple Tenants**

```bash
# 1. Deploy feature (defaultValue: false)
./scripts/deploy-production.sh

# 2. Enable for test tenants first
./scripts/manage-tenant-features.sh rollout beta_feature admin,staging

# 3. Monitor and test
./scripts/health-check-all.sh

# 4. Roll out to production tenants
./scripts/manage-tenant-features.sh enable-feature moravian beta_feature

# 5. Eventually enable for all (if successful)
./scripts/manage-tenant-features.sh bulk-enable beta_feature
```

---

## 🔧 **Tenant Feature Management Commands**

### **List All Tenants**
```bash
./scripts/manage-tenant-features.sh list-tenants
# Output:
# moravian    Moravian University         ✅ active
# admin       EdSteward Admin            ✅ active
# staging     EdSteward Staging          ✅ active
```

### **Check Features for a Tenant**
```bash
./scripts/manage-tenant-features.sh list-features moravian
# Shows current feature flag settings for Moravian
```

### **Enable Feature for Single Tenant**
```bash
# Enable for Moravian only
./scripts/manage-tenant-features.sh enable-feature moravian new_feature

# Enable for admin only
./scripts/manage-tenant-features.sh enable-feature admin new_feature
```

### **Enable Feature for All Tenants**
```bash
# Enable for ALL active tenants
./scripts/manage-tenant-features.sh bulk-enable new_feature
```

### **Progressive Rollout**
```bash
# Enable for specific tenants (comma-separated)
./scripts/manage-tenant-features.sh rollout new_feature moravian,admin,test
```

### **Emergency Disable**
```bash
# Disable for single tenant
./scripts/manage-tenant-features.sh disable-feature moravian problematic_feature

# Disable for ALL tenants
./scripts/manage-tenant-features.sh bulk-disable problematic_feature
```

---

## 📋 **Real-World Examples**

### **Example 1: Enhanced Navigation (All Tenants)**
```typescript
// shared/feature-flags.ts
'enhanced_navigation_2025': {
  key: 'enhanced_navigation_2025',
  name: 'Enhanced Navigation 2025',
  description: 'Improved navigation with breadcrumbs and search',
  category: 'ui',
  defaultValue: true  // All tenants benefit immediately
}
```

**Deployment:**
```bash
./scripts/deploy-production.sh  # Goes live for all tenants
```

### **Example 2: AI Document Analysis (Premium Feature)**
```typescript
// shared/feature-flags.ts
'ai_document_analysis': {
  key: 'ai_document_analysis',
  name: 'AI Document Analysis',
  description: 'AI-powered document processing',
  category: 'integration',
  defaultValue: false  // Premium feature
}
```

**Deployment:**
```bash
# Deploy code
./scripts/deploy-production.sh

# Enable for Moravian (they pay for premium features)
./scripts/manage-tenant-features.sh enable-feature moravian ai_document_analysis

# Other tenants don't get it unless they upgrade
```

### **Example 3: Beta Testing New Dashboard**
```typescript
// shared/feature-flags.ts
'new_dashboard_beta': {
  key: 'new_dashboard_beta',
  name: 'New Dashboard Beta',
  description: 'Beta version of redesigned dashboard',
  category: 'ui',
  defaultValue: false  // Beta testing only
}
```

**Deployment:**
```bash
# Deploy code
./scripts/deploy-production.sh

# Enable for internal testing first
./scripts/manage-tenant-features.sh enable-feature admin new_dashboard_beta
./scripts/manage-tenant-features.sh enable-feature staging new_dashboard_beta

# After testing, enable for willing beta testers
./scripts/manage-tenant-features.sh enable-feature moravian new_dashboard_beta

# Eventually roll out to all
./scripts/manage-tenant-features.sh bulk-enable new_dashboard_beta
```

---

## 🎯 **Decision Matrix: When to Use Which Strategy**

| Update Type | Strategy | defaultValue | Deployment |
|-------------|----------|--------------|------------|
| **Bug Fixes** | Universal | `true` | `./scripts/deploy-production.sh` |
| **Security Patches** | Universal | `true` | `./scripts/deploy-production.sh` |
| **UI Improvements** | Universal | `true` | `./scripts/deploy-production.sh` |
| **Performance Fixes** | Universal | `true` | `./scripts/deploy-production.sh` |
| **Premium Features** | Tenant-Specific | `false` | Deploy + Enable per tenant |
| **Beta Features** | Tenant-Specific | `false` | Deploy + Gradual rollout |
| **Institution-Specific** | Tenant-Specific | `false` | Deploy + Enable for specific tenant |
| **Experimental** | Tenant-Specific | `false` | Deploy + Internal testing first |

---

## 🚨 **Emergency Procedures**

### **Rollback Single Tenant**
```bash
# If Moravian has issues with a feature
./scripts/manage-tenant-features.sh disable-feature moravian problematic_feature
```

### **Rollback All Tenants**
```bash
# If feature causes issues for everyone
./scripts/manage-tenant-features.sh bulk-disable problematic_feature
```

### **Emergency Feature Toggle**
```bash
# Instant disable without code deployment
./scripts/manage-tenant-features.sh disable-feature moravian feature_name

# Instant enable for urgent fix
./scripts/manage-tenant-features.sh enable-feature moravian urgent_fix
```

---

## 📊 **Monitoring & Verification**

### **Check Deployment Status**
```bash
# Check all environments are healthy
./scripts/health-check-all.sh

# Check specific tenant
curl -I https://moravian.edsteward.ai/health
```

### **Verify Feature Rollout**
```bash
# Check which tenants have a feature
./scripts/manage-tenant-features.sh list-features moravian
./scripts/manage-tenant-features.sh list-features admin
```

### **Monitor Feature Usage**
```bash
# Check application logs for feature usage
aws logs tail /ecs/edsteward-multi-tenant-staging --follow --region us-east-1
```

---

## 🎉 **Best Practices**

### **1. Safe Feature Development**
- ✅ Always start with `defaultValue: false` for new features
- ✅ Test on staging environment first
- ✅ Enable for internal tenants (admin, staging) before production
- ✅ Monitor logs after enabling features

### **2. Gradual Rollouts**
- ✅ Start with 1 tenant → Monitor → Expand
- ✅ Use `rollout` command for multiple tenants
- ✅ Keep rollback plan ready
- ✅ Document which tenants have which features

### **3. Universal Updates**
- ✅ Use `defaultValue: true` only for stable, tested features
- ✅ Always test on staging first
- ✅ Monitor all tenants after deployment
- ✅ Have emergency disable plan ready

### **4. Communication**
- ✅ Document feature rollouts
- ✅ Notify tenants of new features
- ✅ Keep changelog updated
- ✅ Track feature adoption

---

## 🚀 **Your Complete Workflow**

### **For Updates to ALL Tenants:**
1. Set `defaultValue: true` in feature flags
2. Deploy: `./scripts/deploy-production.sh`
3. Verify: `./scripts/health-check-all.sh`
4. All tenants get the update immediately

### **For Updates to SPECIFIC Tenants:**
1. Set `defaultValue: false` in feature flags
2. Deploy: `./scripts/deploy-production.sh` (feature stays hidden)
3. Enable: `./scripts/manage-tenant-features.sh enable-feature moravian feature_name`
4. Only enabled tenants see the feature

### **For GRADUAL Rollouts:**
1. Deploy with `defaultValue: false`
2. Test: `./scripts/manage-tenant-features.sh enable-feature admin feature_name`
3. Rollout: `./scripts/manage-tenant-features.sh rollout feature_name moravian,tenant2`
4. Monitor and expand as needed

---

**🎯 Your multi-tenant deployment strategy is now enterprise-ready with granular control over which tenants get which features!** 