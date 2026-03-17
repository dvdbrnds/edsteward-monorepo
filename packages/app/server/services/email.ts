import nodemailer from 'nodemailer';
import dns from 'dns';
import net from 'net';
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

interface RecipientVerifyResult {
  valid: boolean;
  code?: string;
  message?: string;
}

// Cache RCPT TO results for 10 minutes to avoid hammering MX servers
const verifyCache = new Map<string, { result: RecipientVerifyResult; expires: number }>();
const VERIFY_CACHE_TTL = 10 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 8000;

function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses || []);
    });
  });
}

/**
 * Verify a recipient exists by connecting to their MX server and issuing RCPT TO.
 * Returns { valid: true } if the server accepts, { valid: false, code, message } if rejected.
 * Errors and timeouts are treated as inconclusive (valid: true) — we don't block sends on uncertainty.
 */
async function verifyRecipientSmtp(email: string, fromEmail: string): Promise<RecipientVerifyResult> {
  const cached = verifyCache.get(email);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const domain = email.split('@')[1];
  if (!domain) {
    return { valid: false, code: 'INVALID', message: 'No domain in email address' };
  }

  let mxRecords: dns.MxRecord[];
  try {
    mxRecords = await resolveMx(domain);
    if (mxRecords.length === 0) {
      const result: RecipientVerifyResult = { valid: false, code: 'NO_MX', message: `No MX records found for ${domain}` };
      verifyCache.set(email, { result, expires: Date.now() + VERIFY_CACHE_TTL });
      return result;
    }
  } catch (err: any) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      const result: RecipientVerifyResult = { valid: false, code: 'NO_MX', message: `Domain ${domain} has no MX records` };
      verifyCache.set(email, { result, expires: Date.now() + VERIFY_CACHE_TTL });
      return result;
    }
    // DNS error — inconclusive, allow the send
    console.warn(`[EmailVerify] DNS lookup failed for ${domain}: ${err.message}`);
    return { valid: true };
  }

  // Sort by priority (lowest = highest priority)
  mxRecords.sort((a, b) => a.priority - b.priority);
  const mxHost = mxRecords[0].exchange;

  return new Promise<RecipientVerifyResult>((resolve) => {
    const socket = new net.Socket();
    let phase: 'greeting' | 'ehlo' | 'mailfrom' | 'rcptto' | 'quit' | 'done' = 'greeting';
    let buffer = '';
    let settled = false;

    const finish = (result: RecipientVerifyResult) => {
      if (settled) return;
      settled = true;
      verifyCache.set(email, { result, expires: Date.now() + VERIFY_CACHE_TTL });
      try { socket.write('QUIT\r\n'); } catch { /* ignore */ }
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      console.warn(`[EmailVerify] Timeout verifying ${email} via ${mxHost}`);
      finish({ valid: true }); // inconclusive
    }, VERIFY_TIMEOUT_MS);

    socket.on('error', () => {
      clearTimeout(timer);
      finish({ valid: true }); // inconclusive
    });

    socket.on('close', () => {
      clearTimeout(timer);
      if (!settled) finish({ valid: true });
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      // SMTP responses end with \r\n; multi-line use "250-" continuation
      if (!buffer.includes('\r\n')) return;
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line) continue;
        const code = line.substring(0, 3);
        const isContinuation = line[3] === '-';
        if (isContinuation) continue; // wait for final line of multi-line response

        if (phase === 'greeting') {
          if (code.startsWith('2')) {
            phase = 'ehlo';
            socket.write('EHLO edsteward.ai\r\n');
          } else {
            finish({ valid: true }); // server not cooperative, inconclusive
          }
        } else if (phase === 'ehlo') {
          if (code.startsWith('2')) {
            phase = 'mailfrom';
            socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
          } else {
            finish({ valid: true });
          }
        } else if (phase === 'mailfrom') {
          if (code.startsWith('2')) {
            phase = 'rcptto';
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            finish({ valid: true });
          }
        } else if (phase === 'rcptto') {
          clearTimeout(timer);
          if (code.startsWith('2')) {
            finish({ valid: true });
          } else if (code.startsWith('5')) {
            // 550 = mailbox doesn't exist, 551 = user not local, 553 = mailbox name not allowed
            finish({ valid: false, code, message: line });
          } else {
            // 4xx = temp error, treat as inconclusive
            finish({ valid: true });
          }
        }
      }
    });

    socket.connect(25, mxHost);
  });
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

      // Pre-flight: verify recipient's domain has MX records and probe via RCPT TO.
      // Catches non-existent domains and addresses at providers that enforce recipient validation.
      // NOTE: Servers with catch-all/relay configs (e.g., Exchange accepting all local recipients,
      // or Gmail relay) will return 250 for any address — those bounces are only detectable later.
      try {
        const verify = await verifyRecipientSmtp(recipientTo, config.fromEmail);
        if (!verify.valid) {
          console.warn(`[EmailService] Recipient verification failed for ${recipientTo}: ${verify.code} ${verify.message}`);
          const verifyError = new Error(`Recipient verification failed: ${verify.code} - ${verify.message}`);
          (verifyError as any).responseCode = verify.code;
          throw verifyError;
        }
      } catch (verifyErr: any) {
        if (verifyErr.responseCode) throw verifyErr;
        console.warn(`[EmailService] RCPT TO probe error (non-fatal): ${verifyErr.message}`);
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
