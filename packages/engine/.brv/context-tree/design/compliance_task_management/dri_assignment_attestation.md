# EdSteward Task DRI Assignment & Attestation System (Jan 2026)

## New Database Tables

### role_assignments
Maps suggested roles (from MCP Engine) to default DRIs for automatic task assignment.
```sql
CREATE TABLE role_assignments (
  id SERIAL PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  default_user_id INTEGER REFERENCES users(id),
  default_email TEXT,
  default_name TEXT,
  backup_user_id INTEGER REFERENCES users(id),
  category TEXT,
  description TEXT,
  auto_assign_enabled BOOLEAN DEFAULT TRUE
);
```
Pre-populated with 13 standard higher ed roles: Title IX Coordinator, Registrar, Dean of Students, HR Director, Financial Aid Director, Legal Counsel, Campus Police Chief, Clery Compliance Officer, VP Academic Affairs, VP Student Affairs, IT Security Officer, Disability Services, Athletic Director.

### task_attestation_tokens
Magic link tokens for field compliance officers to attest/upload evidence without full login.
```sql
CREATE TABLE task_attestation_tokens (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES compliance_tasks(id),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  recipient_name TEXT,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  can_upload_evidence BOOLEAN DEFAULT TRUE,
  can_attest BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  personal_message TEXT
);
```

## New Fields on compliance_tasks
```sql
ALTER TABLE compliance_tasks ADD COLUMN category TEXT;
ALTER TABLE compliance_tasks ADD COLUMN statutory_role TEXT;
ALTER TABLE compliance_tasks ADD COLUMN statutory_citation TEXT;
ALTER TABLE compliance_tasks ADD COLUMN attested_at TIMESTAMP;
ALTER TABLE compliance_tasks ADD COLUMN attested_by INTEGER REFERENCES users(id);
ALTER TABLE compliance_tasks ADD COLUMN attestation_signature TEXT;
ALTER TABLE compliance_tasks ADD COLUMN attestation_notes TEXT;
ALTER TABLE compliance_tasks ADD COLUMN attestation_status TEXT DEFAULT 'not_required';
```

## Auto-Assignment Logic (storage.ts)
When tasks are approved via acceptRegulationUpdate():
1. Fetch role_assignments where auto_assign_enabled = true
2. Build roleToUserMap (role_name -> default_user_id)
3. For each task: try statutoryRole first, then assignedRole
4. If found in map, set assigned_to to that user_id

## MCP Engine Task Payload Format
```json
{
  "complianceTasks": [{
    "taskId": "TITLE-IX-001",
    "tempId": "task-123",
    "parentTempId": "task-100",
    "title": "Designate Title IX Coordinator",
    "description": "...",
    "category": "Coordinator Requirements",
    "priority": "high",
    "requirementType": "requirement",
    "statutoryRole": "Title IX Coordinator",
    "statutoryCitation": "34 CFR 106.8",
    "assignedRole": "Title IX Coordinator",
    "evidenceRequired": true,
    "evidenceType": "document",
    "sortOrder": 1
  }]
}
```
- statutoryRole: Role legally REQUIRED by statute (show badge "Required: X per Y")
- assignedRole: Suggested default for auto-assignment
- Both can differ (statutory is legal requirement, assigned is practical default)

## API Endpoints

### Role Assignments
- GET /api/role-assignments - List all with user details
- GET /api/role-assignments/by-role/:roleName - Get specific role
- POST /api/role-assignments - Create new
- PATCH /api/role-assignments/:id - Update
- DELETE /api/role-assignments/:id - Delete
- POST /api/role-assignments/resolve - Resolve role to assignee
- POST /api/role-assignments/bulk-resolve - Resolve multiple roles

### Attestation (public endpoints - no auth)
- POST /api/compliance-tasks/:taskId/request-attestation - Send magic link email
- GET /api/compliance-tasks/attestation/:token - Verify token, get task details
- POST /api/compliance-tasks/attestation/:token/attest - Submit attestation signature
- POST /api/compliance-tasks/attestation/:token/evidence - Upload evidence via magic link
- PATCH /api/compliance-tasks/:taskId/assign-dri - Assign user as DRI

## UI Components
- Settings > Roles tab: RoleAssignmentsSettings component for managing role-to-person mappings
- /attest/:token: AttestationPage - public page for field officers to view task, upload evidence, sign attestation