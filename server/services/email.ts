import nodemailer from 'nodemailer';
import { db } from '../db';
import { emailConfigs } from '@shared/schema';

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

      // Verify the connection
      await this.transporter.verify();
      console.log('[EmailService] SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to initialize SMTP transporter:`, error);
      this.transporter = null;
      return false;
    }
  }

  async sendEmail(to: string | Record<string, any>, subject?: string, content?: string, options?: { html?: boolean; cc?: string }) {
    try {
      // Handle both positional args and object-style args
      let recipientTo: string;
      let emailSubject: string;
      let emailContent: string;
      let emailOptions: { html?: boolean; cc?: string } | undefined;

      if (typeof to === 'object' && to !== null) {
        // Object-style call: sendEmail({ to, subject, html, cc })
        recipientTo = to.to;
        emailSubject = to.subject;
        emailContent = to.html || to.text || to.content || '';
        emailOptions = { html: !!to.html, cc: to.cc };
      } else {
        // Positional args: sendEmail(to, subject, content, options)
        recipientTo = to;
        emailSubject = subject!;
        emailContent = content!;
        emailOptions = options;
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

      // Determine if content is HTML (auto-detect or use option)
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
        // Create plain text fallback by stripping HTML
        mailOptions.text = emailContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      } else {
        mailOptions.text = emailContent;
      }

      const info = await this.transporter!.sendMail(mailOptions);

      console.log(`[EmailService] Email sent successfully: messageId=${info.messageId} to=${recipientTo}`);
      return true;
    } catch (error) {
      console.error(`[EmailService] Email send failed:`, error);
      return false;
    }
  }
}

export const emailService = new EmailService();