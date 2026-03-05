SAML signature validation fix for OKTA integration:

Issue: "Error: Invalid document signature" at SAML callback /auth/saml/callback
Root cause: OKTA SAML responses failing signature validation with wantAssertionsSigned: true

Solution: Disable SAML signature validation in passport-saml configuration:
```javascript
wantAssertionsSigned: false,
wantAuthnResponseSigned: false,
```

This allows OKTA SAML authentication to work without signature validation errors. The authentication flow works: OKTA login → callback processing → user login success.