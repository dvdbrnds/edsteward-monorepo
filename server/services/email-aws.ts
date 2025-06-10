import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { log } from '../vite';

export class AWSEmailService {
  private sesClient: SESClient;
  private fromEmail: string;

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      } : undefined, // Use IAM role if credentials not provided
    });
    
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@edsteward.ai';
  }

  async sendEmail(
    to: string | string[], 
    subject: string, 
    htmlBody: string, 
    textBody?: string
  ): Promise<boolean> {
    try {
      const toAddresses = Array.isArray(to) ? to : [to];
      
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: toAddresses,
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: textBody ? {
              Data: textBody,
              Charset: 'UTF-8',
            } : undefined,
          },
        },
        Tags: [
          {
            Name: 'Application',
            Value: 'RegulatoryTrackr',
          },
          {
            Name: 'Environment',
            Value: process.env.NODE_ENV || 'development',
          },
        ],
      });

      const result = await this.sesClient.send(command);
      log(`Email sent successfully: ${result.MessageId}`);
      return true;
    } catch (error) {
      log(`SES email error: ${error}`);
      return false;
    }
  }

  async sendNotificationEmail(
    to: string,
    tenantName: string,
    subject: string,
    message: string,
    actionUrl?: string
  ): Promise<boolean> {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #2563eb; margin: 0;">${tenantName}</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280;">RegulatoryTrackr Notification</p>
            </div>
            
            <h2 style="color: #374151;">${subject}</h2>
            
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 5px;">
              <p>${message}</p>
              
              ${actionUrl ? `
                <div style="margin-top: 30px; text-align: center;">
                  <a href="${actionUrl}" 
                     style="background: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Details
                  </a>
                </div>
              ` : ''}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; 
                        color: #6b7280; font-size: 14px;">
              <p>This email was sent from your RegulatoryTrackr account. 
                 If you no longer wish to receive these notifications, 
                 please update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textBody = `
${tenantName} - RegulatoryTrackr Notification

${subject}

${message}

${actionUrl ? `View Details: ${actionUrl}` : ''}

---
This email was sent from your RegulatoryTrackr account.
    `.trim();

    return this.sendEmail(to, `${tenantName} - ${subject}`, htmlBody, textBody);
  }

  async sendWelcomeEmail(
    to: string,
    tenantName: string,
    userFirstName: string,
    loginUrl: string
  ): Promise<boolean> {
    const subject = `Welcome to ${tenantName} - RegulatoryTrackr`;
    const message = `
      Welcome ${userFirstName}! Your account has been created for ${tenantName} on RegulatoryTrackr.
      
      You can now access your compliance tracking dashboard and begin managing regulatory requirements.
    `;

    return this.sendNotificationEmail(to, tenantName, subject, message, loginUrl);
  }
}

export const awsEmailService = new AWSEmailService(); 