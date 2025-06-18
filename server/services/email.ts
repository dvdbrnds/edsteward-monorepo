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

  async sendEmail(to: string, subject: string, text: string) {
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

      const info = await this.transporter!.sendMail({
        from: config.fromEmail,
        to,
        subject,
        text,
      });

      log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      log(`Email error: ${error}`);
      return false;
    }
  }
}

export const emailService = new EmailService();