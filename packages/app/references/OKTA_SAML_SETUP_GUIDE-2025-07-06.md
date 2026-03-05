# Okta SAML 2.0 Integration Guide for EdSteward

## Overview

This guide walks you through configuring Okta as your SAML 2.0 identity provider for EdSteward, supporting both local development and AWS production environments.

## Prerequisites

- Okta administrator access
- EdSteward application running
- SAML certificates generated (run `python3 enable_saml_authentication.py`)

## Part 1: Okta Application Configuration

### Step 1: Create SAML Application in Okta

1. **Login to Okta Admin Console**
   - Navigate to your Okta admin dashboard
   - Go to **Applications** → **Applications**

2. **Create New Application**
   - Click **Create App Integration**
   - Select **SAML 2.0**
   - Click **Next**

3. **General Settings**
   - **App name**: `EdSteward`
   - **App logo**: Upload your logo (optional)
   - **App visibility**: Configure as needed
   - Click **Next**

### Step 2: Configure SAML Settings

#### SAML Settings (Development)
```
Single sign on URL: http://localhost:3000/auth/saml/callback/okta
Audience URI (SP Entity ID): urn:edsteward:sp
Default RelayState: (leave empty)
Name ID format: EmailAddress
Application username: Email
```

#### SAML Settings (Production)
```
Single sign on URL: https://yourdomain.com/auth/saml/callback/okta
Audience URI (SP Entity ID): urn:edsteward:sp
Default RelayState: (leave empty)
Name ID format: EmailAddress
Application username: Email
```

#### Advanced Settings
```
Response: Signed
Assertion Signature: Signed
Signature Algorithm: RSA_SHA256
Digest Algorithm: SHA256
Assertion Encryption: Encrypted
SAML Single Logout: Enabled
SP Issuer: urn:edsteward:sp
Signature Certificate: (upload your SP certificate)
```

### Step 3: Attribute Statements (Claims)

Configure these attribute mappings:

| Name | Name format | Value |
|------|-------------|-------|
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | URI Reference | `user.email` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | URI Reference | `user.firstName` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | URI Reference | `user.lastName` |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` | URI Reference | `user.login` |
| `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups` | URI Reference | `isMemberOfGroupName("EdSteward-Users")` |
| `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` | URI Reference | `appuser.role` |

### Step 4: Group Attribute Statements

| Name | Name format | Filter | Value |
|------|-------------|--------|-------|
| `groups` | Basic | Matches regex | `EdSteward-.*` | `user.groups` |

## Part 2: Okta Groups and Users

### Step 1: Create Groups

Create these groups in Okta:

1. **EdSteward-Users** (Basic access)
2. **EdSteward-ComplianceOfficers** (Advanced access)
3. **EdSteward-Admins** (Administrative access)

### Step 2: Assign Users

1. Go to **Directory** → **People**
2. Select users and assign to appropriate groups
3. Assign the EdSteward application to users

### Step 3: Create Custom Attribute (Optional)

For role mapping, create a custom user attribute:

1. Go to **Directory** → **Profile Editor**
2. Select **User (default)**
3. Add attribute:
   - **Display name**: `EdSteward Role`
   - **Variable name**: `regulatoryTrackrRole`
   - **Description**: `Role in EdSteward application`
   - **Type**: `string`
   - **Enum**: `user`, `compliance_officer`, `admin`

## Part 3: Application Configuration

### Step 1: Update Environment Variables

Update your environment variables with Okta details:

#### Local Development (.env.local)
```bash
# Okta SAML Configuration
OKTA_SSO_URL=https://your-okta-domain.okta.com/app/your-app-id/sso/saml
OKTA_SLO_URL=https://your-okta-domain.okta.com/app/your-app-id/slo/saml
OKTA_ENTITY_ID=http://www.okta.com/your-app-id
OKTA_CERT="-----BEGIN CERTIFICATE-----
MIICmzCCAYMCBgF...
-----END CERTIFICATE-----"

# SAML Service Provider
SAML_SP_ENTITY_ID=urn:edsteward:sp
SAML_CALLBACK_URL=http://localhost:3000/auth/saml/callback
SAML_SLO_URL=http://localhost:3000/auth/saml/logout
ENABLE_SAML=true
```

#### Production (AWS)
```bash
# Okta SAML Configuration
OKTA_SSO_URL=https://your-okta-domain.okta.com/app/your-app-id/sso/saml
OKTA_SLO_URL=https://your-okta-domain.okta.com/app/your-app-id/slo/saml
OKTA_ENTITY_ID=http://www.okta.com/your-app-id
OKTA_CERT="-----BEGIN CERTIFICATE-----
MIICmzCCAYMCBgF...
-----END CERTIFICATE-----"

# SAML Service Provider
SAML_SP_ENTITY_ID=urn:edsteward:sp
SAML_CALLBACK_URL=https://yourdomain.com/auth/saml/callback
SAML_SLO_URL=https://yourdomain.com/auth/saml/logout
ENABLE_SAML=true
```

### Step 2: Get Okta Certificate

1. In your Okta app, go to **Sign On** tab
2. Click **View Setup Instructions**
3. Copy the X.509 Certificate
4. Add it to your environment variables

### Step 3: Configure Role Mapping

Update your SAML attribute mapping in `server/config/saml.ts`:

```typescript
// In extractUserAttributes function
if (idpType === 'okta') {
  const groups = profile[mapping.groups] || [];
  
  // Map Okta groups to application roles
  let role = 'user'; // default
  
  if (groups.includes('EdSteward-Admins')) {
    role = 'admin';
  } else if (groups.includes('EdSteward-ComplianceOfficers')) {
    role = 'compliance_officer';
  }
  
  extractedData.role = role;
}
```

## Part 4: Testing and Validation

### Step 1: Test SAML Configuration

1. **Start your application**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **Access login page**:
   ```
   http://localhost:3000/login.html
   ```

3. **Click "Sign in with Okta"**

4. **Verify redirect to Okta**

### Step 2: Test Service Provider Metadata

Access your SP metadata:
```
http://localhost:3000/auth/saml/metadata
```

Upload this metadata to Okta if needed.

### Step 3: Test Authentication Flow

1. **Login** via Okta
2. **Verify user creation** in database
3. **Test protected endpoints**:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/regulations
   ```

### Step 4: Test Single Logout

1. Navigate to: `http://localhost:3000/auth/saml/logout/okta`
2. Verify logout from both app and Okta

## Part 5: Advanced Configuration

### Federation Support

For supporting multiple institutions via InCommon:

1. **Enable federation in Okta**:
   - Configure Okta as hub for multiple IdPs
   - Set up identity provider discovery

2. **Configure discovery service**:
   ```typescript
   // In your SAML config
   {
     entryPoint: 'https://wayf.incommonfederation.org/DS',
     additionalAuthorizeParams: {
       entityID: 'https://your-institution.edu/idp',
       return: 'http://localhost:3000/auth/saml/callback/incommon'
     }
   }
   ```

### Just-in-Time (JIT) Provisioning

Configure automatic user provisioning:

1. **In Okta application**:
   - Enable JIT provisioning
   - Configure attribute mappings

2. **In your application**:
   - Ensure user creation logic handles SAML attributes
   - Map roles appropriately

### Multiple Environments

For different environments (dev/staging/prod):

1. **Create separate Okta applications** for each environment
2. **Use environment-specific configurations**
3. **Configure appropriate redirect URLs**

## Part 6: Security Best Practices

### Certificate Management

1. **Generate strong certificates**:
   ```bash
   openssl genrsa -out sp-key.pem 4096
   openssl req -new -x509 -key sp-key.pem -out sp-cert.pem -days 365
   ```

2. **Rotate certificates regularly** (annually recommended)

3. **Store certificates securely** (Azure Key Vault, AWS Secrets Manager)

### Session Security

1. **Configure secure session settings**:
   ```typescript
   {
     secret: process.env.SESSION_SECRET, // 256-bit random string
     secure: true, // HTTPS only in production
     httpOnly: true,
     maxAge: 8 * 60 * 60 * 1000, // 8 hours
     sameSite: 'strict'
   }
   ```

2. **Use Redis for session storage** in production

### SAML Security

1. **Always validate signatures**:
   ```typescript
   {
     wantAssertionsSigned: true,
     wantAuthnResponseSigned: true,
     validateInResponseTo: 'always'
   }
   ```

2. **Configure appropriate timeouts**:
   ```typescript
   {
     requestIdExpirationPeriodMs: 28800000, // 8 hours
     clockSkew: 5000 // 5 seconds
   }
   ```

## Troubleshooting

### Common Issues

1. **"Invalid SAML Response"**
   - Check certificate configuration
   - Verify entity IDs match
   - Check time synchronization

2. **"User not found after SAML login"**
   - Verify attribute mappings
   - Check user creation logic
   - Review SAML response attributes

3. **"SAML assertion expired"**
   - Check server time synchronization
   - Adjust clock skew settings
   - Verify assertion validity period

### Debug Mode

Enable SAML debugging:

```typescript
// In your SAML config
{
  debug: process.env.NODE_ENV === 'development',
  logoutCallbackUrl: '/auth/logout-callback'
}
```

### Logging

Monitor SAML events:

```bash
# View SAML authentication logs
docker logs -f edsteward-app-dev-1 | grep SAML
```

## Support

For additional support:

1. **Okta Documentation**: [SAML App Integration Guide](https://developer.okta.com/docs/guides/saml-application-setup/)
2. **node-saml Documentation**: [passport-saml](https://github.com/node-saml/passport-saml)
3. **Application logs**: Check server logs for detailed error messages 