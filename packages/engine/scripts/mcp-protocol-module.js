// src/common/mcp/protocol.js
/**
 * MCP Protocol Module
 * 
 * This module defines the core protocol structure and validation for the MCP system.
 * It includes schemas for requests and responses, validation utilities, and constants.
 */

const Joi = require('joi');

/**
 * Protocol version for this implementation
 */
const PROTOCOL_VERSION = '1.0';

/**
 * Validation Status Enum
 * Defines possible validation result status values
 */
const ValidationStatus = {
  PASS: 'PASS',        // All validation checks passed
  FAIL: 'FAIL',        // Critical validation checks failed
  PARTIAL: 'PARTIAL'   // Some non-critical validation checks failed
};

/**
 * Severity Level Enum
 * Defines severity levels for validation findings
 */
const SeverityLevel = {
  ERROR: 'ERROR',      // Critical issue that causes validation failure
  WARNING: 'WARNING',  // Potential issue that should be addressed
  INFO: 'INFO'         // Informational finding
};

/**
 * Change Type Enum
 * Defines types of changes in regulation versioning
 */
const ChangeType = {
  ADDITION: 'ADDITION',          // New content added
  MODIFICATION: 'MODIFICATION',  // Existing content modified
  REMOVAL: 'REMOVAL'             // Existing content removed
};

/**
 * MCP Request Schema
 * Defines the structure for validation requests
 */
const requestSchema = Joi.object({
  // Core request metadata
  requestId: Joi.string().required().description('Unique identifier for the request'),
  timestamp: Joi.date().iso().required().description('Request creation time in ISO8601 format'),
  
  // Protocol information
  protocol: Joi.object({
    version: Joi.string().required().description('MCP protocol version'),
    level: Joi.number().integer().min(1).max(4).required().description('Validation intensity level (1-4)')
  }).required(),
  
  // Client information
  client: Joi.object({
    id: Joi.string().required().description('Client identifier'),
    version: Joi.string().required().description('Client version')
  }).required(),
  
  // Regulation information
  regulation: Joi.object({
    id: Joi.string().required().description('Identifier for the regulation'),
    version: Joi.string().optional().description('Version of the regulation in frontend')
  }).required(),
  
  // Data to validate
  data: Joi.object().required().description('Regulation-specific data payload'),
  
  // Optional flags
  options: Joi.object({
    attestation: Joi.boolean().default(false).description('Generate attestation certificate'),
    diff: Joi.boolean().default(false).description('Include diff if regulation has changed'),
    explanation: Joi.boolean().default(false).description('Include explanation of validation results')
  }).default()
});

/**
 * MCP Response Schema
 * Defines the structure for validation responses
 */
const responseSchema = Joi.object({
  // Core response metadata
  responseId: Joi.string().required().description('Unique identifier for the response'),
  requestId: Joi.string().required().description('Request identifier (from request)'),
  timestamp: Joi.date().iso().required().description('Response creation time in ISO8601 format'),
  
  // Protocol information
  protocol: Joi.object({
    version: Joi.string().required().description('MCP protocol version'),
    level: Joi.number().integer().min(1).max(4).required().description('Validation level used')
  }).required(),
  
  // Regulation information
  regulation: Joi.object({
    id: Joi.string().required().description('Identifier for the regulation'),
    version: Joi.string().required().description('Current authoritative version'),
    hasUpdate: Joi.boolean().required().description('Indicates if frontend version is outdated')
  }).required(),
  
  // Validation results
  validation: Joi.object({
    status: Joi.string().valid(...Object.values(ValidationStatus)).required()
      .description('Overall validation result (PASS, FAIL, PARTIAL)'),
    confidence: Joi.number().min(0).max(1).required().description('Confidence score (0.0-1.0)'),
    findings: Joi.array().items(Joi.object({
      id: Joi.string().required().description('Unique identifier for the finding'),
      path: Joi.string().required().description('JSON path to the relevant data'),
      severity: Joi.string().valid(...Object.values(SeverityLevel)).required()
        .description('Severity level (ERROR, WARNING, INFO)'),
      message: Joi.string().required().description('Human-readable description'),
      reference: Joi.string().optional().description('Reference to regulation section')
    })).required()
  }).required(),
  
  // Optional attestation certificate (if requested and validation passed)
  attestation: Joi.object({
    id: Joi.string().required().description('Unique attestation identifier'),
    timestamp: Joi.date().iso().required().description('Issuance time in ISO8601 format'),
    expiresAt: Joi.date().iso().required().description('Expiration time in ISO8601 format'),
    regulation: Joi.object({
      id: Joi.string().required().description('Regulation identifier'),
      version: Joi.string().required().description('Regulation version'),
      title: Joi.string().required().description('Human-readable regulation title')
    }).required(),
    client: Joi.object({
      id: Joi.string().required().description('Client identifier'),
      name: Joi.string().required().description('Human-readable client name')
    }).required(),
    level: Joi.number().integer().min(1).max(4).required().description('Validation level (1-4)'),
    confidence: Joi.number().min(0).max(1).required().description('Confidence score (0.0-1.0)'),
    signature: Joi.string().required().description('Cryptographic signature of attestation'),
    verificationUrl: Joi.string().uri().required().description('URL to verify attestation')
  }).optional(),
  
  // Optional diff information (if requested and regulation has changed)
  diff: Joi.object({
    fromVersion: Joi.string().required().description('Original regulation version'),
    toVersion: Joi.string().required().description('New regulation version'),
    changes: Joi.array().items(Joi.object({
      type: Joi.string().valid(...Object.values(ChangeType)).required().description('Type of change'),
      path: Joi.string().required().description('Path to the changed element'),
      oldValue: Joi.string().allow(null).description('Previous value (if applicable)'),
      newValue: Joi.string().allow(null).description('New value (if applicable)'),
      description: Joi.string().required().description('Human-readable description')
    })).required(),
    summary: Joi.string().required().description('Human-readable summary of changes'),
    effectiveDate: Joi.date().iso().optional().description('When changes take effect')
  }).optional(),
  
  // Optional explanation (if requested)
  explanation: Joi.object({
    summary: Joi.string().required().description('Overall explanation summary'),
    details: Joi.array().items(Joi.object({
      finding: Joi.string().required().description('Finding ID reference'),
      explanation: Joi.string().required().description('Detailed explanation of issue'),
      recommendation: Joi.string().required().description('Suggested remediation')
    })).required(),
    resources: Joi.array().items(Joi.object({
      title: Joi.string().required().description('Resource title'),
      url: Joi.string().uri().required().description('Resource URL'),
      description: Joi.string().optional().description('Resource description')
    })).optional()
  }).optional(),
  
  // Metadata about processing
  meta: Joi.object({
    processingTime: Joi.number().integer().required().description('Processing time in milliseconds'),
    validatorId: Joi.string().required().description('Identifier of the validator')
  }).required()
});

/**
 * Error Response Schema
 * Defines the structure for error responses
 */
const errorSchema = Joi.object({
  error: Joi.object({
    code: Joi.string().required().description('Error code'),
    message: Joi.string().required().description('Human-readable error message'),
    details: Joi.array().items(Joi.object({
      field: Joi.string().required().description('Field with issue'),
      issue: Joi.string().required().description('Description of the issue')
    })).optional(),
    requestId: Joi.string().required().description('Original request ID')
  }).required()
});

/**
 * Common Error Codes
 */
const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  REGULATION_NOT_FOUND: 'REGULATION_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Validation Levels
 */
const ValidationLevels = {
  LEVEL_1: 1, // Basic static text validation
  LEVEL_2: 2, // Standard pattern matching and context-aware validation
  LEVEL_3: 3, // Enhanced validation with cross-reference checking
  LEVEL_4: 4  // Comprehensive human-assisted validation
};

/**
 * Validates an MCP request
 * 
 * @param {Object} request - The request object to validate
 * @returns {Object} Validation result with error or value
 */
function validateRequest(request) {
  return requestSchema.validate(request, { abortEarly: false });
}

/**
 * Validates an MCP response
 * 
 * @param {Object} response - The response object to validate
 * @returns {Object} Validation result with error or value
 */
function validateResponse(response) {
  return responseSchema.validate(response, { abortEarly: false });
}

/**
 * Creates a standard error response
 * 
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Human-readable error message
 * @param {string} requestId - Original request ID
 * @param {Array} details - Optional array of field-specific errors
 * @returns {Object} Formatted error response
 */
function createErrorResponse(code, message, requestId, details = null) {
  const error = {
    code,
    message,
    requestId: requestId || 'unknown'
  };
  
  if (details) {
    error.details = details;
  }
  
  return { error };
}

/**
 * Calculates confidence score based on validation findings
 * 
 * @param {Array} findings - Array of validation findings
 * @param {number} totalRules - Total number of validation rules applied
 * @returns {number} Confidence score between 0 and 1
 */
function calculateConfidence(findings, totalRules) {
  if (!findings || findings.length === 0) return 1.0;
  if (!totalRules || totalRules <= 0) return 0.0;
  
  // Weight factors for different severity levels
  const errorWeight = 0.6;
  const warningWeight = 0.3;
  const infoWeight = 0.1;
  
  // Count findings by severity
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  
  findings.forEach(finding => {
    if (finding.severity === SeverityLevel.ERROR) errorCount++;
    else if (finding.severity === SeverityLevel.WARNING) warningCount++;
    else if (finding.severity === SeverityLevel.INFO) infoCount++;
  });
  
  // Calculate weighted sum of issues
  const weightedIssues = (errorCount * errorWeight) + 
                         (warningCount * warningWeight) + 
                         (infoCount * infoWeight);
  
  // Calculate confidence score (higher is better)
  return Math.max(0, Math.min(1, 1 - (weightedIssues / totalRules)));
}

/**
 * Generates a UUID v4 for use in request/response IDs
 * 
 * @returns {string} UUID v4 string
 */
function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Creates an MCP response structure
 * 
 * @param {Object} request - Original request object
 * @param {Object} validationResult - Validation results
 * @param {Object} regulation - Regulation information
 * @param {Object} options - Additional options
 * @returns {Object} Formatted MCP response
 */
function createResponse(request, validationResult, regulation, options = {}) {
  const now = new Date();
  
  const response = {
    responseId: options.responseId || generateUuid(),
    requestId: request.requestId,
    timestamp: now.toISOString(),
    protocol: {
      version: PROTOCOL_VERSION,
      level: request.protocol.level
    },
    regulation: {
      id: regulation.id,
      version: regulation.version,
      hasUpdate: regulation.hasUpdate || false
    },
    validation: {
      status: validationResult.status,
      confidence: validationResult.confidence,
      findings: validationResult.findings || []
    },
    meta: {
      processingTime: options.processingTime || 0,
      validatorId: options.validatorId || 'unknown'
    }
  };
  
  // Add attestation if requested and validation passed
  if (request.options && request.options.attestation && 
      validationResult.status === ValidationStatus.PASS) {
    
    response.attestation = {
      id: `att-${generateUuid()}`,
      timestamp: now.toISOString(),
      expiresAt: new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)).toISOString(), // 90 days
      regulation: {
        id: regulation.id,
        version: regulation.version,
        title: regulation.title || `${regulation.id} Compliance`
      },
      client: {
        id: request.client.id,
        name: options.clientName || request.client.id
      },
      level: request.protocol.level,
      confidence: validationResult.confidence,
      signature: options.signature || 'PLACEHOLDER_SIGNATURE',
      verificationUrl: `https://api.compliance-tracker.edu/verify/${response.attestation.id}`
    };
  }
  
  // Add diff if requested and regulation has changed
  if (request.options && request.options.diff && 
      regulation.hasUpdate && options.diff) {
    response.diff = options.diff;
  }
  
  // Add explanation if requested
  if (request.options && request.options.explanation && options.explanation) {
    response.explanation = options.explanation;
  }
  
  return response;
}

module.exports = {
  // Constants
  PROTOCOL_VERSION,
  ValidationStatus,
  SeverityLevel,
  ChangeType,
  ErrorCodes,
  ValidationLevels,
  
  // Schemas
  requestSchema,
  responseSchema,
  errorSchema,
  
  // Functions
  validateRequest,
  validateResponse,
  createErrorResponse,
  calculateConfidence,
  generateUuid,
  createResponse
};

  