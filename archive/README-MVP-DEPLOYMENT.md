# MCP Engine MVP Deployment Guide

## Overview

This is the **Minimum Viable Product (MVP)** deployment of the MCP Engine to satisfy patent claims with the absolute minimum infrastructure:

- ✅ **ONE working Lambda validator** (Level 1 - Basic Text Validation)
- ✅ **Basic Orchestrator** (Routes all requests to Level 1)
- ✅ **API Gateway endpoint** (MCP protocol compliant)
- ✅ **Health check endpoint**

## Quick Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js 18+** installed
3. **Serverless Framework** (will be installed automatically)

### Deploy

```bash
# Deploy to dev environment (default)
./deploy-mvp.sh

# Deploy to production
./deploy-mvp.sh prod us-east-1
```

### Test

```bash
# Test the deployed endpoints
node test-mcp-endpoint.js
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│   Orchestrator  │───▶│ Level 1 Validator│
│   /mcp/validate │    │     Lambda      │    │     Lambda      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    MCP Protocol            Route ALL to L1         Text Pattern
    Request/Response        (MVP Simplification)     Matching Only
```

## MCP Protocol Implementation

### Request Format
```json
{
  "requestId": "req-1728567890123-abc123def",
  "timestamp": "2025-10-10T15:00:00.000Z",
  "protocol": {
    "version": "1.0",
    "level": "BASIC"
  },
  "client": {
    "id": "client-id",
    "version": "1.0.0"
  },
  "regulation": {
    "id": "reg-66",
    "name": "TEACH Act Section 110",
    "version": "2023-01-01"
  },
  "data": "Institution policy document text...",
  "options": {
    "attestation": false,
    "diff": false,
    "explanation": true
  }
}
```

### Response Format
```json
{
  "responseId": "res-1728567890456-def456ghi",
  "requestId": "req-1728567890123-abc123def",
  "timestamp": "2025-10-10T15:00:01.000Z",
  "protocol": {
    "version": "1.0",
    "level": "BASIC"
  },
  "regulation": {
    "id": "reg-66",
    "version": "2023-01-01",
    "hasUpdate": false
  },
  "validation": {
    "status": "PASS|FAIL|ERROR|PENDING|PARTIAL",
    "confidence": 0.95,
    "findings": [
      {
        "id": "TEACH_110_2_A",
        "path": "compliance_document",
        "severity": "ERROR",
        "message": "Institution must be accredited nonprofit educational institution",
        "reference": "17 U.S.C. § 110(2)(A)"
      }
    ]
  },
  "meta": {
    "processingTime": 150,
    "validatorId": "level1-validator-v1.0"
  }
}
```

## Supported Regulations (Level 1)

### TEACH Act (REG-66)
- ✅ **11 validation requirements** from 17 U.S.C. § 110(2)
- ✅ **Institutional eligibility** checks
- ✅ **Copyright policy** requirements
- ✅ **Technological measures** validation
- ✅ **Student enrollment** verification

### GDPR (Basic)
- ✅ **Lawful basis** validation (Article 6)
- ✅ **Transparency** requirements (Articles 13-14)
- ✅ **Security measures** (Article 32)

### Generic Compliance
- ✅ **Policy requirements** for unknown regulations
- ✅ **Training requirements** validation

## Endpoints

After deployment, you'll get:

- **Validation**: `https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/mcp/validate`
- **Health**: `https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/health`

## EdSteward Integration

### Configuration
Send regulation data to the validation endpoint:

```bash
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/mcp/validate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-123",
    "protocol": { "version": "1.0", "level": "BASIC" },
    "client": { "id": "edsteward", "version": "1.0" },
    "regulation": { "id": "reg-66", "version": "2023-01-01" },
    "data": "Your institution policy document...",
    "options": {}
  }'
```

### Expected Response
- **PASS**: Institution meets TEACH Act requirements
- **FAIL**: Specific violations found with references
- **ERROR**: System error during validation

## Monitoring

### CloudWatch Logs
```bash
# Orchestrator logs
serverless logs -f orchestrator --config serverless-mvp.yml --stage dev

# Level 1 validator logs  
serverless logs -f level1-validator --config serverless-mvp.yml --stage dev
```

### Health Monitoring
```bash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/health
```

## Scaling (Future)

This MVP can be extended by:

1. **Adding Level 2-4 validators** (semantic, workflow, human review)
2. **Implementing regulation classification** (automatic routing)
3. **Adding database persistence** (validation history)
4. **Implementing caching** (Redis/ElastiCache)
5. **Adding authentication** (API keys, JWT)

## Cost Estimate

**Monthly cost for light usage** (~1000 validations/month):
- Lambda executions: ~$0.20
- API Gateway requests: ~$3.50
- CloudWatch logs: ~$0.50
- **Total: ~$4.20/month**

## Troubleshooting

### Common Issues

1. **Deployment fails**: Check AWS credentials and permissions
2. **Endpoints not responding**: Wait 2-3 minutes after deployment
3. **Validation errors**: Check CloudWatch logs for details

### Support

- Check CloudWatch logs for detailed error messages
- Use `serverless info` to verify deployment status
- Test with the provided test script

## Patent Claims Satisfied

✅ **Model Context Protocol implementation**
✅ **Multi-level validation framework** (Level 1 operational)
✅ **Request orchestration and routing**
✅ **Standardized validation responses**
✅ **Regulation-specific validation logic**
✅ **Confidence scoring and findings**
✅ **API endpoint for external integration**

This MVP deployment satisfies the core patent claims with a working, testable MCP validation system.
