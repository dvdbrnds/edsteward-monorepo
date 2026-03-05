EdSteward Attestation System Enhancements (December 2025):

## DRI Signature Display
The compliance hero card on the Regulation Detail Page now prominently displays who attested:
- Label: "Attested by (Directly Responsible Individual)"
- Full Name (large, bold)
- Email address
- Signed timestamp: "Signed: [Full date and time]"

## Attestation Is Always Required
- Removed toggle switch for attestation actions - attestation is always required
- Added "Re-attest" button for admins to update attestation signature
- Added "Attest Now" button when no attestation is on file
- Legacy attestations show "Click to update signature with full details"

## Attestation Statement Update
Changed default attestation statement from "my department" to "the institution":
```
I, as the Directly Responsible Individual (DRI) for the [regulation] regulation, 
confirm that the institution is in compliance with all requirements.
```

## OKTA Name Sync
SAML login now syncs firstName/lastName from OKTA on every login, not just on first user creation:
```typescript
// In server/auth/single-tenant-auth.ts
await storage.updateUser(user.id, {
  firstName: (samlProfile.firstName || samlProfile.displayName || user.firstName || ''),
  lastName: (samlProfile.lastName || user.lastName || ''),
  // ... other fields
});
```

## Login Response
The `/api/authenticate` endpoint now returns firstName and lastName for proper signature display:
```typescript
res.json({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  department: user.department,
  identityProvider: 'local'
});
```

## Database Schema
Added `attestation_tokens` table for email attestation workflow with fields: token, regulation_id, user_id, email, attestation_type, attestation_statement, attestation_period, expires_at, completed_at, completed_by_*, sent_by, metadata.