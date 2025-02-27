import { storage } from '../storage';
import { emailService } from '../services/email';
import { differenceInDays, differenceInHours, format } from 'date-fns';
import type { Deadline, Regulation, User } from '@shared/schema';

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