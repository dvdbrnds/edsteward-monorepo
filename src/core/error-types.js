/**
 * Standardized Error Types
 * Custom error classes for consistent error handling
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND_ERROR', details);
  }
}

/**
 * Database connection error
 */
export class DatabaseError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service, message, details = null) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service,
      ...details
    });
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details = null) {
    super(message, 429, 'RATE_LIMIT_ERROR', details);
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'CONFIGURATION_ERROR', details);
  }
}

/**
 * Compliance processing error
 */
export class ComplianceError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'COMPLIANCE_ERROR', details);
  }
}

/**
 * MCP protocol error
 */
export class MCPError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'MCP_ERROR', details);
  }
}

/**
 * Queue processing error
 */
export class QueueError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'QUEUE_ERROR', details);
  }
}

/**
 * CDC (Change Data Capture) error
 */
export class CDCError extends AppError {
  constructor(message, details = null) {
    super(message, 500, 'CDC_ERROR', details);
  }
}

/**
 * Error helper functions
 */

/**
 * Check if error is an AppError instance
 */
export function isAppError(error) {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error) {
  if (isAppError(error)) {
    return error;
  }
  
  // Handle common Node.js errors
  if (error.code === 'ECONNREFUSED') {
    return new ExternalServiceError('Database', 'Connection refused', {
      originalError: error.message
    });
  }
  
  if (error.code === 'ENOTFOUND') {
    return new ExternalServiceError('Network', 'Host not found', {
      originalError: error.message
    });
  }
  
  // Handle validation errors from libraries
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, {
      originalError: error.message
    });
  }
  
  // Default to generic app error
  return new AppError(error.message || 'Unknown error', 500, 'UNKNOWN_ERROR', {
    originalError: error.message,
    stack: error.stack
  });
}

/**
 * Create error response object
 */
export function createErrorResponse(error) {
  const appError = toAppError(error);
  
  return {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
      timestamp: appError.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: appError.details,
        stack: appError.stack
      })
    }
  };
}

/**
 * Error logging helper
 */
export function logError(logger, error, context = {}) {
  const appError = toAppError(error);
  
  logger.error('Application error', {
    ...appError.toJSON(),
    context
  });
} 