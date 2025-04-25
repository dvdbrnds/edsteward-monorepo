const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

/**
 * MCP Protocol Constants and Types
 * This file defines the constants and types used for validation across the system
 */

// Protocol version information
const PROTOCOL_VERSION = '1.0';
const MIN_SUPPORTED_VERSION = '1.0';
const MAX_SUPPORTED_VERSION = '1.2';

/**
 * Validation Status Enum
 * Represents the status of a validation result
 */
const ValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  ERROR: 'ERROR',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL'
};

/**
 * Severity Level Enum
 * Represents the severity of a validation finding
 */
const SeverityLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Validation Level Enum
 * Represents the level of validation
 */
const ValidationLevel = {
  BASIC: 'BASIC',
  STANDARD: 'STANDARD',
  ENHANCED: 'ENHANCED',
  COMPREHENSIVE: 'COMPREHENSIVE'
};

/**
 * Validation Strategy Enum
 * Represents different strategies for orchestrating validation
 */
const ValidationStrategy = {
  ALL: 'ALL',                  // Run all validations
  FAST_FAIL: 'FAST_FAIL',      // Stop on first failure
  THOROUGH: 'THOROUGH',        // Most comprehensive first
  CACHED_FIRST: 'CACHED_FIRST', // Prioritize validators with cached results
  CONFIDENCE_PRIORITIZED: 'CONFIDENCE_PRIORITIZED', // Prioritize based on historic confidence
  PERFORMANCE_OPTIMIZED: 'PERFORMANCE_OPTIMIZED', // Optimize for execution speed
  COST_OPTIMIZED: 'COST_OPTIMIZED', // Optimize for computational cost
  ADAPTIVE: 'ADAPTIVE'         // Adapt strategy based on input characteristics
};

/**
 * Confidence Threshold Constants
 * Default threshold values for different validation levels
 */
const ConfidenceThresholds = {
  BASIC: 0.95,
  STANDARD: 0.85,
  ENHANCED: 0.90,
  COMPREHENSIVE: 0.95
};

/**
 * Default Finding Structure
 * Standard structure for validation findings
 */
const createFinding = ({
  id,
  path,
  severity,
  message,
  reference,
  confidence = 1.0,
  details = {}
}) => ({
  id,
  path,
  severity,
  message,
  reference,
  confidence,
  details,
  timestamp: new Date().toISOString()
});

/**
 * Default Result Structure
 * Standard structure for validation results
 */
const createResult = ({
  status = ValidationStatus.PASS,
  confidence = 1.0,
  findings = []
}) => ({
  status,
  confidence,
  findings,
  timestamp: new Date().toISOString()
});

/**
 * Validation Type Constants
 * Different types of validation that can be performed
 */
const ValidationType = {
  TEXT_MATCH: 'TEXT_MATCH',
  SEMANTIC: 'SEMANTIC',
  STRUCTURAL: 'STRUCTURAL',
  RELATIONSHIP: 'RELATIONSHIP',
  TEMPORAL: 'TEMPORAL',
  CROSS_REFERENCE: 'CROSS_REFERENCE'
};

// Request schema definition
const requestSchema = Joi.object({
  requestId: Joi.string().uuid().required(),
  timestamp: Joi.date().iso().required(),
  protocol: Joi.object({
    version: Joi.string().required(),
    level: Joi.number().valid(...Object.values(ValidationLevel)).required()
  }).required(),
  client: Joi.object({
    id: Joi.string().required(),
    version: Joi.string().required()
  }).required(),
  regulation: Joi.object({
    id: Joi.string().required(),
    version: Joi.string()
  }).required(),
  data: Joi.object().required(),
  options: Joi.object({
    attestation: Joi.boolean().default(false),
    diff: Joi.boolean().default(false),
    explanation: Joi.boolean().default(false)
  }).default({})
});

// Finding schema definition
const findingSchema = Joi.object({
  id: Joi.string().required(),
  path: Joi.string().required(),
  severity: Joi.string().valid(...Object.values(SeverityLevel)).required(),
  message: Joi.string().required(),
  reference: Joi.string()
});

// Response schema definition
const responseSchema = Joi.object({
  responseId: Joi.string().uuid().required(),
  requestId: Joi.string().uuid().required(),
  timestamp: Joi.date().iso().required(),
  protocol: Joi.object({
    version: Joi.string().required(),
    level: Joi.number().valid(...Object.values(ValidationLevel)).required()
  }).required(),
  regulation: Joi.object({
    id: Joi.string().required(),
    version: Joi.string().required(),
    hasUpdate: Joi.boolean().required()
  }).required(),
  validation: Joi.object({
    status: Joi.string().valid(...Object.values(ValidationStatus)).required(),
    confidence: Joi.number().min(0).max(1).required(),
    findings: Joi.array().items(findingSchema).required()
  }).required(),
  attestation: Joi.object().optional(),
  diff: Joi.object().optional(),
  explanation: Joi.object().optional(),
  meta: Joi.object({
    processingTime: Joi.number().required(),
    validatorId: Joi.string().required()
  }).required()
});

/**
 * MCP Protocol API
 * Utility functions for creating standardized requests and responses
 */
const MCPProtocol = {
  createRequest: (params) => {
    const {
      clientId,
      clientVersion,
      regulationId,
      regulationVersion,
      validationLevel,
      data,
      options = {}
    } = params;

    // Validate required parameters
    if (!clientId || !clientVersion) {
      throw new Error('Client identification is required');
    }

    if (!regulationId || !regulationVersion) {
      throw new Error('Regulation identification is required');
    }

    if (!validationLevel) {
      throw new Error('Validation level is required');
    }

    if (!data) {
      throw new Error('Data for validation is required');
    }

    // Generate request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      requestId,
      client: {
        id: clientId,
        version: clientVersion
      },
      protocol: {
        version: PROTOCOL_VERSION,
        level: validationLevel
      },
      regulation: {
        id: regulationId,
        version: regulationVersion
      },
      data,
      options
    };
  },

  createResponse: (params) => {
    const {
      requestId,
      validationLevel,
      regulationId,
      regulationVersion,
      hasUpdate,
      status,
      confidence,
      findings,
      processingTime,
      validatorId
    } = params;

    return {
      responseId: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requestId,
      timestamp: new Date().toISOString(),
      protocol: {
        version: PROTOCOL_VERSION,
        level: validationLevel
      },
      regulation: {
        id: regulationId,
        version: regulationVersion,
        hasUpdate
      },
      validation: {
        status,
        confidence,
        findings: findings || []
      },
      meta: {
        processingTime,
        validatorId
      }
    };
  },

  createErrorResponse: (code, message, details, requestId) => {
    return {
      responseId: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString(),
      protocol: {
        version: PROTOCOL_VERSION
      },
      error: {
        code,
        message,
        details
      }
    };
  }
};

// Export constants and main class
module.exports = {
  MCPProtocol,
  ValidationLevel,
  ValidationStatus,
  SeverityLevel,
  PROTOCOL_VERSION,
  MIN_SUPPORTED_VERSION,
  MAX_SUPPORTED_VERSION,
  ValidationStrategy,
  ConfidenceThresholds,
  ValidationType,
  createFinding,
  createResult
}; 