// src/lambda/orchestrator/index.js
/**
 * MCP Orchestrator Lambda
 * 
 * This is the primary entry point for validation requests. It receives requests from API Gateway,
 * routes them to appropriate validators, and aggregates results.
 */

const { 
  validateRequest, 
  createErrorResponse, 
  ValidationStatus, 
  createResponse,
  ErrorCodes,
  PROTOCOL_VERSION
} = require('../../common/mcp/protocol');
const classifier = require('./classifier');
const router = require('./router');
const aggregator = require('./aggregator');
const dbOps = require('../../common/db/operations');
const auditLogger = require('../../common/audit/logger');

/**
 * Main Lambda handler function
 */
exports.handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  const startTime = Date.now();
  let requestBody;
  
  try {
    // Parse request body from API Gateway event
    if (event.body) {
      requestBody = JSON.parse(event.body);
    } else if (event.requestBody) {
      // Support direct invocation for testing
      requestBody = event.requestBody;
    } else {
      throw new Error('No request body found');
    }
    
    // Validate request format against MCP protocol
    const { error, value } = validateRequest(requestBody);
    if (error) {
      console.warn('Invalid request format:', error.message);
      return formatResponse(400, createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        error.message,
        requestBody.requestId
      ));
    }
    
    const validatedRequest = value;
    
    // Log the validation request
    await auditLogger.logEvent({
      eventType: 'VALIDATION_REQUEST',
      regulationId: validatedRequest.regulation.id,
      userId: event.requestContext?.authorizer?.claims?.sub || 'unknown',
      data: {
        requestId: validatedRequest.requestId,
        clientId: validatedRequest.client.id,
        regulationVersion: validatedRequest.regulation.version,
        validationLevel: validatedRequest.protocol.level
      }
    });
    
    // Get regulation details
    const regulation = await dbOps.getRegulation(validatedRequest.regulation.id);
    if (!regulation) {
      console.warn(`Regulation ${validatedRequest.regulation.id} not found`);
      return formatResponse(404, createErrorResponse(
        ErrorCodes.REGULATION_NOT_FOUND,
        `Regulation ${validatedRequest.regulation.id} not found`,
        validatedRequest.requestId
      ));
    }
    
    // Get latest authoritative version
    const latestVersion = await dbOps.getLatestRegulationVersion(regulation.regulation_id);
    if (!latestVersion) {
      console.error(`No version found for regulation ${validatedRequest.regulation.id}`);
      return formatResponse(500, createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Error retrieving regulation version',
        validatedRequest.requestId
      ));
    }
    
    // Check if frontend version is outdated
    const frontendVersion = validatedRequest.regulation.version;
    const hasUpdate = frontendVersion && frontendVersion !== latestVersion.version_number;
    
    // Prepare regulation info for validation
    const regulationInfo = {
      id: validatedRequest.regulation.id,
      version: latestVersion.version_number,
      title: regulation.name,
      hasUpdate
    };
    
    // Classify regulation and determine validation approach
    const validationPlan = await classifier.classifyRegulation(
      regulation,
      latestVersion,
      validatedRequest.protocol.level
    );
    
    console.log('Validation plan:', JSON.stringify(validationPlan, null, 2));
    
    // Route to appropriate validators based on classification
    const validationResults = await router.routeValidation(
      validationPlan,
      validatedRequest,
      regulationInfo
    );
    
    // Aggregate results from all validators
    const aggregatedResult = aggregator.aggregateResults(validationResults);
    
    // Prepare diff information if requested and regulation has update
    let diffInfo = null;
    if (validatedRequest.options.diff && hasUpdate && frontendVersion) {
      diffInfo = await generateDiff(
        validatedRequest.regulation.id,
        frontendVersion,
        latestVersion.version_number
      );
    }
    
    // Prepare explanation if requested
    let explanation = null;
    if (validatedRequest.options.explanation) {
      explanation = await generateExplanation(
        aggregatedResult,
        regulationInfo,
        validatedRequest.protocol.level
      );
    }
    
    // Generate attestation signature if needed
    let signature = null;
    if (validatedRequest.options.attestation && 
        aggregatedResult.status === ValidationStatus.PASS) {
      signature = await generateAttestationSignature(
        validatedRequest,
        aggregatedResult,
        regulationInfo
      );
    }
    
    // Create final MCP response
    const response = createResponse(validatedRequest, aggregatedResult, regulationInfo, {
      processingTime: Date.now() - startTime,
      validatorId: `orchestrator-${process.env.AWS_LAMBDA_FUNCTION_VERSION || 'dev'}`,
      clientName: validatedRequest.client.name || validatedRequest.client.id,
      diff: diffInfo,
      explanation,
      signature
    });
    
    // Store validation result in database
    await dbOps.storeValidationResult(response);
    
    // Log successful validation
    await auditLogger.logEvent({
      eventType: 'VALIDATION_COMPLETE',
      regulationId: validatedRequest.regulation.id,
      userId: event.requestContext?.authorizer?.claims?.sub || 'unknown',
      data: {
        requestId: validatedRequest.requestId,
        responseId: response.responseId,
        status: response.validation.status,
        confidence: response.validation.confidence,
        findingsCount: response.validation.findings.length
      }
    });
    
    return formatResponse(200, response);
  } catch (error) {
    console.error('Error processing validation request:', error);
    
    // Log error
    await auditLogger.logEvent({
      eventType: 'VALIDATION_ERROR',
      regulationId: requestBody?.regulation?.id || 'unknown',
      userId: event.requestContext?.authorizer?.claims?.sub || 'unknown',
      data: {
        requestId: requestBody?.requestId || 'unknown',
        error: error.message,
        stack: error.stack
      }
    });
    
    return formatResponse(500, createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An internal error occurred while processing the validation request',
      requestBody?.requestId || 'unknown'
    ));
  }
};

/**
 * Formats Lambda response for API Gateway
 * 
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body
 * @returns {Object} Formatted response
 */
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-MCP-Version': PROTOCOL_VERSION
    },
    body: JSON.stringify(body)
  };
}

/**
 * Generates diff between regulation versions
 * 
 * @param {string} regulationId - Regulation identifier
 * @param {string} fromVersion - Source version
 * @param {string} toVersion - Target version
 * @returns {Object} Diff information
 */
async function generateDiff(regulationId, fromVersion, toVersion) {
  try {
    // Call version control service to generate diff
    const AWS = require('aws-sdk');
    const lambda = new AWS.Lambda();
    
    const params = {
      FunctionName: process.env.VERSION_CONTROL_FUNCTION || 'compliance-tracker-dev-version-control',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        action: 'GENERATE_DIFF',
        regulationId,
        fromVersion,
        toVersion
      })
    };
    
    const response = await lambda.invoke(params).promise();
    
    if (response.FunctionError) {
      console.error('Error generating diff:', response.Payload);
      return null;
    }
    
    return JSON.parse(response.Payload);
  } catch (error) {
    console.error('Error calling version control service:', error);
    return null;
  }
}

/**
 * Generates explanation for validation results
 * 
 * @param {Object} validationResult - Aggregated validation result
 * @param {Object} regulationInfo - Regulation information
 * @param {number} level - Validation level
 * @returns {Object} Explanation object
 */
async function generateExplanation(validationResult, regulationInfo, level) {
  // Get explanation templates based on findings
  const explanationTemplates = await dbOps.getExplanationTemplates(
    regulationInfo.id,
    validationResult.findings.map(f => f.id)
  );
  
  // Generate overall summary
  let summary;
  if (validationResult.status === ValidationStatus.PASS) {
    summary = `Your compliance data passes validation with ${getConfidenceText(validationResult.confidence)}.`;
    if (regulationInfo.hasUpdate) {
      summary += ' There are regulatory updates available.';
    }
  } else if (validationResult.status === ValidationStatus.PARTIAL) {
    summary = `Your compliance data passes critical validation checks but has some issues that should be addressed.`;
  } else {
    summary = `Validation failed due to critical compliance issues that must be resolved.`;
  }
  
  // Generate detailed explanations for each finding
  const details = validationResult.findings.map(finding => {
    const template = explanationTemplates.find(t => t.findingId === finding.id) || {};
    
    return {
      finding: finding.id,
      explanation: template.explanation || finding.message,
      recommendation: template.recommendation || getDefaultRecommendation(finding)
    };
  });
  
  // Get relevant resources
  const resources = await dbOps.getResourcesForRegulation(regulationInfo.id, level);
  
  return {
    summary,
    details,
    resources: resources || []
  };
}

/**
 * Gets confidence level text representation
 * 
 * @param {number} confidence - Confidence score
 * @returns {string} Text representation
 */
function getConfidenceText(confidence) {
  if (confidence >= 0.95) return 'high confidence';
  if (confidence >= 0.8) return 'moderate confidence';
  return 'low confidence';
}

/**
 * Gets default recommendation for a finding
 * 
 * @param {Object} finding - Validation finding
 * @returns {string} Default recommendation
 */
function getDefaultRecommendation(finding) {
  switch (finding.severity) {
    case 'ERROR':
      return `Address this issue to achieve compliance with ${finding.reference || 'regulations'}.`;
    case 'WARNING':
      return `Consider reviewing this aspect to improve compliance posture.`;
    case 'INFO':
      return `No action required, but you may want to review for best practices.`;
    default:
      return `Review and address as appropriate.`;
  }
}

/**
 * Generates attestation signature
 * 
 * @param {Object} request - Original validation request
 * @param {Object} result - Validation result
 * @param {Object} regulation - Regulation information
 * @returns {string} Cryptographic signature
 */
async function generateAttestationSignature(request, result, regulation) {
  // In production, this would use proper cryptographic signing
  // For this implementation, we'll create a placeholder signature
  
  const crypto = require('crypto');
  
  const signatureContent = JSON.stringify({
    regulation: {
      id: regulation.id,
      version: regulation.version
    },
    client: request.client,
    timestamp: new Date().toISOString(),
    level: request.protocol.level,
    confidence: result.confidence
  });
  
  return crypto
    .createHmac('sha256', process.env.SIGNATURE_SECRET || 'development-secret-key')
    .update(signatureContent)
    .digest('base64');
}
