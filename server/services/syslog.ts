import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { db } from '../db';
import { systemLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Log levels based on syslog protocol (RFC 5424)
export enum LogLevel {
  EMERGENCY = 0, // System is unusable
  ALERT = 1,     // Action must be taken immediately
  CRITICAL = 2,  // Critical conditions
  ERROR = 3,     // Error conditions
  WARNING = 4,   // Warning conditions
  NOTICE = 5,    // Normal but significant condition
  INFO = 6,      // Informational messages
  DEBUG = 7      // Debug-level messages
}

// Map log levels to human-readable strings
const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.EMERGENCY]: 'EMERGENCY',
  [LogLevel.ALERT]: 'ALERT',
  [LogLevel.CRITICAL]: 'CRITICAL',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARNING]: 'WARNING',
  [LogLevel.NOTICE]: 'NOTICE',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG'
};

// Log facilities based on syslog protocol (RFC 5424)
export enum LogFacility {
  KERNEL = 0,     // Kernel messages
  USER = 1,       // User-level messages
  MAIL = 2,       // Mail system
  SYSTEM = 3,     // System daemons
  SECURITY = 4,   // Security/authorization messages
  INTERNAL = 5,   // Internal syslogd messages
  PRINTER = 6,    // Line printer subsystem
  NETWORK = 7,    // Network news subsystem
  UUCP = 8,       // UUCP subsystem
  CLOCK = 9,      // Clock daemon
  AUTH = 10,      // Security/authorization messages
  FTP = 11,       // FTP daemon
  NTP = 12,       // NTP subsystem
  AUDIT = 13,     // Log audit
  ALERT = 14,     // Log alert
  CRON = 15,      // Clock daemon
  LOCAL0 = 16,    // Local use 0
  LOCAL1 = 17,    // Local use 1
  LOCAL2 = 18,    // Local use 2
  LOCAL3 = 19,    // Local use 3
  LOCAL4 = 20,    // Local use 4
  LOCAL5 = 21,    // Local use 5
  LOCAL6 = 22,    // Local use 6
  LOCAL7 = 23     // Local use 7
}

// Map log facilities to human-readable strings
const LogFacilityNames: Record<LogFacility, string> = {
  [LogFacility.KERNEL]: 'KERNEL',
  [LogFacility.USER]: 'USER',
  [LogFacility.MAIL]: 'MAIL',
  [LogFacility.SYSTEM]: 'SYSTEM',
  [LogFacility.SECURITY]: 'SECURITY',
  [LogFacility.INTERNAL]: 'INTERNAL',
  [LogFacility.PRINTER]: 'PRINTER',
  [LogFacility.NETWORK]: 'NETWORK',
  [LogFacility.UUCP]: 'UUCP',
  [LogFacility.CLOCK]: 'CLOCK',
  [LogFacility.AUTH]: 'AUTH',
  [LogFacility.FTP]: 'FTP',
  [LogFacility.NTP]: 'NTP',
  [LogFacility.AUDIT]: 'AUDIT',
  [LogFacility.ALERT]: 'ALERT',
  [LogFacility.CRON]: 'CRON',
  [LogFacility.LOCAL0]: 'LOCAL0',
  [LogFacility.LOCAL1]: 'LOCAL1',
  [LogFacility.LOCAL2]: 'LOCAL2',
  [LogFacility.LOCAL3]: 'LOCAL3',
  [LogFacility.LOCAL4]: 'LOCAL4',
  [LogFacility.LOCAL5]: 'LOCAL5',
  [LogFacility.LOCAL6]: 'LOCAL6',
  [LogFacility.LOCAL7]: 'LOCAL7'
};

// Interface for structured data in log messages
interface StructuredData {
  id: string;
  parameters: Record<string, any>;
}

interface LogConfig {
  logToConsole: boolean;
  logToFile: boolean;
  logLevel: LogLevel;
  logFilePath: string;
  applicationName: string;
  maxFileSize: number;     // Maximum size of log file in bytes
  maxFiles: number;        // Maximum number of rotated log files to keep
  rotateDaily: boolean;    // Whether to rotate logs daily
}

export class SysLogger {
  private config: LogConfig;
  private fileStream: fs.WriteStream | null = null;
  private currentLogFile: string;
  private lastRotateCheck: Date;

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      logToConsole: true,
      logToFile: false, // NEVER enable file logging in production
      logLevel: LogLevel.INFO,
      logFilePath: '/dev/null', // Safe fallback path that won't cause errors
      applicationName: 'EdSteward',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      rotateDaily: true,
      ...config
    };

    // Force disable file logging in production environment
    if (process.env.NODE_ENV === 'production') {
      this.config.logToFile = false;
    }

    this.currentLogFile = this.config.logFilePath;
    this.lastRotateCheck = new Date();

    // COMPLETELY SKIP all file operations - do not attempt any filesystem access
    // No directory creation, no file stream setup, nothing
  }

  private setupFileStream(): void {
    // NEVER attempt file operations in production - always skip
    if (process.env.NODE_ENV !== 'production' && this.config.logToFile) {
      try {
        this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        this.fileStream.on('error', (error) => {
          console.error('Error writing to log file:', error);
          this.fileStream = null;
        });
      } catch (error) {
        console.warn('Could not create file stream, disabling file logging:', error);
        this.fileStream = null;
        this.config.logToFile = false;
      }
    }
  }

  /**
   * Log a message with the specified facility and level
   */
  async log(facility: LogFacility, level: LogLevel, message: string, structuredData?: StructuredData): Promise<void> {
    if (level > this.config.logLevel) {
      return; // Skip if level is higher than configured level
    }

    const timestamp = new Date();
    const hostname = os.hostname();
    const pid = process.pid.toString();

    try {
      // Prepare structured data for database with safe defaults
      const dbStructuredData = structuredData ? {
        ...(structuredData.parameters || {}),
        _timestamp: timestamp.toISOString(),
        _facility: LogFacilityNames[facility],
        _level: LogLevelNames[level]
      } : {
        _timestamp: timestamp.toISOString(),
        _facility: LogFacilityNames[facility],
        _level: LogLevelNames[level]
      };

      // Store in database according to RFC 5424
      await db.insert(systemLogs).values({
        timestamp,
        facility,
        severity: level,
        version: 1,
        hostname,
        appName: this.config.applicationName,
        procId: pid,
        msgId: structuredData?.id || null,
        structuredData: dbStructuredData,
        message,
      });

      // Format syslog message according to RFC 5424
      const pri = facility * 8 + level;
      let structuredDataStr = '-';

      if (structuredData?.parameters) {
        const entries = Object.entries(structuredData.parameters || {});
        if (entries.length > 0) {
          structuredDataStr = `[${structuredData.id} ${entries
            .map(([key, value]) => `${key}="${String(value)}"`)
            .join(' ')}]`;
        }
      }

      const syslogMessage = `<${pri}>1 ${timestamp.toISOString()} ${hostname} ${
        this.config.applicationName
      } ${pid} ${structuredData?.id || '-'} ${structuredDataStr} ${message}\n`;

      // Write to file if enabled
      if (this.config.logToFile && this.fileStream) {
        this.fileStream.write(syslogMessage);
      }

      // Write to console if enabled
      if (this.config.logToConsole) {
        const consoleMessage = `${timestamp.toISOString()} [${LogLevelNames[level]}] ${message}`;
        if (level <= LogLevel.ERROR) {
          console.error(consoleMessage);
        } else if (level === LogLevel.WARNING) {
          console.warn(consoleMessage);
        } else {
        }
      }
    } catch (error) {
      console.error('Failed to log message:', error);
      // Ensure we at least have console output if database fails
      console.error(`LOGGING_FAILURE: ${message}`, error);
    }
  }

  // Auth specific logging methods
  async logAuthEvent(level: LogLevel, message: string, userId?: number, username?: string, metadata?: Record<string, any>): Promise<void> {
    try {

      // Prepare structured data for database
      const eventData = {
        userId: userId || 'none',
        username: username || 'unknown',
        timestamp: new Date().toISOString(),
        event: message.toLowerCase().includes('login') ? 'login' :
               message.toLowerCase().includes('logout') ? 'logout' : 'auth',
        ip: metadata?.ip || 'N/A',
        userAgent: metadata?.userAgent || 'N/A',
        context: metadata?.context || 'AUTH',
        type: metadata?.type || 'auth_event',
        ...(metadata || {})
      };

      await this.log(LogFacility.AUTH, level, message, {
        id: 'AUTH',
        parameters: eventData
      });
    } catch (error) {
      console.error('Failed to log auth event:', error);
      // Ensure we at least have console output if database fails
      console.error(`AUTH_EVENT: ${message}`, { userId, username, metadata });
    }
  }

  // Security specific logging methods
  async logSecurityEvent(level: LogLevel, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.SECURITY, level, message, {
      id: 'SECURITY',
      parameters: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Audit specific logging methods
  async logAuditEvent(level: LogLevel, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.AUDIT, level, message, {
      id: 'AUDIT',
      parameters: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Convenience methods for different log levels
  async emergency(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.EMERGENCY, message, {
      id: 'EMERGENCY',
      parameters: metadata || {}
    });
  }

  async alert(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.ALERT, message, {
      id: 'ALERT',
      parameters: metadata || {}
    });
  }

  async critical(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.CRITICAL, message, {
      id: 'CRITICAL',
      parameters: metadata || {}
    });
  }

  async error(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.ERROR, message, {
      id: 'ERROR',
      parameters: metadata || {}
    });
  }

  async warning(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.WARNING, message, {
      id: 'WARNING',
      parameters: metadata || {}
    });
  }

  async notice(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.NOTICE, message, {
      id: 'NOTICE',
      parameters: metadata || {}
    });
  }

  async info(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.INFO, message, {
      id: 'INFO',
      parameters: metadata || {}
    });
  }

  async debug(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogFacility.USER, LogLevel.DEBUG, message, {
      id: 'DEBUG',
      parameters: metadata || {}
    });
  }

  // Clean up resources
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  /**
   * Log an audit event with structured data
   */
  logAuditEvent(level: LogLevel, message: string, auditData: Record<string, any>): void {
    const structuredData: StructuredData = {
      audit: auditData
    };
    this.log(LogFacility.LOCAL0, level, `[AUDIT] ${message}`, structuredData);
  }
}

// Export configured syslog instance
export const syslog = new SysLogger({
  logToFile: process.env.NODE_ENV !== 'production', // Disable file logging in production
  logToConsole: true,
  logLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
});