# Multi-Tenant Development Strategy
## How to Develop Without Breaking Tenant Configurations

*Last Updated: January 2025*

---

## 🎯 **Core Principle**
**Develop the application so that updates never affect tenant-specific configurations, data, or customizations.**

---

## 🏗️ **1. Configuration-Driven Architecture**

### **Feature Flag System**
Use the new feature flag system to control features per tenant:

```typescript
// Check if a feature is enabled for the current tenant
const { isFeatureEnabled } = useFeatureFlags();

if (isFeatureEnabled('advanced_dashboard')) {
  // Show advanced dashboard
} else {
  // Show basic dashboard
}
```

### **Tenant-Specific Settings**
All tenant customizations are stored in the database `tenants.settings` field:

```typescript
// Example tenant settings structure
{
  "allowedDomains": ["moravian.edu"],
  "defaultRole": "user",
  "customBranding": {
    "primaryColor": "#0066cc",
    "logoUrl": "https://example.com/logo.png"
  },
  "features": {
    "maxUsers": 500,
    "ssoEnabled": true
  },
  "featureFlags": {
    "advanced_dashboard": true,
    "bulk_operations": false,
    "document_ai": true
  },
  "institutionConfig": {
    "primaryTypes": ["conservatory"],
    "hideNonApplicable": true
  }
}
```

---

## 🔧 **2. Development Workflow**

### **Phase 1: Local Development**
```bash
# Start multi-tenant development environment
make -f Makefile.local dev

# Access tenant-specific environments
# Moravian: http://moravian.edsteward.local
# Admin: http://admin.edsteward.local
```

### **Phase 2: Feature Development**
1. **Add new features behind feature flags**
2. **Test with different tenant configurations**
3. **Ensure backward compatibility**

### **Phase 3: Staging Testing**
```bash
# Deploy to staging
git push origin ES-clientside

# Test with real tenant data
# Moravian tenant: https://moravian.edsteward.ai/
# Admin tenant: https://staging.edsteward.ai/
```

### **Phase 4: Production Deployment**
```bash
# Merge to main for production
git checkout main
git merge ES-clientside
git push origin main
```

---

## 🛡️ **3. Safe Development Practices**

### **A. Always Use Feature Flags for New Features**

```typescript
// ❌ DON'T: Add features directly
function NewFeatureComponent() {
  return <div>New Feature</div>;
}

// ✅ DO: Wrap in feature flag
function NewFeatureComponent() {
  const isEnabled = useFeatureFlag('new_feature');
  
  if (!isEnabled) {
    return null;
  }
  
  return <div>New Feature</div>;
}
```

### **B. Tenant-Aware Components**

```typescript
// ✅ Components that adapt to tenant settings
function Dashboard() {
  const { tenant } = useTenant();
  const isAdvanced = useFeatureFlag('advanced_dashboard');
  
  return (
    <div style={{ 
      '--primary-color': tenant.settings.customBranding?.primaryColor 
    }}>
      {isAdvanced ? <AdvancedDashboard /> : <BasicDashboard />}
    </div>
  );
}
```

### **C. Database Migrations**

```typescript
// ✅ Always make database changes backward compatible
// Add new columns with default values
// Never remove columns without migration strategy
// Use feature flags to control new database features
```

---

## 📊 **4. Feature Flag Categories**

### **UI Features**
- `advanced_dashboard` - Enhanced dashboard with analytics
- `dark_mode` - Dark/light theme toggle
- `bulk_operations` - Bulk actions on data
- `advanced_search` - Enhanced search functionality

### **API Features**
- `api_rate_limiting` - Rate limiting for API endpoints
- `webhook_notifications` - Webhook support
- `api_versioning` - API versioning support

### **Integration Features**
- `email_notifications` - Email notification system
- `calendar_integration` - Calendar sync
- `document_ai` - AI-powered document analysis

### **Compliance Features**
- `automated_compliance_checks` - Auto compliance checking
- `risk_assessment` - Risk scoring
- `audit_trail` - Enhanced audit logging

### **Admin Features**
- `tenant_analytics` - Advanced tenant analytics
- `user_impersonation` - Admin user impersonation
- `advanced_user_management` - Enhanced user management

---

## 🔄 **5. Deployment Strategy**

### **Gradual Rollout Process**

1. **Feature Development**
   - Develop behind feature flags (disabled by default)
   - Test locally with multiple tenant configurations

2. **Staging Deployment**
   - Deploy to staging with feature flags disabled
   - Enable features for testing tenants only
   - Validate with real tenant data

3. **Production Soft Launch**
   - Deploy to production with features disabled
   - Enable for internal/test tenants first
   - Monitor performance and stability

4. **Tenant-by-Tenant Rollout**
   - Enable features for specific tenants
   - Monitor each tenant's experience
   - Roll back if issues arise

5. **Full Rollout**
   - Enable for all tenants
   - Update feature flag defaults
   - Remove feature flag code in next release

### **Example Rollout Commands**

```bash
# Enable feature for specific tenant
curl -X POST /api/tenants/moravian/features \
  -H "Content-Type: application/json" \
  -d '{"advanced_dashboard": true}'

# Enable feature for all tenants
curl -X POST /api/admin/features/bulk-enable \
  -H "Content-Type: application/json" \
  -d '{"feature": "advanced_dashboard", "enabled": true}'
```

---

## 🎯 **6. Testing Strategy**

### **Multi-Tenant Testing**

```typescript
// Test with different tenant configurations
describe('Dashboard Component', () => {
  it('shows basic dashboard for moravian tenant', async () => {
    const { render } = setupTenantTest('moravian', {
      featureFlags: { advanced_dashboard: false }
    });
    
    render(<Dashboard />);
    expect(screen.getByText('Basic Dashboard')).toBeInTheDocument();
  });
  
  it('shows advanced dashboard for admin tenant', async () => {
    const { render } = setupTenantTest('admin', {
      featureFlags: { advanced_dashboard: true }
    });
    
    render(<Dashboard />);
    expect(screen.getByText('Advanced Dashboard')).toBeInTheDocument();
  });
});
```

### **Configuration Testing**

```bash
# Test different tenant configurations locally
# 1. Start development environment
make -f Makefile.local dev

# 2. Test different tenant URLs
curl -H "Host: moravian.edsteward.local" http://localhost/api/health
curl -H "Host: admin.edsteward.local" http://localhost/api/health

# 3. Verify tenant-specific behavior
curl -H "Host: moravian.edsteward.local" http://localhost/api/features
curl -H "Host: admin.edsteward.local" http://localhost/api/features
```

---

## 🚨 **7. Emergency Procedures**

### **Feature Rollback**

```bash
# Disable problematic feature for all tenants
curl -X POST /api/admin/features/emergency-disable \
  -H "Content-Type: application/json" \
  -d '{"feature": "problematic_feature"}'

# Disable for specific tenant
curl -X POST /api/tenants/moravian/features \
  -H "Content-Type: application/json" \
  -d '{"problematic_feature": false}'
```

### **Tenant Isolation**

```bash
# Temporarily disable tenant if issues arise
curl -X PUT /api/tenants/moravian/status \
  -H "Content-Type: application/json" \
  -d '{"status": "maintenance"}'
```

---

## 📈 **8. Monitoring & Analytics**

### **Feature Usage Tracking**

```typescript
// Track feature usage per tenant
useEffect(() => {
  if (isFeatureEnabled('advanced_dashboard')) {
    analytics.track('feature_used', {
      feature: 'advanced_dashboard',
      tenant: tenantId,
      timestamp: new Date()
    });
  }
}, [isFeatureEnabled, tenantId]);
```

### **Tenant Health Monitoring**

```bash
# Monitor tenant-specific metrics
curl /api/admin/tenants/moravian/health
curl /api/admin/tenants/moravian/usage-stats
curl /api/admin/tenants/moravian/feature-usage
```

---

## 🔮 **9. Future Considerations**

### **Tenant-Specific Deployments**
- Consider tenant-specific Docker containers for large customers
- Implement tenant-specific database schemas if needed
- Plan for tenant-specific API versions

### **Advanced Configuration**
- Tenant-specific UI themes and layouts
- Tenant-specific business logic rules
- Tenant-specific integrations and workflows

### **Scalability**
- Implement tenant sharding for large-scale deployments
- Consider tenant-specific caching strategies
- Plan for tenant-specific performance optimizations

---

## ✅ **Summary: Development Checklist**

Before deploying any changes:

- [ ] New features are behind feature flags
- [ ] Tested with multiple tenant configurations
- [ ] Database changes are backward compatible
- [ ] Tenant-specific settings are preserved
- [ ] Feature flags are properly configured
- [ ] Monitoring is in place
- [ ] Rollback plan is ready
- [ ] Documentation is updated

**Remember: The goal is to develop fearlessly while keeping tenant configurations completely safe and isolated.** 