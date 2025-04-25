/**
 * MCP Validation Protocol
 * 
 * This module defines common validation types, evidence formats, and certainty
 * levels for the MCP validation protocol used across regulation servers.
 */

// Mock implementations of MCP SDK components
// In a real implementation, we would import from the SDK:
// import { Server } from '@modelcontextprotocol/sdk/server';
// import { ErrorCode } from '@modelcontextprotocol/sdk/protocol';

// Mock error codes based on MCP spec
const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
};

// Certainty levels for validation results
export const CERTAINTY_LEVELS = {
  A: 'HIGH',       // High certainty (e.g., based on exact text match or clear pattern)
  B: 'MEDIUM',     // Medium certainty (e.g., based on semantic understanding)
  C: 'LOW',        // Low certainty (e.g., based on inference or incomplete data)
  D: 'UNCERTAIN'   // Uncertain (e.g., insufficient data to make a determination)
};

// Types of evidence that can be provided in validation results
export const EVIDENCE_TYPES = {
  TEXT_MATCH: 'text_match',               // Direct text match
  PATTERN_MATCH: 'pattern_match',         // Pattern-based match (e.g., regex)
  SEMANTIC_MATCH: 'semantic_match',       // Semantic understanding
  LOGICAL_INFERENCE: 'logical_inference',  // Logical inference
  EXTERNAL_REFERENCE: 'external_reference' // Reference to external source
};

// Validation result status
export const VALIDATION_STATUS = {
  COMPLIANT: 'compliant',
  NON_COMPLIANT: 'non_compliant',
  NEEDS_REVIEW: 'needs_review',
  INSUFFICIENT_DATA: 'insufficient_data',
  ERROR: 'error'
};

// Custom error codes (must be above -32000 per MCP spec)
export const ValidationErrorCode = {
  VALIDATION_FAILED: 1000,
  INVALID_REGULATION: 1001,
  INSUFFICIENT_DATA: 1002,
  UNSUPPORTED_VALIDATION_TYPE: 1003,
  VALIDATION_TIMEOUT: 1004,
  EVIDENCE_COLLECTION_FAILED: 1005
};

// Schema definitions for requests
export const InitializeRequestSchema = {
  type: 'object',
  required: ['client_info'],
  properties: {
    client_info: {
      type: 'object',
      required: ['name', 'version'],
      properties: {
        name: { type: 'string' },
        version: { type: 'string' }
      }
    },
    capabilities: {
      type: 'object'
    }
  }
};

export const ValidateRequestSchema = {
  type: 'object',
  required: ['regulation_id', 'content'],
  properties: {
    regulation_id: { type: 'string' },
    content: { type: 'object' },
    validation_type: { type: 'string' },
    context: { type: 'object' },
    timeout_ms: { type: 'number' }
  }
};

export const ValidateBatchRequestSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['regulation_id', 'content'],
        properties: {
          regulation_id: { type: 'string' },
          content: { type: 'object' },
          validation_type: { type: 'string' },
          context: { type: 'object' }
        }
      }
    },
    parallel: { type: 'boolean' },
    timeout_ms: { type: 'number' }
  }
};

export const QueryCapabilitiesRequestSchema = {
  type: 'object',
  properties: {}
};

export const QueryValidationStatusRequestSchema = {
  type: 'object',
  required: ['validation_id'],
  properties: {
    validation_id: { type: 'string' }
  }
};

export const CancelValidationRequestSchema = {
  type: 'object',
  required: ['validation_id'],
  properties: {
    validation_id: { type: 'string' }
  }
};

/**
 * Create a validation evidence object
 * 
 * @param {Object} options - Evidence options
 * @param {string} options.type - Type of evidence (from EVIDENCE_TYPES)
 * @param {string} options.content - Text content of the evidence
 * @param {Object} [options.details] - Additional details about the evidence
 * @param {string} [options.certainty=CERTAINTY_LEVELS.D] - Certainty level of the evidence
 * @returns {Object} Evidence object
 */
export function createEvidence(options) {
  const { type, content, details = {}, certainty = CERTAINTY_LEVELS.D } = options;
  
  return {
    type,
    content,
    details,
    certainty,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a validation result object
 * 
 * @param {Object} options - Validation result options
 * @param {string} options.regulationId - ID of the regulation
 * @param {boolean} options.compliant - Whether the content is compliant
 * @param {string} [options.certainty=CERTAINTY_LEVELS.D] - Overall certainty level
 * @param {Array} [options.evidence=[]] - Evidence supporting the result
 * @param {Object} [options.details={}] - Additional details about the result
 * @returns {Object} Validation result object
 */
export function createValidationResult(options) {
  const { 
    regulationId, 
    compliant, 
    certainty = CERTAINTY_LEVELS.D, 
    evidence = [],
    details = {} 
  } = options;
  
  return {
    regulationId,
    status: compliant ? VALIDATION_STATUS.COMPLIANT : VALIDATION_STATUS.NON_COMPLIANT,
    compliant,
    certainty,
    evidence,
    details,
    timestamp: new Date().toISOString(),
    id: generateResultId(regulationId)
  };
}

/**
 * Generate a unique ID for a validation result
 * 
 * @param {string} regulationId - ID of the regulation
 * @returns {string} Unique ID for the validation result
 */
function generateResultId(regulationId) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `val-${regulationId}-${timestamp}-${random}`;
}

/**
 * Create a change detection result
 * 
 * @param {Object} options - Change detection options
 * @param {string} options.regulationId - ID of the regulation
 * @param {boolean} options.hasChanged - Whether the regulation has changed
 * @param {Date} options.lastChecked - When the regulation was last checked
 * @param {Array} [options.changes=[]] - List of specific changes
 * @returns {Object} Change detection result
 */
export function createChangeResult(options) {
  const { 
    regulationId, 
    hasChanged, 
    lastChecked,
    changes = [] 
  } = options;
  
  return {
    regulationId,
    hasChanged,
    lastChecked: lastChecked.toISOString(),
    currentCheckTime: new Date().toISOString(),
    changes,
    priority: determinePriority(hasChanged, changes),
    id: `change-${regulationId}-${Date.now()}`
  };
}

/**
 * Determine priority based on changes
 * 
 * @param {boolean} hasChanged - Whether regulation has changed
 * @param {Array} changes - List of specific changes
 * @returns {string} Priority level (high, medium, low)
 */
function determinePriority(hasChanged, changes) {
  if (!hasChanged) return 'low';
  
  // If any changes are marked as critical, priority is high
  if (changes.some(change => change.impact === 'critical')) {
    return 'high';
  }
  
  // If there are multiple changes, priority is high
  if (changes.length > 2) {
    return 'high';
  }
  
  return 'medium';
}

/**
 * MCP Validation Server class - Using mock methods for testing purposes
 * Creates a Model Context Protocol server for validation services
 */
export class ValidationServer {
  /**
   * Create a new MCP Validation Server
   * 
   * @param {Object} options - Server options
   */
  constructor(options = {}) {
    this.name = options.name || "mcp-validation-server";
    this.version = options.version || "1.0.0";
    this.supportedRegulations = options.supportedRegulations || [];
    this.validationHandlers = new Map();
    
    // We're using a mock implementation since we can't start the server without transport
    console.log(`Created ValidationServer ${this.name} v${this.version}`);
  }
  
  /**
   * Register a validation handler for a specific regulation
   * 
   * @param {string} regulationId - The regulation ID
   * @param {Function} handler - The validation handler function
   */
  registerValidationHandler(regulationId, handler) {
    if (typeof handler !== 'function') {
      throw new Error("Handler must be a function");
    }
    
    this.validationHandlers.set(regulationId, handler);
    
    // Add to supported regulations if not already present
    if (!this.supportedRegulations.includes(regulationId)) {
      this.supportedRegulations.push(regulationId);
    }
    
    console.log(`Registered handler for regulation: ${regulationId}`);
  }
  
  /**
   * Process a validation request directly (for testing purposes)
   * 
   * @param {string} regulationId - The regulation ID
   * @param {Object} content - Content to validate
   * @param {string} validationType - Validation type
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Validation result 
   */
  async processValidation(regulationId, content, validationType = 'standard', context = {}) {
    if (!this.supportedRegulations.includes(regulationId)) {
      throw {
        code: ValidationErrorCode.INVALID_REGULATION,
        message: `Regulation ${regulationId} is not supported by this server`
      };
    }
    
    const handler = this.validationHandlers.get(regulationId);
    if (!handler) {
      throw {
        code: ErrorCode.MethodNotFound,
        message: `No handler defined for regulation ${regulationId}`
      };
    }
    
    try {
      const result = await handler(content, validationType, context);
      return {
        validation_id: generateRequestId(),
        result
      };
    } catch (error) {
      throw {
        code: ValidationErrorCode.VALIDATION_FAILED,
        message: error.message || "Validation failed",
        data: error.data
      };
    }
  }
}

/**
 * MCP Validation Client class - Using mock methods for testing purposes
 * Creates a Model Context Protocol client for validation services
 */
export class ValidationClient {
  /**
   * Create a new MCP Validation Client
   * 
   * @param {Object} options - Client options
   */
  constructor(options = {}) {
    this.client = {
      name: options.name || "mcp-validation-client",
      version: options.version || "1.0.0"
    };
    
    this.initialized = false;
    console.log(`Created ValidationClient ${this.client.name} v${this.client.version}`);
  }
  
  /**
   * Connect to a validation server (mock implementation for testing)
   */
  async connect() {
    console.log(`Client ${this.client.name} connecting...`);
    this.initialized = true;
    console.log(`Client ${this.client.name} connected successfully`);
  }
  
  /**
   * Validate content against a regulation (mock implementation for testing)
   * 
   * @param {string} regulationId - The regulation ID
   * @param {Object} content - The content to validate
   * @param {string} validationType - The validation type
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Validation result
   */
  async validate(regulationId, content, validationType = 'standard', context = {}) {
    if (!this.initialized) {
      throw new Error("Client not initialized. Call connect() first.");
    }
    
    // This is a mock implementation for testing
    console.log(`Validating ${regulationId} with type ${validationType}`);
    
    // Mock validation logic
    const isValid = regulationId !== 'invalid-regulation';
    
    const evidence = createEvidence({
      type: EVIDENCE_TYPES.TEXT_MATCH,
      content: isValid ? 'Mock validation passed' : 'Mock validation failed',
      details: { context_size: Object.keys(context).length },
      certainty: isValid ? CERTAINTY_LEVELS.B : CERTAINTY_LEVELS.D
    });
    
    return {
      validation_id: generateRequestId(),
      result: createValidationResult({
        regulationId,
        compliant: isValid,
        certainty: isValid ? CERTAINTY_LEVELS.B : CERTAINTY_LEVELS.D,
        evidence: [evidence],
        details: {
          description: isValid ? 'Validation successful' : 'Validation failed'
        }
      })
    };
  }
  
  /**
   * Query server capabilities (mock implementation for testing)
   * 
   * @returns {Promise<Object>} Server capabilities
   */
  async queryCapabilities() {
    if (!this.initialized) {
      throw new Error("Client not initialized. Call connect() first.");
    }
    
    return {
      supported_regulations: ['REG001', 'REG002', 'REG003', 'GDPR', 'HIPAA'],
      max_batch_size: 10,
      supports_async: true,
      validation_types: ["standard", "comprehensive", "quick"]
    };
  }
  
  /**
   * Disconnect from the server (mock implementation for testing)
   */
  async disconnect() {
    this.initialized = false;
    console.log(`Client ${this.client.name} disconnected`);
  }
}

/**
 * Generate a unique request ID
 * 
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `req-${timestamp}-${random}`;
}

export default {
  CERTAINTY_LEVELS,
  EVIDENCE_TYPES,
  ValidationErrorCode,
  ValidationServer,
  ValidationClient,
  createEvidence,
  createValidationResult,
  generateRequestId
}; 