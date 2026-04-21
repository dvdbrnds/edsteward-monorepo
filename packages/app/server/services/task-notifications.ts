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
import type { EmailTrackingContext } from './email';
import { differenceInDays, format, addDays } from 'date-fns';
import { getDatabaseStorage } from './database';
import { sql } from 'drizzle-orm';
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
async function getTasksNeedingNotification(tenantId?: string): Promise<TaskNotificationContext[]> {
  const storage = getDatabaseStorage(tenantId);
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
    const result = await db.execute(sql`
      SELECT 
        ct.id, ct.title, ct.description, ct.due_date, 
        ct.assigned_role, ct.assigned_to, ct.priority, 
        ct.status, ct.evidence_required, ct.regulation_id,
        r.name as regulation_name
      FROM compliance_tasks ct
      JOIN regulations r ON ct.regulation_id = r.id
      WHERE ct.status != 'completed'
        AND ct.due_date IS NOT NULL
        AND ct.due_date BETWEEN ${pastDate.toISOString()} AND ${futureDate.toISOString()}
      ORDER BY ct.due_date ASC
    `);

    const tasks: TaskNotificationContext[] = [];
    
    for (const row of result.rows as any[]) {
      const dueDate = new Date(row.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = daysUntilDue < 0;

      // Get assigned user if available
      let assignedUser: User | null = null;
      if (row.assigned_to) {
        assignedUser = (await storage.getUser(row.assigned_to)) ?? null;
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
  if ((TASK_NOTIFICATION_CONFIG.reminderDays as readonly number[]).includes(daysUntilDue)) {
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
  context: TaskNotificationContext,
  tenantId?: string
): Promise<User[]> {
  const storage = getDatabaseStorage(tenantId);
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
async function sendTaskNotification(context: TaskNotificationContext, tenantId?: string): Promise<boolean> {
  const recipients = await getTaskNotificationRecipients(context, tenantId);
  
  if (recipients.length === 0) {
    return false;
  }

  const { subject, html, text } = generateTaskNotificationEmail(context);

  let success = false;
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    
    try {
      const tracking: EmailTrackingContext = {
        emailType: 'task_reminder',
        relatedEntityType: 'compliance_task',
        relatedEntityId: context.task.id,
        recipientUserId: recipient.id,
      };
      await emailService.sendEmailTracked(
        { to: recipient.email, subject, html, text },
        undefined, undefined, undefined,
        tracking
      );
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
export async function checkAndSendTaskNotifications(tenantId?: string): Promise<{
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
    const tasks = await getTasksNeedingNotification(tenantId);
    results.tasksChecked = tasks.length;
    

    for (const context of tasks) {
      if (!shouldSendNotification(context.daysUntilDue)) {
        continue;
      }

      try {
        const sent = await sendTaskNotification(context, tenantId);
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
  _notificationType: 'assignment' | 'nudge' | 'escalation',
  tenantId?: string
): Promise<boolean> {
  const storage = getDatabaseStorage(tenantId);
  const db = storage.getDb();
  
  if (!db) {
    console.error('[TaskNotifications] Database not available');
    return false;
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        ct.id, ct.title, ct.description, ct.due_date, 
        ct.assigned_role, ct.assigned_to, ct.priority, 
        ct.status, ct.evidence_required, ct.regulation_id,
        r.name as regulation_name
      FROM compliance_tasks ct
      JOIN regulations r ON ct.regulation_id = r.id
      WHERE ct.id = ${taskId}
    `);

    if (!result.rows.length) {
      console.error(`[TaskNotifications] Task ${taskId} not found`);
      return false;
    }

    const row = result.rows[0] as any;
    const dueDate = row.due_date ? new Date(row.due_date) : null;
    const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : 0;

    let assignedUser: User | null = null;
    if (row.assigned_to) {
      assignedUser = (await storage.getUser(row.assigned_to)) ?? null;
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

    return await sendTaskNotification(context, tenantId);
  } catch (error) {
    console.error(`[TaskNotifications] Error sending immediate notification:`, error);
    return false;
  }
}

export { TASK_NOTIFICATION_CONFIG };

/**
 * Check if all tasks for a regulation are completed/attested
 * If so, send notification to DRI and CCO that it's ready for final attestation
 */
export async function checkAndNotifyRegulationReadyForAttestation(
  regulationId: number,
  tenantId?: string
): Promise<{ ready: boolean; notified: boolean; recipients: string[] }> {
  const storage = getDatabaseStorage(tenantId);
  const db = storage.getDb();

  if (!db) {
    console.error('[FinalAttestation] Database not available');
    return { ready: false, notified: false, recipients: [] };
  }

  try {
    // Get regulation details
    const regResult = await db.execute(sql`
      SELECT r.id, r.name, r.dro, r.owner_id, r.responsible_office_email,
             u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM regulations r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.id = ${regulationId}
    `);

    if (!regResult.rows.length) {
      console.error(`[FinalAttestation] Regulation ${regulationId} not found`);
      return { ready: false, notified: false, recipients: [] };
    }

    const regulation = regResult.rows[0] as any;

    // Get all tasks for this regulation (excluding sub-tasks that are part of parent tasks)
    const tasksResult = await db.execute(sql`
      SELECT id, title, status, attestation_status, assigned_to
      FROM compliance_tasks
      WHERE regulation_id = ${regulationId}
        AND status != 'not_applicable'
    `);

    const tasks = tasksResult.rows as any[];

    if (tasks.length === 0) {
      return { ready: false, notified: false, recipients: [] };
    }

    // Check if ALL tasks are completed
    const allCompleted = tasks.every(t => t.status === 'completed');

    if (!allCompleted) {
      return { ready: false, notified: false, recipients: [] };
    }

    console.log(`[FinalAttestation] All ${tasks.length} tasks completed for regulation ${regulationId}: ${regulation.name}`);

    // Gather recipients: DRI (owner or DRO) and CCO
    const recipients: { email: string; name: string; role: string }[] = [];

    // Add regulation owner (DRI)
    if (regulation.owner_email) {
      recipients.push({
        email: regulation.owner_email,
        name: `${regulation.owner_first_name || ''} ${regulation.owner_last_name || ''}`.trim() || 'Compliance Officer',
        role: 'DRI (Regulation Owner)',
      });
    } else if (regulation.dro) {
      recipients.push({
        email: regulation.dro,
        name: 'Designated Responsible Official',
        role: 'DRO',
      });
    }

    // Add responsible office if different from owner
    if (regulation.responsible_office_email && 
        regulation.responsible_office_email !== regulation.owner_email &&
        regulation.responsible_office_email !== regulation.dro) {
      recipients.push({
        email: regulation.responsible_office_email,
        name: 'Responsible Office',
        role: 'Responsible Office',
      });
    }

    // Add CCO (users with admin/cco role)
    const allUsers = await storage.getAllUsers();
    const ccoUsers = allUsers.filter(user => {
      const userRoles = Array.isArray(user.roles) ? user.roles :
        typeof user.roles === 'string' ? JSON.parse(user.roles || '[]') : [];

      return userRoles.includes('admin') ||
        userRoles.includes('cco') ||
        userRoles.includes('chief_compliance_officer') ||
        user.role === 'admin';
    });

    for (const cco of ccoUsers) {
      if (cco.email && !recipients.find(r => r.email === cco.email)) {
        recipients.push({
          email: cco.email,
          name: `${cco.firstName || ''} ${cco.lastName || ''}`.trim() || 'Administrator',
          role: 'CCO',
        });
      }
    }

    if (recipients.length === 0) {
      console.warn(`[FinalAttestation] No recipients found for regulation ${regulationId}`);
      return { ready: true, notified: false, recipients: [] };
    }

    // Send notification emails
    const baseUrl = process.env.PUBLIC_URL || 'https://moravian.edsteward.ai';
    const regulationUrl = `${baseUrl}/regulations/${regulationId}`;

    const subject = `✅ Ready for Final Attestation: ${regulation.name}`;
    const html = generateFinalAttestationEmail(regulation, tasks.length, regulationUrl);
    const text = `
Ready for Final Attestation: ${regulation.name}

All ${tasks.length} compliance tasks have been completed and attested for this regulation.

This regulation is now ready for your final review and attestation.

View Regulation: ${regulationUrl}

---
This is an automated notification from EdSteward Compliance Management.
    `.trim();

    const notifiedEmails: string[] = [];

    for (const recipient of recipients) {
      try {
        const tracking: EmailTrackingContext = {
          emailType: 'final_attestation',
          relatedEntityType: 'regulation',
          relatedEntityId: regulationId,
        };
        await emailService.sendEmailTracked(
          { to: recipient.email, subject, html, text },
          undefined, undefined, undefined,
          tracking
        );
        notifiedEmails.push(recipient.email);
        console.log(`[FinalAttestation] Notified ${recipient.role}: ${recipient.email}`);
      } catch (error) {
        console.error(`[FinalAttestation] Failed to send to ${recipient.email}:`, error);
      }
    }

    return {
      ready: true,
      notified: notifiedEmails.length > 0,
      recipients: notifiedEmails,
    };

  } catch (error) {
    console.error(`[FinalAttestation] Error checking regulation ${regulationId}:`, error);
    return { ready: false, notified: false, recipients: [] };
  }
}

/**
 * Generate the HTML email for final attestation notification
 */
function generateFinalAttestationEmail(
  regulation: { id: number; name: string },
  taskCount: number,
  regulationUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .content { background: #f0fdf4; padding: 24px; border: 1px solid #bbf7d0; border-top: none; }
    .footer { background: #1f2937; color: #9ca3af; padding: 16px 24px; border-radius: 0 0 12px 12px; font-size: 12px; }
    .success-box { background: white; border-left: 4px solid #22c55e; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .stats { display: flex; gap: 24px; margin: 20px 0; }
    .stat { background: white; padding: 16px; border-radius: 8px; text-align: center; flex: 1; }
    .stat-number { font-size: 32px; font-weight: bold; color: #059669; }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .btn { display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    .btn:hover { background: #047857; }
    .check-icon { font-size: 48px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="check-icon">✅</div>
    <h1 style="margin: 0; font-size: 24px;">Ready for Final Attestation</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">All compliance tasks have been completed</p>
  </div>
  
  <div class="content">
    <div class="success-box">
      <strong>Great news!</strong> All compliance tasks for this regulation have been completed and attested by the responsible parties.
    </div>
    
    <h2 style="margin-top: 0; color: #166534;">${regulation.name}</h2>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${taskCount}</div>
        <div class="stat-label">Tasks Completed</div>
      </div>
      <div class="stat">
        <div class="stat-number">100%</div>
        <div class="stat-label">Compliance</div>
      </div>
    </div>
    
    <h3>What's Next?</h3>
    <p>This regulation is now ready for your final review and attestation. Please:</p>
    <ol style="padding-left: 20px;">
      <li>Review the completed tasks and uploaded evidence</li>
      <li>Verify that all compliance requirements have been met</li>
      <li>Complete the final attestation to certify compliance</li>
    </ol>
    
    <a href="${regulationUrl}" class="btn">Review & Attest →</a>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from EdSteward Compliance Management.</p>
    <p>You are receiving this because you are listed as a DRI or CCO for this regulation.</p>
  </div>
</body>
</html>
  `.trim();
}

