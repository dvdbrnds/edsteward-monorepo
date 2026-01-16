# 🔐 OKTA SAML Setup Guide for EdSteward Local Development

## 📋 **STEP-BY-STEP OKTA CONFIGURATION**

### **Phase 1: Create SAML Application in OKTA**

1. **Login to OKTA Admin Console**
   - Go to your OKTA admin dashboard
   - Navigate to **Applications** → **Applications**

2. **Create New SAML 2.0 Application**
   - Click **Create App Integration**
   - Select **SAML 2.0**
   - Click **Next**

3. **General Settings**
   - **App name**: `EdSteward Local Development`
   - **App logo**: (Optional - upload EdSteward logo)
   - Click **Next**

### **Phase 2: SAML Settings Configuration**

#### **Basic SAML Settings:**
```
Single sign on URL: http://localhost:3000/auth/saml/callback
Audience URI (SP Entity ID): urn:edsteward:sp
Default RelayState: (leave empty)
Name ID format: EmailAddress
Application username: Email
```

#### **Advanced Settings:**
```
Response: Signed
Assertion Signature: Signed  
Signature Algorithm: RSA_SHA256
Digest Algorithm: SHA256
Assertion Encryption: Unencrypted (for development)
SAML Single Logout: Disabled (for development)
Honor Force Authentication: No
SAML Issuer ID: Use OKTA URL
```

#### **Attribute Statements (Required):**
| Name | Name format | Value |
|------|-------------|-------|
| `email` | Basic | `user.email` |
| `firstName` | Basic | `user.firstName` |
| `lastName` | Basic | `user.lastName` |
| `username` | Basic | `user.login` |

### **Phase 3: Get OKTA Configuration Values**

After creating the application, you'll need these values:

1. **SAML SSO URL** (from OKTA app settings)
   - Example: `https://dev-12345678.okta.com/app/dev-12345678_edsteward_1/exk1234567890abcdef/sso/saml`

2. **OKTA Certificate** (download from OKTA)
   - Go to **Sign On** tab → **SAML Signing Certificates**
   - Download the **X.509 Certificate**

3. **Entity ID** (from OKTA app settings)
   - Example: `http://www.okta.com/exk1234567890abcdef`

### **Phase 4: Update EdSteward Configuration**

Replace these values in your `.env` file:

```bash
# Replace these placeholder values with real OKTA values:
AUTH_SAML_SSO_URL=https://your-okta-domain.okta.com/app/your-app-id/sso/saml
AUTH_SAML_CERT="-----BEGIN CERTIFICATE-----
MIIDpDCCAoygAwIBAgIGAV2ka+55MA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG
[Your full OKTA certificate content here - multiple lines]
-----END CERTIFICATE-----"
```

### **Phase 5: Test the Integration**

1. **Start EdSteward** (should already be running on http://localhost:3000)

2. **Test SAML Login**
   - Visit: http://localhost:3000/test-saml-setup.html
   - Click "Test SAML Login"
   - Should redirect to OKTA login

3. **Complete Authentication Flow**
   - Login with your OKTA credentials
   - Should redirect back to EdSteward dashboard
   - User should be automatically created in EdSteward

### **Phase 6: Assign Users in OKTA**

1. **Go to Applications** → **EdSteward Local Development**
2. **Click Assignments tab**
3. **Assign yourself and test users**
4. **Set up any group assignments if needed**

## 🚨 **CRITICAL NOTES:**

### **Certificate Formatting**
- **MUST** include `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`
- **MUST** have actual newlines (not literal `\n` characters)
- **MUST** be the complete certificate from OKTA

### **URL Matching**
- OKTA callback URL **MUST** exactly match: `http://localhost:3000/auth/saml/callback`
- Entity ID **MUST** exactly match: `urn:edsteward:sp`

### **Testing Checklist**
- [ ] OKTA application created and configured
- [ ] Certificate downloaded and formatted correctly
- [ ] Environment variables updated in `.env`
- [ ] EdSteward server restarted (if needed)
- [ ] Test user assigned to OKTA application
- [ ] SAML login flow tested end-to-end

## 🔧 **Troubleshooting**

### **Common Issues:**
1. **Certificate formatting errors** - Ensure proper newlines
2. **URL mismatch** - Verify callback URL exactly matches
3. **User not assigned** - Check OKTA application assignments
4. **Attribute mapping** - Verify email attribute is mapped correctly

### **Debug Steps:**
1. Check EdSteward server logs for SAML errors
2. Check OKTA system logs for authentication attempts
3. Verify certificate format with online validators
4. Test with SAML tracer browser extension

## 📞 **Need Help?**

If you encounter issues:
1. Check the EdSteward server logs
2. Verify all URLs and certificates match exactly
3. Ensure test user is assigned to the OKTA application
4. Test with a fresh incognito browser session

---

**Once configured, SAML SSO will work seamlessly for Friday's board presentation! 🚀**


