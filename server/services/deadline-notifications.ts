import { storage } from '../storage';
import { emailService } from '../services/email';
import { differenceInDays, differenceInHours as _differenceInHours, format } from 'date-fns';
import type { Deadline, Regulation, User } from '@shared/schema';
import { getDatabaseStorage } from './database';

// Default notification schedules if not specified in regulation
const DEFAULT_NOTIFICATION_SCHEDULES = {
  initialReminder: 90, // days before
  weeklyReminder: 30, // start weekly reminders
  dailyReminder: 7,   // start daily reminders
  finalDayReminders: true // three times on the final day
} as const;

interface NotificationContext {
  deadline: Deadline;
  regulation: Regulation;
  assignedUser: User;
  daysRemaining: number;
}

export async function checkAndSendDeadlineNotifications() {
  try {
    const deadlines = await storage.getAllIncompleteDeadlines();
    console.log(`Checking ${deadlines.length} incomplete deadlines`);

    for (const deadline of deadlines) {
      const daysRemaining = differenceInDays(new Date(deadline.dueDate), new Date());

      // Skip if deadline has passed
      if (daysRemaining < 0) continue;

      const regulation = await storage.getRegulation(deadline.regulationId);
      const assignedUser = await storage.getUser(deadline.assignedTo);

      if (!regulation || !assignedUser) {
        console.log(`Skipping deadline ${deadline.id}: Missing regulation or user info`);
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

  const subject = `Regulation Deadline Reminder: ${regulation.name}`;
  const dueDate = format(new Date(deadline.dueDate), 'PPPP');

  let urgencyLevel = getUrgencyLevel(daysRemaining);

  const emailContent = `
    <h2>Regulation Compliance Deadline Reminder</h2>
    <p>This is a reminder about an upcoming compliance deadline:</p>

    <h3>Regulation Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${regulation.name}</li>
      <li><strong>Due Date:</strong> ${dueDate}</li>
      <li><strong>Time Remaining:</strong> ${formatTimeRemaining(daysRemaining)}</li>
      <li><strong>Urgency:</strong> ${urgencyLevel}</li>
    </ul>

    <p><strong>Required Action:</strong> Please review and complete the compliance requirements for this regulation.</p>

    <p>You can view the regulation details and mark it as complete by clicking the link below:</p>
    <a href="${process.env.APP_URL}/regulations/${regulation.id}">View Regulation Details</a>

    <p>If you have any questions, please contact the compliance office.</p>
  `;

  await emailService.sendEmail(assignedUser.email, subject, emailContent);

  // Log notification sent
  console.log(`Sent ${urgencyLevel} deadline notification to ${assignedUser.email} for regulation ${regulation.id}`);
}

function shouldSendNotification(daysRemaining: number, regulation: Regulation): boolean {
  const schedules = regulation.notificationSchedule || DEFAULT_NOTIFICATION_SCHEDULES;
  const hoursRemaining = daysRemaining * 24;

  // Initial reminder
  if (daysRemaining === schedules.initialReminder) return true;

  // Weekly reminders between weekly threshold and daily threshold
  if (daysRemaining <= schedules.weeklyReminder &&
      daysRemaining > schedules.dailyReminder &&
      daysRemaining % 7 === 0) return true;

  // Daily reminders in the final week
  if (daysRemaining <= schedules.dailyReminder &&
      daysRemaining > 1) return true;

  // Three times on the last day if enabled
  if (daysRemaining <= 1 && schedules.finalDayReminders) {
    const hour = new Date().getHours();
    return hour === 9 || hour === 13 || hour === 17;
  }

  return false;
}

function getUrgencyLevel(daysRemaining: number): string {
  if (daysRemaining <= 1) return 'CRITICAL';
  if (daysRemaining <= 7) return 'HIGH';
  if (daysRemaining <= 30) return 'MEDIUM';
  return 'LOW';
}

function formatTimeRemaining(daysRemaining: number): string {
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
      console.log(`Cannot send creation notification for deadline ${deadline.id}: Missing regulation or user info`);
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
    const allUsers = await tenantStorage.getUsers();
    const complianceOfficers = allUsers.filter(user => 
      user.role === 'compliance_officer' || 
      (user.roles && JSON.parse(user.roles || '[]').includes('compliance_officer'))
    );
    
    complianceOfficers.forEach(officer => recipients.add(officer.email));
    
    // 4. Find all admins as backup
    const admins = allUsers.filter(user => 
      user.role === 'admin' || 
      (user.roles && JSON.parse(user.roles || '[]').includes('admin'))
    );
    
    admins.forEach(admin => recipients.add(admin.email));

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

    // Send to all recipients
    const emailPromises = Array.from(recipients).map(email => 
      emailService.sendEmail(email, subject, emailContent)
    );
    
    await Promise.allSettled(emailPromises);
    
    // Create in-app notifications for all recipients
    const notificationPromises = Array.from(recipients).map(async (email) => {
      const user = allUsers.find(u => u.email === email);
      if (user) {
        return tenantStorage.createNotification({
          userId: user.id,
          type: 'deadline_created',
          title: `New Deadline: ${regulation.name}`,
          message: `A new compliance deadline has been created, due ${dueDate}. Assigned to: ${assignedUser.firstName} ${assignedUser.lastName}`,
          data: JSON.stringify({
            deadlineId: deadline.id,
            regulationId: regulation.id,
            dueDate: deadline.dueDate,
            assignedTo: deadline.assignedTo
          }),
          isRead: false
        });
      }
    });
    
    await Promise.allSettled(notificationPromises.filter(Boolean));
    
    console.log(`✅ Sent deadline creation notifications to ${recipients.size} recipients for deadline ${deadline.id}`);
    
  } catch (error) {
    console.error(`❌ Error sending deadline creation notification:`, error);
    throw error;
  }
}