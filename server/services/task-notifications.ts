/**
 * Task Notification Service
 * 
 * Sends notifications for:
 * - Tasks approaching their due date
 * - Overdue tasks
 * - Task assignments
 * - Nudge/escalation reminders
 */

import { emailService } from './email';
import { differenceInDays, format, addDays } from 'date-fns';
import { getDatabaseStorage } from './database';
import type { User } from '@shared/schema';

// Notification schedules for tasks
const TASK_NOTIFICATION_CONFIG = {
  // Days before due date to send reminders
  reminderDays: [14, 7, 3, 1, 0],
  // Include manager/admin after this many days overdue
  escalationThreshold: 3,
  // Maximum days overdue to keep sending notifications
  maxOverdueDays: 30,
} as const;

interface TaskNotificationContext {
  task: {
    id: number;
    title: string;
    description: string | null;
    dueDate: Date | null;
    assignedRole: string | null;
    assignedTo: number | null;
    priority: string | null;
    status: string;
    evidenceRequired: boolean;
    regulationId: number;
  };
  regulation: {
    id: number;
    name: string;
  };
  assignedUser: User | null;
  daysUntilDue: number;
  isOverdue: boolean;
}

/**
 * Get tasks that need notifications sent
 */
async function getTasksNeedingNotification(): Promise<TaskNotificationContext[]> {
  const storage = getDatabaseStorage();
  const db = storage.getDb();
  
  if (!db) {
    console.error('[TaskNotifications] Database not available');
    return [];
  }

  // Get tasks with due dates that are:
  // 1. Coming up in the next 14 days
  // 2. Overdue but less than 30 days overdue
  // 3. Not completed
  const today = new Date();
  const futureDate = addDays(today, 14);
  const pastDate = addDays(today, -TASK_NOTIFICATION_CONFIG.maxOverdueDays);

  try {
    // Raw query to get tasks with due dates in notification window
    const result = await db.execute(`
      SELECT 
        ct.id, ct.title, ct.description, ct.due_date, 
        ct.assigned_role, ct.assigned_to, ct.priority, 
        ct.status, ct.evidence_required, ct.regulation_id,
        r.name as regulation_name
      FROM compliance_tasks ct
      JOIN regulations r ON ct.regulation_id = r.id
      WHERE ct.status != 'completed'
        AND ct.due_date IS NOT NULL
        AND ct.due_date BETWEEN $1 AND $2
      ORDER BY ct.due_date ASC
    `, [pastDate.toISOString(), futureDate.toISOString()]);

    const tasks: TaskNotificationContext[] = [];
    
    for (const row of result.rows as any[]) {
      const dueDate = new Date(row.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = daysUntilDue < 0;

      // Get assigned user if available
      let assignedUser: User | null = null;
      if (row.assigned_to) {
        assignedUser = await storage.getUserById(row.assigned_to);
      }

      tasks.push({
        task: {
          id: row.id,
          title: row.title,
          description: row.description,
          dueDate,
          assignedRole: row.assigned_role,
          assignedTo: row.assigned_to,
          priority: row.priority,
          status: row.status,
          evidenceRequired: row.evidence_required,
          regulationId: row.regulation_id,
        },
        regulation: {
          id: row.regulation_id,
          name: row.regulation_name,
        },
        assignedUser,
        daysUntilDue,
        isOverdue,
      });
    }

    return tasks;
  } catch (error) {
    console.error('[TaskNotifications] Error fetching tasks:', error);
    return [];
  }
}

/**
 * Determine if notification should be sent based on days remaining
 */
function shouldSendNotification(daysUntilDue: number): boolean {
  // Check if this is a reminder day
  if (TASK_NOTIFICATION_CONFIG.reminderDays.includes(daysUntilDue)) {
    return true;
  }
  
  // For overdue tasks, send daily up to max overdue days
  if (daysUntilDue < 0 && Math.abs(daysUntilDue) <= TASK_NOTIFICATION_CONFIG.maxOverdueDays) {
    return true;
  }

  return false;
}

/**
 * Get notification recipients based on task assignment and escalation status
 */
async function getTaskNotificationRecipients(
  context: TaskNotificationContext
): Promise<User[]> {
  const storage = getDatabaseStorage();
  const recipients: User[] = [];

  // Always include assigned user if available
  if (context.assignedUser && context.assignedUser.email) {
    recipients.push(context.assignedUser);
  }

  // If overdue past threshold, escalate to admins and CCO
  if (context.isOverdue && Math.abs(context.daysUntilDue) >= TASK_NOTIFICATION_CONFIG.escalationThreshold) {
    const allUsers = await storage.getAllUsers();
    const escalationRecipients = allUsers.filter(user => {
      const userRoles = Array.isArray(user.roles) ? user.roles : 
                       typeof user.roles === 'string' ? JSON.parse(user.roles || '[]') : [];
      
      return userRoles.includes('admin') || 
             userRoles.includes('cco') || 
             userRoles.includes('chief_compliance_officer') ||
             user.role === 'admin';
    });

    for (const user of escalationRecipients) {
      if (user.email && !recipients.find(r => r.id === user.id)) {
        recipients.push(user);
      }
    }
  }

  return recipients;
}

/**
 * Generate email content for task notification
 */
function generateTaskNotificationEmail(context: TaskNotificationContext): {
  subject: string;
  html: string;
  text: string;
} {
  const { task, regulation, daysUntilDue, isOverdue, assignedUser } = context;
  const formattedDueDate = task.dueDate ? format(task.dueDate, 'MMMM d, yyyy') : 'Not set';
  const baseUrl = process.env.PUBLIC_URL || 'https://moravian.edsteward.ai';
  const taskUrl = `${baseUrl}/regulations/${regulation.id}`;

  let subject: string;
  let urgencyClass: string;
  let urgencyMessage: string;

  if (isOverdue) {
    const daysOverdue = Math.abs(daysUntilDue);
    subject = `⚠️ OVERDUE: ${task.title} - ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} past due`;
    urgencyClass = 'overdue';
    urgencyMessage = `This task is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.`;
  } else if (daysUntilDue === 0) {
    subject = `🔴 DUE TODAY: ${task.title}`;
    urgencyClass = 'urgent';
    urgencyMessage = 'This task is due today.';
  } else if (daysUntilDue <= 3) {
    subject = `🟠 Due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}: ${task.title}`;
    urgencyClass = 'warning';
    urgencyMessage = `This task is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}.`;
  } else {
    subject = `📋 Task Reminder: ${task.title} - Due ${formattedDueDate}`;
    urgencyClass = 'info';
    urgencyMessage = `This task is due in ${daysUntilDue} days.`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #1f2937; color: #9ca3af; padding: 16px 24px; border-radius: 0 0 12px 12px; font-size: 12px; }
    .urgency-overdue { background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px; margin: 16px 0; }
    .urgency-urgent { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; }
    .urgency-warning { background: #fff7ed; border-left: 4px solid #f97316; padding: 12px; margin: 16px 0; }
    .urgency-info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; }
    .task-details { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .task-details dt { font-weight: 600; color: #374151; margin-top: 12px; }
    .task-details dd { color: #6b7280; margin-left: 0; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    .btn:hover { background: #1d4ed8; }
    .priority-critical { color: #dc2626; font-weight: 600; }
    .priority-high { color: #f97316; font-weight: 600; }
    .priority-medium { color: #eab308; }
    .priority-low { color: #22c55e; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">Task Notification</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${regulation.name}</p>
  </div>
  
  <div class="content">
    <div class="urgency-${urgencyClass}">
      <strong>${urgencyMessage}</strong>
    </div>
    
    <h2 style="margin-top: 0;">${task.title}</h2>
    
    <dl class="task-details">
      <dt>Regulation</dt>
      <dd>${regulation.name}</dd>
      
      <dt>Due Date</dt>
      <dd>${formattedDueDate}</dd>
      
      <dt>Priority</dt>
      <dd class="priority-${task.priority || 'medium'}">${(task.priority || 'medium').toUpperCase()}</dd>
      
      ${task.assignedRole ? `
      <dt>Assigned Role</dt>
      <dd>${task.assignedRole}</dd>
      ` : ''}
      
      ${assignedUser ? `
      <dt>Assigned To</dt>
      <dd>${assignedUser.firstName || ''} ${assignedUser.lastName || ''} (${assignedUser.email})</dd>
      ` : ''}
      
      ${task.evidenceRequired ? `
      <dt>Evidence Required</dt>
      <dd>Yes - Please upload supporting documentation</dd>
      ` : ''}
    </dl>
    
    ${task.description ? `
    <h3>Task Description</h3>
    <p>${task.description}</p>
    ` : ''}
    
    <a href="${taskUrl}" class="btn">View Task in EdSteward →</a>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from EdSteward Compliance Management.</p>
    <p>If you believe you received this in error, please contact your compliance administrator.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Task Notification: ${task.title}

${urgencyMessage}

Regulation: ${regulation.name}
Due Date: ${formattedDueDate}
Priority: ${(task.priority || 'medium').toUpperCase()}
${task.assignedRole ? `Assigned Role: ${task.assignedRole}` : ''}
${assignedUser ? `Assigned To: ${assignedUser.firstName || ''} ${assignedUser.lastName || ''} (${assignedUser.email})` : ''}
${task.evidenceRequired ? 'Evidence Required: Yes' : ''}

${task.description || ''}

View this task: ${taskUrl}

---
This is an automated notification from EdSteward Compliance Management.
  `.trim();

  return { subject, html, text };
}

/**
 * Send notification for a single task
 */
async function sendTaskNotification(context: TaskNotificationContext): Promise<boolean> {
  const recipients = await getTaskNotificationRecipients(context);
  
  if (recipients.length === 0) {
    return false;
  }

  const { subject, html, text } = generateTaskNotificationEmail(context);

  let success = false;
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    
    try {
      await emailService.sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
      });
      success = true;
    } catch (error) {
      console.error(`[TaskNotifications] Failed to send to ${recipient.email}:`, error);
    }
  }

  return success;
}

/**
 * Main entry point - check all tasks and send notifications as needed
 */
export async function checkAndSendTaskNotifications(): Promise<{
  tasksChecked: number;
  notificationsSent: number;
  errors: string[];
}> {
  
  const results = {
    tasksChecked: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    const tasks = await getTasksNeedingNotification();
    results.tasksChecked = tasks.length;
    

    for (const context of tasks) {
      if (!shouldSendNotification(context.daysUntilDue)) {
        continue;
      }

      try {
        const sent = await sendTaskNotification(context);
        if (sent) {
          results.notificationsSent++;
        }
      } catch (error) {
        const errorMsg = `Failed to process task ${context.task.id}: ${error}`;
        results.errors.push(errorMsg);
        console.error(`[TaskNotifications] ${errorMsg}`);
      }
    }

  } catch (error) {
    const errorMsg = `Notification check failed: ${error}`;
    results.errors.push(errorMsg);
    console.error(`[TaskNotifications] ${errorMsg}`);
  }

  return results;
}

/**
 * Send immediate notification for a specific task (e.g., new assignment or nudge)
 */
export async function sendImmediateTaskNotification(
  taskId: number,
  _notificationType: 'assignment' | 'nudge' | 'escalation'
): Promise<boolean> {
  const storage = getDatabaseStorage();
  const db = storage.getDb();
  
  if (!db) {
    console.error('[TaskNotifications] Database not available');
    return false;
  }

  try {
    const result = await db.execute(`
      SELECT 
        ct.id, ct.title, ct.description, ct.due_date, 
        ct.assigned_role, ct.assigned_to, ct.priority, 
        ct.status, ct.evidence_required, ct.regulation_id,
        r.name as regulation_name
      FROM compliance_tasks ct
      JOIN regulations r ON ct.regulation_id = r.id
      WHERE ct.id = $1
    `, [taskId]);

    if (!result.rows.length) {
      console.error(`[TaskNotifications] Task ${taskId} not found`);
      return false;
    }

    const row = result.rows[0] as any;
    const dueDate = row.due_date ? new Date(row.due_date) : null;
    const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : 0;

    let assignedUser: User | null = null;
    if (row.assigned_to) {
      assignedUser = await storage.getUserById(row.assigned_to);
    }

    const context: TaskNotificationContext = {
      task: {
        id: row.id,
        title: row.title,
        description: row.description,
        dueDate,
        assignedRole: row.assigned_role,
        assignedTo: row.assigned_to,
        priority: row.priority,
        status: row.status,
        evidenceRequired: row.evidence_required,
        regulationId: row.regulation_id,
      },
      regulation: {
        id: row.regulation_id,
        name: row.regulation_name,
      },
      assignedUser,
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
    };

    return await sendTaskNotification(context);
  } catch (error) {
    console.error(`[TaskNotifications] Error sending immediate notification:`, error);
    return false;
  }
}

export { TASK_NOTIFICATION_CONFIG };

