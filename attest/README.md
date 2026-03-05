# EdSteward Attestation System

> Complete documentation of the email-based attestation workflow: how compliance
> officers are notified, how they upload evidence, and how they digitally sign
> attestations -- all without logging in.

---

## Table of Contents

1. [Overview](#overview)
2. [End-to-End Flow](#end-to-end-flow)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Pages & Components](#frontend-pages--components)
6. [Email Templates](#email-templates)
7. [Security Model](#security-model)
8. [File Inventory](#file-inventory)

---

## Overview

EdSteward has **two levels** of attestation:

| Level | Scope | Token Table | Entry Point |
|-------|-------|-------------|-------------|
| **Regulation-level** | Entire regulation | `attestation_tokens` | `POST /api/attestation/send` |
| **Task-level** | Single compliance task | `task_attestation_tokens` | `POST /api/compliance-tasks/:taskId/request-attestation` |

Both share the same core pattern:

1. An admin sends an attestation request (email with a magic link).
2. The recipient clicks the link -- no login required.
3. They see the task/regulation details, upload evidence if needed, and sign.
4. The system records the attestation and marks the item completed.
5. If all tasks for a regulation are now done, the DRI and CCO are notified.

The **task-level flow** is the primary one used in production and is the one
documented in full detail below. The regulation-level flow is an older pathway
that operates on the regulation's `actions` JSON array rather than on individual
compliance tasks.

---

## End-to-End Flow

### Step 1: Admin Initiates Attestation Request

**Who:** An admin or compliance officer logged into EdSteward.

**How:** Two places in the UI can trigger this:

- **Dashboard widget** (`pending-attestations.tsx`): Shows regulations needing
  attestation. Click "Request" to open the send dialog.
- **Task actions menu** (`compliance-tasks-panel.tsx`): Right-click or use the
  dropdown on any task and select "Request Attestation."

**What happens:**

1. The `SendAttestationDialog` opens (regulation-level) or inline attestation
   form opens (task-level).
2. Admin selects a recipient (from user list or manual email entry).
3. Admin can customize the attestation statement, type (quarterly/annual/etc.),
   period, and add a personal message.
4. Admin clicks "Send Attestation Request."

**API call (task-level):**

```
POST /api/compliance-tasks/:taskId/request-attestation
Body: { email, recipientName?, personalMessage?, expiresInDays? }
Auth: Required (session cookie)
```

**API call (regulation-level):**

```
POST /api/attestation/send
Body: { regulationId, userId?, email?, attestationType, attestationStatement, attestationPeriod }
Auth: Required (admin only)
```

### Step 2: Backend Generates Token and Sends Email

**What happens on the server:**

1. **Validate the request** -- check that the task/regulation exists.
2. **Generate a secure token** -- `crypto.randomBytes(32).toString('hex')` (task-level) or `crypto.randomBytes(32).toString('base64url')` (regulation-level).
3. **Store the token** in the database:
   - Task-level: `task_attestation_tokens` table
   - Regulation-level: `attestation_tokens` table
4. **Set token expiry** -- default 7 days (task-level) or 14 days (regulation-level).
5. **Update attestation status** -- set `complianceTasks.attestationStatus = 'pending'`.
6. **Build the magic link URL** -- `{APP_URL}/attest/{token}`.
7. **Send the email** via `emailService.sendEmail()`:
   - Reads SMTP config from the `email_configs` database table.
   - Uses nodemailer to send HTML email with task details and a green CTA button.
   - Button text: "Upload Evidence & Attest" (if evidence required) or "Review & Attest".
8. **Log activity** -- writes to `task_activity` table.
9. **Return response** -- includes `attestationUrl`, `expiresAt`, and whether email delivered.

### Step 3: Recipient Clicks the Link

The recipient receives an email with a link like:

```
https://moravian.edsteward.ai/attest/a1b2c3d4e5f6...
```

This maps to the React route `/attest/:token` which renders `AttestationPage`.

**No login is required.** The token itself is the authentication.

### Step 4: Frontend Loads Attestation Page

**Component:** `attestation-page.tsx`

**On mount, the page:**

1. Extracts the `:token` from the URL via `useRoute`.
2. Calls `GET /api/compliance-tasks/attestation/:token` to validate the token
   and fetch task details.
3. Shows a loading skeleton while fetching.

**Backend validates the token:**

1. Looks up the token in `task_attestation_tokens`.
2. Checks that `expiresAt > now` (not expired).
3. Checks that `usedAt` is null (not already used).
4. Fetches the associated task with regulation details.
5. Fetches any existing evidence for the task.
6. Returns all data to the frontend.

**If the token is invalid/expired/used:**
- Shows an error card: "Invalid or Expired Link"

**If the token is valid, the page shows three sections:**

#### Section A: Task Details Card
- Task title, regulation name, description, instructions
- Due date, priority badge, assigned role

#### Section B: Evidence Upload (Collapsible)
- Only shown if `token.canUploadEvidence` is true
- Shows existing evidence with remove buttons
- **File upload:** Drag-and-drop or click-to-browse. Files auto-upload immediately on selection.
- **Link evidence:** Always-visible URL + title + description fields with "Add Link" button
- After upload, the evidence card auto-collapses and the page smoothly scrolls to the signature section

#### Section C: Attestation Signature Form
- Digital signature input (full legal name)
- Optional notes textarea
- If evidence is required and none uploaded, shows a warning and disables the submit button
- Green "Submit Attestation" button
- Shows token expiry date

### Step 5: Recipient Uploads Evidence (Optional)

**File upload:**

```
POST /api/compliance-tasks/attestation/:token/evidence
Content-Type: multipart/form-data
Body: FormData with 'file' field
Auth: None (token validated server-side)
```

**Link evidence:**

```
POST /api/compliance-tasks/attestation/:token/evidence
Content-Type: application/json
Body: { linkUrl, linkTitle, description }
Auth: None (token validated server-side)
```

**Backend processing (file upload):**

1. Validate token (valid, not expired, `canUploadEvidence = true`).
2. Parse multipart form data using `busboy`.
3. Write file to `uploads/evidence/{timestamp}-{random}-{filename}`.
4. Insert record into `task_evidence` table.
5. Log activity to `task_activity`.

**Evidence removal:**

```
DELETE /api/compliance-tasks/attestation/:token/evidence/:evidenceId
Auth: None (token validated server-side)
```

Deletes both the database record and the physical file on disk.

### Step 6: Recipient Signs and Submits Attestation

**API call:**

```
POST /api/compliance-tasks/attestation/:token/attest
Body: { signature: "Full Legal Name", notes?: "Optional notes" }
Auth: None (token validated server-side)
```

**Backend processing:**

1. Validate token (valid, not expired, not used, `canAttest = true`).
2. Verify task exists.
3. If `evidenceRequired = true`, check that at least one evidence record exists.
4. Build full signature text:
   ```
   {typed name}

   Digitally attested by {recipientName or email} on {ISO timestamp}
   ```
5. Try to match the token email to an existing user (for `completedBy`).
6. **Update the compliance task:**
   - `attestedAt` = now
   - `attestationSignature` = full signature text
   - `attestationNotes` = notes
   - `attestationStatus` = 'attested'
   - `status` = 'completed'
   - `completedAt` = now
   - `completedBy` = matched user ID (if found)
7. **Mark token as used** -- set `usedAt = now`.
8. **Log activity** -- status change from previous status to 'completed'.
9. **Check if all tasks for this regulation are now completed.** If yes, trigger
   `checkAndNotifyRegulationReadyForAttestation()`.

### Step 7: Post-Attestation Notification (Automatic)

When all compliance tasks for a regulation are marked 'completed':

1. `checkAndNotifyRegulationReadyForAttestation()` fires asynchronously.
2. Queries all tasks for the regulation (excluding `not_applicable` status).
3. If every task's status is 'completed':
   - Gathers recipients: regulation owner/DRI, responsible office, all admin/CCO users.
   - Sends a "Ready for Final Attestation" email with task count stats and a link
     to the regulation page.

### Step 8: Success Screen

After successful attestation submission, the frontend shows a green success card:

- "Attestation Complete -- Thank you for your attestation!"
- "Your compliance attestation has been successfully recorded."
- "A copy of this attestation has been saved for audit purposes."

---

## Database Schema

### Tables

#### `task_attestation_tokens` (Magic Link Tokens)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `task_id` | integer FK | References `compliance_tasks.id` |
| `token` | text UNIQUE | Secure random hex string (64 chars) |
| `email` | text | Recipient email address |
| `recipient_name` | text | Optional display name |
| `expires_at` | timestamp | Token expiry (default: 7 days) |
| `used_at` | timestamp | Set when attestation is submitted |
| `can_upload_evidence` | boolean | Whether evidence upload is allowed |
| `can_attest` | boolean | Whether attestation is allowed |
| `created_at` | timestamp | Token creation time |
| `created_by` | integer FK | Admin who sent the request |
| `personal_message` | text | Optional message shown to recipient |

#### `attestation_tokens` (Regulation-Level Tokens)

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `token` | text UNIQUE | Secure random base64url string |
| `regulation_id` | integer FK | References `regulations.id` |
| `user_id` | integer FK | Target user (nullable for manual email) |
| `email` | text | Target email address |
| `attestation_type` | text | 'quarterly', 'annual', 'incident', 'ad_hoc' |
| `attestation_statement` | text | What the officer is attesting to |
| `attestation_period` | text | e.g., "Q4 2025", "Annual 2026" |
| `created_at` | timestamp | Token creation time |
| `expires_at` | timestamp | Token expiry (14 days) |
| `completed_at` | timestamp | Set when attestation confirmed |
| `completed_by_name` | text | Name of person who completed |
| `completed_by_email` | text | Email of person who completed |
| `completed_by_ip` | text | IP address at completion |
| `sent_by` | integer FK | Admin who sent the request |

#### Attestation Fields on `compliance_tasks`

| Column | Type | Description |
|--------|------|-------------|
| `attested_at` | timestamp | When DRI attested |
| `attested_by` | integer FK | User who attested |
| `attestation_signature` | text | Full digital signature text |
| `attestation_notes` | text | Optional notes from DRI |
| `attestation_status` | text | 'not_required', 'pending', 'attested', 'rejected' |

#### `task_evidence`

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `task_id` | integer FK | References `compliance_tasks.id` |
| `file_name` | text | Display filename |
| `file_type` | text | MIME type |
| `file_size` | integer | Bytes |
| `file_url` | text | Local path (e.g., `/uploads/evidence/...`) |
| `link_url` | text | For link-type evidence |
| `link_title` | text | Display name for links |
| `description` | text | Description of the evidence |
| `uploaded_by` | integer FK | User who uploaded |
| `uploaded_at` | timestamp | Upload timestamp |
| `verified` | boolean | Audit verification flag |

---

## Backend API

### Task-Level Attestation (Primary Flow)

All routes are on the `/api/compliance-tasks` router.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/:taskId/request-attestation` | Required | Create token, send email |
| `GET` | `/attestation/:token` | **None** | Validate token, get task data |
| `POST` | `/attestation/:token/attest` | **None** | Submit attestation signature |
| `POST` | `/attestation/:token/evidence` | **None** | Upload evidence (file or link) |
| `DELETE` | `/attestation/:token/evidence/:evidenceId` | **None** | Remove evidence |

### Regulation-Level Attestation

All routes are on the `/api/attestation` router.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/send` | Admin | Send attestation request email |
| `GET` | `/verify/:token` | **None** | Verify token, get regulation data |
| `POST` | `/confirm/:token` | **None** | Complete regulation attestation |
| `GET` | `/pending` | Admin | List pending attestation tokens |
| `GET` | `/history/:regulationId` | Required | Attestation history for a regulation |
| `DELETE` | `/:tokenId` | Admin | Revoke a pending token |

### Supporting Services

| Service | File | Purpose |
|---------|------|---------|
| `EmailService` | `server/services/email.ts` | SMTP email delivery via nodemailer |
| `task-notifications` | `server/services/task-notifications.ts` | Auto-notify when all tasks complete |

---

## Frontend Pages & Components

### `attestation-page.tsx` (Public Attestation Page)

**Route:** `/attest/:token` (no authentication required)

**Purpose:** The landing page for magic link recipients. Displays task details,
allows evidence upload, and collects the digital signature.

**State Management:**
- Token validation and task data via `useQuery` (React Query)
- Evidence upload via `useMutation` (auto-upload on file selection)
- Link evidence via `useMutation`
- Evidence deletion via `useMutation`
- Attestation submission via `useMutation`

**Key UX Details:**
- Drag-and-drop file upload with auto-upload (no separate submit button)
- Evidence card auto-collapses after upload, scrolls to signature section
- If evidence is required but not uploaded, attestation submit is disabled
- After successful attestation, shows a green success confirmation

### `send-attestation-dialog.tsx` (Admin Dialog)

**Purpose:** Dialog for admins to compose and send attestation requests for
regulations. Used from the dashboard pending attestations widget.

**Features:**
- Select recipient from user list or enter email manually
- Auto-selects assigned user or matches responsible office email
- Configurable attestation type (quarterly, annual, incident, ad-hoc)
- Configurable period (Q1-Q4, Annual)
- Editable attestation statement (pre-filled with default text)
- Email preview toggle
- Warns against email attestation for high-risk regulations

### `pending-attestations.tsx` (Dashboard Widget)

**Purpose:** Dashboard card showing regulations that still need attestation.
Provides a quick "Request" button to open the send dialog.

**Features:**
- Filters regulations where attestation action is not completed
- Shows regulation name, category, and "Required" badge
- Quick action buttons for admins (Send attestation request)
- Links to regulation detail pages
- Progress indicator: "{completed}/{total} attested"

### `compliance-tasks-panel.tsx` (Task Actions)

**Purpose:** Not a standalone attestation component, but the compliance tasks
panel includes "Request Attestation" in each task's action menu. This triggers
the task-level attestation flow (`POST /:taskId/request-attestation`) via an
inline email form.

---

## Email Templates

### Task-Level Attestation Request Email

**Sent by:** `POST /:taskId/request-attestation`

**Subject:** `Attestation Required: {task title}`

**HTML email includes:**
- Blue gradient header: "Compliance Attestation Request"
- Greeting with recipient name
- Sender name and personal message (if provided)
- Task details card: title, regulation, due date, priority, evidence requirement
- Green CTA button: "Upload Evidence & Attest" or "Review & Attest"
- Expiry notice
- EdSteward footer

### Regulation-Level Attestation Request Email

**Sent by:** `POST /api/attestation/send`

**Subject:** `Action Required: {regulation name} Compliance Attestation`

**Plain text email includes:**
- Greeting, regulation name, statute, period
- Full attestation statement
- Attestation URL link
- Legal notice (4 bullet points about what clicking means)
- Expiry notice (14 days)

### Final Attestation Notification Email

**Sent by:** `checkAndNotifyRegulationReadyForAttestation()` (automatic)

**Subject:** `Ready for Final Attestation: {regulation name}`

**HTML email includes:**
- Green gradient header with checkmark
- "All compliance tasks have been completed" message
- Regulation name
- Task count and 100% compliance stats
- "What's Next?" checklist (review, verify, certify)
- Green CTA button: "Review & Attest"
- DRI/CCO footer

---

## Security Model

### Token-Based Authentication

- All public-facing attestation endpoints use the **token as authentication**.
  No session cookies or JWT required.
- Tokens are 32 bytes of `crypto.randomBytes`, encoded as hex (64-character
  string) or base64url.
- Tokens are single-use: once `usedAt` is set, the token cannot be reused.
- Tokens expire after 7 days (task-level) or 14 days (regulation-level).

### Access Controls

| Action | Who Can Do It |
|--------|--------------|
| Send attestation request | Authenticated admin/compliance officer |
| View attestation page | Anyone with a valid, unexpired, unused token |
| Upload evidence | Anyone with a valid token where `canUploadEvidence = true` |
| Submit attestation | Anyone with a valid token where `canAttest = true` |
| Delete evidence | Anyone with a valid token where `canUploadEvidence = true` |
| View pending tokens | Authenticated admin |
| Revoke a token | Authenticated admin |

### Rate Limiting

- Evidence upload endpoint has `uploadLimiter` middleware to prevent abuse.

### Tenant Isolation

- All database queries use `getDbForRequest(req)` which routes to the correct
  tenant database based on the request's subdomain.

---

## File Inventory

This `attest/` folder contains copies of all attestation-related code:

```
attest/
├── README.md                                          # This document
├── frontend/
│   ├── attestation-page.tsx                           # Public attestation landing page
│   │   Source: client/src/pages/attestation-page.tsx
│   │
│   ├── send-attestation-dialog.tsx                    # Admin dialog to send requests
│   │   Source: client/src/components/regulations/send-attestation-dialog.tsx
│   │
│   └── pending-attestations.tsx                       # Dashboard widget
│       Source: client/src/components/dashboard/pending-attestations.tsx
│
├── backend/
│   ├── attestation-routes.ts                          # Regulation-level attestation API
│   │   Source: server/routes/api/attestation.ts
│   │
│   ├── compliance-tasks-attestation-routes.ts         # Task-level attestation endpoints
│   │   Source: server/routes/api/compliance-tasks.ts (lines 2080-2714)
│   │
│   ├── email-service.ts                               # SMTP email delivery
│   │   Source: server/services/email.ts
│   │
│   └── task-notifications.ts                          # Auto-notify when all tasks complete
│       Source: server/services/task-notifications.ts
│
├── schema/
│   ├── attestation-tokens.ts                          # Regulation-level token schema
│   │   Source: shared/schema.ts (lines 1107-1141)
│   │
│   ├── task-attestation-tokens.ts                     # Task-level magic link schema
│   │   Source: shared/schema.ts (lines 1281-1318)
│   │
│   ├── compliance-tasks-attestation-fields.ts         # Attestation fields on tasks table
│   │   Source: shared/schema.ts (lines 1195-1200)
│   │
│   └── task-evidence.ts                               # Evidence uploads schema
│       Source: shared/schema.ts (lines 1246-1279)
│
└── migrations/
    └── add-task-attestation-workflow.sql               # Database migration
        Source: migrations/add-task-attestation-workflow.sql
```

### Related Files NOT Copied (Reference Only)

These files reference attestation but are not dedicated to it:

| File | What It Does |
|------|-------------|
| `client/src/App.tsx` | Defines `/attest/:token` route (line 63) |
| `client/src/components/regulations/compliance-tasks-panel.tsx` | "Request Attestation" in task menu |
| `client/src/components/regulations/task-detail-dialog.tsx` | Shows attestation signature when task is attested |
| `server/mcp-integration-api.ts` | Cleans up `task_attestation_tokens` when tasks deleted |
| `server/routes/api/data-export.ts` | Includes tokens in data export |
| `server/routes/api/legal-export.ts` | Includes tokens in legal export |
| `server/services/data-retention.ts` | Token cleanup for data retention |
| `scripts/migrate-task-fk-cascade.cjs` | FK cascade migration for tokens |

---

## Flow Diagram

```
┌────────────────────┐
│    Admin/CCO        │
│    (logged in)      │
└────────┬───────────┘
         │
         │ 1. Click "Request Attestation"
         │    (from task menu or dashboard)
         ▼
┌─────────────────────────────┐
│  Send Attestation Dialog    │
│  - Select recipient         │
│  - Set type/period          │
│  - Customize statement      │
│  - Click "Send"             │
└────────┬────────────────────┘
         │
         │ 2. POST /api/compliance-tasks/:taskId/request-attestation
         ▼
┌─────────────────────────────┐
│  Backend                     │
│  - Generate secure token     │
│  - Store in DB               │
│  - Set task status=pending   │
│  - Build magic link URL      │
│  - Send HTML email           │
│  - Log activity              │
└────────┬────────────────────┘
         │
         │ 3. Email delivered
         ▼
┌─────────────────────────────┐
│  Recipient's Inbox           │
│  ┌─────────────────────┐    │
│  │ Attestation Required │    │
│  │ [Review & Attest]    │────┼──── 4. Click button
│  └─────────────────────┘    │
└─────────────────────────────┘
         │
         │ 5. Opens /attest/{token}
         ▼
┌─────────────────────────────┐
│  Attestation Page (public)   │
│                              │
│  ┌── Task Details ────────┐ │
│  │ Title, regulation,     │ │
│  │ due date, priority     │ │
│  └────────────────────────┘ │
│                              │
│  ┌── Evidence Upload ─────┐ │
│  │ Drag & drop files      │ │  6. Upload evidence (optional)
│  │ Add link evidence      │ │  ──► POST .../evidence
│  │ Remove evidence        │ │  ──► DELETE .../evidence/:id
│  └────────────────────────┘ │
│                              │
│  ┌── Attestation Form ────┐ │
│  │ Digital Signature: ___ │ │  7. Type name & submit
│  │ Notes: ___             │ │  ──► POST .../attest
│  │ [Submit Attestation]   │ │
│  └────────────────────────┘ │
└────────┬────────────────────┘
         │
         │ 8. Backend processes attestation
         ▼
┌─────────────────────────────┐
│  Backend                     │
│  - Validate token            │
│  - Check evidence if req'd   │
│  - Update task: status=      │
│    completed, attested       │
│  - Mark token as used        │
│  - Log activity              │
│  - Check if all tasks done   │
└────────┬────────────────────┘
         │
         │ 9. If all tasks completed
         ▼
┌─────────────────────────────┐
│  Auto-Notification           │
│  - Email DRI + CCO           │
│  - "Ready for Final          │
│    Attestation" email        │
└─────────────────────────────┘
         │
         │ 10. Frontend shows success
         ▼
┌─────────────────────────────┐
│  ✓ Attestation Complete      │
│  "Thank you for your        │
│   attestation!"              │
└─────────────────────────────┘
```
