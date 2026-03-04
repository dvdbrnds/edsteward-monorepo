# MCP Software Engine Implementation Plan

## Overview

This implementation plan provides a step-by-step approach for developing the Model Context Protocol (MCP) software engine for the Compliance Tracker system. The plan is designed for a solo developer following the comprehensive implementation guide, with a focus on AWS serverless architecture to minimize operational overhead while maintaining scalability for future commercialization.

## Phase 1: Project Setup and AWS Environment (10-15 days)

### 1.1 Project Preparation (5-7 days)

1. **Create GitHub Repository and Structure**
   - Initialize Git repository
   - Set up directory structure following the implementation guide
   - Create initial README.md with project overview
   - Set up .gitignore file

2. **Create Key Documentation**
   - MCP protocol specification
   - Regulation data model
   - API contract
   - Project timeline and milestones

3. **Set Up Development Environment**
   - Install Node.js, npm, AWS CLI, Terraform
   - Configure IDE with necessary extensions
   - Set up linting and formatting

### 1.2 AWS Account Setup (5-8 days)

1. **AWS Account Configuration**
   - Create/configure AWS account
   - Enable MFA for root account
   - Create administrator group and user
   - Create appropriate IAM roles
   - Set up budget monitoring

2. **Infrastructure as Code Foundation**
   - Initialize Terraform project
   - Create variables, providers, and backend configuration
   - Set up core networking (VPC, subnets, security groups)
   - Configure initial AWS services setup

## Phase 2: Core Infrastructure Implementation (15-20 days)

### 2.1 Database Infrastructure (5-6 days)

1. **Database Schema Design**
   - Create initial PostgreSQL migration files based on data model
   - Set up Aurora Serverless PostgreSQL in Terraform
   - Configure database security and encryption
   - Implement database access layer in code

2. **Database Secret Management**
   - Set up AWS Secrets Manager for database credentials
   - Configure secure access to credentials
   - Implement credential rotation

### 2.2 API Infrastructure (5-6 days)

1. **API Gateway Configuration**
   - Create REST API in API Gateway via Terraform
   - Configure resources, methods, and integrations
   - Set up CORS for frontend integration
   - Implement request/response validation

2. **Authentication System**
   - Configure Amazon Cognito user pool
   - Implement custom Lambda authorizer
   - Set up role-based permissions
   - Create authentication utilities for Lambda functions

### 2.3 Core AWS Services (5-8 days)

1. **Lambda Foundation**
   - Create base Lambda configurations
   - Set up shared utilities and middleware
   - Configure logging and monitoring
   - Implement error handling framework

2. **Storage and Auxiliary Services**
   - Set up S3 for document storage
   - Configure CloudWatch for logging and metrics
   - Set up SNS for notifications
   - Implement QLDB for immutable audit trail

## Phase 3: MCP Core Implementation (20-25 days)

### 3.1 Protocol Implementation (5-6 days)

1. **MCP Protocol Library**
   - Implement protocol definition module
   - Create request/response validation utilities
   - Set up protocol versioning support
   - Develop shared validation functions

2. **Request/Response Processing**
   - Create standardized request parser
   - Implement response formatter
   - Set up error handling middleware
   - Create validation result builder

### 3.2 Primary MCP Orchestrator (5-6 days)

1. **Orchestrator Lambda**
   - Implement handler for validation requests
   - Create regulation classifier module
   - Develop request routing logic
   - Implement response aggregation

2. **Workflow Management**
   - Create state management for multi-step validations
   - Implement retry and error recovery logic
   - Set up timeout handling
   - Develop caching strategy

### 3.3 Validation Services (7-10 days)

1. **Level 1 Validator**
   - Implement simple text comparison for static regulations
   - Create pattern matching for semi-structured content
   - Develop caching for validation results
   - Set up performance optimization

2. **Advanced Validators (Level 2-3)**
   - Create framework for more complex validators
   - Implement rule-based validation engine
   - Set up context-aware validation logic
   - Enable workflow for complex validations

### 3.4 Version Control and Change Management (3-5 days)

1. **Version Control Service**
   - Implement version tracking logic
   - Create diff generation between versions
   - Develop change notification system
   - Build acceptance tracking mechanism

## Phase 4: Frontend Integration and Testing (15-20 days)

### 4.1 API Client Library (5-6 days)

1. **JavaScript Client**
   - Create client library for Replit frontend
   - Implement authentication utilities
   - Develop validation request/response handling
   - Create version control utilities

2. **API Documentation**
   - Create comprehensive API docs
   - Generate OpenAPI/Swagger specification
   - Provide usage examples
   - Document error handling

### 4.2 Replit Frontend Integration (5-6 days)

1. **Integration with Existing Frontend**
   - Update authentication mechanism
   - Implement validation request workflow
   - Add version control UI
   - Create change notification handling

2. **Frontend Configuration**
   - Set up environment-specific configuration
   - Implement feature flags
   - Create deployment pipeline for frontend
   - Develop testing utilities

### 4.3 Testing and Quality Assurance (5-8 days)

1. **Unit Testing**
   - Develop test suite for common modules
   - Create tests for Lambda functions
   - Set up test data generation
   - Implement mocking for AWS services

2. **Integration Testing**
   - Create end-to-end test suite
   - Set up test environment
   - Develop validation flow tests
   - Create version control flow tests

## Phase 5: Deployment and Initial Rollout (15-20 days)

### 5.1 Deployment Pipeline (5-6 days)

1. **CI/CD Setup**
   - Configure GitHub Actions for CI/CD
   - Create deployment scripts
   - Set up environment promotion workflow
   - Implement rollback procedures

2. **Initial Deployment**
   - Deploy infrastructure via Terraform
   - Deploy Lambda functions
   - Initialize database
   - Configure monitoring and alerting

### 5.2 University Testing Environment (5-6 days)

1. **Testing Environment Setup**
   - Deploy to development environment
   - Configure test data
   - Set up test users
   - Create testing scenarios

2. **Internal Testing**
   - Conduct validation flow testing
   - Test version control functionality
   - Verify frontend integration
   - Review security and performance

### 5.3 Department Rollout (5-8 days)

1. **Initial Department Onboarding**
   - Select department with manageable requirements
   - Conduct training session
   - Set up department-specific users
   - Create department-specific regulations

2. **Monitoring and Adjustments**
   - Track validation results
   - Monitor system performance
   - Collect user feedback
   - Make necessary adjustments

## Phase 6: Expanded University Rollout (25-30 days)

### 6.1 Multi-Department Expansion (15-20 days)

1. **Additional Department Onboarding**
   - Conduct training sessions
   - Set up department-specific users
   - Provide documentation
   - Offer support resources

2. **System Refinement**
   - Gather metrics and feedback
   - Implement improvements
   - Optimize performance
   - Enhance documentation

### 6.2 University-wide Deployment (10-15 days)

1. **Full Deployment Preparation**
   - Scale infrastructure as needed
   - Update documentation
   - Finalize training materials
   - Prepare support resources

2. **Rollout Management**
   - Deploy to all departments in phases
   - Conduct training sessions
   - Provide support
   - Establish ongoing maintenance procedures

## Phase 7: Commercialization Preparation (40-50 days)

### 7.1 Multi-tenant Infrastructure Enhancement (15-20 days)

1. **Multi-tenancy Implementation**
   - Update database schema for tenant isolation
   - Implement tenant context in API calls
   - Create tenant management API
   - Set up tenant-specific configuration

2. **White-labeling Support**
   - Add tenant-specific theming
   - Create branding configuration options
   - Implement customization features
   - Develop tenant onboarding workflow

### 7.2 Product Packaging (10-15 days)

1. **Product Branding**
   - Develop product name and identity
   - Create logo and visual assets
   - Define product positioning
   - Prepare marketing materials

2. **Documentation and Training**
   - Create installation guide
   - Develop configuration guide
   - Write administration manual
   - Prepare training materials

### 7.3 Pricing and Early Adopter Program (15-20 days)

1. **Pricing Model Development**
   - Define pricing tiers
   - Set up billing system
   - Create licensing terms
   - Implement usage tracking

2. **Early Adopter Preparation**
   - Identify partner institutions
   - Prepare outreach materials
   - Create partner onboarding process
   - Develop feedback collection mechanism

## Detailed Time Breakdown

1. **Project Setup and AWS Environment**: 10-15 days
2. **Core Infrastructure Implementation**: 15-20 days
3. **MCP Core Implementation**: 20-25 days
4. **Frontend Integration and Testing**: 15-20 days
5. **Deployment and Initial Rollout**: 15-20 days
6. **Expanded University Rollout**: 25-30 days
7. **Commercialization Preparation**: 40-50 days

**Total Implementation Time**: Approximately 140-180 days (4.5-6 months) for a solo developer

## Implementation Strategy

### Iterative Development Approach

1. **Minimum Viable Product (MVP)**
   - Start with Level 1 validation only
   - Implement core infrastructure
   - Focus on a single regulation type
   - Create basic frontend integration

2. **Progressive Enhancement**
   - Add Level 2 validation
   - Implement version control
   - Expand to multiple regulations
   - Enhance frontend features

3. **Scale and Commercialize**
   - Add Level 3 validation
   - Implement multi-tenancy
   - Create white-labeling
   - Develop billing and licensing

### Risk Mitigation Strategies

1. **Technical Risks**
   - Start with proven AWS services
   - Use infrastructure as code for consistency
   - Implement comprehensive testing
   - Create rollback procedures

2. **Timeline Risks**
   - Focus on core functionality first
   - Use AI assistance for acceleration
   - Create clear milestones and checkpoints
   - Regularly reassess priorities

3. **Resource Constraints**
   - Leverage serverless architecture to minimize operational overhead
   - Use managed services where possible
   - Implement automation for routine tasks
   - Create reusable components and libraries

## Implementation Details by Component

### 1. MCP Protocol Library

The MCP Protocol Library will provide the foundational components for protocol implementation:

```javascript
// src/common/mcp/protocol.js
const Joi = require('joi');

/**
 * MCP Protocol Request Schema
 */
const requestSchema = Joi.object({
  requestId: Joi.string().required(),
  timestamp: Joi.date().iso().required(),
  protocol: Joi.object({
    version: Joi.string().required(),
    level: Joi.number().integer().min(1).max(4).required()
  }).required(),
  client: Joi.object({
    id: Joi.string().required(),
    version: Joi.string().required()
  }).required(),
  regulation: Joi.object({
    id: Joi.string().required(),
    version: Joi.string().optional()
  }).required(),
  data: Joi.object().required(),
  options: Joi.object({
    attestation: Joi.boolean().default(false),
    diff: Joi.boolean().default(false),
    explanation: Joi.boolean().default(false)
  }).default()
});

/**
 * MCP Protocol Response Schema
 */
const responseSchema = Joi.object({
  // Response schema definition
});

/**
 * Validation Status Enum
 */
const ValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL'
};

/**
 * Severity Level Enum
 */
const SeverityLevel = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

module.exports = {
  requestSchema,
  responseSchema,
  ValidationStatus,
  SeverityLevel,
  validateRequest: (data) => requestSchema.validate(data),
  validateResponse: (data) => responseSchema.validate(data)
};
```

### 2. Primary MCP Orchestrator Lambda

The Orchestrator Lambda handles incoming requests and routes them to the appropriate validators:

```javascript
// src/lambda/orchestrator/index.js
const { validateRequest } = require('../../common/mcp/protocol');
const classifier = require('./classifier');
const router = require('./router');
const aggregator = require('./aggregator');
const db = require('../../common/db');

/**
 * Main handler for MCP validation requests
 */
exports.handler = async (event, context) => {
  try {
    console.log('Received validation request', JSON.stringify(event));
    
    // Parse API Gateway event
    const body = JSON.parse(event.body);
    
    // Validate request format
    const { error, value } = validateRequest(body);
    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: error.message,
            requestId: body.requestId || 'unknown'
          }
        })
      };
    }
    
    // Get regulation details
    const regulation = await db.getRegulation(value.regulation.id);
    if (!regulation) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: {
            code: 'REGULATION_NOT_FOUND',
            message: `Regulation ${value.regulation.id} not found`,
            requestId: value.requestId
          }
        })
      };
    }
    
    // Classify regulation and determine validation approach
    const validationPlan = classifier.classifyRegulation(regulation, value.protocol.level);
    
    // Route to appropriate validators
    const validationResults = await router.routeValidation(validationPlan, value);
    
    // Aggregate results
    const aggregatedResponse = aggregator.aggregateResults(validationResults, value, regulation);
    
    // Create validation record in database
    await db.storeValidationResult(aggregatedResponse);
    
    return {
      statusCode: 200,
      body: JSON.stringify(aggregatedResponse)
    };
  } catch (err) {
    console.error('Error processing validation request', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred processing the validation request',
          requestId: event.body ? JSON.parse(event.body).requestId : 'unknown'
        }
      })
    };
  }
};
```

### 3. Level 1 Validator Lambda

The Level 1 Validator handles simple text-based validation for static regulations:

```javascript
// src/lambda/level1-validator/index.js
const textCompare = require('./textCompare');
const patternMatch = require('./patternMatch');
const cache = require('./cache');
const { SeverityLevel, ValidationStatus } = require('../../common/mcp/protocol');

/**
 * Handler for Level 1 Validation
 */
exports.handler = async (event) => {
  try {
    const { regulation, data, validationContext } = event;
    
    // Try to get cached result
    const cachedResult = await cache.getResult(regulation.id, regulation.version, data);
    if (cachedResult) {
      console.log('Returning cached validation result');
      return cachedResult;
    }
    
    // Get validation rules for regulation
    const validationRules = await getValidationRules(regulation.id, regulation.version);
    
    // Perform validation
    const findings = [];
    let hasErrors = false;
    
    for (const rule of validationRules) {
      const dataValue = getValueAtPath(data, rule.dataPath);
      
      let isValid = true;
      let message = null;
      
      // Perform appropriate validation based on rule type
      switch (rule.validationType) {
        case 'PATTERN':
          const patternResult = patternMatch.validate(dataValue, rule.validationParams);
          isValid = patternResult.isValid;
          message = patternResult.message;
          break;
        case 'EXISTS':
          isValid = dataValue !== undefined && dataValue !== null;
          message = isValid ? null : `Required field is missing`;
          break;
        case 'COMPARISON':
          // Implement comparison logic
          break;
        default:
          // Default text comparison
          const compareResult = textCompare.validate(dataValue, rule.validationParams);
          isValid = compareResult.isValid;
          message = compareResult.message;
      }
      
      if (!isValid) {
        findings.push({
          id: `find-${findings.length + 1}`,
          path: rule.dataPath,
          severity: rule.severity,
          message: message || rule.messageTemplate.replace('{value}', dataValue),
          reference: rule.referenceSection
        });
        
        if (rule.severity === SeverityLevel.ERROR) {
          hasErrors = true;
        }
      }
    }
    
    // Determine overall status
    let status = ValidationStatus.PASS;
    if (hasErrors) {
      status = ValidationStatus.FAIL;
    } else if (findings.length > 0) {
      status = ValidationStatus.PARTIAL;
    }
    
    const result = {
      status,
      confidence: calculateConfidence(findings, validationRules.length),
      findings
    };
    
    // Cache result
    await cache.storeResult(regulation.id, regulation.version, data, result);
    
    return result;
  } catch (err) {
    console.error('Error in Level 1 validation', err);
    throw err;
  }
};

/**
 * Calculate confidence score based on findings
 */
function calculateConfidence(findings, totalRules) {
  if (findings.length === 0) return 1.0;
  
  const errorWeight = 0.6;
  const warningWeight = 0.3;
  const infoWeight = 0.1;
  
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  
  findings.forEach(finding => {
    if (finding.severity === SeverityLevel.ERROR) errorCount++;
    if (finding.severity === SeverityLevel.WARNING) warningCount++;
    if (finding.severity === SeverityLevel.INFO) infoCount++;
  });
  
  const weightedIssues = (errorCount * errorWeight) + 
                         (warningCount * warningWeight) + 
                         (infoCount * infoWeight);
  
  return Math.max(0, Math.min(1, 1 - (weightedIssues / totalRules)));
}

/**
 * Extract value at specified JSON path
 */
function getValueAtPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array notation (e.g., items[0])
    if (part.includes('[') && part.includes(']')) {
      const arrayPart = part.substring(0, part.indexOf('['));
      const indexPart = part.substring(part.indexOf('[') + 1, part.indexOf(']'));
      const index = parseInt(indexPart, 10);
      
      current = current[arrayPart];
      if (Array.isArray(current) && !isNaN(index)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }
  
  return current;
}

/**
 * Get validation rules for regulation
 */
async function getValidationRules(regulationId, version) {
  // In real implementation, fetch from database
  // This is a simplified example
  return [
    {
      dataPath: 'data.institutionalControls.trainingProgram.completionRate',
      validationType: 'COMPARISON',
      validationParams: { operator: '>=', value: 0.9 },
      severity: SeverityLevel.ERROR,
      messageTemplate: 'Training completion rate {value} does not meet minimum threshold of 90%',
      referenceSection: 'FERPA §99.16(b)(2)'
    }
  ];
}
```

### 4. Versioning and Change Detection

```javascript
// src/lambda/version-control/index.js
const diffGen = require('./diffGen');
const notification = require('./notification');
const acceptance = require('./acceptance');
const db = require('../../common/db');

/**
 * Handler for version control operations
 */
exports.handler = async (event) => {
  const { action, regulationId, fromVersion, toVersion, acceptanceData } = event;
  
  try {
    switch (action) {
      case 'GENERATE_DIFF':
        return await generateDiff(regulationId, fromVersion, toVersion);
      
      case 'NOTIFY_CHANGE':
        return await notifyChange(regulationId, fromVersion, toVersion);
      
      case 'TRACK_ACCEPTANCE':
        return await trackAcceptance(regulationId, toVersion, acceptanceData);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`Error in version control: ${err.message}`, err);
    throw err;
  }
};

/**
 * Generate diff between regulation versions
 */
async function generateDiff(regulationId, fromVersion, toVersion) {
  // Get both versions from database
  const oldVersion = await db.getRegulationVersion(regulationId, fromVersion);
  const newVersion = await db.getRegulationVersion(regulationId, toVersion);
  
  if (!oldVersion || !newVersion) {
    throw new Error('One or both regulation versions not found');
  }
  
  // Generate diff
  const diff = diffGen.generateDiff(oldVersion, newVersion);
  
  return {
    regulationId,
    fromVersion,
    toVersion,
    changes: diff.changes,
    summary: diff.summary,
    effectiveDate: newVersion.effectiveDate
  };
}

/**
 * Notify frontend about regulation changes
 */
async function notifyChange(regulationId, fromVersion, toVersion) {
  // Generate diff
  const diff = await generateDiff(regulationId, fromVersion, toVersion);
  
  // Get clients using old version
  const affectedClients = await db.getClientsUsingVersion(regulationId, fromVersion);
  
  // Send notifications
  for (const client of affectedClients) {
    await notification.sendChangeNotification(client, diff);
  }
  
  return {
    regulationId,
    fromVersion,
    toVersion,
    notificationsSent: affectedClients.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Track frontend acceptance of regulation updates
 */
async function trackAcceptance(regulationId, version, acceptanceData) {
  const { clientId, accepted, acceptedBy, notes, implementationDate } = acceptanceData;
  
  // Record acceptance decision
  const result = await acceptance.recordAcceptance({
    regulationId,
    version,
    clientId,
    accepted,
    acceptedBy,
    notes,
    implementationDate,
    acceptanceDate: new Date().toISOString()
  });
  
  // Update client version if accepted
  if (accepted) {
    await db.updateClientVersion(clientId, regulationId, version);
  }
  
  return result;
}
```

### 5. Database Operations Layer

```javascript
// src/common/db/operations.js
const { Pool } = require('pg');
const { getDbConfig } = require('./config');

let pool;

/**
 * Initialize database connection pool
 */
async function initPool() {
  if (!pool) {
    const config = await getDbConfig();
    pool = new Pool(config);
    
    // Test connection
    try {
      const client = await pool.connect();
      console.log('Successfully connected to database');
      client.release();
    } catch (err) {
      console.error('Failed to connect to database', err);
      pool = null;
      throw err;
    }
  }
  return pool;
}

/**
 * Get regulation by ID or code
 */
async function getRegulation(idOrCode) {
  const pool = await initPool();
  
  let query = 'SELECT * FROM regulation WHERE ';
  let params = [];
  
  // Determine if ID or code was provided
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode)) {
    // UUID format
    query += 'regulation_id = $1';
    params.push(idOrCode);
  } else {
    // Code format
    query += 'code = $1';
    params.push(idOrCode);
  }
  
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

/**
 * Get regulation version
 */
async function getRegulationVersion(regulationId, versionNumber) {
  const pool = await initPool();
  
  // First get the version record
  const versionQuery = `
    SELECT * FROM regulation_version 
    WHERE regulation_id = $1 AND version_number = $2
  `;
  
  const versionResult = await pool.query(versionQuery, [regulationId, versionNumber]);
  
  if (versionResult.rows.length === 0) {
    return null;
  }
  
  const version = versionResult.rows[0];
  
  // Get content for this version
  const contentQuery = `
    SELECT * FROM regulation_content
    WHERE version_id = $1
    ORDER BY order_index
  `;
  
  const contentResult = await pool.query(contentQuery, [version.version_id]);
  
  // Get attributes for this version
  const attributeQuery = `
    SELECT * FROM regulation_attribute
    WHERE version_id = $1
  `;
  
  const attributeResult = await pool.query(attributeQuery, [version.version_id]);
  
  // Combine into complete version object
  return {
    ...version,
    content: contentResult.rows,
    attributes: attributeResult.rows.reduce((obj, attr) => {
      obj[attr.key] = attr.value;
      return obj;
    }, {})
  };
}

/**
 * Store validation result
 */
async function storeValidationResult(validationResponse) {
  const pool = await initPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert validation result record
    const resultQuery = `
      INSERT INTO validation_result (
        result_id,
        regulation_id,
        version_id,
        user_id,
        tenant_id,
        request_id,
        status,
        confidence,
        validation_level,
        data_hash,
        validation_date,
        processing_time_ms,
        validator_id,
        client_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING result_id
    `;
    
    const resultParams = [
      validationResponse.responseId,
      validationResponse.regulation.id,
      // Need to look up version_id from regulation_id and version_number
      null, // version_id - to be determined
      null, // user_id - from context
      null, // tenant_id - from context
      validationResponse.requestId,
      validationResponse.validation.status,
      validationResponse.validation.confidence,
      validationResponse.protocol.level,
      'placeholder_hash', // Would calculate hash of data
      new Date(validationResponse.timestamp),
      validationResponse.meta.processingTime,
      validationResponse.meta.validatorId,
      JSON.stringify(validationResponse.client)
    ];
    
    const resultRes = await client.query(resultQuery, resultParams);
    const resultId = resultRes.rows[0].result_id;
    
    // Insert validation findings
    for (const finding of validationResponse.validation.findings) {
      const findingQuery = `
        INSERT INTO validation_finding (
          finding_id,
          result_id,
          finding_code,
          rule_id,
          path,
          severity,
          message,
          reference,
          data_value,
          expected_value,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      
      const findingParams = [
        // Generate UUID for finding_id
        finding.id,
        resultId,
        finding.id,
        null, // rule_id - would look up from reference
        finding.path,
        finding.severity,
        finding.message,
        finding.reference,
        null, // data_value - would extract from data
        null, // expected_value - from rule
        new Date()
      ];
      
      await client.query(findingQuery, findingParams);
    }
    
    // If attestation present, store it
    if (validationResponse.attestation) {
      const attestationQuery = `
        INSERT INTO attestation_certificate (
          attestation_id,
          result_id,
          certificate_id,
          issue_date,
          expiration_date,
          level,
          confidence,
          status,
          signature,
          signature_algorithm,
          verification_url,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      const attestationParams = [
        // Generate UUID for attestation_id
        validationResponse.attestation.id,
        resultId,
        validationResponse.attestation.id,
        new Date(validationResponse.attestation.timestamp),
        new Date(validationResponse.attestation.expiresAt),
        validationResponse.attestation.level,
        validationResponse.attestation.confidence,
        'ACTIVE',
        validationResponse.attestation.signature,
        'HMAC-SHA256',
        validationResponse.attestation.verificationUrl,
        new Date()
      ];
      
      await client.query(attestationQuery, attestationParams);
    }
    
    await client.query('COMMIT');
    
    return resultId;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error storing validation result', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get clients using a specific regulation version
 */
async function getClientsUsingVersion(regulationId, version) {
  // Simplified implementation - in real system would query from database
  return [
    { id: 'university-frontend', name: 'State University Compliance System' }
  ];
}

/**
 * Update client's regulation version
 */
async function updateClientVersion(clientId, regulationId, version) {
  // Simplified implementation - in real system would update database
  console.log(`Updating client ${clientId} to use regulation ${regulationId} version ${version}`);
  return true;
}

module.exports = {
  getRegulation,
  getRegulationVersion,
  storeValidationResult,
  getClientsUsingVersion,
  updateClientVersion
};
```

## Next Steps and First Milestones

### Initial Development Milestones (First 30 Days)

1. **Week 1-2: Project Setup and Infrastructure**
   - Complete project repository setup
   - Create core documentation
   - Set up AWS environment
   - Deploy initial infrastructure with Terraform

2. **Week 3-4: Database and API Foundation**
   - Implement database schema and migrations
   - Set up API Gateway configuration
   - Create authentication system
   - Deploy database and API infrastructure

3. **Week 5-6: MCP Core Components**
   - Implement MCP protocol library
   - Create Primary Orchestrator Lambda
   - Implement Level 1 Validator
   - Set up basic version control

### Initial Testing Milestones (Days 30-60)

1. **Week 7-8: Frontend Integration**
   - Create API client library
   - Integrate with Replit frontend
   - Implement basic validation workflow
   - Test end-to-end validation flow

2. **Week 9-10: Testing and Refinement**
   - Develop comprehensive test suite
   - Set up CI/CD pipeline
   - Implement monitoring and alerting
   - Refine and optimize implementation

3. **Week 11-12: Initial Department Rollout**
   - Deploy to test environment
   - Set up with initial department
   - Gather feedback and make adjustments
   - Document lessons learned