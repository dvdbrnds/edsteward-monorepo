/**
 * Email Bounce Escalation Service
 *
 * When an outbound email bounces (SMTP rejection), this service:
 * 1. Looks up the escalation contact for the related regulation/task
 * 2. Sends a delivery-failure alert to the escalation contact
 * 3. Notifies CCO/admin users
 * 4. Creates an in-app notification (notification_queue) so it surfaces in the UI
 */

import { db } from '../db';
import { emailDeliveryLog, notificationQueue, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import type { EmailType } from '@shared/schema';

export interface BounceContext {
  recipientEmail: string;
  subject: string;
  smtpCode: string;
  errorMessage: string;
  bounceType: 'permanent' | 'transient';
  emailType?: EmailType;
  relatedEntityType?: 'regulation' | 'compliance_task';
  relatedEntityId?: number;
  recipientUserId?: number;
  deliveryLogId?: number;
}

interface EscalationTarget {
  email: string;
  name: string;
}

async function findEscalationContact(ctx: BounceContext): Promise<EscalationTarget | null> {
  if (!ctx.relatedEntityType || !ctx.relatedEntityId) return null;

  try {
    if (ctx.relatedEntityType === 'regulation') {
      const result = await db.execute(sql`
        SELECT escalation_target, escalation_email, name
        FROM regulations WHERE id = ${ctx.relatedEntityId} LIMIT 1
      `);
      const reg = result.rows[0] as any;
      if (reg?.escalation_email) {
        return { email: reg.escalation_email, name: reg.escalation_target || 'Escalation Contact' };
      }
    }

    if (ctx.relatedEntityType === 'compliance_task') {
      const result = await db.execute(sql`
        SELECT ct.escalation_email, ct.escalation_name, ct.regulation_id,
               r.escalation_email as reg_escalation_email, r.escalation_target as reg_escalation_target
        FROM compliance_tasks ct
        LEFT JOIN regulations r ON ct.regulation_id = r.id
        WHERE ct.id = ${ctx.relatedEntityId} LIMIT 1
      `);
      const task = result.rows[0] as any;
      if (task?.escalation_email) {
        return { email: task.escalation_email, name: task.escalation_name || 'Escalation Contact' };
      }
      if (task?.reg_escalation_email) {
        return { email: task.reg_escalation_email, name: task.reg_escalation_target || 'Escalation Contact' };
      }
    }
  } catch (err) {
    console.error('[EmailEscalation] Failed to look up escalation contact:', err);
  }

  return null;
}

async function getAdminAndCcoUsers(): Promise<Array<{ id: number; email: string; name: string }>> {
  try {
    const allUsers = await db.select().from(users);
    return allUsers
      .filter(user => {
        const userRoles = Array.isArray(user.roles) ? user.roles :
          typeof user.roles === 'string' ? (() => { try { return JSON.parse(user.roles || '[]'); } catch { return []; } })() : [];
        return userRoles.includes('admin') ||
          userRoles.includes('cco') ||
          userRoles.includes('chief_compliance_officer') ||
          user.role === 'admin';
      })
      .filter(u => u.email)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
      }));
  } catch (err) {
    console.error('[EmailEscalation] Failed to get admin/CCO users:', err);
    return [];
  }
}

async function getEntityName(ctx: BounceContext): Promise<string> {
  try {
    if (ctx.relatedEntityType === 'regulation' && ctx.relatedEntityId) {
      const result = await db.execute(sql`SELECT name FROM regulations WHERE id = ${ctx.relatedEntityId} LIMIT 1`);
      return (result.rows[0] as any)?.name || `Regulation #${ctx.relatedEntityId}`;
    }
    if (ctx.relatedEntityType === 'compliance_task' && ctx.relatedEntityId) {
      const result = await db.execute(sql`
        SELECT ct.title, r.name as regulation_name
        FROM compliance_tasks ct LEFT JOIN regulations r ON ct.regulation_id = r.id
        WHERE ct.id = ${ctx.relatedEntityId} LIMIT 1
      `);
      const row = result.rows[0] as any;
      return row ? `${row.title} (${row.regulation_name || 'unknown regulation'})` : `Task #${ctx.relatedEntityId}`;
    }
  } catch { /* fall through */ }
  return 'Unknown';
}

function generateBounceAlertEmail(ctx: BounceContext, entityName: string): { subject: string; html: string } {
  const isPermanent = ctx.bounceType === 'permanent';
  const subject = `${isPermanent ? '[ACTION REQUIRED]' : '[WARNING]'} Email delivery failed for ${ctx.recipientEmail}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .content { background: #fef2f2; padding: 24px; border: 1px solid #fecaca; border-top: none; }
    .footer { background: #1f2937; color: #9ca3af; padding: 16px 24px; border-radius: 0 0 12px 12px; font-size: 12px; }
    .error-box { background: white; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .detail { margin: 8px 0; }
    .detail strong { color: #374151; }
    .action-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 20px;">Email Delivery Failed</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">A notification could not be delivered</p>
  </div>
  <div class="content">
    <div class="error-box">
      <p class="detail"><strong>Recipient:</strong> ${ctx.recipientEmail}</p>
      <p class="detail"><strong>Original Subject:</strong> ${ctx.subject}</p>
      <p class="detail"><strong>Related To:</strong> ${entityName}</p>
      <p class="detail"><strong>SMTP Error:</strong> ${ctx.smtpCode} - ${ctx.errorMessage.substring(0, 200)}</p>
      <p class="detail"><strong>Bounce Type:</strong> ${isPermanent ? 'Permanent (address invalid)' : 'Transient (temporary issue)'}</p>
    </div>
    <div class="action-box">
      <strong>What to do:</strong>
      <p>${isPermanent
        ? 'This email address appears to be invalid or no longer exists. Please verify the correct email address for this person and update their profile in EdSteward.'
        : 'This may be a temporary issue (mailbox full, server down). The system will not automatically retry. Please check if the issue persists and resend if needed.'
      }</p>
    </div>
  </div>
  <div class="footer">
    <p>This is an automated alert from EdSteward Compliance Management.</p>
  </div>
</body>
</html>`.trim();

  return { subject, html };
}

/**
 * Main entry point — called by EmailService when a send fails.
 */
export async function handleEmailBounce(ctx: BounceContext): Promise<void> {
  console.log(`[EmailEscalation] Handling bounce for ${ctx.recipientEmail} (code=${ctx.smtpCode}, type=${ctx.bounceType})`);

  const entityName = await getEntityName(ctx);
  const { subject: alertSubject, html: alertHtml } = generateBounceAlertEmail(ctx, entityName);

  const escalationContact = await findEscalationContact(ctx);
  const admins = await getAdminAndCcoUsers();

  // Collect everyone we need to alert (deduplicated by email)
  const alertRecipients = new Map<string, string>();

  if (escalationContact) {
    alertRecipients.set(escalationContact.email, escalationContact.name);
  }
  for (const admin of admins) {
    if (!alertRecipients.has(admin.email)) {
      alertRecipients.set(admin.email, admin.name);
    }
  }

  // Don't alert the same address that bounced
  alertRecipients.delete(ctx.recipientEmail);

  if (alertRecipients.size === 0) {
    console.warn('[EmailEscalation] No escalation recipients found — bounce will only be visible in delivery log');
    return;
  }

  // Send alert emails directly via nodemailer (bypass tracked send to avoid recursion)
  let escalationSent = false;
  try {
    const nodemailer = await import('nodemailer');
    const { emailConfigs: emailConfigsTable } = await import('@shared/schema');
    const configs = await db.select().from(emailConfigsTable).limit(1);
    const config = configs[0];
    if (!config) {
      console.error('[EmailEscalation] No email config — cannot send escalation alerts');
      return;
    }

    const transporter = nodemailer.default.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });

    for (const [email] of Array.from(alertRecipients)) {
      try {
        await transporter.sendMail({
          from: config.fromEmail,
          to: email,
          subject: alertSubject,
          html: alertHtml,
          text: alertHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
        });
        escalationSent = true;
        console.log(`[EmailEscalation] Sent bounce alert to ${email}`);
      } catch (sendErr) {
        console.error(`[EmailEscalation] Failed to send bounce alert to ${email}:`, sendErr);
      }
    }
  } catch (err) {
    console.error('[EmailEscalation] Failed to send escalation emails:', err);
  }

  // Update delivery log with escalation info
  if (ctx.deliveryLogId) {
    try {
      const escalationRecipient = escalationContact?.email || admins[0]?.email || null;
      await db.update(emailDeliveryLog)
        .set({
          escalationTriggered: escalationSent,
          escalationRecipient,
          statusUpdatedAt: new Date(),
        })
        .where(eq(emailDeliveryLog.id, ctx.deliveryLogId));
    } catch (err) {
      console.error('[EmailEscalation] Failed to update delivery log escalation status:', err);
    }
  }

  // Create in-app notification so it shows in the notifications page
  try {
    const regulationId = await resolveRegulationId(ctx);
    if (regulationId) {
      await db.insert(notificationQueue).values({
        regulationId,
        userId: ctx.recipientUserId ?? null,
        type: 'email_bounce',
        content: {
          title: `Email delivery failed: ${ctx.recipientEmail}`,
          message: `SMTP ${ctx.smtpCode}: ${ctx.errorMessage.substring(0, 200)}`,
          bounceType: ctx.bounceType,
          entityName,
          emailType: ctx.emailType,
          escalationSent,
        },
        status: 'pending',
        priority: ctx.bounceType === 'permanent' ? 'high' : 'normal',
      });
      console.log('[EmailEscalation] Created in-app notification for bounce');
    }
  } catch (err) {
    console.error('[EmailEscalation] Failed to create in-app notification:', err);
  }
}

async function resolveRegulationId(ctx: BounceContext): Promise<number | null> {
  if (ctx.relatedEntityType === 'regulation' && ctx.relatedEntityId) {
    return ctx.relatedEntityId;
  }
  if (ctx.relatedEntityType === 'compliance_task' && ctx.relatedEntityId) {
    try {
      const result = await db.execute(
        sql`SELECT regulation_id FROM compliance_tasks WHERE id = ${ctx.relatedEntityId} LIMIT 1`
      );
      return (result.rows[0] as any)?.regulation_id ?? null;
    } catch { return null; }
  }
  // Fall back to first regulation as a generic anchor for the notification
  try {
    const result = await db.execute(sql`SELECT id FROM regulations LIMIT 1`);
    return (result.rows[0] as any)?.id ?? null;
  } catch { return null; }
}
