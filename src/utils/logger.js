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

// Log levels in order of verbosity
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Default log level (can be overridden by environment variable)
const DEFAULT_LOG_LEVEL = 'INFO';

/**
 * Create a logger instance for a specific component
 * @param {string} component - Component name for the logger
 * @param {Object} options - Logger options
 * @returns {Object} Logger object with log methods
 */
export function setupLogger(component, options = {}) {
  const logLevel = determineLogLevel(options.level);
  
  // Create and return the logger object
  return {
    error: createLogMethod('ERROR', component, logLevel),
    warn: createLogMethod('WARN', component, logLevel),
    info: createLogMethod('INFO', component, logLevel),
    debug: createLogMethod('DEBUG', component, logLevel),
    trace: createLogMethod('TRACE', component, logLevel),
    
    // Allow dynamically changing the log level
    setLevel: (newLevel) => {
      const parsedLevel = determineLogLevel(newLevel);
      
      // Update all log methods
      Object.keys(LOG_LEVELS).forEach((level) => {
        const methodName = level.toLowerCase();
        logger[methodName] = createLogMethod(level, component, parsedLevel);
      });
    },
    
    // Get current log level
    getLevel: () => {
      return Object.keys(LOG_LEVELS).find(
        key => LOG_LEVELS[key] === logLevel
      );
    }
  };
}

/**
 * Create a log method for a specific level
 * @param {string} level - Log level (ERROR, WARN, etc.)
 * @param {string} component - Component name
 * @param {number} configuredLevel - Configured log level threshold
 * @returns {Function} Log method
 */
function createLogMethod(level, component, configuredLevel) {
  const levelValue = LOG_LEVELS[level];
  
  // If the log level is above the configured threshold, return a no-op function
  if (levelValue > configuredLevel) {
    return () => {}; // No-op
  }
  
  // Return a function that formats and outputs the log
  return (message, data = {}) => {
    const timestamp = new Date().toISOString();
    
    // Prepare log entry
    const logEntry = {
      timestamp,
      level,
      component,
      message,
      ...data
    };
    
    // Convert the entry to JSON
    const logString = JSON.stringify(logEntry);
    
    // Output to the appropriate console method
    switch (level) {
      case 'ERROR':
        console.error(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      case 'DEBUG':
      case 'TRACE':
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  };
}

/**
 * Determine the log level based on input
 * @param {string|undefined} level - Log level string or undefined
 * @returns {number} Log level value
 */
function determineLogLevel(level) {
  // First check the parameter
  if (level && LOG_LEVELS[level.toUpperCase()] !== undefined) {
    return LOG_LEVELS[level.toUpperCase()];
  }
  
  // Then check environment variable
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && LOG_LEVELS[envLevel.toUpperCase()] !== undefined) {
    return LOG_LEVELS[envLevel.toUpperCase()];
  }
  
  // Fall back to default
  return LOG_LEVELS[DEFAULT_LOG_LEVEL];
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