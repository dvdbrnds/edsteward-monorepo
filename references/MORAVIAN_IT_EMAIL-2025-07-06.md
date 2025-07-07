# Email to Moravian IT for SAML Setup

## Subject: SAML 2.0 SSO Integration Request - EdSteward Compliance Platform

---

**To:** [Moravian IT Contact - Identity Management/SSO Administrator]  
**From:** [Your Name and Title]  
**Subject:** SAML 2.0 SSO Integration Request - EdSteward Compliance Platform

---

Hi [IT Contact Name],

I'm reaching out to coordinate the technical implementation of SAML 2.0 Single Sign-On between Moravian University's identity provider and our EdSteward compliance management platform.

## Platform Overview

EdSteward is a regulatory compliance platform for higher education institutions. Moravian University has a dedicated instance at **https://moravian.edsteward.ai/** with the following technical stack:

- **Architecture**: Node.js/Express backend, React frontend, PostgreSQL database
- **SAML Library**: @node-saml/passport-saml (industry standard)
- **Security**: HTTPS/TLS 1.3, tenant isolation
- **Infrastructure**: AWS ECS with Application Load Balancer

## SAML 2.0 Configuration for Moravian

### Service Provider (SP) Details

```
Entity ID: urn:edsteward:sp:moravian
ACS URL: https://moravian.edsteward.ai/auth/saml/callback
SLO URL: https://moravian.edsteward.ai/auth/saml/logout
Metadata URL: https://moravian.edsteward.ai/auth/saml/metadata

Supported Bindings:
- HTTP-POST (for assertions)
- HTTP-Redirect (for SSO initiation and logout)

NameID Format: 
- urn:oasis:names:tc:SAML:2.0:nameid-format:persistent (preferred)
- urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress

Security Requirements:
- Response: Must be signed
- Assertion: Must be signed  
- Algorithm: RSA-SHA256 (preferred)
- Transport: TLS 1.2/1.3 required
```

### SP Metadata

Our complete SP metadata is available at:
**https://moravian.edsteward.ai/auth/saml/metadata**

You can import this metadata directly into your IdP configuration.

## Information Required from Moravian IT

### 1. Identity Provider Configuration

**Please provide:**
```
Entity ID: _________________________________
SSO URL: __________________________________
SLO URL: __________________________________
X.509 Certificate: _________________________
```

**OR** provide your complete IdP metadata XML file (preferred method).

### 2. SAML Attribute Mapping

**Required attributes we need:**
```
Email: ____________________________________
First Name: _______________________________
Last Name: ________________________________
Username: __________________________________
Groups/Affiliations: ______________________
Department: ________________________________
```

**Standard eduPerson attributes (if available):**
- `urn:oid:0.9.2342.19200300.100.1.3` (mail)
- `urn:oid:2.5.4.42` (givenName)
- `urn:oid:2.5.4.4` (sn/lastName)
- `urn:oid:0.9.2342.19200300.100.1.1` (uid)
- `urn:oid:1.3.6.1.4.1.5923.1.5.1.1` (eduPersonAffiliation)
- `urn:oid:2.5.4.11` (ou/department)

### 3. User Access Control

**Who should have access:**
```
Authorized groups/affiliations: ____________
Pilot test group: __________________________
Estimated user count: ______________________
```

## Role Assignment Logic

Our platform will automatically assign roles based on user attributes:

- **Admin**: IT administrators, compliance administrators
- **Compliance Officer**: Faculty, staff, department heads, compliance team
- **User**: Students, affiliates, general members (read-only access)

## Implementation Process

### Phase 1: Configuration (Week 1)
1. Receive IdP details from Moravian IT
2. Configure Moravian tenant in EdSteward
3. Configure EdSteward SP in Moravian IdP
4. Initial connectivity testing

### Phase 2: Testing (Week 2)
1. End-to-end SAML authentication flow
2. User provisioning and role assignment validation
3. Single logout testing (if implemented)

### Phase 3: Pilot & Rollout (Week 3-4)
1. IT staff pilot testing
2. Compliance team pilot testing
3. Full user base enablement

## Security & Network Requirements

### Network Access Required
```
Outbound HTTPS (443) to:
- Your IdP SSO URL
- Your IdP SLO URL

Inbound HTTPS (443) from:
- Your IdP server (for assertions)
- User browsers (for redirects)
```

### User Authentication Flow
1. User visits https://moravian.edsteward.ai/
2. Clicks "Sign in with Moravian"
3. Redirects to Moravian IdP for authentication
4. User authenticates with Moravian credentials
5. IdP sends signed SAML assertion to EdSteward
6. EdSteward creates/updates user account and grants access

## Testing & Validation

### Verification Steps
1. **SP Metadata**: Verify you can access https://moravian.edsteward.ai/auth/saml/metadata
2. **SAML Flow**: Test complete authentication flow
3. **User Creation**: Verify users are created with correct roles
4. **Access Control**: Confirm appropriate access levels

### Troubleshooting Support
- **Health Check**: https://moravian.edsteward.ai/api/health
- **Debug Mode**: Available during initial testing
- **Technical Support**: Direct access to our development team

## Next Steps

1. **Reply** with your IdP configuration details or metadata file
2. **Schedule** a brief technical coordination call if needed
3. **Provide** any specific attribute mapping requirements
4. **Identify** pilot test users for initial validation

## Contact Information

- **Technical Lead**: [Your Name] - [email] - [phone]
- **Platform**: https://moravian.edsteward.ai/
- **Support**: Available for immediate technical discussion

I'm available for any questions and can provide additional technical details as needed.

Looking forward to a successful integration!

Best regards,

[Your Name]  
[Your Title]  
[Company/Organization]  
[Email Address]  
[Phone Number]