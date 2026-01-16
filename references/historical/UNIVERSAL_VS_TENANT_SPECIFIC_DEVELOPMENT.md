# Universal vs Tenant-Specific Development Guide

## 🎯 **Your Question Answered:**
> "What do I develop in for my dev stage for things I want to be pushed to all tenants?"

## **The Answer: Use `defaultValue: true` for Universal Features**

---

## 🚀 **Universal Features (All Tenants)**

### **When to Use:**
- Core application improvements
- Bug fixes and enhancements
- Standard features all customers should have
- UI/UX improvements
- Performance optimizations

### **How to Develop:**

```typescript
// 1. Set defaultValue: true in shared/feature-flags.ts
'universal_feature': {
  key: 'universal_feature',
  name: 'Universal Feature',
  description: 'Feature for all tenants',
  category: 'ui',
  defaultValue: true  // 👈 ALL TENANTS GET THIS
}

// 2. Use in components
function MyComponent() {
  const hasFeature = useFeatureFlag('universal_feature');
  
  return (
    <div>
      {hasFeature ? (
        <NewImprovedVersion />  // All tenants see this
      ) : (
        <OldVersion />          // Rarely used fallback
      )}
    </div>
  );
}
```

### **Development Workflow:**
```bash
# 1. Develop locally - feature appears on ALL tenant URLs
make -f Makefile.local dev
# Test: moravian.edsteward.local ✅ Has feature
# Test: admin.edsteward.local    ✅ Has feature

# 2. Deploy to staging - ALL tenants get it
git push origin ES-clientside

# 3. Deploy to production - ALL tenants get it
./scripts/deploy-production.sh
```

---

## 🎯 **Tenant-Specific Features**

### **When to Use:**
- Premium features
- Institution-specific functionality
- Beta features for testing
- Admin-only tools
- Paid add-ons

### **How to Develop:**

```typescript
// 1. Set defaultValue: false in shared/feature-flags.ts
'premium_feature': {
  key: 'premium_feature',
  name: 'Premium Feature',
  description: 'Feature for specific tenants only',
  category: 'ui',
  defaultValue: false  // 👈 NO TENANTS GET THIS BY DEFAULT
}

// 2. Use in components (same pattern)
function MyComponent() {
  const hasFeature = useFeatureFlag('premium_feature');
  
  return (
    <div>
      {hasFeature ? (
        <PremiumFeature />      // Only enabled tenants see this
      ) : (
        <StandardFeature />     // Default for most tenants
      )}
    </div>
  );
}
```

### **Development Workflow:**
```bash
# 1. Develop locally - feature hidden by default
make -f Makefile.local dev

# 2. Deploy to staging/production - feature remains hidden
git push origin ES-clientside
./scripts/deploy-production.sh

# 3. Enable for specific tenants via database
UPDATE tenants SET settings = jsonb_set(
  settings, 
  '{featureFlags,premium_feature}', 
  'true'
) WHERE id = 'moravian';
```

---

## 📋 **Practical Examples**

### **✅ Universal Features (defaultValue: true)**

#### **Example 1: Enhanced Navigation**
```typescript
'enhanced_navigation': {
  key: 'enhanced_navigation',
  name: 'Enhanced Navigation',
  description: 'Improved navigation with breadcrumbs and search',
  category: 'ui',
  defaultValue: true  // All tenants benefit from better UX
}
```

#### **Example 2: Performance Improvements**
```typescript
'optimized_loading': {
  key: 'optimized_loading',
  name: 'Optimized Loading',
  description: 'Faster page loads and better caching',
  category: 'ui',
  defaultValue: true  // All tenants get performance benefits
}
```

#### **Example 3: Security Enhancements**
```typescript
'enhanced_security': {
  key: 'enhanced_security',
  name: 'Enhanced Security',
  description: 'Improved security headers and validation',
  category: 'api',
  defaultValue: true  // All tenants get security improvements
}
```

### **🎯 Tenant-Specific Features (defaultValue: false)**

#### **Example 1: AI Features**
```typescript
'ai_document_analysis': {
  key: 'ai_document_analysis',
  name: 'AI Document Analysis',
  description: 'AI-powered document processing',
  category: 'integration',
  defaultValue: false  // Premium feature, costs money
}
```

#### **Example 2: Advanced Analytics**
```typescript
'advanced_analytics': {
  key: 'advanced_analytics',
  name: 'Advanced Analytics',
  description: 'Detailed reporting and insights',
  category: 'admin',
  defaultValue: false  // Premium feature for larger institutions
}
```

#### **Example 3: Custom Integrations**
```typescript
'custom_sso_provider': {
  key: 'custom_sso_provider',
  name: 'Custom SSO Provider',
  description: 'Integration with custom identity providers',
  category: 'integration',
  defaultValue: false  // Tenant-specific configuration required
}
```

---

## 🔧 **Your Current Development Setup**

Based on your attached terminal output, your multi-tenant environment is working perfectly:

- ✅ **Moravian Tenant**: `http://moravian.edsteward.local`
- ✅ **Admin Tenant**: `http://admin.edsteward.local`
- ✅ **Main Domain**: `http://edsteward.local`

### **Test Universal Features:**
```bash
# Feature with defaultValue: true will appear on ALL these URLs:
curl http://moravian.edsteward.local/  # ✅ Feature visible
curl http://admin.edsteward.local/     # ✅ Feature visible
curl http://edsteward.local/           # ✅ Feature visible
```

### **Test Tenant-Specific Features:**
```bash
# Feature with defaultValue: false will be hidden unless explicitly enabled
curl http://moravian.edsteward.local/  # ❌ Feature hidden
curl http://admin.edsteward.local/     # ❌ Feature hidden

# After enabling for moravian tenant:
curl http://moravian.edsteward.local/  # ✅ Feature visible
curl http://admin.edsteward.local/     # ❌ Still hidden
```

---

## 🎮 **Quick Start Guide**

### **For Your Next Universal Feature:**

1. **Add to feature flags:**
```typescript
// shared/feature-flags.ts
'my_universal_improvement': {
  key: 'my_universal_improvement',
  name: 'My Universal Improvement',
  description: 'An improvement all tenants should have',
  category: 'ui',
  defaultValue: true  // 👈 KEY: Set to true
}
```

2. **Use in your component:**
```typescript
const hasImprovement = useFeatureFlag('my_universal_improvement');
```

3. **Test locally:**
```bash
make -f Makefile.local dev
# Check both moravian.edsteward.local and admin.edsteward.local
```

4. **Deploy:**
```bash
git push origin ES-clientside  # Goes to all staging tenants
./scripts/deploy-production.sh          # Goes to all production tenants
```

### **For Your Next Tenant-Specific Feature:**

1. **Add to feature flags:**
```typescript
// shared/feature-flags.ts
'my_premium_feature': {
  key: 'my_premium_feature',
  name: 'My Premium Feature',
  description: 'A feature for specific tenants only',
  category: 'ui',
  defaultValue: false  // 👈 KEY: Set to false
}
```

2. **Deploy (feature remains hidden)**
3. **Enable for specific tenants via database when ready**

---

## ✅ **Summary**

**For features you want pushed to ALL tenants:**
- ✅ Set `defaultValue: true` in feature flags
- ✅ Develop and test normally
- ✅ Deploy - feature goes live for everyone immediately

**For features you want for SPECIFIC tenants only:**
- ✅ Set `defaultValue: false` in feature flags  
- ✅ Deploy (feature stays hidden)
- ✅ Enable per tenant via database when ready

**Your multi-tenant development environment is perfectly set up for this workflow!** 🚀 