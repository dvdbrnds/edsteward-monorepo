import { storage } from '../storage';
import { emailService } from '../services/email';
import type { EmailTrackingContext } from '../services/email';
import { differenceInDays, differenceInHours as _differenceInHours, format } from 'date-fns';
import type { Deadline, Regulation, User } from '@shared/schema';
import { getDatabaseStorage } from './database';

// Compliance notification timeline per user requirements:
// 90 days: Email to Compliance Officer
// 60 days: Email to Compliance Officer  
// 30 days: Email to Compliance Officer
// 7 days: Weekly emails to Compliance Officer
// Final week: Daily emails to Compliance Officer + CCO/Legal/Admin
const DEFAULT_NOTIFICATION_SCHEDULES = {
  initialReminder: 90,     // 90-day notice to Compliance Officer
  secondReminder: 60,      // 60-day notice to Compliance Officer
  thirdReminder: 30,       // 30-day notice to Compliance Officer
  weeklyReminder: 7,       // Weekly reminders in final approach (7 days)
  dailyReminder: 7,        // Daily reminders in final week (escalated to all stakeholders)
  finalDayReminders: true, // Multiple times on final day
  escalateToAllStakeholders: 7 // Days before deadline to include CCO/Legal/Admin
} as const;

interface NotificationContext {
  deadline: Deadline;
  regulation: Regulation;
  assignedUser: User;
  daysRemaining: number;
}

/**
 * Get notification recipients based on timeline and roles
 * - Days 90-8: Only Compliance Officers
 * - Final week (≤7 days): Compliance Officers + CCO + Legal + Admin
 */
async function getNotificationRecipients(daysRemaining: number): Promise<User[]> {
  const tenantStorage = getDatabaseStorage();
  const allUsers = await tenantStorage.getAllUsers();
  
  // Always include compliance officers
  const complianceOfficers = allUsers.filter(user => {
    const userRoles = Array.isArray(user.roles) ? user.roles : 
                     typeof user.roles === 'string' ? JSON.parse(user.roles || '[]') : [];
    
    return userRoles.includes('compliance') || 
           user.department === 'Compliance' ||
           user.role === 'compliance_officer';
  });

  // If more than 7 days remaining, only send to compliance officers
  if (daysRemaining > DEFAULT_NOTIFICATION_SCHEDULES.escalateToAllStakeholders) {
    return complianceOfficers;
  }

  // Final week: Include CCO, Legal, and Admin stakeholders
  const allStakeholders = allUsers.filter(user => {
    const userRoles = Array.isArray(user.roles) ? user.roles : 
                     typeof user.roles === 'string' ? JSON.parse(user.roles || '[]') : [];
    
    return userRoles.includes('compliance') || 
           userRoles.includes('cco') || 
           userRoles.includes('chief_compliance_officer') ||
           userRoles.includes('legal') || 
           userRoles.includes('admin') ||
           user.department === 'Compliance' ||
           user.department === 'Legal' ||
           user.role === 'admin' ||
           user.role === 'compliance_officer';
  });

  return allStakeholders;
}

export async function checkAndSendDeadlineNotifications() {
  try {
    const deadlines = await storage.getAllIncompleteDeadlines();

    for (const deadline of deadlines) {
      const daysRemaining = differenceInDays(new Date(deadline.dueDate), new Date());

      // Skip if deadline has passed
      if (daysRemaining < 0) continue;

      const regulation = await storage.getRegulation(deadline.regulationId);
      const assignedUser = await storage.getUser(deadline.assignedTo);

      if (!regulation || !assignedUser) {
        continue;
      }

      const context: NotificationContext = {
        deadline,
        regulation,
        assignedUser,
        daysRemaining
      };

      await sendDeadlineNotification(context);
    }
  } catch (error) {
    console.error('Error in deadline notification check:', error);
  }
}

async function sendDeadlineNotification(context: NotificationContext) {
  const { deadline, regulation, assignedUser, daysRemaining } = context;

  // Determine if we should send a notification based on the schedule
  if (!shouldSendNotification(daysRemaining, regulation)) return;

  // Get role-based recipients based on timeline
  const recipients = await getNotificationRecipients(daysRemaining);
  
  if (recipients.length === 0) {
    return;
  }

  const urgencyLevel = getUrgencyLevel(daysRemaining);
  const subject = `${urgencyLevel === 'CRITICAL' ? '[URGENT] ' : ''}Compliance Deadline: ${regulation.name} - ${formatTimeRemaining(daysRemaining)}`;
  const dueDate = format(new Date(deadline.dueDate), 'PPPP');

  // Determine recipient context for email
  const isEscalated = daysRemaining <= DEFAULT_NOTIFICATION_SCHEDULES.escalateToAllStakeholders;
  const recipientContext = isEscalated ? 
    'This notification has been escalated to all compliance stakeholders due to the approaching deadline.' :
    'This notification is being sent to compliance officers for review and action.';

  const emailContent = `
    <h2>🚨 Compliance Deadline Notification</h2>
    <p>${recipientContext}</p>

    <div style="background-color: ${urgencyLevel === 'CRITICAL' ? '#fee2e2' : urgencyLevel === 'HIGH' ? '#fef3c7' : '#f0f9ff'}; 
                border-left: 4px solid ${urgencyLevel === 'CRITICAL' ? '#dc2626' : urgencyLevel === 'HIGH' ? '#d97706' : '#0284c7'}; 
                padding: 15px; margin: 20px 0;">
      <h3>📋 Regulation Details:</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>📄 Regulation:</strong> ${regulation.name}</li>
        <li><strong>📅 Due Date:</strong> ${dueDate}</li>
        <li><strong>⏰ Time Remaining:</strong> ${formatTimeRemaining(daysRemaining)}</li>
        <li><strong>🚩 Urgency Level:</strong> ${urgencyLevel}</li>
        <li><strong>👤 Assigned To:</strong> ${assignedUser.firstName} ${assignedUser.lastName} (${assignedUser.email})</li>
      </ul>
    </div>

    <h3>📋 Required Action:</h3>
    <p>Please review and complete the compliance requirements for this regulation. ${
      isEscalated ? 
      '<strong>This deadline is approaching rapidly and requires immediate attention from all stakeholders.</strong>' :
      'Please coordinate with the assigned team member to ensure timely completion.'
    }</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}/regulations/${regulation.id}" 
         style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        📖 View Regulation Details & Update Status
      </a>
    </p>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
      <p><strong>📧 This notification was sent to:</strong></p>
      <ul>
        ${recipients.map(user => `<li>• ${user.firstName} ${user.lastName} (${user.email}) - ${getUserRoleDescription(user)}</li>`).join('')}
      </ul>
    </div>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
    <p style="font-size: 12px; color: #6c757d;">
      🔔 Notification Schedule: 90 days → 60 days → 30 days → Daily (final week) → Hourly (final day)
      <br>
      🔧 This is an automated notification from the EdSteward Compliance Management System.
    </p>
  `;

  // Send emails to all recipients with delivery tracking
  const emailPromises = recipients.map(recipient => {
    const tracking: EmailTrackingContext = {
      emailType: 'deadline_warning',
      relatedEntityType: 'regulation',
      relatedEntityId: regulation.id,
      recipientUserId: recipient.id,
    };
    return emailService.sendEmailTracked(
      recipient.email, subject, emailContent, undefined, tracking
    );
  });
  
  await Promise.allSettled(emailPromises);
}

/**
 * Get user role description for email display
 */
function getUserRoleDescription(user: User): string {
  const userRoles = Array.isArray(user.roles) ? user.roles : 
                   typeof user.roles === 'string' ? JSON.parse(user.roles || '[]') : [];
  
  if (userRoles.includes('cco') || userRoles.includes('chief_compliance_officer')) {
    return 'Chief Compliance Officer';
  }
  if (userRoles.includes('legal')) {
    return 'Legal Counsel';
  }
  if (userRoles.includes('admin') || user.role === 'admin') {
    return 'Administrator';
  }
  if (userRoles.includes('compliance') || user.department === 'Compliance') {
    return 'Compliance Officer';
  }
  return 'Team Member';
}

function shouldSendNotification(daysRemaining: number, regulation: Regulation): boolean {
  // Check if notifications are disabled for this regulation
  if (regulation.notificationsDisabled) {
    return false;
  }

  const schedules = (regulation.notificationSchedule || DEFAULT_NOTIFICATION_SCHEDULES) as typeof DEFAULT_NOTIFICATION_SCHEDULES;

  // 90-day notice (initial reminder to Compliance Officer)
  if (daysRemaining === schedules.initialReminder) return true;

  // 60-day notice (second reminder to Compliance Officer)  
  if (daysRemaining === schedules.secondReminder) return true;

  // 30-day notice (third reminder to Compliance Officer)
  if (daysRemaining === schedules.thirdReminder) return true;

  // Final week (≤7 days): Daily reminders to all stakeholders
  if (daysRemaining <= schedules.dailyReminder && daysRemaining > 0) {
    // Send daily notifications every morning at 9 AM
    const hour = new Date().getHours();
    return hour === 9;
  }

  // Final day: Multiple notifications throughout the day
  if (daysRemaining <= 1 && daysRemaining >= 0 && schedules.finalDayReminders) {
    const hour = new Date().getHours();
    return hour === 9 || hour === 13 || hour === 17; // 9 AM, 1 PM, 5 PM
  }

  // OVERDUE NOTIFICATIONS
  if (daysRemaining < 0) {
    const daysOverdue = Math.abs(daysRemaining);
    
    // Day 1 overdue: Immediate alert
    if (daysOverdue === 1) return true;
    
    // Days 2-7 overdue: Daily urgent reminders at 9 AM
    if (daysOverdue >= 2 && daysOverdue <= 7) {
      const hour = new Date().getHours();
      return hour === 9;
    }
    
    // Week 2+ overdue: Weekly critical alerts on Mondays at 9 AM
    if (daysOverdue > 7) {
      const now = new Date();
      const isMonday = now.getDay() === 1;
      const hour = now.getHours();
      return isMonday && hour === 9;
    }
  }

  return false;
}

function getUrgencyLevel(daysRemaining: number): string {
  // Overdue cases
  if (daysRemaining < 0) {
    const daysOverdue = Math.abs(daysRemaining);
    if (daysOverdue > 7) return 'CRITICAL - EXECUTIVE ESCALATION';
    return 'CRITICAL - OVERDUE';
  }
  
  // Pre-deadline cases
  if (daysRemaining <= 1) return 'CRITICAL';
  if (daysRemaining <= 7) return 'HIGH';
  if (daysRemaining <= 30) return 'MEDIUM';
  return 'LOW';
}

function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const daysOverdue = Math.abs(daysRemaining);
    if (daysOverdue === 1) return '1 day overdue';
    return `${daysOverdue} days overdue`;
  }
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `${daysRemaining} days remaining`;
}

// New function to send immediate notifications when deadlines are created
export async function sendDeadlineCreationNotification(deadline: Deadline) {
  try {
    const tenantStorage = getDatabaseStorage();
    
    // Get regulation and assigned user details
    const regulation = await tenantStorage.getRegulation(deadline.regulationId);
    const assignedUser = await tenantStorage.getUser(deadline.assignedTo);
    
    if (!regulation || !assignedUser) {
      return;
    }

    const dueDate = format(new Date(deadline.dueDate), 'PPPP');
    const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());
    
    // Notification recipients
    const recipients = new Set<string>();
    
    // 1. Always notify the assigned user
    recipients.add(assignedUser.email);
    
    // 2. Check for regulation-specific notification override
    if (regulation.notificationOverride?.email) {
      recipients.add(regulation.notificationOverride.email);
    }
    
    // 3. Find all compliance officers in the system
    const allUsers = await tenantStorage.getAllUsers();
    const complianceOfficers = allUsers.filter((user: User) => 
      user.role === 'compliance_officer' || 
      (user.roles && JSON.parse(user.roles || '[]').includes('compliance_officer'))
    );
    
    complianceOfficers.forEach((officer: User) => recipients.add(officer.email));
    
    // 4. Find all admins as backup
    const admins = allUsers.filter((user: User) => 
      user.role === 'admin' || 
      (user.roles && JSON.parse(user.roles || '[]').includes('admin'))
    );
    
    admins.forEach((admin: User) => recipients.add(admin.email));

    const subject = `🚨 New Compliance Deadline Created: ${regulation.name}`;
    
    const emailContent = `
      <h2>🚨 New Compliance Deadline Alert</h2>
      <p>A new compliance deadline has been created and requires your attention:</p>

      <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
        <h3>📋 Deadline Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>📄 Regulation:</strong> ${regulation.name}</li>
          <li><strong>📅 Due Date:</strong> ${dueDate}</li>
          <li><strong>⏰ Time Until Due:</strong> ${formatTimeRemaining(daysUntilDue)}</li>
          <li><strong>👤 Assigned To:</strong> ${assignedUser.firstName} ${assignedUser.lastName} (${assignedUser.email})</li>
          <li><strong>📊 Status:</strong> ${deadline.status.toUpperCase()}</li>
        </ul>
      </div>

      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <h4>⚡ Immediate Actions Required:</h4>
        <ol>
          <li>Review the regulation requirements and compliance obligations</li>
          <li>Coordinate with the assigned team member if you're a compliance officer</li>
          <li>Set up any necessary tracking or reminder systems</li>
          <li>Begin preparation work if the deadline is approaching</li>
        </ol>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL}/regulations/${regulation.id}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          📖 View Regulation Details & Manage Deadline
        </a>
      </p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <p><strong>📧 This notification was sent to:</strong></p>
        <ul>
          <li>✅ Assigned team member: ${assignedUser.email}</li>
          <li>✅ All compliance officers</li>
          <li>✅ System administrators</li>
          ${regulation.notificationOverride?.email ? `<li>✅ Regulation-specific contact: ${regulation.notificationOverride.email}</li>` : ''}
        </ul>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
      <p style="font-size: 12px; color: #6c757d;">
        📱 You will continue to receive automated reminders as this deadline approaches based on the regulation's notification schedule.
        <br>
        🔧 This is an automated notification from the EdSteward Compliance Management System.
      </p>
    `;

    // Send to all recipients with delivery tracking
    const emailPromises = Array.from(recipients).map(email => {
      const user = allUsers.find((u: User) => u.email === email);
      const tracking: EmailTrackingContext = {
        emailType: 'deadline_warning',
        relatedEntityType: 'regulation',
        relatedEntityId: regulation.id,
        recipientUserId: user?.id,
      };
      return emailService.sendEmailTracked(email, subject, emailContent, undefined, tracking);
    });
    
    await Promise.allSettled(emailPromises);
    
    // Create in-app notifications for all recipients
    const notificationPromises = Array.from(recipients).map(async (email) => {
      const user = allUsers.find((u: User) => u.email === email);
      if (user) {
        return tenantStorage.createNotification({
          userId: user.id,
          regulationId: regulation.id,
          type: 'deadline_created',
          frequency: 'once',
        });
      }
    });
    
    await Promise.allSettled(notificationPromises.filter(Boolean));
    
    
  } catch (error) {
    console.error(`❌ Error sending deadline creation notification:`, error);
    throw error;
  }
}

/**
 * Test function to visualize notification timeline for a specific number of days
 * Useful for testing and validation
 */
export async function getNotificationTimelineSummary(daysFromNow: number[] = [90, 60, 30, 14, 7, 3, 1, 0]): Promise<void> {
  
  for (const days of daysFromNow) {
    const wouldSend = shouldSendNotification(days, { notificationSchedule: DEFAULT_NOTIFICATION_SCHEDULES } as unknown as Regulation);
    const recipients = await getNotificationRecipients(days);
    const urgency = getUrgencyLevel(days);
    const timeDesc = formatTimeRemaining(days);
    
    
    if (recipients.length > 0) {
      recipients.forEach(user => {
      });
    } else {
    }
  }
  
}