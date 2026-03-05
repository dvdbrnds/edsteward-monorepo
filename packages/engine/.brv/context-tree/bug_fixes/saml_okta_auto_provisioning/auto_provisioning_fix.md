SAML/Okta Auto-Provisioning Fix (January 7, 2026):

**Problem:** New users assigned in Okta could not log into EdSteward via SSO. They authenticated successfully at Okta but were redirected back to the login page with no error message.

**Root Cause:** `AUTH_ALLOW_SELF_REGISTRATION` environment variable was not set in the ECS task definition, defaulting to `false`. This prevented auto-provisioning of new SAML users.

**Code Location:** `server/auth/single-tenant-auth.ts` line 106:
```typescript
if (!user && institutionConfig.authentication.allowSelfRegistration) {
  user = await storage.createUser({ ... });
}
```

**Fix:** Added `AUTH_ALLOW_SELF_REGISTRATION=true` to the ECS task definition:
```bash
jq '.containerDefinitions[0].environment += [{"name": "AUTH_ALLOW_SELF_REGISTRATION", "value": "true"}]'
```

**Result:** New Okta users are now auto-provisioned on first login with roles mapped from Okta groups. Their data is synced from Okta on each subsequent login.