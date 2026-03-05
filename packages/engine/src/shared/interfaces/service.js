/**
 * Base Service Interfaces
 * Defines contracts for business logic operations
 */

/**
 * Base Service Interface
 * All services should implement basic service patterns
 */
export class BaseService {
  /**
   * Initialize service with dependencies
   * @param {Object} dependencies - Service dependencies
   */
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.logger;
  }

  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async initialize() {
    // Base implementation - can be overridden by subclasses
    return Promise.resolve();
  }

  /**
   * Validate input data
   * @param {any} data - Data to validate
   * @param {Object} rules - Validation rules
   * @returns {Promise<Object>} Validation result
   */
  async validate(data, rules) {
    throw new Error('validate method must be implemented');
  }

  /**
   * Handle service errors consistently
   * @param {Error} error - Original error
   * @param {string} operation - Operation name
   * @param {Object} context - Error context
   * @throws {AppError} Formatted application error
   */
  handleError(error, operation, context = {}) {
    if (this.logger) {
      this.logger.error(`Service error in ${operation}:`, { error: error.message, context });
    }
    throw error;
  }
}

/**
 * Service Interface Definitions
 * Extended base service interfaces for specific service types
 */

/**
 * Compliance Service Interface
 * Defines contract for compliance-related operations
 */
export class ComplianceServiceInterface extends BaseService {
  /**
   * Process a compliance query
   * @param {string} query - The compliance query
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Query result
   */
  async processQuery(query, options = {}) {
    throw new Error('processQuery method must be implemented');
  }

  /**
   * Validate content against regulations
   * @param {string} content - Content to validate
   * @param {Array} regulationIds - IDs of regulations to check against
   * @returns {Promise<Object>} Validation result
   */
  async validateContent(content, regulationIds = []) {
    throw new Error('validateContent method must be implemented');
  }

  /**
   * Detect changes in compliance status
   * @param {string} previousContent - Previous version of content
   * @param {string} currentContent - Current version of content
   * @param {Array} categories - Categories to check
   * @returns {Promise<Object>} Change detection result
   */
  async detectChanges(previousContent, currentContent, categories = []) {
    throw new Error('detectChanges method must be implemented');
  }

  /**
   * Get compliance summary for content
   * @param {string} content - Content to analyze
   * @returns {Promise<Object>} Compliance summary
   */
  async getComplianceSummary(content) {
    throw new Error('getComplianceSummary method must be implemented');
  }
}

/**
 * LLM Service Interface
 * Defines contract for LLM interactions
 */
export class LLMServiceInterface extends BaseService {
  /**
   * Send query to LLM
   * @param {string} prompt - The prompt to send
   * @param {Object} options - LLM options (temperature, max_tokens, etc.)
   * @returns {Promise<string>} LLM response
   */
  async query(prompt, options = {}) {
    throw new Error('query method must be implemented');
  }

  /**
   * Analyze text for compliance
   * @param {string} text - Text to analyze
   * @param {Array} regulations - Relevant regulations
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeCompliance(text, regulations) {
    throw new Error('analyzeCompliance method must be implemented');
  }

  /**
   * Generate compliance report
   * @param {Object} analysisData - Data to include in report
   * @returns {Promise<Object>} Generated report
   */
  async generateReport(analysisData) {
    throw new Error('generateReport method must be implemented');
  }

  /**
   * Check if LLM service is available
   * @returns {Promise<boolean>} Service availability
   */
  async isAvailable() {
    throw new Error('isAvailable method must be implemented');
  }
}

/**
 * Validation Service Interface
 * Defines contract for input validation
 */
export class ValidationServiceInterface extends BaseService {
  /**
   * Validate compliance query
   * @param {Object} queryData - Query data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateComplianceQuery(queryData) {
    throw new Error('validateComplianceQuery method must be implemented');
  }

  /**
   * Validate content data
   * @param {Object} contentData - Content data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateContentData(contentData) {
    throw new Error('validateContentData method must be implemented');
  }

  /**
   * Validate regulation data
   * @param {Object} regulationData - Regulation data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateRegulationData(regulationData) {
    throw new Error('validateRegulationData method must be implemented');
  }
} 