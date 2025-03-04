import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

// Map facilities to human-readable strings
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
  parameters: Record<string, string | number | boolean>;
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
      logToFile: true,
      logLevel: LogLevel.INFO,
      logFilePath: path.join(process.cwd(), 'logs', 'system.log'),
      applicationName: 'compliance-app',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      rotateDaily: true,
      ...config
    };

    this.currentLogFile = this.config.logFilePath;
    this.lastRotateCheck = new Date();

    // Ensure logs directory exists
    const logsDir = path.dirname(this.config.logFilePath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Set up file stream for logging
    this.setupFileStream();

    // Log system startup
    this.log(LogFacility.SYSTEM, LogLevel.NOTICE, 'System logger initialized', {
      id: 'LOGGER_INIT',
      parameters: {
        logLevel: LogLevelNames[this.config.logLevel],
        logFile: this.config.logFilePath,
        maxFileSize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        rotateDaily: this.config.rotateDaily
      }
    });
  }

  private setupFileStream(): void {
    if (this.config.logToFile) {
      this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
      this.fileStream.on('error', (error) => {
        console.error('Error writing to log file:', error);
      });
    }
  }

  private shouldRotateLog(): boolean {
    if (!this.config.logToFile) return false;

    const now = new Date();
    const stats = fs.statSync(this.currentLogFile);

    // Check file size
    if (stats.size >= this.config.maxFileSize) {
      return true;
    }

    // Check daily rotation
    if (this.config.rotateDaily) {
      const today = now.toDateString();
      const lastCheck = this.lastRotateCheck.toDateString();
      if (today !== lastCheck) {
        return true;
      }
    }

    return false;
  }

  private rotateLog(): void {
    if (!this.fileStream) return;

    // Close current stream
    this.fileStream.end();
    this.fileStream = null;

    // Rotate files
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldFile = `${this.config.logFilePath}.${i}`;
      const newFile = `${this.config.logFilePath}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Rename current log file
    if (fs.existsSync(this.config.logFilePath)) {
      fs.renameSync(this.config.logFilePath, `${this.config.logFilePath}.1`);
    }

    // Create new stream
    this.setupFileStream();
    this.lastRotateCheck = new Date();
  }

  /**
   * Log a message with the specified facility and level
   */
  log(facility: LogFacility, level: LogLevel, message: string, structuredData?: StructuredData): void {
    if (level > this.config.logLevel) {
      return; // Skip if level is higher than configured level
    }

    // Check log rotation
    if (this.shouldRotateLog()) {
      this.rotateLog();
    }

    const timestamp = new Date().toISOString();
    const hostname = os.hostname();
    const pid = process.pid;

    // Calculate priority value (PRI) as per syslog RFC
    const pri = facility * 8 + level;

    // Format structured data according to RFC 5424
    let structuredDataStr = '-';
    if (structuredData) {
      structuredDataStr = `[${structuredData.id}`;
      for (const [key, value] of Object.entries(structuredData.parameters)) {
        structuredDataStr += ` ${key}="${value}"`;
      }
      structuredDataStr += ']';
    }

    // Format according to syslog RFC 5424
    // <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
    const syslogMessage = `<${pri}>1 ${timestamp} ${hostname} ${this.config.applicationName} ${pid} - ${structuredDataStr} ${message}\n`;

    // Human-readable format for console
    const humanReadable = `${timestamp} [${LogFacilityNames[facility]}:${LogLevelNames[level]}] [${pid}] ${message}`;

    // Log to console if enabled
    if (this.config.logToConsole) {
      if (level <= LogLevel.ERROR) {
        console.error(humanReadable);
      } else if (level === LogLevel.WARNING) {
        console.warn(humanReadable);
      } else {
        console.log(humanReadable);
      }
    }

    // Log to file if enabled
    if (this.config.logToFile && this.fileStream) {
      this.fileStream.write(syslogMessage);
    }
  }

  // Convenience methods for different log levels
  emergency(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.EMERGENCY, message, {
      id: 'EMERGENCY',
      parameters: metadata || {}
    });
  }

  alert(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.ALERT, message, {
      id: 'ALERT',
      parameters: metadata || {}
    });
  }

  critical(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.CRITICAL, message, {
      id: 'CRITICAL',
      parameters: metadata || {}
    });
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.ERROR, message, {
      id: 'ERROR',
      parameters: metadata || {}
    });
  }

  warning(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.WARNING, message, {
      id: 'WARNING',
      parameters: metadata || {}
    });
  }

  notice(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.NOTICE, message, {
      id: 'NOTICE',
      parameters: metadata || {}
    });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.INFO, message, {
      id: 'INFO',
      parameters: metadata || {}
    });
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.USER, LogLevel.DEBUG, message, {
      id: 'DEBUG',
      parameters: metadata || {}
    });
  }

  // System-specific logging methods
  logAuthEvent(level: LogLevel, message: string, userId?: number, username?: string): void {
    this.log(LogFacility.AUTH, level, message, {
      id: 'AUTH',
      parameters: {
        userId: userId || 'none',
        username: username || 'unknown'
      }
    });
  }

  logSystemEvent(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.SYSTEM, level, message, {
      id: 'SYSTEM',
      parameters: metadata || {}
    });
  }

  logSecurityEvent(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.SECURITY, level, message, {
      id: 'SECURITY',
      parameters: metadata || {}
    });
  }

  logAuditEvent(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    this.log(LogFacility.AUDIT, level, message, {
      id: 'AUDIT',
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
}

// Create and export a singleton instance
export const syslog = new SysLogger();