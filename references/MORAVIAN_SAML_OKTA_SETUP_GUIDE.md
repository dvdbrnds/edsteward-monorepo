# Moravian University SAML/OKTA SSO Setup Guide for EdSteward

## 🚀 TL;DR - Quick Setup for Expert IT Teams

**For IT experts who want to get straight to business:**

### Key Information:
- **Service Provider Entity ID**: `urn:edsteward:sp:moravian`
- **ACS URL**: `https://moravian.edsteward.ai/auth/saml/callback`
- **Metadata URL**: `https://moravian.edsteward.ai/auth/saml/metadata`
- **SSO Login URL**: `https://moravian.edsteward.ai/auth/saml/login/moravian`
- **Domain Restriction**: `moravian.edu` (enforced)
- **Auto-Provisioning**: Enabled with role mapping

### Required from Moravian IT:
1. **OKTA SSO URL**: `https://your-okta-domain.okta.com/app/edsteward/[app-id]/sso/saml`
2. **OKTA Entity ID**: `http://www.okta.com/[app-id]`
3. **X.509 Certificate**: From OKTA app configuration
4. **Attribute Release**: Email, First Name, Last Name, Groups/Affiliations

### Attribute Mapping:
```
Email: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
First Name: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname
Last Name: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname
Username: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
Groups: http://schemas.microsoft.com/ws/2008/06/identity/claims/groups
```

### Role Assignment Logic:
- **Admin**: IT administrators, compliance administrators
- **Compliance Officer**: Faculty, staff, department heads
- **User**: Students, general users (read-only access)

### Security Requirements:
- **Response Signing**: Required
- **Assertion Signing**: Required  
- **Algorithm**: RSA-SHA256
- **Transport**: TLS 1.2/1.3 mandatory

---

## 📖 Complete Setup Guide

### Overview

EdSteward is a regulatory compliance platform designed specifically for higher education institutions. Moravian University has a dedicated, isolated tenant instance at **https://moravian.edsteward.ai/** with enterprise-grade security and complete data separation.

**Architecture**: Node.js/Express backend, React frontend, PostgreSQL database  
**SAML Library**: @node-saml/node-saml (industry standard)  
**Security**: End-to-end encryption, tenant isolation, HTTPS/TLS 1.3  
**Infrastructure**: AWS ECS with Application Load Balancer  

---

## 🎯 Part 1: OKTA Application Configuration

### Step 1: Create SAML 2.0 Application in OKTA

1. **Login to OKTA Admin Console**
   - Navigate to your OKTA admin dashboard
   - Go to **Applications** → **Applications**

2. **Create New Application**
   - Click **Create App Integration**
   - Select **SAML 2.0**
   - Click **Next**

3. **General Settings**
   - **App name**: `EdSteward - Moravian University`
   - **App logo**: Optional (upload Moravian logo if desired)
   - **App visibility**: Configure based on your policy
   - Click **Next**

### Step 2: Configure SAML Settings

#### Basic SAML Configuration
```
Single Sign On URL: https://moravian.edsteward.ai/auth/saml/callback
Audience URI (SP Entity ID): urn:edsteward:sp:moravian
Default RelayState: moravian
Name ID format: EmailAddress
Application username: Email
Update application username on: Create and update
```

#### Advanced SAML Settings
```
Response: Signed (Required)
Assertion Signature: Signed (Required)
Signature Algorithm: RSA_SHA256 (Required)
Digest Algorithm: SHA256 (Required)
Assertion Encryption: Unencrypted (Optional)
SAML Single Logout: Enabled (Required)
Honor Force Authentication: Yes (Required)
```

#### Single Logout (SLO) Configuration
```
Enable Single Logout: Yes
SP Issuer: urn:edsteward:sp:moravian
Logout URL: https://moravian.edsteward.ai/auth/saml/logout
Participate in SLO: Yes
Logout Request URL: https://moravian.edsteward.ai/auth/saml/slo
Session Index Required: Yes
Binding Type: POST (Recommended)
```

#### Service Provider Configuration
```
Honor Force Authentication: Yes
SAML Issuer ID: urn:edsteward:sp:moravian
Authn Context Class Reference: PasswordProtectedTransport
Want Assertions Signed: Yes (Required)
Want Authentication Response Signed: Yes (Required)
Subject Name ID Format: EmailAddress
Request Compression: Disabled (Recommended)
Signature Certificate: Upload Service Provider certificate (if available)
```

### Step 3: Configure Attribute Statements

**Required Attributes** - Configure these in OKTA:

| Name | Name Format | Value | Description |
|------|-------------|-------|-------------|
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | URI Reference | `user.email` | Primary identifier |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | URI Reference | `user.firstName` | User's first name |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | URI Reference | `user.lastName` | User's last name |
| `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` | URI Reference | `user.login` | Username |

**Group Attribute** (for role assignment):

| Name | Name Format | Filter | Value |
|------|-------------|--------|-------|
| `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups` | URI Reference | Matches regex `EdSteward-.*` | `user.groups` |

### Step 4: Create OKTA Groups for Role Mapping

Create these groups in OKTA for proper role assignment:

1. **EdSteward-Moravian-Admins**
   - **Purpose**: Administrative access to all features
   - **Members**: IT administrators, compliance directors
   - **Permissions**: Full platform access, user management, system configuration

2. **EdSteward-Moravian-Officers**
   - **Purpose**: Compliance management and oversight
   - **Members**: Faculty, staff, department heads, compliance team
   - **Permissions**: Regulation management, deadline tracking, reporting

3. **EdSteward-Moravian-Users**
   - **Purpose**: Basic compliance access
   - **Members**: Students, general staff, affiliates
   - **Permissions**: Read-only access to applicable regulations

---

## 🔧 Part 2: EdSteward Service Provider Configuration

### Service Provider Details

**Metadata URL**: https://moravian.edsteward.ai/auth/saml/metadata

The complete Service Provider metadata is available at the above URL and can be imported directly into OKTA.

### Manual Configuration (if metadata import fails)

```xml
<!-- Service Provider Configuration -->
<EntityDescriptor entityID="urn:edsteward:sp:moravian">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
      Location="https://moravian.edsteward.ai/auth/saml/callback" 
      index="0" />
    <SingleLogoutService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
      Location="https://moravian.edsteward.ai/auth/saml/logout" />
  </SPSSODescriptor>
</EntityDescriptor>
```

### Security Requirements

**Network Access Required:**
```
Outbound HTTPS (443) to:
- Your OKTA SSO URL
- Your OKTA SLO URL (if configured)

Inbound HTTPS (443) from:
- Your OKTA server IP ranges
- User browsers (for redirects)
```

**Firewall Configuration:**
- Allow outbound connections to `*.okta.com` on port 443
- Ensure `moravian.edsteward.ai` is accessible from campus network
- No inbound firewall changes required

---

## 🔄 Part 3: Authentication Flow

### User Authentication Process

1. **Initiation**: User visits https://moravian.edsteward.ai/
2. **Login Option**: User clicks "Sign in with Moravian University SSO"
3. **SAML Request**: EdSteward generates signed SAML AuthnRequest
4. **Redirect**: User is redirected to OKTA with SAML request
5. **Authentication**: User authenticates with Moravian credentials in OKTA
6. **SAML Response**: OKTA sends signed SAML assertion to EdSteward
7. **Validation**: EdSteward validates signature and creates/updates user account
8. **Access Granted**: User is logged into EdSteward with appropriate role

### Single Logout (SLO) Process

1. **Logout Initiation**: User clicks logout in EdSteward
2. **SLO Request**: EdSteward sends SAML LogoutRequest to OKTA
3. **OKTA Logout**: OKTA terminates user session
4. **Confirmation**: OKTA sends LogoutResponse back to EdSteward
5. **Complete**: User is fully logged out from both systems

---

## 👥 Part 4: User Provisioning & Role Management

### Automatic User Provisioning

**Enabled**: Users are automatically created on first login  
**Domain Validation**: Only `@moravian.edu` email addresses allowed  
**Profile Sync**: User information updated on each login  

### Role Assignment Logic

Based on OKTA group membership:

```javascript
// Role mapping algorithm
if (userGroups.includes('EdSteward-Moravian-Admins')) {
  role = 'admin';
} else if (userGroups.includes('EdSteward-Moravian-Officers')) {
  role = 'compliance_officer';
} else {
  role = 'user'; // default for all authenticated users
}
```

### Permission Matrix

| Role | Regulations | Deadlines | Reports | User Mgmt | Admin Tools |
|------|-------------|-----------|---------|-----------|-------------|
| **User** | Read-only | View own | Basic | None | None |
| **Compliance Officer** | Full access | Manage all | Advanced | None | None |
| **Admin** | Full access | Manage all | Full access | Full access | Full access |

---

## 🧪 Part 5: Testing & Validation

### Pre-Production Testing

1. **Metadata Validation**
   ```bash
   curl -s https://moravian.edsteward.ai/auth/saml/metadata
   # Should return valid SAML metadata XML
   ```

2. **OKTA Configuration Test**
   - Use OKTA's SAML test feature
   - Verify attribute release
   - Check group membership propagation

3. **End-to-End Flow Test**
   - Complete authentication flow
   - Verify user creation
   - Test role assignment
   - Validate session management

### Pilot Testing Plan

**Phase 1: IT Team Testing (Week 1)**
- IT administrators test full authentication flow
- Verify administrative access and features
- Test edge cases and error scenarios

**Phase 2: Compliance Team Testing (Week 2)**  
- Compliance officers test core functionality
- Verify regulation access and deadline management
- Test reporting and analytics features

**Phase 3: Limited Faculty Testing (Week 3)**
- Select faculty members test user experience
- Verify read-only access and navigation
- Gather feedback on usability

**Phase 4: Full Deployment (Week 4)**
- Enable access for all intended users
- Monitor system performance and usage
- Provide user training and support

---

## 📋 Part 6: Information Required from Moravian IT

### Please Provide the Following:

#### 1. OKTA Identity Provider Configuration
```
OKTA SSO URL: ________________________________
OKTA Entity ID: ______________________________
OKTA SLO URL (optional): ____________________
```

#### 2. X.509 Certificate
```
-----BEGIN CERTIFICATE-----
[Paste your OKTA X.509 certificate here]
-----END CERTIFICATE-----
```

**Certificate Requirements:**
- Must be in PEM format (Base64-encoded)
- Include full certificate chain if using intermediate CAs
- Certificate must be valid (not expired)
- Must support RSA_SHA256 signature algorithm
- Minimum 2048-bit RSA key length (4096-bit recommended)
- Certificate should be dedicated to SAML signing (best practice)

#### 3. User Access Control
```
Authorized Groups: ___________________________
Pilot Test Users: ____________________________
Estimated Total Users: _______________________
```

#### 4. Technical Contacts
```
Primary IT Contact: __________________________
Email: _______________________________________
Phone: _______________________________________

Secondary Contact: ___________________________
Email: _______________________________________
```

---

## 🚨 Part 7: Security Considerations

### Data Protection

**Tenant Isolation**: Moravian data is completely isolated from other institutions  
**Encryption**: All data encrypted in transit (TLS 1.3) and at rest (AES-256)  
**Access Logging**: All authentication and access events are logged  
**Compliance**: SOC 2 Type II, FERPA, GDPR compliant  

### SAML Security Features

**Signature Validation**: All SAML responses and assertions must be signed  
**Timestamp Validation**: Strict NotBefore/NotOnOrAfter checking  
**Audience Validation**: Ensures responses are intended for Moravian  
**Replay Protection**: InResponseTo validation prevents replay attacks  

### Network Security

**IP Allowlisting**: Can be configured if required by Moravian policy  
**Certificate Pinning**: OKTA certificate is pinned for validation  
**Session Management**: Secure session handling with automatic timeout  
**Clock Synchronization**: Strict timing validation with 5-second tolerance  
**Request ID Validation**: InResponseTo validation prevents replay attacks  
**Session Index Tracking**: Full SLO support with session-specific logout  

---

## 🔧 Part 8: Technical Implementation Details

### SAML Configuration Parameters

Based on the latest @node-saml/node-saml specifications:

```javascript
// EdSteward SAML Configuration for Moravian
{
  callbackUrl: "https://moravian.edsteward.ai/auth/saml/callback",
  entryPoint: "[MORAVIAN_OKTA_SSO_URL]",
  issuer: "urn:edsteward:sp:moravian",
  audience: "urn:edsteward:sp:moravian",
  idpCert: "[MORAVIAN_OKTA_CERTIFICATE]",
  signatureAlgorithm: "RSA_SHA256",
  digestAlgorithm: "SHA256",
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,
  identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  acceptedClockSkewMs: 5000,
  maxAssertionAgeMs: 300000,
  validateInResponseTo: "always",
  disableRequestedAuthnContext: false,
  authnContext: "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport",
  logoutUrl: "[MORAVIAN_OKTA_SLO_URL]",
  logoutCallbackUrl: "https://moravian.edsteward.ai/auth/saml/logout",
  requestIdExpirationPeriodMs: 28800000,
  skipRequestCompression: false,
  forceAuthn: false,
  passive: false,
  spNameQualifier: "urn:edsteward:sp:moravian"
}
```

### Attribute Mapping Configuration

```javascript
// Incoming SAML attribute mapping
{
  email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  firstName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  groups: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
}
```

---

## 📞 Part 9: Support & Troubleshooting

### Common Issues & Solutions

**Issue**: "Invalid SAML Response" error
**Solution**: 
- Verify OKTA certificate matches what's configured
- Check entity IDs match exactly
- Ensure system clocks are synchronized

**Issue**: "User domain not allowed" error  
**Solution**:
- Verify user's email ends with `@moravian.edu`
- Check SAML assertion contains correct email format

**Issue**: "Auto-provisioning failed" error
**Solution**:
- Verify required attributes are being sent by OKTA
- Check attribute mapping configuration
- Review SAML assertion content

### Debug Mode

For initial testing, we can enable detailed SAML logging:
- All SAML requests and responses logged
- Attribute mapping details captured
- Authentication flow step-by-step tracking

### Support Contacts

**Technical Support**: Available during implementation  
**Platform Support**: https://moravian.edsteward.ai/support  
**Emergency Contact**: Available 24/7 during deployment  

---

## ✅ Part 10: Post-Implementation Checklist

### Immediate Verification (Day 1)

- [ ] OKTA app configuration completed
- [ ] EdSteward metadata imported into OKTA
- [ ] Test user authentication successful
- [ ] Role assignment working correctly
- [ ] All required attributes being passed
- [ ] Single logout functioning (if configured)

### Week 1 Validation

- [ ] IT team pilot testing completed
- [ ] No authentication errors in logs
- [ ] Performance metrics within acceptable range
- [ ] Security scanning completed
- [ ] Backup authentication method verified

### Ongoing Monitoring

- [ ] User adoption tracking enabled
- [ ] Authentication failure monitoring
- [ ] Regular certificate expiration checks
- [ ] Quarterly access review process
- [ ] Annual security assessment

---

## 🎯 Next Steps

1. **Immediate**: Review this document and gather required information
2. **Week 1**: Configure OKTA application with provided specifications
3. **Week 2**: Coordinate with EdSteward team for configuration verification
4. **Week 3**: Conduct pilot testing with IT team
5. **Week 4**: Full deployment to intended user base

---

## 📄 Appendix A: Sample OKTA Configuration

### Complete OKTA App Configuration Template

```xml
<!-- OKTA Application Configuration -->
<Application>
  <Name>EdSteward - Moravian University</Name>
  <SignOnMode>SAML_2_0</SignOnMode>
  
  <Settings>
    <signOn>
      <defaultRelayState>moravian</defaultRelayState>
      <ssoAcsUrl>https://moravian.edsteward.ai/auth/saml/callback</ssoAcsUrl>
      <audience>urn:edsteward:sp:moravian</audience>
      <recipient>https://moravian.edsteward.ai/auth/saml/callback</recipient>
      <destination>https://moravian.edsteward.ai/auth/saml/callback</destination>
      <subjectNameIdFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</subjectNameIdFormat>
      <responseSigned>true</responseSigned>
      <assertionSigned>true</assertionSigned>
      <signatureAlgorithm>RSA_SHA256</signatureAlgorithm>
      <digestAlgorithm>SHA256</digestAlgorithm>
      
      <attributeStatements>
        <attributeStatement>
          <type>EXPRESSION</type>
          <name>http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress</name>
          <namespace>urn:oasis:names:tc:SAML:2.0:attrname-format:uri</namespace>
          <values>user.email</values>
        </attributeStatement>
        <attributeStatement>
          <type>EXPRESSION</type>
          <name>http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname</name>
          <namespace>urn:oasis:names:tc:SAML:2.0:attrname-format:uri</namespace>
          <values>user.firstName</values>
        </attributeStatement>
        <attributeStatement>
          <type>EXPRESSION</type>
          <name>http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname</name>
          <namespace>urn:oasis:names:tc:SAML:2.0:attrname-format:uri</namespace>
          <values>user.lastName</values>
        </attributeStatement>
        <attributeStatement>
          <type>GROUP</type>
          <name>http://schemas.microsoft.com/ws/2008/06/identity/claims/groups</name>
          <namespace>urn:oasis:names:tc:SAML:2.0:attrname-format:uri</namespace>
          <filterType>REGEX</filterType>
          <filterValue>EdSteward-.*</filterValue>
        </attributeStatement>
      </attributeStatements>
    </signOn>
  </Settings>
</Application>
```

---

## 📄 Appendix B: Email Template for Moravian IT

### Subject: SAML SSO Configuration Required - EdSteward Compliance Platform

```
Hi [IT Contact Name],

We're ready to finalize the SAML SSO integration between Moravian University's 
OKTA system and your dedicated EdSteward compliance platform instance.

QUICK REFERENCE:
- Platform URL: https://moravian.edsteward.ai/
- Metadata URL: https://moravian.edsteward.ai/auth/saml/metadata
- Entity ID: urn:edsteward:sp:moravian
- ACS URL: https://moravian.edsteward.ai/auth/saml/callback

REQUIRED FROM MORAVIAN:
1. OKTA SSO URL
2. OKTA Entity ID  
3. X.509 Certificate
4. Confirmation of attribute release

Please see the attached comprehensive setup guide (MORAVIAN_SAML_OKTA_SETUP_GUIDE.md) 
for complete implementation details.

Timeline: 2-3 weeks from OKTA configuration to full deployment
Support: Direct technical support available throughout implementation

Ready to proceed when you are!

Best regards,
[Your Name]
EdSteward Technical Team
```

---

**Document Version**: 1.0  
**Last Updated**: June 29, 2025  
**Next Review**: July 29, 2025  
**Contact**: EdSteward Technical Team  

---

*This document contains all necessary information for implementing secure SAML SSO between Moravian University's OKTA system and the EdSteward compliance platform. All configurations are based on current industry standards and security best practices.* 