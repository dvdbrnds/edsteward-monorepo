# EdSteward Regulatory Compliance Platform - Development Summary

**Coverage Period:** November 17, 2025 - January 5, 2026  
**Production URL:** moravian.edsteward.ai  
**Git:** main branch, commit 7e23d8fa

EdSteward is a SaaS regulatory compliance management application for higher education institutions. It tracks federal and state regulations, manages compliance workflows, and provides audit-ready documentation.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript + TanStack Query + shadcn/ui (Radix primitives) + Tailwind CSS + Wouter routing |
| Backend | Express.js + TypeScript + Drizzle ORM |
| Database | Neon PostgreSQL with database-per-tenant architecture (edsteward_admin, edsteward_moravian, edsteward_staging, edsteward_test) |
| Authentication | Passport.js with session-based auth (scrypt passwords) + Okta SSO with group-to-role mapping |
| Deployment | AWS ECS/ECR with Docker containers, Application Load Balancer with session stickiness enabled |
| Development | macOS with zsh shell, Colima for Docker (not Docker Desktop), Homebrew for packages |

---

## Directory Structure

```
EdSteward/
├── client/src/
│   ├── components/
│   │   ├── regulations/     # compliance-tasks-panel, task-detail-dialog, bulk-task-operations, submission-wizard, regulation-list
│   │   ├── dashboard/       # widget-settings.tsx for customizable widgets
│   │   ├── layout/          # navigation.tsx with dark mode toggle
│   │   └── ui/              # shadcn primitives (button, card, dialog, dropdown-menu, table, etc.)
│   ├── hooks/               # use-auth, use-dashboard-widgets, use-tenant-branding, use-toast
│   ├── pages/               # home-page (dashboard), RegulationDetailPage, admin pages
│   └── lib/                 # utils, protected routes
├── server/
│   ├── routes/api/          # API endpoints (regulations, compliance-tasks, users, notifications, uploads)
│   ├── middleware/          # rate-limiter.ts, role-based-auth.ts
│   ├── services/            # email, syslog, database, task-scheduler
│   ├── templates/           # Regulation task templates (clery-act-tasks.ts, ferpa-tasks.ts, title-ix-tasks.ts)
│   ├── auth/                # single-tenant-auth.ts with Okta SSO
│   └── storage.ts           # DatabaseStorage class with all CRUD operations
├── shared/
│   └── schema.ts            # Drizzle schema definitions for all tables
└── tests/
    ├── setup/               # global.setup.ts for Vitest
    ├── unit/                # rate-limiter, accessibility, storage, dashboard-widgets, keyboard-shortcuts tests
    └── integration/         # API integration tests
```

---

## Database Schema

### Core Tables (shared/schema.ts)

**users**
- id, username, email, password (scrypt), firstName, lastName
- role: admin | compliance_officer | viewer
- tenantId

**regulations**
- id, itemId, name, topic, statute, category, jurisdictionSource, status
- ownerId (DRI - primary responsible individual)
- filingDeadlines (jsonb), actions (jsonb), requirements (jsonb)

**notifications** - Regulation alerts and reminders

**notificationQueue** - Pending notifications including `regulation_assigned` type

**auditLogs** - System audit trail

**tenantSettings** - Branding, SAML config per tenant

**attestationTokens** - One-click email attestation verification

### Compliance Task Tables

**complianceTasks**
```
id, regulationId, parentTaskId (hierarchy)
title, description, instructions
assignedTo, assignedRole
dueDate, recurringSchedule, reminderDays
status: pending | in_progress | completed | overdue | blocked | not_applicable
priority: low | medium | high | critical
evidenceRequired, evidenceType, evidenceInstructions
evidenceType: none | document | link | screenshot | attestation | form
escalationEmail, escalationName
sortOrder, createdBy, createdAt, updatedAt
```

**taskEvidence**
```
id, taskId
fileName, fileType, fileSize, fileUrl
linkUrl, linkTitle
description, uploadedBy
verified, verifiedBy, verifiedAt
```

**taskActivity**
```
id, taskId, userId
activityType: comment | status_change | assignment_change | evidence_uploaded | nudge | escalation | due_date_change
content, previousValue, newValue
```

---

## Compliance Task System - Detailed Architecture

The compliance task system handles complex multi-step regulations like the Clery Act. Each regulation can have a hierarchy of tasks with parent/child relationships, individual DRI assignments, flexible evidence requirements, and escalation paths.

### Task Template Structure

```typescript
// server/templates/clery-act-tasks.ts
export interface CleryTaskTemplate {
  tempId: string;           // Temporary ID for parent-child linking during creation
  parentTempId?: string;    // Links to parent task's tempId
  title: string;
  description: string;
  instructions?: string;    // Detailed how-to guidance
  assignedRole: string;     // Default role assignment
  dueDate?: string;         // "October 1" or specific date
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidenceRequired: boolean;
  evidenceType: 'none' | 'document' | 'link' | 'screenshot' | 'attestation' | 'form';
  evidenceInstructions?: string;
  sortOrder: number;
}
```

### Clery Act Template (~50 tasks)

The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (20 U.S.C. § 1092(f)) requires colleges and universities to:

**1. Annual Security Report (ASR) - Due October 1**
- Draft ASR Content (gather policies, 3-year crime stats)
- Legal/Compliance Review
- Publish ASR to Website
- Notify Campus Community (email all students/employees)
- Submit to Department of Education

**2. Crime Statistics Collection**
- Gather from Campus Police
- Gather from Local Law Enforcement
- Gather from Campus Security Authorities (CSAs)
- Compile Geographic Data (on-campus, public property, non-campus)

**3. Timely Warning Procedures**
- Policy Documentation
- Distribution System Testing

**4. Emergency Notification System**
- System Testing
- Annual Drill Documentation

**5. Daily Crime Log**
- Maintain Public Log
- 60-Day Availability Verification

**6. Missing Student Procedures** (residential)

**7. Fire Safety Report** (residential facilities)

### FERPA Template (~40 tasks)

The Family Educational Rights and Privacy Act (20 U.S.C. § 1232g):
- Annual Rights Notification
- Record Access Request Procedures
- Amendment Procedures
- Directory Information Opt-Out
- Disclosure Consent Requirements
- Staff Training Program

### Title IX Template (~45 tasks)

Title IX of the Education Amendments of 1972 (20 U.S.C. § 1681):
- Title IX Coordinator Designation
- Non-discrimination Policy Publication
- Grievance Procedures
- Personnel Training (investigators, decision-makers)
- Athletics Equity Compliance
- Record Retention

### API Endpoints

```
GET    /api/compliance-tasks/:regulationId           - List all tasks for a regulation
GET    /api/compliance-tasks/:regulationId/:taskId   - Get single task with evidence
POST   /api/compliance-tasks                         - Create new task
PATCH  /api/compliance-tasks/:taskId                 - Update task (status, assignment, etc.)
DELETE /api/compliance-tasks/:taskId                 - Delete task
POST   /api/compliance-tasks/:taskId/evidence        - Upload evidence file or link
DELETE /api/compliance-tasks/:taskId/evidence/:evidenceId - Remove evidence
POST   /api/compliance-tasks/:taskId/nudge           - Send reminder to assignee
POST   /api/compliance-tasks/:taskId/escalate        - Escalate to escalation contact
POST   /api/compliance-tasks/apply-template/clery/:regulationId   - Apply Clery template
POST   /api/compliance-tasks/apply-template/ferpa/:regulationId   - Apply FERPA template
POST   /api/compliance-tasks/apply-template/title-ix/:regulationId - Apply Title IX template
```

### UI Components

**compliance-tasks-panel.tsx**
- Main task display with collapsible hierarchy
- Progress tracking with percentage bars
- Status badges (color-coded)
- Action menus (nudge, escalate, mark complete)
- Evidence indicators with hover preview

**task-detail-dialog.tsx**
- Full task view with description and instructions
- Evidence upload (drag-drop files or paste links)
- Activity timeline
- Comments section

**bulk-task-operations.tsx**
- Multi-select checkbox support
- Bulk status change
- Bulk nudge
- Bulk escalate

---

## Feature Implementations by Date

### November 17, 2025
- Pre-deployment evidence upload fixes
- Action updates and enhanced timeline
- UX improvements across regulation detail page

### November 18-19, 2025
- Okta SSO group-to-role mapping implementation
- Compliance officer role verified working
- Frontend system assessment completed (82% production ready)

### December 4, 2025
- MCP Engine integration fixes (UI rich data display, validation, storage mapping)
- Branding logo upload cache-busting with timestamps
- Database backup system for on-prem deployments
- Audit logs SQL syntax error fix

### December 5, 2025
- Regulation ownership system - compliance officers see only their assigned regulations
- Owner filtering in API and UI
- Auth fixes for proper access control

### December 7-8, 2025
- Major UX redesign: Hero section + accordion layout for regulation detail page
- Escalation feature for overdue tasks
- Colored status badges (green=compliant, yellow=pending, red=overdue)
- Notification toggle fixes

### December 13, 2025
- One-click email attestation for low-risk regulations
- Token-based verification system (attestation_tokens table)
- Email links that complete attestation without login

### December 15, 2025
- Enhanced attestation UX
- Okta sync improvements

### December 16, 2025
- Compliance tasks workflow for complex regulations (Clery Act)
- Task detail view with evidence upload
- Email task links for direct access
- FERPA and Title IX regulation templates with pre-built tasks
- Task notifications and analytics
- Bulk task operations panel

### December 17, 2025
- Hover preview for evidence files with signature display
- Improved compliance tasks UX
- Auto-expand incomplete tasks

### December 31, 2025
- Executive analytics dashboard with compliance metrics
- Task scheduler with GUI toggle in admin settings
- Bulk operations panel
- Mobile menu improvements
- Data export functionality
- Dark mode support with toggle in navigation
- Scheduler toggle GUI in admin settings

### January 2, 2026
- Updated 47 components with dark mode compatible classes
- Updated 26 pages with dark mode compatible classes
- Clean up debug console.logs from key client files
- Implement audit trail CSV export
- Fix React hooks and ESLint errors
- My Tasks focused view for compliance officers
- Improved error states with friendly messages
- Remove vendor admin/tenant management from customer frontend
- Implement agency submission logic
- Mobile responsiveness polish
- Search/filter improvements for regulations
- Remove vendor admin tenant feature manager
- Add quick attestation button from dashboard
- Add deadline calendar view
- Add email digest options (weekly vs instant) to account settings
- Add keyboard shortcuts for power users (cross-platform ⌘/Ctrl)
- Add regulation status history timeline tab

### January 5, 2026
- Add column visibility controls to regulation list (hide/show columns with localStorage persistence)
- Fix Primary DRI display to show firstName lastName instead of User ID
- Fix prose code block styling for light mode and text wrapping
- Remove institution type filter from dashboard (development feature)
- Add assignment notifications when regulations are assigned (notificationQueue with type 'regulation_assigned')
- Clean debug console.logs from server code (1337 removed)
- Remove dead files (30+ backup, debug, test, fix scripts deleted)
- Fix task scheduler error - add getDb() method to storage interface
- Fix widget customization to update instantly without refresh (React Context pattern)
- Accessibility audit - add ARIA labels and improve screen reader support
- Add rate limiting for API endpoints
- Expand test coverage to 81 passing tests

---

## Rate Limiting

**File:** `server/middleware/rate-limiter.ts`

| Limiter | Limit | Window | Purpose |
|---------|-------|--------|---------|
| apiLimiter | 100 requests | 15 minutes | General API |
| authLimiter | 5 requests | 15 minutes | Login, authenticate, SAML |
| passwordResetLimiter | 3 requests | 1 hour | Password reset |
| uploadLimiter | 20 requests | 1 hour | File uploads |
| adminLimiter | 50 requests | 15 minutes | Admin operations |
| burstLimiter | 10 requests | 1 minute | Expensive operations |

**Applied in server/index.ts:**
```typescript
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/authenticate', authLimiter);
app.use('/auth/saml', authLimiter);
```

---

## Dashboard Widget Customization

**File:** `client/src/hooks/use-dashboard-widgets.tsx`

React Context pattern for instant updates without page refresh:

```typescript
type WidgetId = 
  | 'dashboardStats' 
  | 'myTasks' 
  | 'pendingAttestations' 
  | 'complianceOverview' 
  | 'upcomingDeadlines' 
  | 'recentNotifications' 
  | 'deadlineCalendar' 
  | 'trusteesDashboard' 
  | 'regulationList';

interface DashboardWidgetsContextType {
  isWidgetVisible: (widgetId: WidgetId) => boolean;
  toggleWidget: (widgetId: WidgetId) => void;
  showAllWidgets: () => void;
  hiddenCount: number;
}
```

**Usage in home-page.tsx:**
```tsx
<DashboardWidgetsProvider>
  <WidgetSettings />  {/* Customize button */}
  <WidgetWrapper widgetId="dashboardStats"><DashboardStats /></WidgetWrapper>
  <WidgetWrapper widgetId="myTasks"><MyTasks /></WidgetWrapper>
  {/* etc. */}
</DashboardWidgetsProvider>
```

**Persistence:** localStorage key `dashboardWidgetVisibility`

---

## Testing

**Configuration:** `vitest.config.ts`

**81 passing tests across:**
- `tests/unit/rate-limiter.test.ts` - Rate limiter configurations
- `tests/unit/accessibility.test.ts` - ARIA labels, alt text
- `tests/unit/storage.test.ts` - Database operations
- `tests/unit/keyboard-shortcuts.test.ts` - Keyboard event handling
- `tests/unit/dashboard-widgets.test.ts` - Widget visibility state
- `tests/integration/api.test.ts` - API endpoint tests
- `client/src/hooks/use-auth.test.tsx` - Auth hook tests

**Commands:**
```bash
npm test              # vitest run
npm run test:watch    # vitest
npm run test:coverage # vitest run --coverage
```

---

## Assignment Notifications

When a regulation is assigned via `PATCH /api/regulations/:regulationId/owner`, a notification is created:

```typescript
await tenantStorage.createNotificationQueueItem({
  regulationId: regulationId,
  userId: ownerValue,
  type: 'regulation_assigned',
  content: {
    title: 'You have been assigned a regulation',
    message: `${assignedByName} has assigned you as the Primary DRI for "${regulationName}".`,
    regulationId,
    regulationName,
    assignedBy,
    assignedByName
  },
  status: 'pending',
  priority: 'high'
});
```

---

## Accessibility Improvements

**ARIA Labels Added:**
- Icon-only buttons: `aria-label="Task actions menu"`, `aria-label="Clear search"`, `aria-label="Remove file"`, `aria-label="Clear selection"`
- Toggle buttons: `aria-label` with state + `aria-expanded`
- Mobile menu: `aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}`
- Form inputs: `aria-label="Search regulations"`
- Table headers: `scope="col"` added by default

**Files Modified:**
- compliance-tasks-panel.tsx
- regulation-list.tsx
- submission-wizard.tsx
- bulk-task-operations.tsx
- navigation.tsx
- table.tsx (UI component)

---

## Deployment

Production deployment uses `scripts/deploy-ecs-proper.sh` which:
1. Builds Docker image with unique tag
2. Pushes to AWS ECR
3. Registers new ECS task definition with updated image
4. Updates ECS service to use new task definition

**Important:** Never use `aws ecs update-service --force-new-deployment` alone - it doesn't update the image.

**ALB Configuration:** Session stickiness must be enabled for authentication to work across multiple containers.

---

## Current State Summary

| Metric | Value |
|--------|-------|
| Git Branch | main |
| Latest Commit | 7e23d8fa |
| Production URL | moravian.edsteward.ai |
| Tests | 81 passing |
| Regulations | 354 |
| Users | 21 |
| Auth | Session-based + Okta SSO |
| Features | Dark mode, keyboard shortcuts, widget customization, compliance tasks, email attestation, rate limiting, accessibility |

---

## Key Files Quick Reference

| Purpose | File |
|---------|------|
| Database Schema | `shared/schema.ts` |
| Task Templates | `server/templates/clery-act-tasks.ts`, `ferpa-tasks.ts`, `title-ix-tasks.ts` |
| Task API | `server/routes/api/compliance-tasks.ts` |
| Task UI | `client/src/components/regulations/compliance-tasks-panel.tsx` |
| Dashboard Widgets | `client/src/hooks/use-dashboard-widgets.tsx` |
| Rate Limiting | `server/middleware/rate-limiter.ts` |
| Storage Operations | `server/storage.ts` |
| Auth | `server/auth/single-tenant-auth.ts` |
| Main Dashboard | `client/src/pages/home-page.tsx` |
| Regulation Detail | `client/src/pages/RegulationDetailPage.tsx` |

