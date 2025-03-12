"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const vite_1 = require("../vite");
const db_1 = require("../db");
const schema_1 = require("@shared/schema");
class EmailService {
    constructor() {
        this.transporter = null;
    }
    async getEmailConfig() {
        try {
            const configs = await db_1.db.select().from(schema_1.emailConfigs).limit(1);
            return configs[0];
        }
        catch (error) {
            (0, vite_1.log)(`Error fetching email config: ${error}`);
            return null;
        }
    }
    async initializeTransporter() {
        const config = await this.getEmailConfig();
        if (!config) {
            (0, vite_1.log)('No email configuration found');
            return false;
        }
        try {
            this.transporter = nodemailer_1.default.createTransport({
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
            (0, vite_1.log)('Email service initialized successfully');
            return true;
        }
        catch (error) {
            (0, vite_1.log)(`Failed to initialize email service: ${error}`);
            this.transporter = null;
            return false;
        }
    }
    async sendEmail(to, subject, text) {
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
            const info = await this.transporter.sendMail({
                from: config.fromEmail,
                to,
                subject,
                text,
            });
            (0, vite_1.log)(`Email sent: ${info.messageId}`);
            return true;
        }
        catch (error) {
            (0, vite_1.log)(`Email error: ${error}`);
            return false;
        }
    }
}
exports.EmailService = EmailService;
exports.emailService = new EmailService();
