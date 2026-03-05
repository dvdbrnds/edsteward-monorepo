const OrchestratorService = require('./service');
const { 
  ValidationStrategy, 
  ValidationStatus,
  MCPProtocol 
} = require('../../common/mcp/protocol');

/**
 * Validation Orchestrator Lambda Handler
 * Coordinates validation across multiple levels
 */
exports.handler = async (event, context) => {
  console.log('Received validation request:', JSON.stringify(event, null, 2));
  const startTime = Date.now();
  
  try {
    // Parse request
    const request = parseRequest(event);
    
    // Extract validation options
    const validationOptions = extractValidationOptions(event);
    
    // Initialize service with configuration
    const orchestratorConfig = {
      useCache: event.useCache !== false,
      cacheTTL: event.cacheTTL || 3600,
      parallelValidation: event.parallelValidation !== false
    };
    
    const orchestrator = new OrchestratorService(orchestratorConfig);
    
    // Execute validation
    const validationResult = await orchestrator.orchestrateValidation(
      request,
      validationOptions
    );
    
    // Create MCP response
    const response = MCPProtocol.createResponse({
      requestId: request.requestId || 'unknown',
      validationLevel: request.protocol?.level,
      regulationId: request.regulation.id,
      regulationVersion: request.regulation.version,
      hasUpdate: false, // TODO: Implement version checking
      status: validationResult.status,
      confidence: validationResult.confidence,
      findings: validationResult.findings,
      processingTime: Date.now() - startTime,
      validatorId: `orchestrator-${process.env.AWS_LAMBDA_FUNCTION_VERSION || 'dev'}`
    });
    
    // Format and return response
    return formatResponse(200, response);
  } catch (error) {
    console.error('Orchestrator error:', error);
    
    // Format error response
    const errorResponse = MCPProtocol.createErrorResponse(
      'VALIDATION_ERROR',
      error.message,
      { source: 'Orchestrator' },
      event.requestId || 'unknown'
    );
    
    return formatResponse(500, errorResponse);
  }
};

/**
 * Parses and validates incoming request
 * @param {Object} event - Lambda event
 * @returns {Object} Parsed request
 */
function parseRequest(event) {
  try {
    // Handle API Gateway event structure
    const rawBody = event.body 
      ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) 
      : event;
    
    // Extract request data
    const { regulation, data, client, protocol, options } = rawBody;
    
    if (!regulation || !regulation.id) {
      throw new Error('Missing regulation information');
    }
    
    if (!data) {
      throw new Error('Missing validation data');
    }
    
    // Create consistent request format
    return {
      requestId: rawBody.requestId || `req-${Date.now()}`,
      regulation,
      data,
      client: client || { id: 'anonymous', version: '1.0' },
      protocol: protocol || { level: 'BASIC', version: '1.0' },
      options: options || {}
    };
  } catch (error) {
    throw new Error(`Request parsing error: ${error.message}`);
  }
}

/**
 * Extracts validation options from event
 * @param {Object} event - Lambda event
 * @returns {Object} Validation options
 */
function extractValidationOptions(event) {
  const rawBody = event.body 
    ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) 
    : event;
  
  return {
    strategy: parseStrategy(rawBody.strategy),
    levels: parseLevels(rawBody.levels),
    skipCache: !!rawBody.skipCache
  };
}

/**
 * Parses validation strategy
 * @param {string} strategy - Strategy from request
 * @returns {string} Parsed strategy
 */
function parseStrategy(strategy) {
  if (!strategy) {
    return ValidationStrategy.ALL;
  }
  
  const upperStrategy = strategy.toUpperCase();
  
  // Check if strategy is valid
  if (Object.values(ValidationStrategy).includes(upperStrategy)) {
    return upperStrategy;
  }
  
  console.warn(`Unknown strategy ${strategy}, using default ALL`);
  return ValidationStrategy.ALL;
}

/**
 * Parses validation levels
 * @param {Array} levels - Levels from request
 * @returns {Array} Parsed levels
 */
function parseLevels(levels) {
  if (!levels || !Array.isArray(levels) || levels.length === 0) {
    return ['level1', 'level2', 'level3', 'level4'];
  }
  
  // Filter out invalid levels
  const validLevels = levels.filter(level => 
    /^level[1-4]$/.test(level)
  );
  
  if (validLevels.length === 0) {
    console.warn('No valid levels specified, using all levels');
    return ['level1', 'level2', 'level3', 'level4'];
  }
  
  return validLevels;
}

/**
 * Formats the response for API Gateway
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body
 * @returns {Object} Formatted response
 */
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
} 