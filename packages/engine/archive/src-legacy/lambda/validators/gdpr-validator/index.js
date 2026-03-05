/**
 * GDPR MCP Validator
 * 
 * This is a specialized MCP server that validates GDPR compliance.
 * It implements the Model Context Protocol (MCP) specification.
 */

const { Server } = require('@modelcontextprotocol/sdk/dist/cjs/server/index.js');
const validationService = require('./validation-service');
const diffGenerator = require('./diff-generator');

// Validation levels
const VALIDATION_LEVELS = {
  LEVEL_A: 'web_scrape', // Basic validation with web scraping
  LEVEL_B: 'api',        // Validation using official APIs
  LEVEL_C: 'ai',         // AI-assisted validation
  LEVEL_D: 'human'       // Flag for human review
};

// Confidence levels for validation results
const CONFIDENCE_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNCERTAIN: 'uncertain'
};

/**
 * Lambda handler function for the GDPR Validator MCP server
 */
exports.handler = async (event, context) => {
  console.log('GDPR Validator MCP server invoked');
  
  try {
    // For direct Lambda invocation from API Gateway
    if (event.httpMethod === 'POST' && event.body) {
      return handleApiRequest(event, context);
    }
    
    // For invocation from the orchestrator Lambda
    if (event.action === 'validate') {
      return validateRegulation(event.data, event.options);
    }
    
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request' })
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

/**
 * Handle API Gateway request
 */
async function handleApiRequest(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    // Validate if this is an MCP request
    if (body.jsonrpc !== '2.0' || !body.method) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: body.id || null,
          error: {
            code: -32600,
            message: 'Invalid Request'
          }
        })
      };
    }
    
    // Process MCP request
    const result = await processMcpRequest(body);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error handling API request:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      })
    };
  }
}

/**
 * Process MCP JSON-RPC request
 */
async function processMcpRequest(request) {
  const { id, method, params } = request;
  
  try {
    let result;
    
    switch (method) {
      case 'initialize':
        // Initialize the MCP server connection
        result = {
          version: '1.0.0',
          capabilities: {
            tools: {
              validateRegulation: {
                description: 'Validates GDPR regulation compliance',
                params: {
                  type: 'object',
                  properties: {
                    regulationText: { type: 'string', description: 'Text of the regulation to validate' },
                    regulationId: { type: 'string', description: 'Identifier of the regulation' },
                    regulationVersion: { type: 'string', description: 'Version of the regulation' },
                    validationLevel: { 
                      type: 'string', 
                      enum: Object.values(VALIDATION_LEVELS),
                      description: 'Level of validation to perform'
                    }
                  },
                  required: ['regulationText', 'regulationId']
                }
              },
              getValidationStatus: {
                description: 'Get status of a validation operation',
                params: {
                  type: 'object',
                  properties: {
                    validationId: { type: 'string', description: 'ID of the validation operation' }
                  },
                  required: ['validationId']
                }
              }
            }
          }
        };
        break;
        
      case 'validateRegulation':
        // Validate the provided regulation
        result = await validateRegulation(params);
        break;
        
      case 'getValidationStatus':
        // Get validation status
        result = await validationService.getValidationStatus(params.validationId);
        break;
        
      default:
        // Method not found
        throw {
          code: -32601,
          message: `Method not found: ${method}`
        };
    }
    
    return {
      jsonrpc: '2.0',
      id,
      result
    };
    
  } catch (error) {
    console.error(`Error processing MCP request ${method}:`, error);
    
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data
      }
    };
  }
}

/**
 * Validates a regulation against authoritative sources
 * 
 * @param {Object} data - Regulation data to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation results
 */
async function validateRegulation(data, options = {}) {
  console.log('Validating regulation:', data.regulationId);
  
  // Determine validation level to use
  const validationLevel = data.validationLevel || VALIDATION_LEVELS.LEVEL_A;
  
  // Record start time for performance tracking
  const startTime = Date.now();
  
  try {
    // Get the authoritative source based on regulation ID
    const authoritativeSource = await validationService.getAuthoritativeSource(data.regulationId);
    
    // Store validation request in DynamoDB to track status
    const validationId = await validationService.createValidationRecord({
      regulationId: data.regulationId,
      regulationVersion: data.regulationVersion,
      validationLevel,
      status: 'in_progress'
    });
    
    // Perform validation based on the selected level
    let validationResult;
    let confidenceLevel;
    
    switch (validationLevel) {
      case VALIDATION_LEVELS.LEVEL_A:
        // Level A: Web scrape validation
        validationResult = await validationService.performWebScrapeValidation(
          data.regulationText,
          authoritativeSource.webUrl
        );
        confidenceLevel = CONFIDENCE_LEVELS.LOW;
        break;
        
      case VALIDATION_LEVELS.LEVEL_B:
        // Level B: API validation
        validationResult = await validationService.performApiValidation(
          data.regulationText,
          authoritativeSource.apiEndpoint
        );
        confidenceLevel = CONFIDENCE_LEVELS.MEDIUM;
        break;
        
      case VALIDATION_LEVELS.LEVEL_C:
        // Level C: AI-assisted validation
        validationResult = await validationService.performAiValidation(
          data.regulationText,
          authoritativeSource.officialText
        );
        confidenceLevel = CONFIDENCE_LEVELS.MEDIUM;
        break;
        
      case VALIDATION_LEVELS.LEVEL_D:
        // Level D: Flag for human review
        validationResult = {
          valid: false,
          needsHumanReview: true,
          message: 'This regulation requires human expert review'
        };
        confidenceLevel = CONFIDENCE_LEVELS.UNCERTAIN;
        break;
        
      default:
        throw new Error(`Unsupported validation level: ${validationLevel}`);
    }
    
    // Generate a detailed diff if validation failed
    let diff = null;
    if (!validationResult.valid && validationResult.authoritative) {
      diff = diffGenerator.generateDetailedDiff(
        data.regulationText,
        validationResult.authoritative
      );
    }
    
    // Calculate validation duration
    const duration = Date.now() - startTime;
    
    // Update validation record with results
    await validationService.updateValidationRecord(validationId, {
      status: 'completed',
      result: validationResult.valid ? 'valid' : 'invalid',
      confidenceLevel,
      duration,
      needsHumanReview: validationResult.needsHumanReview || false
    });
    
    // Prepare standard response
    const response = {
      validationId,
      regulationId: data.regulationId,
      regulationVersion: data.regulationVersion,
      valid: validationResult.valid,
      confidenceLevel,
      validationLevel,
      message: validationResult.message,
      needsHumanReview: validationResult.needsHumanReview || false,
      duration,
      timestamp: new Date().toISOString()
    };
    
    // Add diff if available
    if (diff) {
      response.discrepancies = {
        diff,
        summary: diffGenerator.generateHumanReadableSummary(diff)
      };
    }
    
    return response;
    
  } catch (error) {
    console.error('Error during regulation validation:', error);
    
    // Handle validation errors
    return {
      valid: false,
      error: true,
      errorType: 'validation_error',
      message: `Validation failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}