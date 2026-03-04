/**
 * Base Regulation MCP Server
 * 
 * This file implements a base MCP server class that can be extended for specific regulations.
 * Each regulation will have its own MCP server implementation that passes the MCP Inspector.
 */

import { 
  CERTAINTY_LEVELS,
  EVIDENCE_TYPES,
  createEvidence,
  createValidationResult
} from '../protocol/mcp-validation-protocol.js';

/**
 * BaseRegulationServer class that implements the MCP server interface
 * for regulation-specific validation servers
 */
export class BaseRegulationServer {
  /**
   * Create a new regulation-specific MCP server
   * 
   * @param {Object} options - Server configuration options
   * @param {string} options.regulationId - The regulation identifier (e.g., "GDPR", "HIPAA")
   * @param {string} options.name - Server name
   * @param {string} options.version - Server version
   * @param {string} options.description - Server description
   * @param {Array<Object>} options.validationRules - Initial validation rules to register
   */
  constructor(options = {}) {
    this.regulationId = options.regulationId || "UNKNOWN";
    this.name = options.name || `${this.regulationId}-validation-server`;
    this.version = options.version || "1.0.0";
    this.description = options.description || `MCP Server for ${this.regulationId} validation`;
    
    // Server capabilities and metadata
    this.capabilities = {
      supported_regulations: [this.regulationId],
      validation_types: ["standard", "comprehensive", "quick"],
      max_batch_size: 10,
      supports_async: true,
      certainty_levels: Object.values(CERTAINTY_LEVELS),
      evidence_types: Object.values(EVIDENCE_TYPES)
    };
    
    // Validation rules registry
    this.validationRules = new Map();
    
    // Register initial validation rules if provided
    if (Array.isArray(options.validationRules)) {
      options.validationRules.forEach(rule => {
        this.registerValidationRule(rule.id, rule);
      });
    }
    
    // Active validation sessions
    this.sessions = new Map();
    
    console.log(`Created ${this.name} (${this.regulationId}) v${this.version}`);
  }
  
  /**
   * Register a validation rule
   * 
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Rule definition
   */
  registerValidationRule(ruleId, rule) {
    this.validationRules.set(ruleId, {
      id: ruleId,
      name: rule.name || ruleId,
      description: rule.description || "",
      validate: rule.validate || (async () => ({ compliant: false, certainty: CERTAINTY_LEVELS.D })),
      importance: rule.importance || "MEDIUM",
      type: rule.type || "TEXT_MATCH",
      createdAt: new Date().toISOString()
    });
    
    console.log(`Registered rule: ${ruleId} for ${this.regulationId}`);
  }
  
  /**
   * Start the MCP server
   * 
   * @param {Object} options - Server startup options
   * @returns {Promise<Object>} - Server metadata
   */
  async start(options = {}) {
    // Normally this would configure and start transport handlers
    // For now we'll just return server metadata
    console.log(`Starting ${this.name} server (${this.regulationId})...`);
    
    return {
      status: "running",
      serverName: this.name,
      regulationId: this.regulationId,
      version: this.version,
      startTime: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }
  
  /**
   * Stop the MCP server
   * 
   * @returns {Promise<Object>} - Server shutdown metadata
   */
  async stop() {
    // Normally this would close all connections and cleanup resources
    console.log(`Stopping ${this.name} server...`);
    
    return {
      status: "stopped",
      serverName: this.name,
      stopTime: new Date().toISOString()
    };
  }
  
  /**
   * Process a validation request according to MCP protocol
   * 
   * @param {Object} request - MCP validation request
   * @returns {Promise<Object>} - Validation result
   */
  async processValidation(request) {
    console.log(`Processing validation request for ${this.regulationId}:`, request.id);
    
    const { content, validation_type = "standard", context = {} } = request;
    
    if (!content) {
      return this._createErrorResponse(request.id, "INSUFFICIENT_DATA", "No content provided for validation");
    }
    
    try {
      // Create a new validation session
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      this.sessions.set(sessionId, {
        id: sessionId,
        requestId: request.id,
        state: "validating",
        startTime: new Date().toISOString(),
        validationType: validation_type,
        context
      });
      
      // Collect all validation results from rules
      const evidenceCollection = [];
      let overallCompliance = true;
      let lowestCertainty = CERTAINTY_LEVELS.A;
      
      for (const [ruleId, rule] of this.validationRules.entries()) {
        // Execute rule validation
        const ruleResult = await rule.validate(content, validation_type, context);
        
        // Add rule evidence to collection
        if (ruleResult.evidence) {
          evidenceCollection.push(...ruleResult.evidence);
        } else {
          // Create default evidence if none provided
          evidenceCollection.push(createEvidence({
            type: rule.type === "TEXT_MATCH" ? EVIDENCE_TYPES.TEXT_MATCH : EVIDENCE_TYPES.LOGICAL_INFERENCE,
            content: ruleResult.compliant ? 
              `Rule "${rule.name}" passed validation` : 
              `Rule "${rule.name}" failed validation`,
            details: {
              rule_id: ruleId,
              rule_name: rule.name,
              rule_type: rule.type,
              validation_type
            },
            certainty: ruleResult.certainty || CERTAINTY_LEVELS.D
          }));
        }
        
        // Update overall compliance and certainty
        if (!ruleResult.compliant) {
          overallCompliance = false;
        }
        
        // Update lowest certainty level (A > B > C > D)
        const certaintiesRanked = [CERTAINTY_LEVELS.A, CERTAINTY_LEVELS.B, CERTAINTY_LEVELS.C, CERTAINTY_LEVELS.D];
        const ruleCertaintyRank = certaintiesRanked.indexOf(ruleResult.certainty || CERTAINTY_LEVELS.D);
        const lowestCertaintyRank = certaintiesRanked.indexOf(lowestCertainty);
        
        if (ruleCertaintyRank > lowestCertaintyRank) {
          lowestCertainty = ruleResult.certainty || CERTAINTY_LEVELS.D;
        }
      }
      
      // Create validation result
      const validationResult = createValidationResult({
        regulationId: this.regulationId,
        compliant: overallCompliance,
        certainty: lowestCertainty,
        evidence: evidenceCollection,
        details: {
          description: overallCompliance ?
            `Content is compliant with ${this.regulationId} regulations` :
            `Content is not compliant with ${this.regulationId} regulations`,
          sessionId,
          validationType: validation_type
        }
      });
      
      // Update session with result
      this.sessions.get(sessionId).state = "completed";
      this.sessions.get(sessionId).endTime = new Date().toISOString();
      this.sessions.get(sessionId).result = validationResult;
      
      return {
        id: request.id,
        validation_id: sessionId,
        result: validationResult
      };
    } catch (error) {
      console.error(`Validation error:`, error);
      return this._createErrorResponse(request.id, "VALIDATION_FAILED", error.message || "An error occurred during validation");
    }
  }
  
  /**
   * Handle MCP queries and requests
   * 
   * @param {string} method - MCP method name
   * @param {Object} params - Method parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async handleRequest(method, params, id) {
    switch (method) {
      case "initialize":
        return this._handleInitialize(params, id);
      
      case "validate":
        return this.processValidation({ ...params, id });
      
      case "query_capabilities":
        return this._handleQueryCapabilities(params, id);
      
      case "query_validation_status":
        return this._handleQueryValidationStatus(params, id);
      
      case "cancel_validation":
        return this._handleCancelValidation(params, id);
      
      case "shutdown":
        return this._handleShutdown(params, id);
      
      default:
        return this._createErrorResponse(id, "METHOD_NOT_FOUND", `Method '${method}' not found`);
    }
  }
  
  /**
   * Handle initialize request
   * 
   * @param {Object} params - Initialize parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async _handleInitialize(params, id) {
    console.log(`Initializing connection for request ${id}`);
    
    return {
      id,
      result: {
        server_info: {
          name: this.name,
          version: this.version,
          description: this.description
        },
        capabilities: this.capabilities
      }
    };
  }
  
  /**
   * Handle query_capabilities request
   * 
   * @param {Object} params - Query parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async _handleQueryCapabilities(params, id) {
    return {
      id,
      result: {
        capabilities: this.capabilities
      }
    };
  }
  
  /**
   * Handle query_validation_status request
   * 
   * @param {Object} params - Query parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async _handleQueryValidationStatus(params, id) {
    const { validation_id } = params;
    
    if (!validation_id) {
      return this._createErrorResponse(id, "INVALID_PARAMS", "validation_id is required");
    }
    
    const session = this.sessions.get(validation_id);
    if (!session) {
      return this._createErrorResponse(id, "NOT_FOUND", `Validation session ${validation_id} not found`);
    }
    
    return {
      id,
      result: {
        validation_id,
        state: session.state,
        start_time: session.startTime,
        end_time: session.endTime,
        result: session.result
      }
    };
  }
  
  /**
   * Handle cancel_validation request
   * 
   * @param {Object} params - Cancel parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async _handleCancelValidation(params, id) {
    const { validation_id } = params;
    
    if (!validation_id) {
      return this._createErrorResponse(id, "INVALID_PARAMS", "validation_id is required");
    }
    
    const session = this.sessions.get(validation_id);
    if (!session) {
      return this._createErrorResponse(id, "NOT_FOUND", `Validation session ${validation_id} not found`);
    }
    
    if (session.state === "validating") {
      session.state = "cancelled";
      session.endTime = new Date().toISOString();
    }
    
    return {
      id,
      result: {
        validation_id,
        state: session.state
      }
    };
  }
  
  /**
   * Handle shutdown request
   * 
   * @param {Object} params - Shutdown parameters
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Response
   */
  async _handleShutdown(params, id) {
    console.log(`Shutdown requested for ${this.name}`);
    
    // Start the shutdown process asynchronously
    setTimeout(() => this.stop(), 100);
    
    return {
      id,
      result: {
        shutdown_initiated: true,
        server_name: this.name
      }
    };
  }
  
  /**
   * Create an error response
   * 
   * @param {string} id - Request ID
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @returns {Object} - Error response
   */
  _createErrorResponse(id, code, message) {
    console.error(`Error [${code}]: ${message}`);
    
    return {
      id,
      error: {
        code: typeof code === "string" ? this._mapErrorCodeToNumber(code) : code,
        message
      }
    };
  }
  
  /**
   * Map string error codes to numeric codes
   * 
   * @param {string} code - String error code
   * @returns {number} - Numeric error code
   */
  _mapErrorCodeToNumber(code) {
    const errorMap = {
      "VALIDATION_FAILED": 1000,
      "INVALID_REGULATION": 1001,
      "INSUFFICIENT_DATA": 1002,
      "UNSUPPORTED_VALIDATION_TYPE": 1003,
      "VALIDATION_TIMEOUT": 1004,
      "EVIDENCE_COLLECTION_FAILED": 1005,
      "NOT_FOUND": 1006,
      "METHOD_NOT_FOUND": -32601,
      "INVALID_PARAMS": -32602,
      "INTERNAL_ERROR": -32603
    };
    
    return errorMap[code] || -32603; // Default to internal error
  }
}

export default BaseRegulationServer; 