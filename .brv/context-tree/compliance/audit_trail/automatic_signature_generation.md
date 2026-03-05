EdSteward Approval Workflow Enhancement - Automatic Signature Generation

COMPLETED: Removed manual signature step from regulation update approval workflow and implemented automatic signature generation using user login information.

## Changes Made:

### Backend (server/regulation-updates-api.ts):
1. **Updated Schemas**: Removed manual signature requirements from acceptUpdateSchema, rejectUpdateSchema, and deferUpdateSchema
2. **Auto-Generated Signatures**: Modified all three endpoints (/accept, /reject, /defer) to automatically generate signatures using:
   ```typescript
   const timestamp = new Date().toISOString();
   const fullName = user.firstName && user.lastName 
     ? `${user.firstName} ${user.lastName}` 
     : user.username;
   const autoSignature = `Digitally [action] by ${fullName} (${user.username}) on ${timestamp}`;
   ```

### Frontend (client/src/pages/differential-view-page.tsx):
1. **Removed Manual Signature Input**: Eliminated signature modal and signature state
2. **Streamlined Workflow**: 
   - Approve: Direct confirmation → immediate approval
   - Reject/Defer: Confirmation → reason dialog → action
3. **Updated API Calls**: Removed signature from request bodies, signatures now auto-generated on backend

## Benefits:
- **Consistent with Attestation**: Now matches how attestation signatures are automatically generated from user login info
- **Improved UX**: Eliminates manual signature typing step
- **Better Security**: Signatures are standardized and include timestamp + user identification
- **Audit Trail**: Clear signature format shows who performed action and when

## Signature Format:
- Approve: "Digitally approved by [Full Name] ([username]) on [ISO timestamp]"
- Reject: "Digitally rejected by [Full Name] ([username]) on [ISO timestamp]"  
- Defer: "Digitally deferred by [Full Name] ([username]) on [ISO timestamp]"

The approval workflow now works exactly like attestation - user authentication provides the signature automatically.