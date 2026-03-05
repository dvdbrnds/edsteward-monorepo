# 🔐 Moravian OKTA Development App Configuration

## 📋 **EXTRACTED FROM EXISTING PRODUCTION SETUP**

From your existing Moravian OKTA at [login.moravian.edu](https://login.moravian.edu/app/exk1dzve5y4scxwes0x8/sso/saml/metadata):

### **Production Certificate (Reference)**
```
MIIDoDCCAoigAwIBAgIGAZkpqk+NMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEG
A1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEU
MBIGA1UECwwLU1NPUHJvdmlkZXIxETAPBgNVBAMMCG1vcmF2aWFuMRwwGgYJKoZIhvcNAQkBFg1p
bmZvQG9rdGEuY29tMB4XDTI1MDkwODE0MDk1MVoXDTM1MDkwODE0MTA1MVowgZAxCzAJBgNVBAYT
AlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYwFAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQK
DARPa3RhMRQwEgYDVQQLDAtTU09Qcm92aWRlcjERMA8GA1UEAwwIbW9yYXZpYW4xHDAaBgkqhkiG
9w0BCQEWDWluZm9Ab2t0YS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDm2CQj
JT9c4H6xr9H9QMW9J/e9UxQxrXkljqFJlaI2zsnq2J2ffv4m0W4ghepxu5j0f7cpcsd4IcWSCxLm
53OlPeD5WCvZo1i+JZguHX2/yuFT65CKzGNAVecpgsQsZc+23b+AFPgydUO/7srXwjqx18XGa+og
X3Vt0QJwGpNHe7dBHbxNExL6ZQw4m3iNS2p51DCzcukMn+r8HDOJV+YIHf3fddEn49z+VKFqYUnq
Bfw219BxnFkFdN7PL+or3EW5z56d2f3FF7irdBenkheXxEVxAoW+CmeLzXNmMS+hPfqqhhfMzYqv
S8/TSAVvi8f8E2AfUEVKuYvDWz+UMz57AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAMYeE83I8Kox
bifb7HG5Om3QfGbpoelwSKGReZ6iC/JAtqZ8KSIurv6MltnkQ4pu9VwT7VRHQR6w/XA/upT6e2uv
CNDcvvv9kzw6XicD7LGshhVmRW8WuTTAXYMmx3mTlHmPEQXJdr2883A4yRBvbR/QtcdEzRq7GEow
tyQRP8z7exdQ5p17VwVs0AkyAv8P08t5HA9qWVWCUY59x6ee9uJowBWwn77VHphPkpo5m/474B9s
axxma0reFqbbZVlN7dlrzGMIX3cH2JeRKuroiX7/IpuzKz04YEJjyZwOWrOdhOcLZB5K7rSMWUpl
hw3het4C7AjQIPO/nMwERuUDFss=
```

## 🚀 **CREATE NEW DEVELOPMENT OKTA APP**

### **Step 1: Create New SAML Application**
1. **Login to OKTA Admin Console**
2. **Applications** → **Applications** → **Create App Integration**
3. **Select SAML 2.0** → **Next**

### **Step 2: General Settings**
```
App name: EdSteward Development
App logo: (optional)
App visibility: Do not display application icon to users
```

### **Step 3: SAML Settings (CRITICAL - Use These Exact Values)**

**Basic SAML Settings:**
```
Single sign on URL: http://localhost:3000/auth/saml/callback
Audience URI (SP Entity ID): urn:edsteward:sp
Default RelayState: (leave empty)
Name ID format: EmailAddress
Application username: Email
```

**Advanced Settings:**
```
Response: Signed
Assertion Signature: Signed
Signature Algorithm: RSA_SHA256
Digest Algorithm: SHA256
Assertion Encryption: Unencrypted
SAML Single Logout: Disabled
Honor Force Authentication: No
SAML Issuer ID: Use OKTA URL
```

### **Step 4: Attribute Statements**
| Name | Name format | Value |
|------|-------------|-------|
| `email` | Basic | `user.email` |
| `firstName` | Basic | `user.firstName` |
| `lastName` | Basic | `user.lastName` |
| `username` | Basic | `user.login` |

### **Step 5: After Creating App - Get These Values**

Once you create the development app, provide me with:

1. **SAML SSO URL** (from Sign On tab)
   - Will look like: `https://login.moravian.edu/app/[NEW-APP-ID]/sso/saml`

2. **Download Certificate** (from Sign On tab → SAML Signing Certificates)
   - Download the X.509 Certificate

3. **Entity ID** (from Sign On tab)
   - Will look like: `http://www.okta.com/[NEW-APP-ID]`

### **Step 6: Assign Users**
- **Assignments** tab → **Assign** → **Assign to People**
- **Assign yourself** and any other developers who need access

## 🎯 **WHAT TO PROVIDE ME NEXT**

After creating the development app, give me these three values:

```
DEV SAML SSO URL: [paste from new dev app]
DEV Entity ID: [paste from new dev app]  
DEV Certificate: [paste downloaded certificate content]
```

Then I'll immediately update the EdSteward `.env` file and we can test the complete SAML flow!

## ⚠️ **IMPORTANT NOTES**

- **Separate from Production**: This dev app is completely separate from your existing production setup
- **Local Testing Only**: This app will only work with localhost:3000
- **Certificate Format**: Make sure to copy the entire certificate including BEGIN/END lines
- **User Assignment**: Don't forget to assign yourself to the new development app

**Ready to create the development OKTA app? Follow the steps above and provide me the three values! 🚀**


