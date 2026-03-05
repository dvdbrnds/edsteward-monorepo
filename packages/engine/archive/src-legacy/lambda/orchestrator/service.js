const AWS = require('aws-sdk');
const { ValidationStatus } = require('../../common/mcp/protocol');

/**
 * Simplified Orchestrator Service for MVP MCP deployment
 * Routes ALL requests to Level 1 validator only
 */
class OrchestratorService {
  constructor(config = {}) {
    this.config = {
      useCache: config.useCache !== false,
      cacheTTL: config.cacheTTL || 3600,
      parallelValidation: config.parallelValidation !== false
    };

    this.lambda = new AWS.Lambda({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Orchestrate validation - MVP version routes everything to Level 1
   * @param {Object} request - MCP validation request
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async orchestrateValidation(request, options) {
    console.log('🎯 [ORCHESTRATOR] Starting MVP validation for:', request.regulation.id);
    
    try {
      // For MVP: Route ALL requests to Level 1 validator only
      const validationResult = await this.invokeLevel1Validator(request);
      
      console.log('✅ [ORCHESTRATOR] Validation completed:', {
        status: validationResult.status,
        confidence: validationResult.confidence,
        findings: validationResult.findings?.length || 0
      });
      
      return validationResult;
    } catch (error) {
      console.error('❌ [ORCHESTRATOR] Validation failed:', error);
      
      return {
        status: ValidationStatus.ERROR,
        confidence: 0,
        findings: [{
          id: 'ORCHESTRATOR_ERROR',
          path: 'system',
          severity: 'CRITICAL',
          message: `Orchestrator error: ${error.message}`,
          reference: 'System Error'
        }]
      };
    }
  }

  /**
   * Invoke Level 1 validator Lambda function
   * @param {Object} request - MCP validation request
   * @returns {Object} Validation result
   */
  async invokeLevel1Validator(request) {
    console.log('📋 [ORCHESTRATOR] Invoking Level 1 validator...');
    
    const functionName = process.env.LEVEL1_VALIDATOR_FUNCTION || 'mcp-level1-validator';
    
    const payload = {
      request: request,
      configuration: {
        textMatchThreshold: 0.85, // Slightly lower for MVP
      useCache: this.config.useCache
      }
    };

    try {
      const params = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
      };

      console.log(`🚀 [ORCHESTRATOR] Calling Lambda function: ${functionName}`);
      
      const result = await this.lambda.invoke(params).promise();
      
      if (result.FunctionError) {
        throw new Error(`Level 1 validator error: ${result.FunctionError}`);
  }

      const response = JSON.parse(result.Payload);
      
      console.log('✅ [ORCHESTRATOR] Level 1 validator response:', {
        status: response.status,
        confidence: response.confidence,
        findings: response.findings?.length || 0
      });

      return response;
    } catch (error) {
      console.error('❌ [ORCHESTRATOR] Level 1 validator invocation failed:', error);
      
      // Fallback to basic validation if Lambda fails
      return this.fallbackValidation(request);
    }
  }

  /**
   * Fallback validation if Lambda invocation fails
   * @param {Object} request - MCP validation request
   * @returns {Object} Basic validation result
   */
  fallbackValidation(request) {
    console.log('⚠️ [ORCHESTRATOR] Using fallback validation');
    
    // Basic text-based validation as fallback
    const data = typeof request.data === 'string' ? request.data : JSON.stringify(request.data);
    const hasContent = data && data.length > 10;
    
    return {
      status: hasContent ? ValidationStatus.PASS : ValidationStatus.FAIL,
      confidence: hasContent ? 0.5 : 0.1,
      findings: hasContent ? [] : [{
        id: 'FALLBACK_NO_CONTENT',
        path: 'data',
        severity: 'ERROR',
        message: 'No substantial content found for validation',
        reference: 'Fallback Validation'
      }]
    };
  }
}

module.exports = OrchestratorService; 