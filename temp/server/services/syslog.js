"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syslog = exports.SysLogger = exports.LogFacility = exports.LogLevel = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const db_1 = require("../db");
const schema_1 = require("@shared/schema");
// Log levels based on syslog protocol (RFC 5424)
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["EMERGENCY"] = 0] = "EMERGENCY";
    LogLevel[LogLevel["ALERT"] = 1] = "ALERT";
    LogLevel[LogLevel["CRITICAL"] = 2] = "CRITICAL";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["WARNING"] = 4] = "WARNING";
    LogLevel[LogLevel["NOTICE"] = 5] = "NOTICE";
    LogLevel[LogLevel["INFO"] = 6] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 7] = "DEBUG"; // Debug-level messages
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// Map log levels to human-readable strings
const LogLevelNames = {
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
var LogFacility;
(function (LogFacility) {
    LogFacility[LogFacility["KERNEL"] = 0] = "KERNEL";
    LogFacility[LogFacility["USER"] = 1] = "USER";
    LogFacility[LogFacility["MAIL"] = 2] = "MAIL";
    LogFacility[LogFacility["SYSTEM"] = 3] = "SYSTEM";
    LogFacility[LogFacility["SECURITY"] = 4] = "SECURITY";
    LogFacility[LogFacility["INTERNAL"] = 5] = "INTERNAL";
    LogFacility[LogFacility["PRINTER"] = 6] = "PRINTER";
    LogFacility[LogFacility["NETWORK"] = 7] = "NETWORK";
    LogFacility[LogFacility["UUCP"] = 8] = "UUCP";
    LogFacility[LogFacility["CLOCK"] = 9] = "CLOCK";
    LogFacility[LogFacility["AUTH"] = 10] = "AUTH";
    LogFacility[LogFacility["FTP"] = 11] = "FTP";
    LogFacility[LogFacility["NTP"] = 12] = "NTP";
    LogFacility[LogFacility["AUDIT"] = 13] = "AUDIT";
    LogFacility[LogFacility["ALERT"] = 14] = "ALERT";
    LogFacility[LogFacility["CRON"] = 15] = "CRON";
    LogFacility[LogFacility["LOCAL0"] = 16] = "LOCAL0";
    LogFacility[LogFacility["LOCAL1"] = 17] = "LOCAL1";
    LogFacility[LogFacility["LOCAL2"] = 18] = "LOCAL2";
    LogFacility[LogFacility["LOCAL3"] = 19] = "LOCAL3";
    LogFacility[LogFacility["LOCAL4"] = 20] = "LOCAL4";
    LogFacility[LogFacility["LOCAL5"] = 21] = "LOCAL5";
    LogFacility[LogFacility["LOCAL6"] = 22] = "LOCAL6";
    LogFacility[LogFacility["LOCAL7"] = 23] = "LOCAL7"; // Local use 7
})(LogFacility || (exports.LogFacility = LogFacility = {}));
// Map log facilities to human-readable strings
const LogFacilityNames = {
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
class SysLogger {
    constructor(config) {
        this.fileStream = null;
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
        this.setupFileStream();
    }
    setupFileStream() {
        if (this.config.logToFile) {
            this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
            this.fileStream.on('error', (error) => {
                console.error('Error writing to log file:', error);
            });
        }
    }
    /**
     * Log a message with the specified facility and level
     */
    async log(facility, level, message, structuredData) {
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
            await db_1.db.insert(schema_1.systemLogs).values({
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
            const syslogMessage = `<${pri}>1 ${timestamp.toISOString()} ${hostname} ${this.config.applicationName} ${pid} ${structuredData?.id || '-'} ${structuredDataStr} ${message}\n`;
            // Write to file if enabled
            if (this.config.logToFile && this.fileStream) {
                this.fileStream.write(syslogMessage);
            }
            // Write to console if enabled
            if (this.config.logToConsole) {
                const consoleMessage = `${timestamp.toISOString()} [${LogLevelNames[level]}] ${message}`;
                if (level <= LogLevel.ERROR) {
                    console.error(consoleMessage);
                }
                else if (level === LogLevel.WARNING) {
                    console.warn(consoleMessage);
                }
                else {
                    console.log(consoleMessage);
                }
            }
        }
        catch (error) {
            console.error('Failed to log message:', error);
            // Ensure we at least have console output if database fails
            console.error(`LOGGING_FAILURE: ${message}`, error);
        }
    }
    // Auth specific logging methods
    async logAuthEvent(level, message, userId, username, metadata) {
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
        }
        catch (error) {
            console.error('Failed to log auth event:', error);
            // Ensure we at least have console output if database fails
            console.error(`AUTH_EVENT: ${message}`, { userId, username, metadata });
        }
    }
    // Security specific logging methods
    async logSecurityEvent(level, message, metadata) {
        await this.log(LogFacility.SECURITY, level, message, {
            id: 'SECURITY',
            parameters: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
    }
    // Audit specific logging methods
    async logAuditEvent(level, message, metadata) {
        await this.log(LogFacility.AUDIT, level, message, {
            id: 'AUDIT',
            parameters: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
    }
    // Convenience methods for different log levels
    async emergency(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.EMERGENCY, message, {
            id: 'EMERGENCY',
            parameters: metadata || {}
        });
    }
    async alert(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.ALERT, message, {
            id: 'ALERT',
            parameters: metadata || {}
        });
    }
    async critical(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.CRITICAL, message, {
            id: 'CRITICAL',
            parameters: metadata || {}
        });
    }
    async error(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.ERROR, message, {
            id: 'ERROR',
            parameters: metadata || {}
        });
    }
    async warning(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.WARNING, message, {
            id: 'WARNING',
            parameters: metadata || {}
        });
    }
    async notice(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.NOTICE, message, {
            id: 'NOTICE',
            parameters: metadata || {}
        });
    }
    async info(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.INFO, message, {
            id: 'INFO',
            parameters: metadata || {}
        });
    }
    async debug(message, metadata) {
        await this.log(LogFacility.USER, LogLevel.DEBUG, message, {
            id: 'DEBUG',
            parameters: metadata || {}
        });
    }
    // Clean up resources
    close() {
        if (this.fileStream) {
            this.fileStream.end();
            this.fileStream = null;
        }
    }
}
exports.SysLogger = SysLogger;
// Create and export a singleton instance
exports.syslog = new SysLogger();
