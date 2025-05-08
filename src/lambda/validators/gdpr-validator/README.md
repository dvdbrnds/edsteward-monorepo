# GDPR MCP Validator

A specialized MCP (Model Context Protocol) server that validates GDPR regulation compliance.

## Overview

This MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-03-26) for validating GDPR regulations at different intensity levels:

- **Level A**: Web scrape validation for basic text comparison
- **Level B**: API validation using official regulation sources
- **Level C**: AI-assisted validation for complex pattern matching
- **Level D**: Flag for human intervention when necessary

## Architecture

This validator follows MCP standards and operates as a serverless Lambda function for stateless, scalable validation. It can be called directly via API Gateway or invoked by an orchestrator.

## Validation Process

1. Receives regulation text to validate from an external orchestrator
2. Determines the appropriate validation level (A, B, C, or D)
3. Compares the text against authoritative sources
4. Generates detailed diffs when discrepancies are found
5. Assigns confidence levels to validation results
6. Returns standardized MCP-compliant response

## Deployment

```bash
# Install dependencies
npm install

# Deploy to AWS
npm run deploy

# Deploy to a specific stage
npm run deploy -- --stage prod

# View logs
npm run logs
```

## API

### MCP Endpoints

#### `initialize`

Initializes the MCP server connection and returns capabilities.

#### `validateRegulation`

Validates a regulation against authoritative sources.

**Parameters:**
- `regulationText`: The text of the regulation to validate
- `regulationId`: Identifier of the regulation
- `regulationVersion`: Version of the regulation
- `validationLevel`: Level of validation to perform (web_scrape, api, ai, human)

**Response:**
```json
{
  "validationId": "uuid",
  "regulationId": "GDPR",
  "regulationVersion": "2016",
  "valid": true,
  "confidenceLevel": "high",
  "validationLevel": "api",
  "message": "Regulation text matches authoritative source",
  "needsHumanReview": false,
  "duration": 1245,
  "timestamp": "2023-06-01T12:34:56Z",
  "discrepancies": {
    "diff": { ... },
    "summary": "Human-readable explanation of differences"
  }
}
```

#### `getValidationStatus`

Retrieves the status of a validation operation.

**Parameters:**
- `validationId`: ID of the validation operation

## Integration

This validator can be integrated into an MCP orchestration system as one of many regulation-specific validators. The orchestrator can route regulation validation requests to the appropriate specialized validator based on regulation type.

## Error Handling

The validator implements comprehensive error handling and logging:

- Network errors during validation
- Invalid regulation text
- Missing authoritative sources
- Internal validation errors

All errors are logged to CloudWatch and returned in MCP-compliant error format.