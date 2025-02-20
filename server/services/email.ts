
import nodemailer from 'nodemailer';
import { log } from '../vite';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, subject: string, text: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
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
