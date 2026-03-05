Okta SAML "asn1 encoding routines::too long" error fix:

**Root Cause**: Improperly formatted X.509 certificates from Okta causing signature validation failures in node-saml library.

**Primary Solution - Certificate Cleaning**:
```javascript
function cleanCertificate(cert) {
  if (!cert) return cert;
  let cleanCert = cert.replace(/\s+/g, '');
  cleanCert = cleanCert.replace(/-----BEGIN CERTIFICATE-----/g, '');
  cleanCert = cleanCert.replace(/-----END CERTIFICATE-----/g, '');
  while (cleanCert.length % 4) {
    cleanCert += '=';
  }
  return cleanCert;
}

// Apply to SAML strategy:
cert: cleanCertificate(process.env.OKTA_CERT)
```

**Alternative Solutions**:
- Update @node-saml/node-saml and passport-saml to latest versions
- Temporarily disable signature validation with `cert: null`
- Verify Okta certificate is copied correctly including PEM headers
- Check certificate format and base64 padding

**Common Issues**:
- Certificate whitespace/newlines from environment variables
- Missing or malformed PEM headers
- Incorrect base64 padding
- Outdated node-saml library versions