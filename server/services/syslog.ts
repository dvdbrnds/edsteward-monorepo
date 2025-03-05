import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { db } from '../db';
import { systemLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';

// Add console output specific configuration
interface ConsoleLogConfig {
  enabled: boolean;
  logDirectory: string;
  filename: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
}

// Extend LogConfig to include console output settings
interface LogConfig {
  logToConsole: boolean;
  logToFile: boolean;
  logLevel: LogLevel;
  logFilePath: string;
  applicationName: string;
  maxFileSize: number;
  maxFiles: number;
  rotateDaily: boolean;
  consoleOutput: ConsoleLogConfig;
}

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


export class SysLogger {
  private config: LogConfig;
  private fileStream: fs.WriteStream | null = null;
  private consoleStream: fs.WriteStream | null = null;
  private currentLogFile: string;
  private currentConsoleFile: string;
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
      consoleOutput: {
        enabled: true,
        logDirectory: path.join(process.cwd(), 'logs', 'console'),
        filename: 'console.log',
        maxFileSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3
      },
      ...config
    };

    this.currentLogFile = this.config.logFilePath;
    this.currentConsoleFile = path.join(
      this.config.consoleOutput.logDirectory,
      this.config.consoleOutput.filename
    );
    this.lastRotateCheck = new Date();

    // Ensure logs directories exist
    const logsDir = path.dirname(this.config.logFilePath);
    const consoleLogsDir = this.config.consoleOutput.logDirectory;

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    if (!fs.existsSync(consoleLogsDir)) {
      fs.mkdirSync(consoleLogsDir, { recursive: true });
    }

    this.setupStreams();
    this.interceptConsole();
  }

  private setupStreams(): void {
    if (this.config.logToFile) {
      this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
      this.fileStream.on('error', (error) => {
        console.error('Error writing to log file:', error);
      });
    }

    if (this.config.consoleOutput.enabled) {
      this.consoleStream = fs.createWriteStream(this.currentConsoleFile, { flags: 'a' });
      this.consoleStream.on('error', (error) => {
        console.error('Error writing to console log file:', error);
      });
    }
  }

  private interceptConsole(): void {
    if (!this.config.consoleOutput.enabled) return;

    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Helper to format console output
    const formatConsoleOutput = (level: string, args: any[]): string => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    };

    // Intercept console methods
    console.log = (...args: any[]) => {
      const output = formatConsoleOutput('log', args);
      this.consoleStream?.write(output);
      originalConsole.log.apply(console, args);
    };

    console.info = (...args: any[]) => {
      const output = formatConsoleOutput('info', args);
      this.consoleStream?.write(output);
      originalConsole.info.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const output = formatConsoleOutput('warn', args);
      this.consoleStream?.write(output);
      originalConsole.warn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const output = formatConsoleOutput('error', args);
      this.consoleStream?.write(output);
      originalConsole.error.apply(console, args);
    };

    console.debug = (...args: any[]) => {
      const output = formatConsoleOutput('debug', args);
      this.consoleStream?.write(output);
      originalConsole.debug.apply(console, args);
    };
  }

  private async rotateConsoleLog(): Promise<void> {
    if (!this.config.consoleOutput.enabled || !this.consoleStream) return;

    try {
      const stats = await fs.promises.stat(this.currentConsoleFile);
      if (stats.size >= this.config.consoleOutput.maxFileSize) {
        // Close current stream
        this.consoleStream.end();

        // Rotate files
        const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss');
        const rotatedFilename = `console-${timestamp}.log`;
        const rotatedFilePath = path.join(
          this.config.consoleOutput.logDirectory,
          rotatedFilename
        );

        await fs.promises.rename(this.currentConsoleFile, rotatedFilePath);

        // Clean up old files if we exceed maxFiles
        const files = await fs.promises.readdir(this.config.consoleOutput.logDirectory);
        const logFiles = files
          .filter(f => f.startsWith('console-'))
          .sort()
          .reverse();

        while (logFiles.length >= this.config.consoleOutput.maxFiles) {
          const oldFile = logFiles.pop();
          if (oldFile) {
            await fs.promises.unlink(
              path.join(this.config.consoleOutput.logDirectory, oldFile)
            );
          }
        }

        // Create new stream
        this.consoleStream = fs.createWriteStream(this.currentConsoleFile, { flags: 'a' });
      }
    } catch (error) {
      console.error('Error rotating console log file:', error);
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
      // Prepare structured data for database
      const dbStructuredData = structuredData ? {
        ...structuredData.parameters,
        _timestamp: timestamp.toISOString(),
        _facility: LogFacilityNames[facility],
        _level: LogLevelNames[level]
      } : null;

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
      const structuredDataStr = structuredData
        ? `[${structuredData.id} ${Object.entries(structuredData.parameters)
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')}]`
        : '-';

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
          console.log(consoleMessage);
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
      console.log('Logging auth event:', { level, message, userId, username, metadata });

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

  // Add new method to get console logs
  async getConsoleLogs(maxLines: number = 1000): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(this.currentConsoleFile, 'utf8');
      return content.split('\n').slice(-maxLines);
    } catch (error) {
      console.error('Error reading console logs:', error);
      return [];
    }
  }

  // Add new method to get filtered console logs with time range
  async getFilteredConsoleLogs(options: {
    maxLines?: number;
    level?: string;
    search?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<string[]> {
    try {
      let logs = await this.getConsoleLogs(options.maxLines);

      if (options.level) {
        logs = logs.filter(log => log.includes(`[${options.level.toUpperCase()}]`));
      }

      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        logs = logs.filter(log => log.toLowerCase().includes(searchTerm));
      }

      if (options.startTime || options.endTime) {
        logs = logs.filter(log => {
          const match = log.match(/\[(.*?)\]/);
          if (!match) return false;

          const logTime = new Date(match[1]);
          if (options.startTime && logTime < options.startTime) return false;
          if (options.endTime && logTime > options.endTime) return false;
          return true;
        });
      }

      return logs;
    } catch (error) {
      console.error('Error filtering console logs:', error);
      return [];
    }
  }

  // Clean up resources
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
    if (this.consoleStream) {
      this.consoleStream.end();
      this.consoleStream = null;
    }
  }
}

// Create and export a singleton instance
export const syslog = new SysLogger();