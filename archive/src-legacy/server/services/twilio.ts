import twilio from 'twilio';
import { log } from '../vite';
import { db } from '../db';
import { twilioConfigs } from '@shared/schema';

export class TwilioService {
  private client: twilio.Twilio | null = null;

  private async getTwilioConfig() {
    try {
      const configs = await db.select().from(twilioConfigs).limit(1);
      return configs[0];
    } catch (error) {
      log(`Error fetching Twilio config: ${error}`);
      return null;
    }
  }

  private async initializeClient() {
    const config = await this.getTwilioConfig();
    if (!config) {
      log('No Twilio configuration found');
      return false;
    }

    try {
      this.client = twilio(config.accountSid, config.authToken);
      log('Twilio service initialized successfully');
      return true;
    } catch (error) {
      log(`Failed to initialize Twilio service: ${error}`);
      this.client = null;
      return false;
    }
  }

  async sendSMS(to: string, body: string) {
    try {
      if (!this.client) {
        const initialized = await this.initializeClient();
        if (!initialized) {
          throw new Error('Twilio service not configured');
        }
      }

      const config = await this.getTwilioConfig();
      if (!config) {
        throw new Error('Twilio configuration not found');
      }

      const message = await this.client!.messages.create({
        body,
        from: config.fromNumber,
        to,
      });

      log(`SMS sent: ${message.sid}`);
      return true;
    } catch (error) {
      log(`SMS error: ${error}`);
      return false;
    }
  }
}

export const twilioService = new TwilioService();
