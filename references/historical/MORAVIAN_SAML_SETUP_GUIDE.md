# Moravian University SAML 2.0 Integration Guide for EdSteward

## Overview

This guide walks you through configuring SAML 2.0 authentication for Moravian University's EdSteward compliance portal, supporting both InCommon Federation and direct Shibboleth IdP integration.

## Prerequisites

- Moravian University IT contact with IdP admin access
- EdSteward multi-tenant application running
- Access to Moravian's Identity Provider configuration

## Part 1: Identify Moravian's Identity Provider

### Most Likely Scenarios

#### Option A: InCommon Federation (Recommended)
Moravian University is likely part of InCommon Federation:
- **Federation**: InCommon (https://incommon.org/)
- **Typical IdP URL**: `https://idp.moravian.edu`
- **Entity ID**: `https://idp.moravian.edu/idp/shibboleth`

#### Option B: Direct Shibboleth
If not using InCommon, direct Shibboleth configuration:
- **IdP Software**: Shibboleth IdP
- **Discovery**: Manual configuration needed

#### Option C: Cloud IdP (Less Common)
Some universities use cloud providers:
- **Microsoft Azure AD for Education**
- **Okta for Education**  
- **Google Workspace for Education**

## Part 2: Moravian Service Provider Configuration

### Service Provider Details (What Moravian IT Needs)

Provide these details to Moravian IT for their IdP configuration:

```
Service Provider Entity ID: urn:edsteward:sp:moravian
Assertion Consumer Service URL: https://moravian.edsteward.ai/auth/saml/callback
Single Logout URL: https://moravian.edsteward.ai/auth/saml/logout
SP Metadata URL: https://moravian.edsteward.ai/auth/saml/metadata

Organization: EdSteward Compliance Platform
Contact: [Your IT Contact]
Purpose: Regulatory compliance management for Moravian University
```

### Required Attributes from Moravian

Ask Moravian IT to release these attributes:

| Attribute | SAML Name | Purpose |
|-----------|-----------|---------|
| Email | `urn:oid:0.9.2342.19200300.100.1.3` | User identification |
| First Name | `urn:oid:2.5.4.42` | User profile |
| Last Name | `urn:oid:2.5.4.4` | User profile |
| Display Name | `urn:oid:2.16.840.1.113730.3.1.241` | User profile |
| Groups/Affiliation | `urn:oid:1.3.6.1.4.1.5923.1.5.1.1` | Role assignment |
| Department | `urn:oid:2.5.4.11` | Organization info |

### Role Mapping Strategy

Map Moravian affiliations to EdSteward roles:

```
eduPersonAffiliation:
- faculty → compliance_officer
- staff → compliance_officer  
- employee → compliance_officer
- student → user
- member → user

Specific Groups (if available):
- compliance-team → admin
- it-staff → admin
- department-heads → compliance_officer
```

## Part 3: EdSteward Configuration

### Step 1: Update Moravian Tenant SAML Config

Connect to your EdSteward database and run:

```sql
-- Update Moravian tenant with SAML configuration
UPDATE tenants 
SET 
  saml_config = jsonb_build_object(
    'entityId', 'https://idp.moravian.edu/idp/shibboleth',
    'ssoUrl', 'https://idp.moravian.edu/idp/profile/SAML2/Redirect/SSO',
    'sloUrl', 'https://idp.moravian.edu/idp/profile/SAML2/Redirect/SLO',
    'certificate', '-----BEGIN CERTIFICATE-----
[MORAVIAN_IDP_CERTIFICATE_HERE]
-----END CERTIFICATE-----',
    'attributeMapping', jsonb_build_object(
      'email', 'urn:oid:0.9.2342.19200300.100.1.3',
      'firstName', 'urn:oid:2.5.4.42',
      'lastName', 'urn:oid:2.5.4.4',
      'username', 'urn:oid:0.9.2342.19200300.100.1.1',
      'groups', 'urn:oid:1.3.6.1.4.1.5923.1.5.1.1',
      'department', 'urn:oid:2.5.4.11'
    )
  ),
  settings = settings || jsonb_build_object(
    'allowedDomains', '["moravian.edu"]'::jsonb,
    'enableAutoProvisioning', true,
    'defaultRole', 'user'
  )
WHERE id = 'moravian';
```

### Step 2: Verify Tenant Configuration

Check the configuration:

```sql
SELECT 
  id,
  name,
  domain,
  subdomain,
  saml_config,
  settings->'allowedDomains' as allowed_domains,
  settings->'enableAutoProvisioning' as auto_provision
FROM tenants 
WHERE id = 'moravian';
```

### Step 3: Test SAML Metadata Generation

Visit the Moravian SP metadata endpoint:
```
https://moravian.edsteward.ai/auth/saml/metadata
```

This should return valid XML metadata that Moravian IT can import.

## Part 4: Testing the Integration

### Step 1: Initial Test

1. **Visit**: https://moravian.edsteward.ai/auth
2. **Look for**: "Sign in with Moravian University" button
3. **Click**: Should redirect to Moravian's IdP
4. **Login**: Use Moravian credentials
5. **Return**: Should create user and log into EdSteward

### Step 2: Verify User Creation

Check that users are created properly:

```sql
SELECT 
  username,
  email,
  role,
  department,
  identity_provider,
  provider_id,
  created_at
FROM users 
WHERE provider_id = 'moravian' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Step 3: Test Role Assignment

Verify roles are assigned correctly based on Moravian groups/affiliations.

## Part 5: Production Deployment

### Environment Variables (if needed)

For any Moravian-specific environment variables:

```env
# Moravian SAML Configuration (stored in database, not env vars)
MORAVIAN_DOMAIN=moravian.edu
MORAVIAN_SUPPORT_EMAIL=it-support@moravian.edu

# Base domain for tenant routing
BASE_DOMAIN=edsteward.ai
```

### SSL/HTTPS Requirements

Ensure all Moravian SAML endpoints use HTTPS:
- ✅ `https://moravian.edsteward.ai/auth/saml/callback`
- ✅ `https://moravian.edsteward.ai/auth/saml/logout`
- ✅ `https://moravian.edsteward.ai/auth/saml/metadata`

## Part 6: Moravian IT Checklist

### What Moravian IT Needs to Do

1. **Add Service Provider** to their IdP:
   - Import metadata from: `https://moravian.edsteward.ai/auth/saml/metadata`
   - Or configure manually with SP details above

2. **Configure Attribute Release**:
   - Release required attributes (email, name, groups)
   - Set up appropriate attribute mappings

3. **Test with Pilot Users**:
   - Start with IT personnel
   - Expand to compliance team
   - Full rollout to intended user base

4. **Provide IdP Details** to EdSteward team:
   - Entity ID
   - SSO URL  
   - SLO URL (if available)
   - Public certificate
   - Attribute names and formats

### Communication Template for Moravian IT

```
Subject: SAML SSO Setup for EdSteward Compliance Platform

Hi [Moravian IT Contact],

We're setting up SAML SSO for Moravian University's EdSteward compliance platform.

Service Provider Details:
- Application: EdSteward Compliance Portal
- SP Entity ID: urn:edsteward:sp:moravian
- ACS URL: https://moravian.edsteward.ai/auth/saml/callback
- Metadata: https://moravian.edsteward.ai/auth/saml/metadata

We need:
1. Your IdP Entity ID
2. SSO URL
3. Public certificate
4. Confirmation of attribute release (email, name, groups)

Let us know when you're ready to test!

Thanks,
[Your Name]
```

## Part 7: Troubleshooting

### Common Issues

1. **"Invalid SAML Response"**
   - Check certificate in database matches Moravian's current cert
   - Verify entity IDs match exactly
   - Check time synchronization

2. **"User domain not allowed"**
   - Verify `allowedDomains` includes `moravian.edu`
   - Check user's email domain from SAML assertion

3. **"Auto-provisioning failed"**
   - Check required attributes are present
   - Verify attribute mapping in database
   - Review SAML assertion content

### Debug Mode

Enable SAML debugging for Moravian tenant:

```sql
UPDATE tenants 
SET settings = settings || '{"debug": true}'::jsonb 
WHERE id = 'moravian';
```

### Logging

Monitor Moravian SAML events:

```bash
# View tenant-specific logs
curl -s https://moravian.edsteward.ai/api/health | jq .tenant

# Check application logs for SAML events
docker logs -f edsteward-app | grep -i "moravian\|saml"
```

## Part 8: Post-Setup Configuration

### User Management

Once SAML is working:

1. **Review Auto-Created Users**: Check roles assigned correctly
2. **Assign Administrators**: Promote key users to admin role
3. **Department Mapping**: Verify department information is captured
4. **Group Sync**: Set up any additional group/role synchronization

### Ongoing Maintenance

1. **Certificate Rotation**: Monitor for IdP certificate changes
2. **User Auditing**: Regular review of active users
3. **Attribute Updates**: Handle changes in Moravian's attribute release
4. **Access Reviews**: Periodic review of user roles and permissions

---

## Summary

This setup provides:
- ✅ **Single Sign-On** for Moravian users
- ✅ **Automatic User Provisioning** from Moravian directory
- ✅ **Role-Based Access** based on Moravian groups
- ✅ **Tenant Isolation** - Moravian users only see Moravian data
- ✅ **Domain Validation** - Only `@moravian.edu` emails allowed

**Next Steps**: Contact Moravian IT with the Service Provider details and begin testing! 