
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Log levels based on syslog protocol
export enum LogLevel {
  EMERGENCY = 0,
  ALERT = 1,
  CRITICAL = 2,
  ERROR = 3,
  WARNING = 4,
  NOTICE = 5,
  INFO = 6,
  DEBUG = 7
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

// Log facilities based on syslog protocol
export enum LogFacility {
  KERNEL = 0,
  USER = 1,
  MAIL = 2,
  SYSTEM = 3,
  SECURITY = 4,
  INTERNAL = 5,
  PRINTER = 6,
  NETWORK = 7,
  UUCP = 8,
  CLOCK = 9,
  AUTH = 10,
  FTP = 11,
  NTP = 12,
  AUDIT = 13,
  ALERT = 14,
  CRON = 15,
  LOCAL0 = 16,
  LOCAL1 = 17,
  LOCAL2 = 18,
  LOCAL3 = 19,
  LOCAL4 = 20,
  LOCAL5 = 21,
  LOCAL6 = 22,
  LOCAL7 = 23
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

interface LogConfig {
  logToConsole: boolean;
  logToFile: boolean;
  logLevel: LogLevel;
  logFilePath: string;
  applicationName: string;
}

export class SysLogger {
  private config: LogConfig;
  private fileStream: fs.WriteStream | null = null;

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      logToConsole: true,
      logToFile: true,
      logLevel: LogLevel.INFO,
      logFilePath: path.join(process.cwd(), 'logs', 'system.log'),
      applicationName: 'compliance-app',
      ...config
    };

    // Ensure logs directory exists
    const logsDir = path.dirname(this.config.logFilePath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Set up file stream for logging
    if (this.config.logToFile) {
      this.fileStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a' });
    }

    // Log system startup
    this.log(LogFacility.SYSTEM, LogLevel.NOTICE, 'System logger initialized');
  }

  /**
   * Log a message with the specified facility and level
   */
  log(facility: LogFacility, level: LogLevel, message: string, metadata?: any): void {
    if (level > this.config.logLevel) {
      return; // Skip if level is higher than configured level
    }

    const timestamp = new Date().toISOString();
    const hostname = os.hostname();
    const pid = process.pid;
    
    // Calculate priority value (PRI) as per syslog RFC
    const pri = facility * 8 + level;
    
    // Format according to syslog RFC 5424
    // <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
    let structuredData = '-';
    if (metadata) {
      try {
        structuredData = JSON.stringify(metadata);
      } catch (e) {
        structuredData = String(metadata);
      }
    }

    const syslogMessage = `<${pri}>1 ${timestamp} ${hostname} ${this.config.applicationName} ${pid} - ${structuredData} ${message}`;
    
    // Human-readable format for console and file
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
      this.fileStream.write(syslogMessage + '\n');
    }
  }

  // Convenience methods for different log levels
  emergency(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.EMERGENCY, message, metadata);
  }

  alert(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.ALERT, message, metadata);
  }

  critical(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.CRITICAL, message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.ERROR, message, metadata);
  }

  warning(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.WARNING, message, metadata);
  }

  notice(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.NOTICE, message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.INFO, message, metadata);
  }

  debug(message: string, metadata?: any): void {
    this.log(LogFacility.USER, LogLevel.DEBUG, message, metadata);
  }

  // Log authentication events
  authEvent(level: LogLevel, message: string, userId?: number, username?: string): void {
    this.log(LogFacility.AUTH, level, message, { userId, username });
  }

  // Log system events
  systemEvent(level: LogLevel, message: string, metadata?: any): void {
    this.log(LogFacility.SYSTEM, level, message, metadata);
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
