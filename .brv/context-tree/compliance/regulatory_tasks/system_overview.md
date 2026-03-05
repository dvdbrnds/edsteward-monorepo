## EdSteward Compliance Task System (Dec 16, 2025)

### Task Templates for Complex Regulations
Templates available at `server/templates/`:

**Clery Act** (`clery-act-tasks.ts`): 42 tasks
- Annual Security Report, Crime Statistics, Timely Warnings, Emergency Notifications
- Regulation ID: 9

**FERPA** (`ferpa-tasks.ts`): 26 tasks (7 sections)
- Annual Notification, Directory Info, Record Access, Amendment, Consent/Disclosure, Training, Security
- Regulation ID: 223

**Title IX** (`title-ix-tasks.ts`): 31 tasks (7 sections)
- Coordinator, Non-Discrimination Policy, Grievance Procedures, Training, Recordkeeping, Athletics Equity, Pregnancy Support
- Regulation ID: 7

### Task Notification System
Service: `server/services/task-notifications.ts`

Configuration:
```typescript
TASK_NOTIFICATION_CONFIG = {
  reminderDays: [14, 7, 3, 1, 0],  // Days before due to send reminders
  escalationThreshold: 3,           // Days overdue before escalating to admins
  maxOverdueDays: 30,               // Stop sending after 30 days overdue
}
```

API Endpoints:
- `POST /api/compliance-tasks/notifications/check` - Trigger check (admin only, for cron)
- `POST /api/compliance-tasks/:taskId/notify` - Send immediate notification

### Task Analytics Dashboard
Route: `/task-analytics`
Component: `client/src/components/regulations/task-analytics-dashboard.tsx`

API: `GET /api/compliance-tasks/analytics`
Returns: overview stats, byRegulation, byPriority, byRole, completionTrend (30 days)

### Bulk Task Operations
```typescript
// Assign multiple tasks
POST /api/compliance-tasks/bulk/assign
Body: { taskIds: number[], userId?: number, role?: string }

// Update status of multiple tasks  
POST /api/compliance-tasks/bulk/status
Body: { taskIds: number[], status: 'pending' | 'in_progress' | 'completed' | 'blocked' }

// Send notifications for multiple tasks
POST /api/compliance-tasks/bulk/notify
Body: { taskIds: number[], notificationType?: 'assignment' | 'nudge' }
```

### Seeding Scripts
- `scripts/seed-clery-tasks.cjs` - Seeds Clery Act tasks for regulation ID 9
- `scripts/seed-ferpa-title-ix-tasks.cjs` - Seeds FERPA (ID 223) and Title IX (ID 7) tasks