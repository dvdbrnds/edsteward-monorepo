Completed four major features for EdSteward on Dec 31, 2025:

**1. Task Notification Scheduler** (`server/services/task-scheduler.ts`)
- Automatically sends reminders at 8 AM and 2 PM (configurable in `SCHEDULER_CONFIG.preferredHours`)
- Also runs every 6 hours as fallback
- Can be disabled with `ENABLE_TASK_SCHEDULER=false` env var
- Uses existing `checkAndSendTaskNotifications()` from task-notifications service
- Status endpoint: GET `/api/compliance-tasks/notifications/scheduler-status`

**2. Bulk Operations UI** (`client/src/components/regulations/bulk-task-operations.tsx`)
- Checkbox selection for multiple tasks
- "Select All" / "Deselect All" functionality
- Bulk actions: Assign DRI, Update Status, Send Notifications
- Confirmation dialog before executing actions
- Uses existing bulk API endpoints: `/api/compliance-tasks/bulk/assign`, `/bulk/status`, `/bulk/notify`

**3. Mobile Navigation**
- Added hamburger menu (`Menu` icon) in navigation for mobile
- Shows/hides with `mobileMenuOpen` state
- Full-width mobile menu with all nav links
- Uses Tailwind `sm:hidden` / `hidden sm:flex` for responsive behavior

**4. Reports/Export API** (`server/routes/api/reports.ts`)
- GET `/api/reports/compliance-summary` - JSON summary of compliance metrics
- GET `/api/reports/export/regulations/csv` - CSV export of all regulations
- GET `/api/reports/export/tasks/csv` - CSV export of all tasks
- GET `/api/reports/export/deadlines/csv` - CSV export of all deadlines
- GET `/api/reports/full-report` - Full data for PDF generation
- Export dropdown added to executive dashboard header