/**
 * MCP Component Interaction Model
 * 
 * This file defines the interaction patterns between components in the MCP architecture,
 * following the MCP specification while using mock implementations for testing.
 */

import { 
  ValidationServer, 
  ValidationClient, 
  ValidationErrorCode,
  createValidationResult,
  createEvidence,
  CERTAINTY_LEVELS,
  EVIDENCE_TYPES
} from './mcp-validation-protocol.js';

// Connection states that follow MCP lifecycle
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  INITIALIZING: 'initializing',
  READY: 'ready',
  CLOSING: 'closing',
  ERROR: 'error'
};

/**
 * ValidationSessionManager class handles validation sessions across multiple connections
 */
export class ValidationSessionManager {
  constructor() {
    this.sessions = new Map();
    this.clients = new Map();
  }
  
  /**
   * Register a new MCP client
   * 
   * @param {string} clientId - Unique client identifier
   * @param {ValidationClient} client - The MCP client instance
   */
  registerClient(clientId, client) {
    this.clients.set(clientId, {
      client,
      state: CONNECTION_STATES.DISCONNECTED,
      connectedAt: null,
      capabilities: null
    });
    
    console.log(`Registered client: ${clientId}`);
  }
  
  /**
   * Connect a client to a validation server
   * 
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} Connection result
   */
  async connectClient(clientId) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      throw new Error(`Unknown client: ${clientId}`);
    }
    
    try {
      clientInfo.state = CONNECTION_STATES.CONNECTING;
      await clientInfo.client.connect();
      
      clientInfo.state = CONNECTION_STATES.READY;
      clientInfo.connectedAt = new Date().toISOString();
      clientInfo.capabilities = await clientInfo.client.queryCapabilities();
      
      return {
        status: 'success',
        clientId,
        state: clientInfo.state,
        capabilities: clientInfo.capabilities
      };
    } catch (error) {
      clientInfo.state = CONNECTION_STATES.ERROR;
      console.error(`Connection failed for client ${clientId}:`, error);
      
      throw {
        code: ValidationErrorCode.VALIDATION_FAILED,
        message: `Failed to connect client: ${error.message}`,
        data: { clientId }
      };
    }
  }
  
  /**
   * Create a new validation session
   * 
   * @param {string} clientId - Client ID to use for validation
   * @param {string} regulationId - Regulation to validate against
   * @param {Object} options - Session options
   * @returns {Object} The created session
   */
  createSession(clientId, regulationId, options = {}) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      throw new Error(`Unknown client: ${clientId}`);
    }
    
    if (clientInfo.state !== CONNECTION_STATES.READY) {
      throw new Error(`Client ${clientId} is not ready (current state: ${clientInfo.state})`);
    }
    
    // Check if regulation is supported by this client
    if (clientInfo.capabilities && 
        clientInfo.capabilities.supported_regulations && 
        !clientInfo.capabilities.supported_regulations.includes(regulationId)) {
      throw {
        code: ValidationErrorCode.INVALID_REGULATION,
        message: `Regulation ${regulationId} is not supported by client ${clientId}`
      };
    }
    
    const sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    this.sessions.set(sessionId, {
      id: sessionId,
      clientId,
      regulationId,
      state: 'created',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      result: null,
      options
    });
    
    console.log(`Created session: ${sessionId} for regulation: ${regulationId}`);
    return this.sessions.get(sessionId);
  }
  
  /**
   * Execute validation for a session
   * 
   * @param {string} sessionId - Session ID
   * @param {Object} content - Content to validate
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Validation result
   */
  async executeValidation(sessionId, content, context = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    
    const clientInfo = this.clients.get(session.clientId);
    if (!clientInfo || clientInfo.state !== CONNECTION_STATES.READY) {
      throw new Error(`Client ${session.clientId} is not available for validation`);
    }
    
    try {
      // Update session state
      session.state = 'validating';
      session.lastUpdatedAt = new Date().toISOString();
      
      console.log(`Executing validation for session: ${sessionId}`);
      
      // Execute validation via MCP client
      const validationType = session.options.validationType || 'standard';
      const result = await clientInfo.client.validate(
        session.regulationId, 
        content, 
        validationType,
        context
      );
      
      // Update session with result
      session.state = 'completed';
      session.lastUpdatedAt = new Date().toISOString();
      session.result = result;
      
      return result;
    } catch (error) {
      // Handle validation error
      session.state = 'failed';
      session.lastUpdatedAt = new Date().toISOString();
      session.error = {
        code: error.code || ValidationErrorCode.VALIDATION_FAILED,
        message: error.message || 'Validation failed',
        details: error.data || null
      };
      
      throw error;
    }
  }
  
  /**
   * Get a session by ID
   * 
   * @param {string} sessionId - Session ID
   * @returns {Object} Session information
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get all sessions for a client
   * 
   * @param {string} clientId - Client ID
   * @returns {Array} All sessions for the client
   */
  getClientSessions(clientId) {
    const results = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.clientId === clientId) {
        results.push(session);
      }
    }
    return results;
  }
  
  /**
   * Close a client connection and clean up its sessions
   * 
   * @param {string} clientId - Client ID
   * @param {boolean} cleanupSessions - Whether to remove sessions
   * @returns {Promise<boolean>} Success status
   */
  async closeClient(clientId, cleanupSessions = false) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      return false;
    }
    
    try {
      clientInfo.state = CONNECTION_STATES.CLOSING;
      await clientInfo.client.disconnect();
      
      if (cleanupSessions) {
        // Remove all sessions for this client
        for (const [id, session] of this.sessions.entries()) {
          if (session.clientId === clientId) {
            this.sessions.delete(id);
          }
        }
      }
      
      clientInfo.state = CONNECTION_STATES.DISCONNECTED;
      return true;
    } catch (error) {
      console.error(`Error closing client ${clientId}:`, error);
      clientInfo.state = CONNECTION_STATES.ERROR;
      return false;
    }
  }
}

/**
 * ValidatorRegistry manages registration and discovery of validation servers
 */
export class ValidatorRegistry {
  constructor() {
    this.validators = new Map();
  }
  
  /**
   * Register a new validation server
   * 
   * @param {string} validatorId - Unique validator identifier
   * @param {Object} info - Validator information
   */
  registerValidator(validatorId, info) {
    this.validators.set(validatorId, {
      id: validatorId,
      name: info.name,
      version: info.version,
      description: info.description || '',
      supportedRegulations: info.supportedRegulations || [],
      endpointType: info.endpointType || 'http',
      endpoint: info.endpoint,
      registeredAt: new Date().toISOString(),
      status: 'active'
    });
    
    console.log(`Registered validator: ${validatorId} with regulations: ${info.supportedRegulations.join(', ')}`);
  }
  
  /**
   * Find validators that support a specific regulation
   * 
   * @param {string} regulationId - Regulation ID
   * @returns {Array} Matching validators
   */
  findValidatorsForRegulation(regulationId) {
    const results = [];
    for (const [id, validator] of this.validators.entries()) {
      if (validator.supportedRegulations.includes(regulationId)) {
        results.push(validator);
      }
    }
    return results;
  }
  
  /**
   * Get all registered validators
   * 
   * @returns {Array} All validators
   */
  getAllValidators() {
    return Array.from(this.validators.values());
  }
  
  /**
   * Deregister a validator
   * 
   * @param {string} validatorId - Validator ID
   * @returns {boolean} Success status
   */
  deregisterValidator(validatorId) {
    return this.validators.delete(validatorId);
  }
}

/**
 * ValidationOrchestrator manages the full validation process across multiple regulations
 */
export class ValidationOrchestrator {
  /**
   * Create a new validation orchestrator
   * 
   * @param {Object} options - Orchestrator options
   */
  constructor(options = {}) {
    this.registry = options.registry || new ValidatorRegistry();
    this.sessionManager = options.sessionManager || new ValidationSessionManager();
    this.clientFactory = options.clientFactory || this.defaultClientFactory;
  }
  
  /**
   * Default client factory creates a new ValidationClient
   * 
   * @param {Object} options - Client options
   * @returns {ValidationClient} New client instance
   */
  defaultClientFactory(options) {
    return new ValidationClient(options);
  }
  
  /**
   * Setup a client connection for a validator
   * 
   * @param {string} validatorId - Validator ID
   * @returns {Promise<string>} Client ID
   */
  async setupClientForValidator(validatorId) {
    const validator = this.registry.validators.get(validatorId);
    if (!validator) {
      throw new Error(`Unknown validator: ${validatorId}`);
    }
    
    // Create a client instance
    const client = this.clientFactory({
      name: `orchestrator-client-${validatorId}`,
      version: '1.0.0'
    });
    
    // Generate client ID
    const clientId = `client-${validatorId}-${Date.now()}`;
    
    // Register client
    this.sessionManager.registerClient(clientId, client);
    
    // Connect to validator
    await this.sessionManager.connectClient(clientId);
    
    return clientId;
  }
  
  /**
   * Validate content against a regulation
   * 
   * @param {string} regulationId - Regulation ID
   * @param {Object} content - Content to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(regulationId, content, options = {}) {
    // Find validators for this regulation
    const validators = this.registry.findValidatorsForRegulation(regulationId);
    if (validators.length === 0) {
      throw {
        code: ValidationErrorCode.INVALID_REGULATION,
        message: `No validators found for regulation: ${regulationId}`
      };
    }
    
    // Use the first validator (can be enhanced with selection logic)
    const validator = validators[0];
    
    try {
      // Get or setup client
      let clientId;
      try {
        clientId = await this.setupClientForValidator(validator.id);
      } catch (error) {
        throw {
          code: ValidationErrorCode.VALIDATION_FAILED,
          message: `Failed to set up validator client: ${error.message}`,
          data: { validatorId: validator.id }
        };
      }
      
      // Create validation session
      const session = this.sessionManager.createSession(clientId, regulationId, options);
      
      // Execute validation
      const result = await this.sessionManager.executeValidation(
        session.id,
        content,
        options.context || {}
      );
      
      return {
        regulationId,
        sessionId: session.id,
        validatorId: validator.id,
        result
      };
    } catch (error) {
      console.error(`Validation error for regulation ${regulationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate content against multiple regulations
   * 
   * @param {Array} items - Validation items
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} Batch validation results
   */
  async validateBatch(items, options = {}) {
    const results = [];
    const failed = [];
    
    if (options.parallel) {
      // Process in parallel
      const promises = items.map(async (item) => {
        try {
          const result = await this.validate(
            item.regulationId,
            item.content,
            {
              validationType: item.validationType,
              context: item.context,
              ...options
            }
          );
          return { success: true, ...result };
        } catch (error) {
          return {
            success: false,
            regulationId: item.regulationId,
            error: {
              code: error.code || ValidationErrorCode.VALIDATION_FAILED,
              message: error.message || 'Validation failed',
              data: error.data
            }
          };
        }
      });
      
      const batchResults = await Promise.all(promises);
      for (const result of batchResults) {
        if (result.success) {
          results.push(result);
        } else {
          failed.push(result);
        }
      }
    } else {
      // Process sequentially
      for (const item of items) {
        try {
          const result = await this.validate(
            item.regulationId,
            item.content,
            {
              validationType: item.validationType,
              context: item.context,
              ...options
            }
          );
          results.push(result);
        } catch (error) {
          failed.push({
            regulationId: item.regulationId,
            error: {
              code: error.code || ValidationErrorCode.VALIDATION_FAILED,
              message: error.message || 'Validation failed',
              data: error.data
            }
          });
        }
      }
    }
    
    return {
      results,
      failed,
      summary: {
        total: items.length,
        succeeded: results.length,
        failed: failed.length
      }
    };
  }
}

export default {
  CONNECTION_STATES,
  ValidationSessionManager,
  ValidatorRegistry,
  ValidationOrchestrator
}; 