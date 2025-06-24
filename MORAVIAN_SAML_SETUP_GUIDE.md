# Moravian University SAML SSO Setup Guide

## Overview
This guide walks you through setting up SAML 2.0 Single Sign-On (SSO) between Moravian University's Okta identity provider and the EdSteward application.

## Prerequisites
- Okta administrator access for Moravian University
- EdSteward application deployed at `moravian.edsteward.ai`
- SSL certificates configured for the domain

## Part 1: Okta Application Configuration

### Step 1: Create SAML Application in Okta

1. **Login to Okta Admin Console**
   - Navigate to your Moravian University Okta admin dashboard
   - Go to **Applications** → **Applications**

2. **Create New Application**
   - Click **Create App Integration**
   - Select **SAML 2.0**
   - Click **Next**

3. **General Settings**
   - **App name**: `EdSteward - Moravian University`
   - **App logo**: Upload Moravian logo if available
   - **App visibility**: Configure as needed for Moravian users
   - Click **Next**

### Step 2: Configure SAML Settings

#### SAML Settings for Production
```
Single sign on URL: https://moravian.edsteward.ai/auth/saml/callback
Audience URI (SP Entity ID): urn:edsteward:sp:moravian
Default RelayState: moravian
Name ID format: EmailAddress
Application username: Email
```

#### Advanced Settings
```
Response: Signed
Assertion Signature: Signed
Signature Algorithm: RSA_SHA256
Digest Algorithm: SHA256
Assertion Encryption: Unencrypted (recommended for initial setup)
SAML Single Logout: Enabled
SP Issuer: urn:edsteward:sp:moravian
```

### Step 3: Attribute Statements (Claims)

Configure these attribute mappings for Moravian University:

| Name | Name format | Value |
|------|-------------|-------|
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | URI Reference | `user.email` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | URI Reference | `user.firstName` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | URI Reference | `user.lastName` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` | URI Reference | `user.login` |
| `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups` | URI Reference | `isMemberOfGroupName("EdSteward-Users")` |

### Step 4: Group Attribute Statements

| Name | Name format | Filter | Value |
|------|-------------|--------|-------|
| `groups` | Basic | Matches regex | `EdSteward-.*` | `user.groups` |

## Part 2: Okta Groups and Users Setup

### Step 1: Create Groups for Moravian University

Create these groups in Okta for role management:

1. **EdSteward-Moravian-Users** (Basic compliance access)
2. **EdSteward-Moravian-Officers** (Compliance officer access)
3. **EdSteward-Moravian-Admins** (Administrative access)

### Step 2: Assign Moravian Users

1. Go to **Directory** → **People**
2. Select Moravian University users with `@moravian.edu` email addresses
3. Assign to appropriate groups based on their roles:
   - Faculty → EdSteward-Moravian-Users
   - Compliance Staff → EdSteward-Moravian-Officers
   - IT/Admin Staff → EdSteward-Moravian-Admins
4. Assign the EdSteward application to users

## Part 3: EdSteward Configuration

### Step 1: Update Environment Variables

Set the following environment variables in your deployment:

```bash
# Moravian University SAML/Okta Configuration
MORAVIAN_OKTA_SSO_URL=https://moravianuniversity.okta.com/app/edsteward/[APP_ID]/sso/saml
MORAVIAN_OKTA_SLO_URL=https://moravianuniversity.okta.com/app/edsteward/[APP_ID]/slo/saml
MORAVIAN_OKTA_ENTITY_ID=http://www.okta.com/[APP_ID]
MORAVIAN_OKTA_CERT="-----BEGIN CERTIFICATE-----
[OKTA_CERTIFICATE_CONTENT]
-----END CERTIFICATE-----"
```

### Step 2: Get Okta Certificate

1. In your Okta app, go to **Sign On** tab
2. Click **View Setup Instructions**
3. Copy the X.509 Certificate
4. Add it to the `MORAVIAN_OKTA_CERT` environment variable

### Step 3: Update Tenant Configuration

Run the tenant migration to update the Moravian tenant with SAML config:

```bash
npm run migrate:tenants
```

## Part 4: Testing and Validation

### Step 1: Test SAML Configuration

1. **Access the login page**:
   ```
   https://moravian.edsteward.ai/login
   ```

2. **Click "Sign in with Okta"** or navigate directly to:
   ```
   https://moravian.edsteward.ai/auth/saml/login/moravian
   ```

3. **Verify redirect to Okta** and successful authentication

### Step 2: Test Service Provider Metadata

Access the SP metadata endpoint:
```
https://moravian.edsteward.ai/auth/saml/metadata/moravian
```

This should return valid XML metadata that can be imported into Okta.

### Step 3: Test User Provisioning

1. Login with a test `@moravian.edu` account
2. Verify user is created automatically in EdSteward
3. Check that user roles are mapped correctly based on group membership

## Part 5: Role Mapping Configuration

The system automatically maps Okta groups to EdSteward roles:

- **EdSteward-Moravian-Admins** → `admin` role
- **EdSteward-Moravian-Officers** → `compliance_officer` role
- **EdSteward-Moravian-Users** → `user` role (default)

## Part 6: Troubleshooting

### Common Issues and Solutions

1. **"SAML not configured for Moravian tenant"**
   - Ensure environment variables are set correctly
   - Verify tenant migration has run successfully

2. **"Authentication failed"**
   - Check Okta certificate is correctly formatted
   - Verify SSO URL matches exactly

3. **"User domain not allowed"**
   - Ensure user email domain is `moravian.edu`
   - Check tenant `allowedDomains` configuration

4. **Role mapping not working**
   - Verify user is assigned to correct Okta groups
   - Check group attribute statements in Okta

### Debug Endpoints

- **Metadata**: `https://moravian.edsteward.ai/auth/saml/metadata/moravian`
- **Login**: `https://moravian.edsteward.ai/auth/saml/login/moravian`
- **Callback**: `https://moravian.edsteward.ai/auth/saml/callback`

## Part 7: Security Considerations

1. **Certificate Management**
   - Regularly rotate SAML certificates
   - Monitor certificate expiration dates
   - Use secure storage for private keys

2. **User Access Review**
   - Regularly review user group assignments
   - Audit login activity
   - Remove access for departed users

3. **Network Security**
   - Ensure all SAML traffic uses HTTPS
   - Configure proper firewall rules
   - Monitor for suspicious authentication attempts

## Contact Information

For technical support or questions about this setup:
- **EdSteward Support**: support@edsteward.ai
- **Moravian IT**: [Moravian IT contact information]

## Additional Resources

- [Okta SAML Documentation](https://developer.okta.com/docs/concepts/saml/)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [EdSteward Documentation](https://docs.edsteward.ai) 