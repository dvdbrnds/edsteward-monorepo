# Enhanced New Tenant Setup Guide - v2.0
## Modern SAML & Multi-Tenant Architecture

---

## 🎯 **Overview**

This guide provides comprehensive instructions for setting up new tenants in the EdSteward multi-tenant SaaS platform with **enhanced SAML security features** based on the latest industry standards and @node-saml/passport-saml@4.0.4 capabilities.

**New in v2.0:**
- ✅ Enhanced SAML Security (InResponseTo validation, advanced timing controls)
- ✅ Certificate rotation support
- ✅ Modern security algorithms (SHA256)
- ✅ Comprehensive security monitoring
- ✅ Automatic enhanced security for new tenants

---

## 📋 **Pre-Requisites**

### **Required Information**
- Tenant organization details
- Domain configuration
- SAML Identity Provider (IdP) configuration
- Database credentials
- SSL certificates

### **Technical Requirements**
- Database-per-tenant setup (physical isolation)
- Subdomain configuration
- SAML IdP with modern security features
- SSL/TLS certificates

---

## 🔧 **Step-by-Step Setup**

### **Phase 1: Core Tenant Infrastructure**

#### **1.1 Create Tenant Database**
```bash
# Create dedicated database for tenant
./scripts/create-tenant-database.sh <tenant-id>

# Example:
./scripts/create-tenant-database.sh "acme-corp"
```

#### **1.2 Configure Tenant Record**
```sql
-- Insert tenant configuration with enhanced security defaults
INSERT INTO edsteward_admin.tenants (
  id, name, subdomain, domain, 
  settings, created_at
) VALUES (
  'acme-corp',
  'ACME Corporation',
  'acme',
  'acme.com',
  '{
    "defaultRole": "user",
    "allowedDomains": ["acme.com", "acme.org"],
    "enableAutoProvisioning": true,
    "enhancedSecurity": true,
    "features": {
      "advancedSamlSecurity": true,
      "certificateRotation": true,
      "comprehensiveLogging": true
    }
  }',
  NOW()
);
```

#### **1.3 Configure Subdomain**
```bash
# Add DNS CNAME record
acme.edsteward.ai → edsteward.ai

# Update load balancer/proxy configuration
# (Usually handled by infrastructure team)
```

---

### **Phase 2: Enhanced SAML Configuration**

#### **2.1 Basic SAML Configuration**
```sql
-- Insert SAML configuration with enhanced security
INSERT INTO edsteward_admin.tenant_saml_configs (
  tenant_id, entity_id, sso_url, slo_url, certificate,
  attribute_mapping, enhanced_security, created_at
) VALUES (
  'acme-corp',
  'https://acme.idp.com/saml/metadata',
  'https://acme.idp.com/saml/sso',
  'https://acme.idp.com/saml/slo',
  '-----BEGIN CERTIFICATE-----
  MIIDXTCCAkWgAwIBAgIJAK...
  -----END CERTIFICATE-----',
  '{
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
  }',
  true,
  NOW()
);
```

#### **2.2 Enhanced Security Features** ✨ **NEW**
```sql
-- Configure enhanced security settings
UPDATE edsteward_admin.tenant_saml_configs 
SET enhanced_security_config = '{
  "validateInResponseTo": "ifPresent",
  "requestIdExpirationPeriodMs": 28800000,
  "acceptedClockSkewMs": 5000,
  "maxAssertionAgeMs": 3600000,
  "certificateRotationEnabled": true,
  "securityLevel": "high"
}'
WHERE tenant_id = 'acme-corp';
```

#### **2.3 Generate Service Provider Metadata**
```bash
# Generate enhanced SP metadata for IdP configuration
curl -X GET "https://acme.edsteward.ai/auth/saml/metadata" \
  -H "Accept: application/xml" \
  -o acme-corp-sp-metadata.xml

# The metadata will include enhanced security capabilities
```

---

### **Phase 3: Advanced Configuration**

#### **3.1 Certificate Management** ✨ **NEW**
```sql
-- Support multiple certificates for rotation
UPDATE edsteward_admin.tenant_saml_configs 
SET certificate = '[
  "-----BEGIN CERTIFICATE-----
  MIIDXTCCAkWgAwIBAgIJAK... (current)
  -----END CERTIFICATE-----",
  "-----BEGIN CERTIFICATE-----
  MIIDYTCCAkWgAwIBAgIJAL... (backup)
  -----END CERTIFICATE-----"
]'
WHERE tenant_id = 'acme-corp';
```

#### **3.2 Security Monitoring Setup** ✨ **NEW**
```bash
# Enable comprehensive SAML security logging
./scripts/configure-tenant-monitoring.sh acme-corp

# This will set up:
# - SAML security event logging
# - Authentication metrics
# - Security alert thresholds
```

#### **3.3 Feature Flags Configuration**
```sql
-- Enable tenant-specific features
INSERT INTO edsteward_admin.tenant_features (
  tenant_id, feature_name, enabled, configuration
) VALUES
  ('acme-corp', 'enhanced_saml', true, '{"securityLevel": "high"}'),
  ('acme-corp', 'certificate_rotation', true, '{"rotationDays": 90}'),
  ('acme-corp', 'advanced_logging', true, '{"logLevel": "detailed"}');
```

---

### **Phase 4: Testing & Validation**

#### **4.1 SAML Configuration Validation** ✨ **NEW**
```bash
# Test enhanced SAML configuration
./scripts/test-enhanced-saml.sh acme-corp

# This will validate:
# - Certificate chain
# - Enhanced security features
# - Timing configurations
# - InResponseTo validation
```

#### **4.2 End-to-End Authentication Test**
```bash
# Test complete authentication flow
./scripts/test-tenant-auth.sh acme-corp

# Test scenarios:
# 1. Initial SAML login
# 2. User provisioning
# 3. Role assignment
# 4. Session management
# 5. Logout flow
```

#### **4.3 Security Compliance Check**
```bash
# Run comprehensive security audit
./scripts/audit-tenant-security.sh acme-corp

# Validates:
# - SHA256 usage (not SHA1)
# - Certificate validation
# - Enhanced security features
# - Logging configuration
```

---

## 🔒 **Security Features**

### **Enhanced Security by Default** ✨ **NEW**
All new tenants automatically receive:

- **InResponseTo Validation**: Prevents replay attacks
- **Advanced Timing Controls**: 5-second clock skew tolerance, 1-hour assertion age limit
- **SHA256 Algorithms**: Modern signature and digest algorithms
- **Certificate Rotation**: Support for multiple certificates
- **Comprehensive Logging**: Detailed security event tracking

### **Backward Compatibility**
- Existing tenants continue with current configuration
- Enhanced security can be enabled via opt-in
- No breaking changes to existing functionality

---

## 📊 **Monitoring & Maintenance**

### **Health Checks**
```bash
# Regular tenant health check
./scripts/health-check-tenant.sh acme-corp

# Enhanced security monitoring
./scripts/monitor-saml-security.sh acme-corp
```

### **Certificate Management**
```bash
# Certificate expiration monitoring
./scripts/monitor-certificates.sh acme-corp

# Automated certificate rotation (if enabled)
./scripts/rotate-certificates.sh acme-corp
```

### **Security Monitoring**
```bash
# Security event dashboard
./scripts/security-dashboard.sh acme-corp

# Generate security report
./scripts/generate-security-report.sh acme-corp
```

---

## 🚀 **Post-Setup Verification**

### **Functional Testing**
- [ ] SAML authentication works
- [ ] User provisioning functions
- [ ] Role assignment correct
- [ ] Database isolation verified
- [ ] Enhanced security features active

### **Security Testing** ✨ **NEW**
- [ ] InResponseTo validation working
- [ ] Timing controls enforced
- [ ] Certificate validation passes
- [ ] Security logging operational
- [ ] Compliance requirements met

### **Performance Testing**
- [ ] Authentication latency acceptable
- [ ] Database performance optimal
- [ ] Logging impact minimal
- [ ] Session management efficient

---

## 🔧 **Troubleshooting**

### **Common Issues & Solutions**

#### **SAML Authentication Failures**
```bash
# Check enhanced SAML logs
tail -f /var/log/edsteward/saml-enhanced.log | grep "acme-corp"

# Validate configuration
./scripts/validate-saml-config.sh acme-corp
```

#### **Certificate Issues**
```bash
# Test certificate validation
./scripts/test-certificate.sh acme-corp

# Check certificate expiration
./scripts/check-cert-expiry.sh acme-corp
```

#### **Enhanced Security Issues**
```bash
# Debug timing issues
./scripts/debug-saml-timing.sh acme-corp

# Check InResponseTo validation
./scripts/debug-inresponseto.sh acme-corp
```

---

## 📚 **Reference Documentation**

### **Related Guides**
- [SAML Multi-Tenant Modernization Plan](./SAML_MULTITENANT_MODERNIZATION_PLAN-2025-07-07.md)
- [Current Version Analysis](./CURRENT_VERSION_ANALYSIS-2025-07-07.md)
- [Architecture Documentation](./ARCHITECTURE-2025-07-06.md)

### **API Documentation**
- Enhanced SAML API: `/server/auth/enhanced-tenant-saml.ts`
- Security validation functions
- Certificate management endpoints

### **Configuration Examples**
- Enhanced SAML configuration templates
- Security policy examples
- Monitoring configuration

---

## 🆕 **What's New in v2.0**

### **Enhanced Security Features**
✅ **Modern SAML Security**: InResponseTo validation, advanced timing controls  
✅ **Certificate Rotation**: Support for multiple certificates  
✅ **Comprehensive Logging**: Detailed security event tracking  
✅ **Automatic Security**: Enhanced security enabled by default for new tenants  

### **Improved Monitoring**
✅ **Security Dashboard**: Real-time security monitoring  
✅ **Compliance Reporting**: Automated security compliance reports  
✅ **Certificate Management**: Automated certificate rotation and monitoring  

### **Developer Experience**
✅ **Enhanced APIs**: New security-focused API endpoints  
✅ **Better Documentation**: Comprehensive setup and troubleshooting guides  
✅ **Validation Tools**: Automated configuration validation  

---

## 📞 **Support**

For assistance with enhanced SAML setup:
- Check the troubleshooting section above
- Review security logs: `/var/log/edsteward/saml-enhanced.log`
- Use validation scripts: `./scripts/validate-saml-config.sh`

---

**Version**: 2.0.0  
**Last Updated**: July 7, 2025  
**Enhanced Security**: Available in @node-saml/passport-saml@4.0.4+  
**Backward Compatible**: ✅ Existing tenants unaffected 