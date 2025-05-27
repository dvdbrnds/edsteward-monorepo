import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Logger Utility
 * 
 * Provides consistent logging capabilities throughout the application.
 * Supports different log levels and structured logging.
 */

/**
 * Logger utility for consistent logging across the application
 */

/**
 * Create a logger instance for a specific module
 * @param {string} module The module name for the logger
 * @returns {Object} Logger instance
 */
export function setupLogger(module) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  // Log levels mapping
  const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  // Only log if the level is less than or equal to the configured level
  const shouldLog = (level) => logLevels[level] <= logLevels[logLevel];
  
  // Format log messages
  const formatLog = (level, message, data) => {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} [${module}] ${message}${logData}`;
  };
  
  return {
    /**
     * Log an error message
     * @param {string} message The log message
     * @param {Object} data Optional data to include in the log
     */
    error: (message, data) => {
      if (shouldLog('error')) {
        console.error(formatLog('error', message, data));
      }
    },
    
    /**
     * Log a warning message
     * @param {string} message The log message
     * @param {Object} data Optional data to include in the log
     */
    warn: (message, data) => {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', message, data));
      }
    },
    
    /**
     * Log an info message
     * @param {string} message The log message
     * @param {Object} data Optional data to include in the log
     */
    info: (message, data) => {
      if (shouldLog('info')) {
        console.info(formatLog('info', message, data));
      }
    },
    
    /**
     * Log a debug message
     * @param {string} message The log message
     * @param {Object} data Optional data to include in the log
     */
    debug: (message, data) => {
      if (shouldLog('debug')) {
        console.debug(formatLog('debug', message, data));
      }
    }
  };
}

/**
 * Format error objects for logging
 * @param {Error} error - Error object
 * @returns {Object} Formatted error for logging
 */
export function formatError(error) {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    ...(error.code && { code: error.code }),
    ...(error.statusCode && { statusCode: error.statusCode }),
    ...(error.details && { details: error.details }),
  };
}

/**
 * Get a child logger that inherits from a parent logger but with additional context
 * @param {Object} parentLogger - Parent logger instance
 * @param {string} subComponent - Sub-component name
 * @param {Object} baseContext - Base context to include with all logs
 * @returns {Object} Child logger instance
 */
export function getChildLogger(parentLogger, subComponent, baseContext = {}) {
  // Get parent's level
  const parentLevel = parentLogger.getLevel();
  
  // Create a new logger with the same level
  const childLogger = setupLogger(`${parentLogger.component}:${subComponent}`, {
    level: parentLevel
  });
  
  // Wrap each method to include the base context
  Object.keys(LOG_LEVELS).forEach((level) => {
    const methodName = level.toLowerCase();
    const originalMethod = childLogger[methodName];
    
    childLogger[methodName] = (message, data = {}) => {
      originalMethod(message, { ...baseContext, ...data });
    };
  });
  
  return childLogger;
}

/**
 * Create a redacted copy of an object for safe logging
 * @param {Object} obj - Object to redact
 * @param {Array<string>} keysToRedact - Keys to redact
 * @returns {Object} Redacted copy
 */
export function redactSensitiveInfo(obj, keysToRedact = ['password', 'token', 'key', 'secret', 'credential']) {
  // Handle null or undefined
  if (obj == null) {
    return obj;
  }
  
  // Handle primitive values
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveInfo(item, keysToRedact));
  }
  
  // Handle objects
  return Object.entries(obj).reduce((result, [key, value]) => {
    // Check if this key should be redacted
    const shouldRedact = keysToRedact.some(redactKey => 
      key.toLowerCase().includes(redactKey.toLowerCase())
    );
    
    // If should redact, use '[REDACTED]', otherwise recursively redact the value
    result[key] = shouldRedact ? '[REDACTED]' : redactSensitiveInfo(value, keysToRedact);
    
    return result;
  }, {});
}

// Create default logger
export const logger = setupLogger('app'); 