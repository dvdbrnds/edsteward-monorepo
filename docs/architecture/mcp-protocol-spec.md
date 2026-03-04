# MCP Protocol Specification

## 1. Introduction

The Model Context Protocol (MCP) defines the standardized communication format for validating regulatory compliance data in the Compliance Tracker system. This protocol enables separation between the frontend application and backend validation services while ensuring consistent, reliable validation results.

## 2. Protocol Overview

The MCP protocol is built on JSON over HTTPS and defines:

1. **Request Format**: Structure for validation requests from frontends
2. **Response Format**: Structure for validation responses from MCPs
3. **Validation Levels**: Different intensities of validation (1-4)
4. **Versioning**: Management of regulation changes
5. **Attestation**: Certification of validation results

## 3. MCP Request Format

### 3.1 Basic Request Structure

```json
{
  "requestId": "string",
  "timestamp": "ISO8601 timestamp",
  "protocol": {
    "version": "string",
    "level": number
  },
  "client": {
    "id": "string",
    "version": "string"
  },
  "regulation": {
    "id": "string",
    "version": "string"
  },
  "data": {
    // Regulation-specific data structure
  },
  "options": {
    "attestation": boolean,
    "diff": boolean,
    "explanation": boolean
  }
}
```

### 3.2 Field Descriptions

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| requestId | Unique identifier for the request | Yes | "req-123e4567-e89b-12d3-a456-426614174000" |
| timestamp | Request creation time in ISO8601 format | Yes | "2025-04-16T14:30:00Z" |
| protocol.version | MCP protocol version | Yes | "1.0" |
| protocol.level | Validation intensity level (1-4) | Yes | 2 |
| client.id | Client identifier | Yes | "university-frontend" |
| client.version | Client version | Yes | "2.3.0" |
| regulation.id | Identifier for the regulation | Yes | "ferpa-student-records" |
| regulation.version | Version of the regulation in frontend | No | "2023-05-15" |
| data | Regulation-specific data payload | Yes | *varies by regulation* |
| options.attestation | Generate attestation certificate | No | true |
| options.diff | Include diff if regulation has changed | No | true |
| options.explanation | Include explanation of validation results | No | true |

### 3.3 Validation Levels

| Level | Name | Description | Use Case |
|-------|------|-------------|----------|
| 1 | Basic | Simple text comparison and checksums | Static regulations with rare changes |
| 2 | Standard | Pattern matching and context-aware validation | Most regulations with moderate complexity |
| 3 | Enhanced | Complex validation with cross-reference checking | High-impact regulations requiring detailed validation |
| 4 | Comprehensive | Human-assisted validation with maximum scrutiny | Critical regulations with legal/compliance significance |

## 4. MCP Response Format

### 4.1 Basic Response Structure

```json
{
  "responseId": "string",
  "requestId": "string",
  "timestamp": "ISO8601 timestamp",
  "protocol": {
    "version": "string",
    "level": number
  },
  "regulation": {
    "id": "string",
    "version": "string",
    "hasUpdate": boolean
  },
  "validation": {
    "status": "string",
    "confidence": number,
    "findings": [
      {
        "id": "string",
        "path": "string",
        "severity": "string",
        "message": "string",
        "reference": "string"
      }
    ]
  },
  "attestation": {
    // Present if requested and validation passed
  },
  "diff": {
    // Present if requested and regulation has changed
  },
  "explanation": {
    // Present if requested
  },
  "meta": {
    "processingTime": number,
    "validatorId": "string"
  }
}
```

### 4.2 Field Descriptions

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| responseId | Unique identifier for the response | Yes | "resp-123e4567-e89b-12d3-a456-426614174000" |
| requestId | Request identifier (from request) | Yes | "req-123e4567-e89b-12d3-a456-426614174000" |
| timestamp | Response creation time in ISO8601 format | Yes | "2025-04-16T14:30:05Z" |
| protocol.version | MCP protocol version | Yes | "1.0" |
| protocol.level | Validation level used | Yes | 2 |
| regulation.id | Identifier for the regulation | Yes | "ferpa-student-records" |
| regulation.version | Current authoritative version | Yes | "2023-08-22" |
| regulation.hasUpdate | Indicates if frontend version is outdated | Yes | true |
| validation.status | Overall validation result | Yes | "PASS", "FAIL", "PARTIAL" |
| validation.confidence | Confidence score (0.0-1.0) | Yes | 0.98 |
| validation.findings | Array of validation findings | Yes | *see below* |
| attestation | Attestation certificate (if requested) | No | *see section 5* |
| diff | Regulation changes (if requested and changed) | No | *see section 6* |
| explanation | Human-readable explanation | No | *see section 7* |
| meta.processingTime | Processing time in milliseconds | Yes | 450 |
| meta.validatorId | Identifier of the validator | Yes | "level2-validator-12" |

### 4.3 Validation Findings

Each finding represents a specific validation result, error, or warning:

```json
{
  "id": "string",
  "path": "string",
  "severity": "string",
  "message": "string",
  "reference": "string"
}
```

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| id | Unique identifier for the finding | Yes | "find-001" |
| path | JSON path to the relevant data | Yes | "data.studentRecords[2].disclosure" |
| severity | Severity level | Yes | "ERROR", "WARNING", "INFO" |
| message | Human-readable description | Yes | "Missing required consent documentation" |
| reference | Reference to regulation section | No | "FERPA §99.30" |

### 4.4 Status Codes

| Status | Description |
|--------|-------------|
| PASS | All validation checks passed |
| FAIL | Critical validation checks failed |
| PARTIAL | Some non-critical validation checks failed |

## 5. Attestation Format

Attestation certificates are generated when requested and validation passes:

```json
"attestation": {
  "id": "string",
  "timestamp": "ISO8601 timestamp",
  "expiresAt": "ISO8601 timestamp",
  "regulation": {
    "id": "string",
    "version": "string",
    "title": "string"
  },
  "client": {
    "id": "string",
    "name": "string"
  },
  "level": number,
  "confidence": number,
  "signature": "string",
  "verificationUrl": "string"
}
```

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| id | Unique attestation identifier | Yes | "att-123e4567-e89b-12d3-a456-426614174000" |
| timestamp | Issuance time in ISO8601 format | Yes | "2025-04-16T14:30:05Z" |
| expiresAt | Expiration time in ISO8601 format | Yes | "2025-07-16T14:30:05Z" |
| regulation.id | Regulation identifier | Yes | "ferpa-student-records" |
| regulation.version | Regulation version | Yes | "2023-08-22" |
| regulation.title | Human-readable regulation title | Yes | "FERPA Student Records Compliance" |
| client.id | Client identifier | Yes | "university-frontend" |
| client.name | Human-readable client name | Yes | "State University Compliance System" |
| level | Validation level (1-4) | Yes | 2 |
| confidence | Confidence score (0.0-1.0) | Yes | 0.98 |
| signature | Cryptographic signature of attestation | Yes | *base64 encoded signature* |
| verificationUrl | URL to verify attestation | Yes | "https://api.compliance-tracker.edu/verify/att-123..." |

## 6. Diff Format

When regulation updates are available and diffs are requested:

```json
"diff": {
  "fromVersion": "string",
  "toVersion": "string",
  "changes": [
    {
      "type": "string",
      "path": "string",
      "oldValue": "string",
      "newValue": "string",
      "description": "string"
    }
  ],
  "summary": "string",
  "effectiveDate": "ISO8601 timestamp"
}
```

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| fromVersion | Original regulation version | Yes | "2023-05-15" |
| toVersion | New regulation version | Yes | "2023-08-22" |
| changes | Array of specific changes | Yes | *see below* |
| summary | Human-readable summary of changes | Yes | "Updated disclosure requirements for digital records" |
| effectiveDate | When changes take effect | No | "2025-05-01T00:00:00Z" |

Each change includes:

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| type | Type of change | Yes | "ADDITION", "MODIFICATION", "REMOVAL" |
| path | Path to the changed element | Yes | "requirements.disclosure.digital" |
| oldValue | Previous value (if applicable) | No | "Written consent required for all disclosures" |
| newValue | New value (if applicable) | No | "Electronic consent permitted with verification" |
| description | Human-readable description | Yes | "Added option for electronic consent mechanisms" |

## 7. Explanation Format

Human-readable explanations of validation results:

```json
"explanation": {
  "summary": "string",
  "details": [
    {
      "finding": "string",
      "explanation": "string",
      "recommendation": "string"
    }
  ],
  "resources": [
    {
      "title": "string",
      "url": "string",
      "description": "string"
    }
  ]
}
```

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| summary | Overall explanation summary | Yes | "2 issues detected with student record disclosure documentation" |
| details | Array of detailed explanations | Yes | *see below* |
| resources | Helpful resources | No | *see below* |

Each detail includes:

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| finding | Finding ID reference | Yes | "find-001" |
| explanation | Detailed explanation of issue | Yes | "The system detected missing parental consent documentation for disclosure to third-party educational services" |
| recommendation | Suggested remediation | Yes | "Add documented consent from parents before sharing student data with the specified service provider" |

Each resource includes:

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| title | Resource title | Yes | "FERPA Disclosure Requirements Guide" |
| url | Resource URL | Yes | "https://compliance.education.gov/ferpa/disclosure" |
| description | Resource description | No | "Official guidance on proper documentation for FERPA disclosures" |

## 8. Protocol Versioning

The MCP protocol uses semantic versioning:

- **Major version**: Incompatible API changes
- **Minor version**: Backwards-compatible functionality additions
- **Patch version**: Backwards-compatible bug fixes

Examples: "1.0.0", "1.2.3"

Clients should specify the protocol version they're using, and servers should support multiple versions with appropriate backward compatibility.

## 9. Error Handling

### 9.1 Standard Error Format

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": [
      {
        "field": "string",
        "issue": "string"
      }
    ],
    "requestId": "string"
  }
}
```

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| error.code | Error code | Yes | "INVALID_REQUEST", "REGULATION_NOT_FOUND" |
| error.message | Human-readable error message | Yes | "The regulation specified does not exist" |
| error.details | Additional error details | No | *array of field-specific errors* |
| error.requestId | Original request ID | Yes | "req-123e4567-e89b-12d3-a456-426614174000" |

### 9.2 Common Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| INVALID_REQUEST | Malformed request | 400 |
| UNAUTHORIZED | Authentication required | 401 |
| FORBIDDEN | Not authorized for the operation | 403 |
| REGULATION_NOT_FOUND | Specified regulation not found | 404 |
| VALIDATION_FAILED | Validation system error | 422 |
| INTERNAL_ERROR | Internal server error | 500 |
| SERVICE_UNAVAILABLE | Service temporarily unavailable | 503 |

## 10. Security Considerations

### 10.1 Authentication

All MCP requests must be authenticated using one of:

1. **JWT Tokens**: Issued by the authentication service
2. **API Keys**: For service-to-service communication
3. **Client Certificates**: For high-security environments

### 10.2 Request Signing

To ensure request integrity and non-repudiation:

1. Sort all request properties alphabetically
2. Create a canonical request string
3. Sign using HMAC-SHA256 with client secret
4. Include signature in Authorization header

### 10.3 Data Protection

1. All communications must use TLS 1.2 or higher
2. Sensitive data should be encrypted at the field level
3. PII should be minimized or tokenized when possible

## 11. Implementation Guidelines

### 11.1 Client Implementation

1. **Versioning Support**: Handle protocol versioning gracefully
2. **Error Handling**: Implement proper error handling with retry logic
3. **Security**: Implement all required security measures
4. **Caching**: Cache attestations and validation results appropriately
5. **User Experience**: Provide clear feedback on validation issues

### 11.2 Validator Implementation

1. **Statelessness**: Design validators to be stateless
2. **Idempotency**: Ensure operations are idempotent
3. **Performance**: Optimize for fast response times
4. **Scalability**: Design for horizontal scaling
5. **Monitoring**: Implement comprehensive logging and metrics

## 12. Regulation-Specific Data Formats

Each regulation type has its own specific data format. This section provides examples for common regulation types.

### 12.1 FERPA Student Records Example

```json
{
  "data": {
    "studentRecords": [
      {
        "studentId": "string",
        "recordType": "string",
        "recipients": [
          {
            "name": "string",
            "purpose": "string",
            "consentDocumentation": {
              "type": "string",
              "date": "ISO8601 timestamp",
              "verificationMethod": "string",
              "documentId": "string"
            }
          }
        ]
      }
    ],
    "institutionalControls": {
      "accessControls": "string",
      "trainingProgram": {
        "name": "string",
        "lastUpdated": "ISO8601 timestamp",
        "completionRate": number
      }
    }
  }
}
```

### 12.2 HIPAA Compliance Example

```json
{
  "data": {
    "phi": [
      {
        "dataType": "string",
        "storage": {
          "method": "string",
          "encryption": "string",
          "accessControls": "string"
        },
        "transmission": {
          "method": "string",
          "encryption": "string",
          "recipientValidation": "string"
        },
        "purposes": [
          {
            "purpose": "string",
            "minimumNecessary": boolean,
            "authorization": {
              "type": "string",
              "date": "ISO8601 timestamp",
              "expirationDate": "ISO8601 timestamp",
              "documentId": "string"
            }
          }
        ]
      }
    ],
    "businessAssociates": [
      {
        "name": "string",
        "agreement": {
          "date": "ISO8601 timestamp",
          "version": "string",
          "documentId": "string",
          "securityAssessment": {
            "date": "ISO8601 timestamp",
            "findings": "string",
            "remediationStatus": "string"
          }
        }
      }
    ]
  }
}
```

## 13. Examples

### 13.1 Basic Validation Request

```json
{
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-04-16T14:30:00Z",
  "protocol": {
    "version": "1.0",
    "level": 2
  },
  "client": {
    "id": "university-frontend",
    "version": "2.3.0"
  },
  "regulation": {
    "id": "ferpa-student-records",
    "version": "2023-05-15"
  },
  "data": {
    "studentRecords": [
      {
        "studentId": "ST12345",
        "recordType": "academic",
        "recipients": [
          {
            "name": "Educational Software Provider",
            "purpose": "Online learning platform access",
            "consentDocumentation": {
              "type": "electronic",
              "date": "2025-01-15T09:45:00Z",
              "verificationMethod": "email confirmation",
              "documentId": "consent-edsp-st12345"
            }
          }
        ]
      }
    ],
    "institutionalControls": {
      "accessControls": "Role-based access with MFA",
      "trainingProgram": {
        "name": "Annual FERPA Compliance Training",
        "lastUpdated": "2024-11-10T00:00:00Z",
        "completionRate": 0.94
      }
    }
  },
  "options": {
    "attestation": true,
    "diff": true,
    "explanation": true
  }
}
```

### 13.2 Successful Validation Response

```json
{
  "responseId": "resp-abcdef12-3456-7890-abcd-ef1234567890",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-04-16T14:30:05Z",
  "protocol": {
    "version": "1.0",
    "level": 2
  },
  "regulation": {
    "id": "ferpa-student-records",
    "version": "2023-08-22",
    "hasUpdate": true
  },
  "validation": {
    "status": "PASS",
    "confidence": 0.98,
    "findings": [
      {
        "id": "find-001",
        "path": "data.institutionalControls.trainingProgram.completionRate",
        "severity": "INFO",
        "message": "Training completion rate exceeds required threshold",
        "reference": "FERPA §99.16(b)(2)"
      }
    ]
  },
  "attestation": {
    "id": "att-123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2025-04-16T14:30:05Z",
    "expiresAt": "2025-07-16T14:30:05Z",
    "regulation": {
      "id": "ferpa-student-records",
      "version": "2023-08-22",
      "title": "FERPA Student Records Compliance"
    },
    "client": {
      "id": "university-frontend",
      "name": "State University Compliance System"
    },
    "level": 2,
    "confidence": 0.98,
    "signature": "HMAC-SHA256-BASE64-SIGNATURE",
    "verificationUrl": "https://api.compliance-tracker.edu/verify/att-123e4567-e89b-12d3-a456-426614174000"
  },
  "diff": {
    "fromVersion": "2023-05-15",
    "toVersion": "2023-08-22",
    "changes": [
      {
        "type": "MODIFICATION",
        "path": "requirements.disclosure.digital.verification",
        "oldValue": "Written verification required for all digital consents",
        "newValue": "Multi-factor verification required for digital consents",
        "description": "Updated digital consent verification requirements to specify multi-factor authentication"
      },
      {
        "type": "ADDITION",
        "path": "requirements.training.refresher",
        "oldValue": null,
        "newValue": "Annual refresher training required for all staff with record access",
        "description": "Added requirement for annual refresher training"
      }
    ],
    "summary": "Enhanced digital consent verification and added annual refresher training requirements",
    "effectiveDate": "2025-01-01T00:00:00Z"
  },
  "explanation": {
    "summary": "Your compliance data passes validation with high confidence. There are regulatory updates available that will become effective on January 1, 2025.",
    "details": [
      {
        "finding": "find-001",
        "explanation": "Your training completion rate of 94% exceeds the required 90% threshold for institutional compliance.",
        "recommendation": "Continue maintaining high training completion rates and prepare for the upcoming refresher training requirement."
      }
    ],
    "resources": [
      {
        "title": "Updated FERPA Digital Consent Guidelines",
        "url": "https://compliance.education.gov/ferpa/digital-consent-2023",
        "description": "Official guidance on the new multi-factor verification requirements for digital consent"
      },
      {
        "title": "FERPA Training Requirement Changes",
        "url": "https://compliance.education.gov/ferpa/training-requirements-2023",
        "description": "Details on the new annual refresher training requirements effective January 2025"
      }
    ]
  },
  "meta": {
    "processingTime": 450,
    "validatorId": "level2-validator-12"
  }
}
```

### 13.3 Failed Validation Response

```json
{
  "responseId": "resp-fedbca98-7654-3210-fedc-ba9876543210",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-04-16T14:30:05Z",
  "protocol": {
    "version": "1.0",
    "level": 2
  },
  "regulation": {
    "id": "ferpa-student-records",
    "version": "2023-08-22",
    "hasUpdate": true
  },
  "validation": {
    "status": "FAIL",
    "confidence": 0.95,
    "findings": [
      {
        "id": "find-002",
        "path": "data.studentRecords[0].recipients[0].consentDocumentation.verificationMethod",
        "severity": "ERROR",
        "message": "Email confirmation alone does not meet multi-factor verification requirement",
        "reference": "FERPA §99.30(d)(4)"
      }
    ]
  },
  "explanation": {
    "summary": "Validation failed due to insufficient verification method for digital consent.",
    "details": [
      {
        "finding": "find-002",
        "explanation": "The current regulation requires multi-factor verification for digital consent. Email confirmation alone is insufficient to meet this requirement.",
        "recommendation": "Implement a second verification factor (e.g., SMS, authenticator app) for digital consent collection."
      }
    ],
    "resources": [
      {
        "title": "FERPA Digital Consent Verification Guide",
        "url": "https://compliance.education.gov/ferpa/digital-consent-verification",
        "description": "Detailed guidance on acceptable multi-factor verification methods for digital consent"
      }
    ]
  },
  "diff": {
    "fromVersion": "2023-05-15",
    "toVersion": "2023-08-22",
    "changes": [
      {
        "type": "MODIFICATION",
        "path": "requirements.disclosure.digital.verification",
        "oldValue": "Written verification required for all digital consents",
        "newValue": "Multi-factor verification required for digital consents",
        "description": "Updated digital consent verification requirements to specify multi-factor authentication"
      }
    ],
    "summary": "Enhanced verification requirements for digital consent collection",
    "effectiveDate": "2025-01-01T00:00:00Z"
  },
  "meta": {
    "processingTime": 420,
    "validatorId": "level2-validator-12"
  }
}
```

## 14. Regulation-Specific MCP Extensions

The base MCP protocol can be extended for specific regulatory domains. Extensions must follow these guidelines:

1. Use the standard request/response format
2. Extend only the `data` object with regulation-specific structures
3. Document extensions thoroughly
4. Maintain backward compatibility

Extensions are identified by the `regulation.id` field and should be registered in the MCP registry.
