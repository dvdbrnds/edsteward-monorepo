# Moravian University OKTA SSO Setup Guide
## EdSteward SAML Integration - Step-by-Step Implementation

---

## 🎯 **Overview**

This guide provides complete instructions for Moravian University's IT team to configure OKTA SAML SSO integration with your existing EdSteward tenant at `moravian.edsteward.ai`.

**Your Current Setup:**
- **Tenant**: Moravian University
- **Subdomain**: `moravian.edsteward.ai`
- **Tenant ID**: `moravian` (based on your existing configuration)
- **Enhanced Security**: ✅ Available (your tenant supports modern SAML features)

---

## 📋 **Pre-Requisites**

### **OKTA Requirements**
- OKTA Administrator access
- OKTA Application creation permissions
- Access to OKTA certificate downloads

### **EdSteward Requirements**
- Database access to configure SAML settings
- Admin access to `moravian.edsteward.ai`
- Ability to test authentication

### **Contact Information**
- **Moravian IT Contact**: [Your IT team contact]
- **EdSteward Support**: [Support contact if needed]

---

## 🔧 **Step-by-Step Implementation**

### **Phase 1: OKTA Application Setup**

#### **Step 1.1: Create OKTA Application**
1. Log in to your OKTA Admin Console
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Select **SAML 2.0** and click **Next**

#### **Step 1.2: General Settings**
```
App name: EdSteward - Moravian University
App logo: [Upload Moravian logo if desired]
App visibility: [Configure as needed]
```

#### **Step 1.3: Configure SAML Settings**
**Single Sign-On URL:**
```
https://moravian.edsteward.ai/auth/saml/callback
```

**Audience URI (SP Entity ID):**
```
urn:edsteward:sp:moravian
```

**Default RelayState:**
```
moravian
```

**Name ID format:**
```
EmailAddress
```

**Application username:**
```
Email
```

#### **Step 1.4: Attribute Statements**
Configure these attribute mappings:

| Name | Name format | Value |
|------|-------------|-------|
| `email` | Unspecified | `user.email` |
| `firstName` | Unspecified | `user.firstName` |
| `lastName` | Unspecified | `user.lastName` |
| `department` | Unspecified | `user.department` |
| `groups` | Unspecified | `user.groups` |

#### **Step 1.5: Group Attribute Statements (Optional)**
For role-based access:

| Name | Name format | Value |
|------|-------------|-------|
| `groups` | Unspecified | Matches regex `.*` |

---

### **Phase 2: Download OKTA Configuration**

#### **Step 2.1: Get OKTA Metadata**
1. In your OKTA application, go to **Sign On** tab
2. Click **View Setup Instructions**
3. Note these values:
   - **Identity Provider Single Sign-On URL**
   - **Identity Provider Issuer**
   - **X.509 Certificate**

#### **Step 2.2: Download Certificate**
1. Copy the **X.509 Certificate** (including BEGIN/END lines)
2. Save as `moravian-okta-cert.pem` for reference

**Example Certificate Format:**
```
-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAV2ka+55MA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG
EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNj
[... certificate content ...]
-----END CERTIFICATE-----
```

---

### **Phase 3: Configure EdSteward SAML**

#### **Step 3.1: Database Configuration**
Execute this SQL to configure Moravian's SAML settings:

```sql
-- Connect to EdSteward admin database
-- Replace the values below with your actual OKTA configuration

-- Update tenant with SAML configuration
UPDATE edsteward_admin.tenants 
SET saml_config = '{
  "entityId": "http://www.okta.com/exk[YOUR_OKTA_APP_ID]",
  "ssoUrl": "https://[YOUR_OKTA_DOMAIN].okta.com/app/[YOUR_OKTA_APP]/exk[YOUR_OKTA_APP_ID]/sso/saml",
  "sloUrl": "https://[YOUR_OKTA_DOMAIN].okta.com/app/[YOUR_OKTA_APP]/exk[YOUR_OKTA_APP_ID]/slo/saml",
  "certificate": "-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAV2ka+55MA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG\n[YOUR_CERTIFICATE_CONTENT]\n-----END CERTIFICATE-----",
  "attributeMapping": {
    "email": "email",
    "firstName": "firstName", 
    "lastName": "lastName",
    "department": "department",
    "groups": "groups"
  },
  "enhancedSecurity": true
}'
WHERE id = 'moravian';

-- Enable auto-provisioning for new users
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{enableAutoProvisioning}', 
  'true'::jsonb
)
WHERE id = 'moravian';

-- Set allowed domains for Moravian
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{allowedDomains}', 
  '["moravian.edu"]'::jsonb
)
WHERE id = 'moravian';
```

#### **Step 3.2: Actual Values for Moravian**
Replace the placeholders above with your actual OKTA values:

1. **[YOUR_OKTA_DOMAIN]**: Your OKTA domain (e.g., `moravian-university`)
2. **[YOUR_OKTA_APP_ID]**: The application ID from OKTA
3. **[YOUR_CERTIFICATE_CONTENT]**: The actual certificate content from Step 2.2

**Example with real values:**
```sql
-- Example configuration (replace with your actual values)
UPDATE edsteward_admin.tenants 
SET saml_config = '{
  "entityId": "http://www.okta.com/exk1a2b3c4d5e6f7g8h9",
  "ssoUrl": "https://moravian-university.okta.com/app/moravian-university_edsteward_1/exk1a2b3c4d5e6f7g8h9/sso/saml",
  "sloUrl": "https://moravian-university.okta.com/app/moravian-university_edsteward_1/exk1a2b3c4d5e6f7g8h9/slo/saml",
  "certificate": "-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAV2ka+55MA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG\nEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNj\n[ACTUAL_CERTIFICATE_CONTENT]\n-----END CERTIFICATE-----",
  "attributeMapping": {
    "email": "email",
    "firstName": "firstName",
    "lastName": "lastName", 
    "department": "department",
    "groups": "groups"
  },
  "enhancedSecurity": true
}'
WHERE id = 'moravian';
```

---

### **Phase 4: OKTA User Assignment**

#### **Step 4.1: Assign Users to Application**
1. In OKTA Admin Console, go to your EdSteward application
2. Click **Assignments** tab
3. Click **Assign** → **Assign to People**
4. Select users who should have access to EdSteward
5. Click **Assign** for each user

#### **Step 4.2: Group Assignment (Recommended)**
1. Create groups in OKTA for different EdSteward roles:
   - `EdSteward-Admin` (for administrators)
   - `EdSteward-ComplianceOfficer` (for compliance officers)
   - `EdSteward-User` (for regular users)

2. Assign the application to these groups:
   - Go to **Assignments** → **Assign to Groups**
   - Select appropriate groups
   - Click **Assign**

---

### **Phase 5: Testing & Validation**

#### **Step 5.1: Test SAML Configuration**
1. **Download Service Provider Metadata:**
   ```bash
   curl -X GET "https://moravian.edsteward.ai/auth/saml/metadata" \
     -H "Accept: application/xml" \
     -o moravian-sp-metadata.xml
   ```

2. **Validate metadata contains:**
   - Correct entity ID: `urn:edsteward:sp:moravian`
   - Correct callback URL: `https://moravian.edsteward.ai/auth/saml/callback`
   - Enhanced security features enabled

#### **Step 5.2: Test Authentication Flow**
1. **Initiate SSO from OKTA:**
   - In OKTA, click on the EdSteward application
   - Should redirect to `moravian.edsteward.ai`
   - Should automatically log you in

2. **Initiate SSO from EdSteward:**
   - Go to `https://moravian.edsteward.ai`
   - Click "Sign in with SAML" or equivalent
   - Should redirect to OKTA
   - Login with Moravian credentials
   - Should redirect back to EdSteward

#### **Step 5.3: Test User Provisioning**
1. Test with a new user (not previously in EdSteward)
2. Login via OKTA SSO
3. Verify user is automatically created in EdSteward
4. Verify user has correct role assignment

---

### **Phase 6: Role Mapping Configuration**

#### **Step 6.1: Configure Role Mapping**
Based on OKTA groups, configure automatic role assignment:

```sql
-- Configure role mapping for Moravian
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{roleMapping}', 
  '{
    "EdSteward-Admin": "admin",
    "EdSteward-ComplianceOfficer": "compliance_officer", 
    "EdSteward-User": "user"
  }'::jsonb
)
WHERE id = 'moravian';
```

#### **Step 6.2: Default Role Configuration**
```sql
-- Set default role for new users
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{defaultRole}', 
  '"user"'::jsonb
)
WHERE id = 'moravian';
```

---

## 🔒 **Enhanced Security Features**

### **Automatically Enabled for Moravian**
Your tenant gets these enhanced security features:

✅ **InResponseTo Validation**: Prevents replay attacks  
✅ **Advanced Timing Controls**: 5-second clock skew tolerance  
✅ **SHA256 Algorithms**: Modern signature validation  
✅ **Comprehensive Logging**: Detailed authentication logs  
✅ **Certificate Rotation**: Ready for future certificate updates  

### **Security Monitoring**
Monitor SAML authentication events:

```bash
# View SAML authentication logs
tail -f /var/log/edsteward/server.log | grep "moravian" | grep "SAML"

# Check enhanced security logs
grep "ENHANCED-SAML" /var/log/edsteward/server.log | grep "moravian"
```

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Issue 1: SAML Response Validation Failed**
**Symptoms:** Users can't login, error about invalid SAML response

**Solutions:**
1. Check certificate configuration:
   ```bash
   # Verify certificate in database
   psql -h [DB_HOST] -U [DB_USER] -d edsteward_admin -c "
   SELECT id, saml_config->>'certificate' 
   FROM tenants WHERE id = 'moravian';"
   ```

2. Verify OKTA certificate matches what's in database
3. Check for extra spaces or line breaks in certificate

#### **Issue 2: User Domain Not Allowed**
**Symptoms:** Error message about domain not allowed

**Solutions:**
1. Verify allowed domains:
   ```sql
   SELECT id, settings->'allowedDomains' 
   FROM edsteward_admin.tenants 
   WHERE id = 'moravian';
   ```

2. Add missing domains:
   ```sql
   UPDATE edsteward_admin.tenants 
   SET settings = jsonb_set(
     settings, 
     '{allowedDomains}', 
     '["moravian.edu", "student.moravian.edu"]'::jsonb
   )
   WHERE id = 'moravian';
   ```

#### **Issue 3: Role Assignment Problems**
**Symptoms:** Users have wrong roles or no access

**Solutions:**
1. Check role mapping configuration
2. Verify OKTA group assignments
3. Test with specific user:
   ```bash
   # Check user role in EdSteward
   psql -h [DB_HOST] -U [DB_USER] -d edsteward_moravian -c "
   SELECT username, email, role, created_at 
   FROM users 
   WHERE email = 'test.user@moravian.edu';"
   ```

---

## 📞 **Support & Contacts**

### **For OKTA Configuration Issues:**
- Moravian IT Help Desk: [Your contact info]
- OKTA Support: [Your OKTA support contact]

### **For EdSteward Configuration Issues:**
- EdSteward Support: [Support contact]
- Database Configuration: [Database admin contact]

### **Emergency Contacts:**
- After-hours IT support: [Emergency contact]
- Critical system issues: [Emergency contact]

---

## 📋 **Post-Implementation Checklist**

### **Technical Verification:**
- [ ] OKTA application created and configured
- [ ] EdSteward SAML configuration updated
- [ ] Certificate properly installed
- [ ] User/group assignments completed
- [ ] Service Provider metadata downloaded
- [ ] Authentication flow tested (both directions)
- [ ] User provisioning tested
- [ ] Role assignment verified
- [ ] Logout functionality tested

### **Security Verification:**
- [ ] Enhanced security features enabled
- [ ] Logging operational
- [ ] Domain restrictions configured
- [ ] Certificate expiration monitoring set up
- [ ] Security event alerts configured

### **Documentation:**
- [ ] Configuration values documented
- [ ] Emergency procedures documented
- [ ] User training materials prepared
- [ ] Support contact information updated

---

## 🎯 **Quick Reference**

### **Moravian-Specific URLs:**
- **EdSteward Login**: `https://moravian.edsteward.ai`
- **SAML Callback**: `https://moravian.edsteward.ai/auth/saml/callback`
- **SP Metadata**: `https://moravian.edsteward.ai/auth/saml/metadata`

### **Entity IDs:**
- **Service Provider**: `urn:edsteward:sp:moravian`
- **Identity Provider**: `http://www.okta.com/exk[YOUR_OKTA_APP_ID]`

### **Key Configuration Values:**
- **Tenant ID**: `moravian`
- **Subdomain**: `moravian.edsteward.ai`
- **Allowed Domains**: `["moravian.edu"]`
- **Default Role**: `user`
- **Enhanced Security**: `enabled`

---

**Document Version**: 1.0  
**Created**: July 7, 2025  
**For**: Moravian University IT Department  
**EdSteward Tenant**: `moravian.edsteward.ai`  
**Status**: Ready for Implementation 