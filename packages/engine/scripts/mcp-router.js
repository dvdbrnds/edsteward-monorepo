// src/lambda/orchestrator/router.js
/**
 * MCP Request Router
 * 
 * This module is responsible for routing validation requests to the appropriate validator
 * functions based on the validation plan from the classifier.
 */

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

/**
 * Route validation request to appropriate validators
 * 
 * @param {Object} validationPlan - Validation plan from classifier
 * @param {Object} request - Original validation request
 * @param {Object} regulationInfo - Regulation information
 * @returns {Array} Array of validation results from validators
 */
async function routeValidation(validationPlan, request, regulationInfo) {
  console.log('Routing validation based on plan:', JSON.stringify(validationPlan, null, 2));
  
  // Extract validators from the plan
  const { validators, parallel } = validationPlan.validationApproach;
  
  if (!validators || validators.length === 0) {
    console.warn('No validators defined in validation plan');
    return [];
  }
  
  // Prepare validation context
  const validationContext = {
    regulationId: validationPlan.regulationId,
    regulationCode: validationPlan.regulationCode,
    versionId: validationPlan.versionId,
    versionNumber: validationPlan.versionNumber,
    effectiveLevel: validationPlan.validationApproach.effectiveLevel,
    requestId: request.requestId
  };
  
  let validationResults;
  
  // Execute validators in parallel or sequentially
  if (parallel) {
    validationResults = await executeParallel(validators, request, regulationInfo, validationContext);
  } else {
    validationResults = await executeSequential(validators, request, regulationInfo, validationContext);
  }
  
  return validationResults;
}

/**
 * Execute validators in parallel
 * 
 * @param {Array} validators - List of validators to execute
 * @param {Object} request - Original validation request
 * @param {Object} regulationInfo - Regulation information
 * @param {Object} validationContext - Context for validation
 * @returns {Array} Array of validation results
 */
async function executeParallel(validators, request, regulationInfo, validationContext) {
  console.log(`Executing ${validators.length} validators in parallel`);
  
  // Create promises for all validators
  const validationPromises = validators.map(validator => 
    invokeValidator(validator, request, regulationInfo, validationContext)
  );
  
  // Execute all validators in parallel and collect results
  const results = await Promise.allSettled(validationPromises);
  
  // Process results, handling any errors
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Validator ${validators[index].type} failed:`, result.reason);
      return {
        validatorType: validators[index].type,
        error: result.reason.message || 'Unknown error',
        status: 'FAIL'
      };
    }
  });
}

/**
 * Execute validators sequentially
 * 
 * @param {Array} validators - List of validators to execute
 * @param {Object} request - Original validation request
 * @param {Object} regulationInfo - Regulation information
 * @param {Object} validationContext - Context for validation
 * @returns {Array} Array of validation results
 */
async function executeSequential(validators, request, regulationInfo, validationContext) {
  console.log(`Executing ${validators.length} validators sequentially`);
  
  const results = [];
  
  // Sort validators by priority (lowest first)
  const sortedValidators = [...validators].sort((a, b) => a.priority - b.priority);
  
  // Process each validator in sequence
  for (const validator of sortedValidators) {
    try {
      const result = await invokeValidator(validator, request, regulationInfo, validationContext);
      results.push(result);
      
      // Update context with previous results
      validationContext.previousResults = results;
      
    } catch (error) {
      console.error(`Validator ${validator.type} failed:`, error);
      results.push({
        validatorType: validator.type,
        error: error.message || 'Unknown error',
        status: 'FAIL'
      });
    }
  }
  
  return results;
}

/**
 * Invoke a single validator
 * 
 * @param {Object} validator - Validator configuration
 * @param {Object} request - Original validation request
 * @param {Object} regulationInfo - Regulation information
 * @param {Object} validationContext - Context for validation
 * @returns {Object} Validation result
 */
async function invokeValidator(validator, request, regulationInfo, validationContext) {
  console.log(`Invoking validator: ${validator.type} (${validator.functionName})`);
  
  // Prepare payload for validator
  const payload = {
    regulation: regulationInfo,
    data: request.data,
    validationContext: {
      ...validationContext,
      validatorType: validator.type,
      domain: validator.domain || null
    }
  };
  
  // Invoke Lambda function
  const params = {
    FunctionName: validator.functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(payload)
  };
  
  try {
    const response = await lambda.invoke(params).promise();
    
    // Check for Lambda errors
    if (response.FunctionError) {
      const errorPayload = JSON.parse(response.Payload);
      throw new Error(errorPayload.errorMessage || 'Unknown Lambda error');
    }
    
    // Parse and validate response
    const validationResult = JSON.parse(response.Payload);
    
    // Add validator metadata
    validationResult.validatorType = validator.type;
    validationResult.validatorName = validator.functionName;
    
    return validationResult;
  } catch (error) {
    console.error(`Error invoking validator ${validator.type}:`, error);
    throw error;
  }
}

module.exports = {
  routeValidation
};
