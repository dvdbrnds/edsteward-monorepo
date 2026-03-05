# Okta Group-Based Role Assignment Configuration Guide

## Overview
EdSteward now automatically assigns user roles based on Okta group membership. When users log in via SAML SSO, their Okta groups are extracted and mapped to EdSteward roles.

---

## Okta Groups → EdSteward Roles Mapping

| Okta Group Name | EdSteward Role | Permissions |
|----------------|----------------|-------------|
| `EdSteward-Admin` | **admin** | Full system access, user management, system settings |
| `EdSteward-ComplianceOfficer` | **compliance_officer** | Manage regulations, submit reports, upload evidence |
| `EdSteward-DepartmentHead` | **department_head** | View regulations, department reports, submit compliance |
| `EdSteward-Viewer` | **viewer** | Read-only access to assigned content |
| *No matching group* | **viewer** | Default safe role (read-only) |

---

## Okta Application Configuration Steps

### Step 1: Configure Group Attribute Statement

1. **Log in to Okta Admin Console**
2. **Navigate to**: Applications → EdSteward (your SAML app)
3. **Click**: "General" tab → "SAML Settings" → "Edit"
4. **Scroll to**: "Attribute Statements (optional)" section
5. **Add Group Attribute**:
   - **Name**: `groups`
   - **Name format**: `Basic`
   - **Value**: `getFilteredGroups({"00g.*"}, "group.name", 40)`
     - Or use: `appuser.groups` (sends all groups)
     - Or use regex filter: `getFilteredGroups({"EdSteward.*"}, "group.name", 40)` (recommended)

6. **Click**: "Next" → "Finish"

### Step 2: Verify Group Names

Ensure your Okta groups match these exact names (case-sensitive):
- ✅ `EdSteward-Admin`
- ✅ `EdSteward-ComplianceOfficer`
- ✅ `EdSteward-DepartmentHead`
- ✅ `EdSteward-Viewer`

**Alternative naming patterns also supported:**
- `edsteward-admin` (lowercase)
- `EdSteward Admin` (with space)

### Step 3: Assign Users to Groups

1. **Navigate to**: Directory → Groups
2. **Select group** (e.g., `EdSteward-Admin`)
3. **Click**: "Assign people"
4. **Add users** to appropriate groups

### Step 4: Test SAML Assertion

1. **Navigate to**: Applications → EdSteward
2. **Click**: "View SAML setup instructions"
3. **Scroll down** to: "Attribute Statements"
4. **Verify** that `groups` attribute is listed
5. **Click**: "Preview SAML Assertion"
6. **Log in as test user**
7. **Verify** the assertion contains:
   ```xml
   <saml2:Attribute Name="groups">
     <saml2:AttributeValue>EdSteward-Admin</saml2:AttributeValue>
   </saml2:Attribute>
   ```

---

## Testing the Integration

### Test Scenario 1: New User (Auto-Provisioning)

1. **Create test user** in Okta
2. **Assign to** `EdSteward-ComplianceOfficer` group
3. **Log in** to EdSteward via SSO
4. **Expected Result**:
   - User automatically created
   - Role: `compliance_officer`
   - Access: Can manage regulations, cannot access admin panel

### Test Scenario 2: Existing User (Role Update)

1. **Existing user** has role `viewer`
2. **Add user** to `EdSteward-Admin` group in Okta
3. **User logs in** via SSO
4. **Expected Result**:
   - Role updated to `admin`
   - Full system access granted immediately

### Test Scenario 3: Multiple Groups (Highest Priority Wins)

1. **User assigned** to both `EdSteward-Viewer` and `EdSteward-Admin`
2. **User logs in** via SSO
3. **Expected Result**:
   - Role: `admin` (highest hierarchy)
   - Full system access

### Test Scenario 4: No Matching Groups (Safe Default)

1. **User assigned** to `Finance-Team` (not an EdSteward group)
2. **User logs in** via SSO
3. **Expected Result**:
   - Role: `viewer` (safe default)
   - Read-only access

---

## Server Logs to Watch

When users log in, you'll see these logs in the server console:

```bash
🔐 SAML Profile received: {
  email: 'user@example.com',
  groups: ['EdSteward-Admin', 'EdSteward-ComplianceOfficer'],
  mappedRoles: ['admin', 'compliance_officer'],
  primaryRole: 'admin'
}

🔐 Creating new user via auto-provisioning with role: admin
🔐 New user created with roles: ["admin","compliance_officer"]
```

Or for existing users:

```bash
🔐 Existing user found: true
🔐 Updating existing user role from viewer to admin
🔐 User roles updated to: ["admin"]
```

---

## Troubleshooting

### Problem: Groups not appearing in SAML assertion

**Solution 1**: Check Okta attribute statement
- Verify `groups` attribute is configured
- Check the value expression (should be `getFilteredGroups(...)` or `appuser.groups`)

**Solution 2**: Check user group assignments
- Navigate to Directory → People → [User] → Groups
- Verify user is assigned to EdSteward groups

**Solution 3**: Preview the SAML assertion
- Applications → EdSteward → "Preview SAML Assertion"
- Log in as test user
- Look for `<saml2:Attribute Name="groups">` in XML

### Problem: User still getting wrong role

**Solution 1**: Check group name spelling
- Must match exactly: `EdSteward-Admin` (not `edsteward-admin` or `EdSteward_Admin`)
- Case-sensitive unless using lowercase variant

**Solution 2**: Force role refresh
- User must log out and log back in
- Roles are updated on each login

**Solution 3**: Check server logs
- Look for "SAML Profile received" log entry
- Verify `groups` array contains your group names
- Check `mappedRoles` shows expected role

### Problem: User getting "viewer" role unexpectedly

**Cause**: No matching Okta groups found

**Solution**:
- Verify user is assigned to an EdSteward group in Okta
- Check group names match exactly
- If user should have access, add them to `EdSteward-ComplianceOfficer` or `EdSteward-Admin`

---

## Role Hierarchy & Permissions

### Admin (Highest)
- ✅ Full system access
- ✅ User management (create, edit, delete)
- ✅ System settings and configuration
- ✅ View all reports and logs
- ✅ Manage regulations (create, edit, delete)
- ✅ Approve/reject regulation updates

### Compliance Officer
- ✅ Manage regulations (create, edit, cannot delete)
- ✅ Submit compliance reports
- ✅ Upload and manage evidence
- ✅ Set deadlines and notifications
- ✅ View all reports
- ❌ Cannot access admin panel
- ❌ Cannot manage users

### Department Head
- ✅ View regulations
- ✅ Submit compliance reports
- ✅ Upload evidence (department scope)
- ✅ View department reports
- ❌ Cannot edit regulations
- ❌ Cannot access admin panel

### Viewer (Lowest)
- ✅ View assigned regulations
- ✅ View department reports (limited)
- ❌ Cannot edit anything
- ❌ Cannot upload evidence
- ❌ Cannot submit reports

---

## Best Practices

### 1. Use Principle of Least Privilege
- Default to `viewer` role
- Only assign `admin` to IT administrators
- Use `compliance_officer` for day-to-day compliance work

### 2. Regular Access Reviews
- Review Okta group assignments quarterly
- Remove users who no longer need access
- Roles update automatically on next login

### 3. Group Naming Convention
- Keep the `EdSteward-` prefix for clarity
- Use PascalCase: `EdSteward-ComplianceOfficer`
- Avoid spaces or special characters

### 4. Emergency Admin Access
- Maintain at least 2 users in `EdSteward-Admin` group
- Document emergency access procedures
- Local `dvdbrnds` account always has admin access (backup)

### 5. Testing Changes
- Always test in staging/development first
- Use Okta's "Preview SAML Assertion" feature
- Check server logs after making changes

---

## Support & Contact

If you encounter issues with Okta group mapping:

1. **Check server logs** for detailed error messages
2. **Verify Okta configuration** matches this guide
3. **Test with a known-good user** (e.g., yourself in `EdSteward-Admin`)
4. **Contact IT support** with server logs and Okta screenshot

---

**Last Updated**: November 17, 2025  
**Version**: 1.0  
**Applies to**: EdSteward Single-Tenant Production Deployment

