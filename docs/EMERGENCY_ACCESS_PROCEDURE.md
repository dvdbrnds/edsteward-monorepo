# Emergency Access Procedure for EdSteward

## 🚨 **Business Continuity Requirement**

**HECVAT 4.0 Compliance**: Universities require guaranteed administrative access to EdSteward even during external authentication system outages (Okta, SAML, network issues).

## 📋 **Emergency Access Strategy**

### **Dual Authentication Architecture**
1. **Primary**: SAML/Okta SSO (for daily operations)
2. **Emergency**: Local admin account with MFA (for outages)

### **When to Use Emergency Access**
- ✅ Okta/SAML system is down
- ✅ Network connectivity issues prevent SAML authentication
- ✅ Identity provider maintenance windows
- ✅ Critical system administration during outages
- ❌ **NOT for daily operations** (use SAML/Okta)

## 🔧 **Setup Process**

### **1. Create Emergency Admin Account**
```bash
# Run the emergency admin setup script
node scripts/setup-emergency-admin.cjs
```

**Required Information:**
- University/Institution name
- Emergency admin email (university domain)
- Admin first and last name
- Secure password (12+ characters, complex)

### **2. Enable MFA Immediately**
1. Log in with emergency credentials
2. Navigate to Security Settings
3. Set up Google Authenticator
4. **Save backup codes securely**
5. Test MFA verification

### **3. Document Credentials**
- Store in university password manager
- Include backup codes in secure location
- Document emergency access procedure
- Train authorized personnel

## 🔐 **Security Requirements**

### **Password Policy**
- Minimum 12 characters
- Uppercase + lowercase letters
- Numbers and symbols
- Unique to this system

### **MFA Requirements**
- Google Authenticator (TOTP)
- 10 backup codes generated
- Backup codes stored securely offline
- Regular testing (quarterly)

### **Access Control**
- Role: Emergency Administrator
- Full system access capabilities
- Audit logging enabled
- Session timeout enforced

## 📊 **HECVAT 4.0 Compliance**

### **Business Continuity Controls**
✅ **Alternative authentication method available**  
✅ **Administrative access during outages guaranteed**  
✅ **MFA protection for emergency accounts**  
✅ **Documented emergency procedures**  
✅ **Regular testing and validation**  

### **Security Controls**
✅ **Strong password requirements**  
✅ **Multi-factor authentication mandatory**  
✅ **Audit logging and monitoring**  
✅ **Principle of least privilege**  
✅ **Regular access reviews**  

## 🧪 **Testing Procedure**

### **Quarterly Emergency Access Test**
1. **Simulate SAML outage** (disable Okta integration temporarily)
2. **Test emergency login** with local credentials
3. **Verify MFA functionality** (authenticator + backup codes)
4. **Confirm administrative access** to all system functions
5. **Document test results** and any issues
6. **Re-enable SAML integration**

### **Test Checklist**
- [ ] Emergency credentials work
- [ ] MFA verification successful
- [ ] Full administrative access confirmed
- [ ] System functions operate normally
- [ ] Audit logs capture emergency access
- [ ] SAML re-enablement successful

## 📞 **Emergency Contact Information**

### **During Business Hours**
- **Primary**: University IT Help Desk
- **Secondary**: EdSteward Support Team
- **Escalation**: University CISO Office

### **After Hours/Weekends**
- **Emergency IT Line**: [University Emergency IT Number]
- **EdSteward Emergency**: [EdSteward Emergency Contact]
- **Vendor Escalation**: [Vendor Emergency Escalation]

## 📝 **Incident Documentation**

### **When Emergency Access is Used**
1. **Document the incident** (date, time, reason)
2. **Record actions taken** during emergency access
3. **Note duration** of emergency access session
4. **Report to security team** within 24 hours
5. **Conduct post-incident review** if extended outage

### **Required Information**
- Incident start/end times
- Root cause of SAML/Okta outage
- Administrative actions performed
- System impact assessment
- Lessons learned and improvements

## 🔄 **Maintenance Schedule**

### **Monthly**
- [ ] Verify emergency account is active
- [ ] Test MFA authenticator app
- [ ] Review backup code security

### **Quarterly**
- [ ] Full emergency access test
- [ ] Password strength review
- [ ] Update emergency contact information
- [ ] Review and update procedures

### **Annually**
- [ ] Emergency account password rotation
- [ ] MFA backup code regeneration
- [ ] Complete procedure review and update
- [ ] Staff training refresh

## ⚠️ **Security Warnings**

### **Critical Reminders**
- **Emergency access bypasses institutional SSO**
- **Use only during actual emergencies**
- **All actions are logged and audited**
- **Unauthorized use may violate security policies**
- **Report any suspicious activity immediately**

### **Best Practices**
- Log out immediately after emergency resolved
- Change password if compromise suspected
- Never share emergency credentials
- Use secure networks only
- Enable all available security features

---

**This procedure ensures HECVAT 4.0 compliance while maintaining robust security controls for emergency administrative access to EdSteward.**







