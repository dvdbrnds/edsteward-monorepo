import nodemailer from 'nodemailer';
import { db } from '../db';
import { emailConfigs, emailDeliveryLog, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { EmailType } from '@shared/schema';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  smtpResponseCode?: string;
  errorMessage?: string;
  bounceType?: 'permanent' | 'transient';
  deliveryLogId?: number;
}

export interface EmailTrackingContext {
  emailType?: EmailType;
  relatedEntityType?: 'regulation' | 'compliance_task';
  relatedEntityId?: number;
  recipientUserId?: number;
}

function classifySmtpError(error: any): { code: string; bounceType: 'permanent' | 'transient' } {
  const responseCode = error.responseCode || error.code;
  const codeStr = String(responseCode || '');

  if (codeStr.startsWith('5')) {
    return { code: codeStr, bounceType: 'permanent' };
  }
  if (codeStr.startsWith('4')) {
    return { code: codeStr, bounceType: 'transient' };
  }

  // Non-SMTP errors (network, DNS, timeout)
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return { code: error.code, bounceType: 'transient' };
  }

  return { code: codeStr || 'UNKNOWN', bounceType: 'permanent' };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getEmailConfig() {
    try {
      const configs = await db.select().from(emailConfigs).limit(1);
      return configs[0];
    } catch (error) {
      console.error(`[EmailService] Error fetching email config:`, error);
      return null;
    }
  }

  private async initializeTransporter() {
    const config = await this.getEmailConfig();
    if (!config) {
      console.error('[EmailService] No email configuration found in database');
      return false;
    }

    try {
      console.log(`[EmailService] Initializing SMTP transporter: ${config.smtpHost}:${config.smtpPort} (secure=${config.smtpSecure}) user=${config.smtpUser}`);
      
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      await this.transporter.verify();
      console.log('[EmailService] SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to initialize SMTP transporter:`, error);
      this.transporter = null;
      return false;
    }
  }

  private parseEmailArgs(to: string | Record<string, any>, subject?: string, content?: string, options?: { html?: boolean; cc?: string }) {
    let recipientTo: string;
    let emailSubject: string;
    let emailContent: string;
    let emailOptions: { html?: boolean; cc?: string } | undefined;

    if (typeof to === 'object' && to !== null) {
      recipientTo = to.to;
      emailSubject = to.subject;
      emailContent = to.html || to.text || to.content || '';
      emailOptions = { html: !!to.html, cc: to.cc };
    } else {
      recipientTo = to;
      emailSubject = subject!;
      emailContent = content!;
      emailOptions = options;
    }

    return { recipientTo, emailSubject, emailContent, emailOptions };
  }

  /**
   * Tracked email send — logs to email_delivery_log, captures SMTP codes, triggers escalation on bounce.
   */
  async sendEmailTracked(
    to: string | Record<string, any>,
    subject?: string,
    content?: string,
    options?: { html?: boolean; cc?: string },
    tracking?: EmailTrackingContext
  ): Promise<EmailSendResult> {
    const { recipientTo, emailSubject, emailContent, emailOptions } = this.parseEmailArgs(to, subject, content, options);

    let logId: number | undefined;

    try {
      // Insert pending delivery log entry
      try {
        const [logEntry] = await db.insert(emailDeliveryLog).values({
          recipientEmail: recipientTo,
          recipientUserId: tracking?.recipientUserId ?? null,
          emailType: tracking?.emailType ?? 'other',
          relatedEntityType: tracking?.relatedEntityType ?? null,
          relatedEntityId: tracking?.relatedEntityId ?? null,
          subject: emailSubject,
          status: 'sent',
          sentAt: new Date(),
          statusUpdatedAt: new Date(),
        }).returning({ id: emailDeliveryLog.id });
        logId = logEntry.id;
      } catch (logError) {
        console.error('[EmailService] Failed to create delivery log entry:', logError);
      }

      console.log(`[EmailService] Sending email to=${recipientTo}, subject="${emailSubject}"`);

      if (!this.transporter) {
        const initialized = await this.initializeTransporter();
        if (!initialized) {
          throw new Error('Email service not configured - SMTP initialization failed');
        }
      }

      const config = await this.getEmailConfig();
      if (!config) {
        throw new Error('Email configuration not found');
      }

      const isHtml = emailOptions?.html ?? emailContent.trim().startsWith('<');
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: config.fromEmail,
        to: recipientTo,
        subject: emailSubject,
      };

      if (emailOptions?.cc) {
        mailOptions.cc = emailOptions.cc;
      }

      if (isHtml) {
        mailOptions.html = emailContent;
        mailOptions.text = emailContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      } else {
        mailOptions.text = emailContent;
      }

      const info = await this.transporter!.sendMail(mailOptions);

      console.log(`[EmailService] Email sent successfully: messageId=${info.messageId} to=${recipientTo}`);

      // Update log with success
      if (logId) {
        try {
          await db.update(emailDeliveryLog)
            .set({
              status: 'delivered',
              smtpMessageId: info.messageId,
              statusUpdatedAt: new Date(),
            })
            .where(eq(emailDeliveryLog.id, logId));
        } catch (updateErr) {
          console.error('[EmailService] Failed to update delivery log:', updateErr);
        }
      }

      return {
        success: true,
        messageId: info.messageId,
        deliveryLogId: logId,
      };

    } catch (error: any) {
      const { code, bounceType } = classifySmtpError(error);
      const errorMessage = error.message || String(error);

      console.error(`[EmailService] Email send failed (code=${code}, bounceType=${bounceType}):`, errorMessage);

      // Update log with failure
      if (logId) {
        try {
          await db.update(emailDeliveryLog)
            .set({
              status: 'bounced',
              smtpResponseCode: code,
              errorMessage: errorMessage.substring(0, 1000),
              bounceType,
              statusUpdatedAt: new Date(),
            })
            .where(eq(emailDeliveryLog.id, logId));
        } catch (updateErr) {
          console.error('[EmailService] Failed to update delivery log with error:', updateErr);
        }
      }

      // Flag user email as bounced for permanent failures
      if (bounceType === 'permanent' && tracking?.recipientUserId) {
        try {
          await db.update(users)
            .set({ emailStatus: 'bounced', updatedAt: new Date() })
            .where(eq(users.id, tracking.recipientUserId));
          console.log(`[EmailService] Flagged user ${tracking.recipientUserId} email as bounced`);
        } catch (flagErr) {
          console.error('[EmailService] Failed to flag user email status:', flagErr);
        }
      }

      // Trigger escalation asynchronously (don't block return)
      this.triggerBounceEscalation(recipientTo, emailSubject, code, errorMessage, bounceType, tracking, logId).catch(
        err => console.error('[EmailService] Escalation trigger failed:', err)
      );

      return {
        success: false,
        smtpResponseCode: code,
        errorMessage,
        bounceType,
        deliveryLogId: logId,
      };
    }
  }

  /**
   * Trigger escalation for a bounced email. Imported lazily to avoid circular deps.
   */
  private async triggerBounceEscalation(
    recipientEmail: string,
    subject: string,
    smtpCode: string,
    errorMessage: string,
    bounceType: 'permanent' | 'transient',
    tracking?: EmailTrackingContext,
    logId?: number
  ) {
    try {
      const { handleEmailBounce } = await import('./email-escalation');
      await handleEmailBounce({
        recipientEmail,
        subject,
        smtpCode,
        errorMessage,
        bounceType,
        emailType: tracking?.emailType,
        relatedEntityType: tracking?.relatedEntityType,
        relatedEntityId: tracking?.relatedEntityId,
        recipientUserId: tracking?.recipientUserId,
        deliveryLogId: logId,
      });
    } catch (err) {
      console.error('[EmailService] Failed to import/run escalation handler:', err);
    }
  }

  /**
   * Backward-compatible wrapper — returns boolean like the old API.
   * All existing callers continue to work unchanged.
   */
  async sendEmail(to: string | Record<string, any>, subject?: string, content?: string, options?: { html?: boolean; cc?: string }): Promise<boolean> {
    const result = await this.sendEmailTracked(to, subject, content, options);
    return result.success;
  }
}

export const emailService = new EmailService();
