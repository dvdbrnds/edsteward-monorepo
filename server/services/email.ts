import nodemailer from 'nodemailer';
import { log } from '../vite';
import { db } from '../db';
import { emailConfigs } from '@shared/schema';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getEmailConfig() {
    try {
      const configs = await db.select().from(emailConfigs).limit(1);
      return configs[0];
    } catch (error) {
      log(`Error fetching email config: ${error}`);
      return null;
    }
  }

  private async initializeTransporter() {
    const config = await this.getEmailConfig();
    if (!config) {
      log('No email configuration found');
      return false;
    }

    try {
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
      log('Email service initialized successfully');
      return true;
    } catch (error) {
      log(`Failed to initialize email service: ${error}`);
      this.transporter = null;
      return false;
    }
  }

  async sendEmail(to: string, subject: string, content: string, options?: { html?: boolean }) {
    try {
      if (!this.transporter) {
        const initialized = await this.initializeTransporter();
        if (!initialized) {
          throw new Error('Email service not configured');
        }
      }

      const config = await this.getEmailConfig();
      if (!config) {
        throw new Error('Email configuration not found');
      }

      // Determine if content is HTML (auto-detect or use option)
      const isHtml = options?.html ?? content.trim().startsWith('<');
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: config.fromEmail,
        to,
        subject,
      };

      if (isHtml) {
        mailOptions.html = content;
        // Create plain text fallback by stripping HTML
        mailOptions.text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      } else {
        mailOptions.text = content;
      }

      const info = await this.transporter!.sendMail(mailOptions);

      log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      log(`Email error: ${error}`);
      return false;
    }
  }
}

export const emailService = new EmailService();