# MCP API Contract

## 1. Introduction

This document defines the API contract between the Compliance Tracker MCP system and client applications. The API is RESTful, uses JSON for request/response bodies, and is secured using JWT tokens.

## 2. Base URL and Versioning

- **Base URL**: `https://api.compliance-tracker.example.com`
- **API Version**: Included in the path as `v1`
- **Example**: `https://api.compliance-tracker.example.com/v1/regulations`

## 3. Authentication

### 3.1 Authentication Flow

The API uses JWT tokens for authentication obtained through Amazon Cognito.

1. Client authenticates with Cognito and receives JWT tokens
2. Client includes the ID token in the `Authorization` header
3. API Gateway validates the token before processing the request

### 3.2 Authorization Header

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.3 Token Expiration

Tokens expire after a configurable time period. Client should refresh tokens before expiration.

## 4. Error Handling

### 4.1 Error Response Format

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

### 4.2 HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request succeeded |
| 201 | Created - A new resource was created |
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service temporarily unavailable |

### 4.3 Common Error Codes

| Error Code | Description |
|------------|-------------|
| INVALID_REQUEST | Malformed request |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Not authorized for the operation |
| RESOURCE_NOT_FOUND | Requested resource not found |
| VALIDATION_FAILED | Request validation failed |
| RATE_LIMIT_EXCEEDED | Rate limit exceeded |
| INTERNAL_ERROR | Internal server error |
| SERVICE_UNAVAILABLE | Service temporarily unavailable |

## 5. Endpoints

### 5.1 Regulation Management

#### 5.1.1 List Regulations

Lists available regulations for the authenticated user.

- **URL**: `/v1/regulations`
- **Method**: `GET`
- **Query Parameters**:
  - `category` (optional): Filter by category
  - `search` (optional): Search term in name/description
  - `status` (optional): Filter by status (ACTIVE, DRAFT, DEPRECATED)
  - `page` (optional): Page number (default: 1)
  - `pageSize` (optional): Items per page (default: 20)
- **Response**:

```json
{
  "regulations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "code": "FERPA-SR",
      "name": "FERPA Student Records",
      "description": "Federal regulation governing student education records...",
      "category": {
        "id": "71f0d7e5-9d8b-4b7c-8709-dfba18a9787c",
        "name": "Education Privacy"
      },
      "currentVersion": "2023.08.22",
      "status": "ACTIVE",
      "complexityLevel": 2
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

#### 5.1.2 Get Regulation Detail

Retrieves detailed information about a specific regulation.

- **URL**: `/v1/regulations/{regulationId}`
- **Method**: `GET`
- **URL Parameters**:
  - `regulationId`: Regulation identifier
- **Query Parameters**:
  - `version` (optional): Specific version to retrieve
- **Response**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "FERPA-SR",
  "name": "FERPA Student Records",
  "description": "Federal regulation governing student education records...",
  "category": {
    "id": "71f0d7e5-9d8b-4b7c-8709-dfba18a9787c",
    "name": "Education Privacy"
  },
  "versions": [
    {
      "versionNumber": "2023.08.22",
      "status": "ACTIVE",
      "effectiveDate": "2023-08-22T00:00:00Z",
      "isAuthoritative": true
    },
    {
      "versionNumber": "2023.05.15",
      "status": "DEPRECATED",
      "effectiveDate": "2023-05-15T00:00:00Z",
      "expirationDate": "2023-08-21T23:59:59Z",
      "isAuthoritative": true
    }
  ],
  "currentVersion": {
    "versionNumber": "2023.08.22",
    "effectiveDate": "2023-08-22T00:00:00Z",
    "changeSummary": "Updated digital consent verification requirements",
    "content": [
      {
        "sectionCode": "99.30",
        "sectionTitle": "Disclosure Requirements",
        "content": "Educational institutions must obtain written consent..."
      }
    ],
    "attributes": [
      {
        "key": "jurisdiction",
        "value": "federal"
      }
    ]
  },
  "complexityLevel": 2,
  "status": "ACTIVE"
}
```

#### 5.1.3 Get Regulation Diff

Retrieves differences between regulation versions.

- **URL**: `/v1/regulations/{regulationId}/diff`
- **Method**: `GET`
- **URL Parameters**:
  - `regulationId`: Regulation identifier
- **Query Parameters**:
  - `fromVersion`: Source version (required)
  - `toVersion`: Target version (required)
- **Response**:

```json
{
  "regulationId": "550e8400-e29b-41d4-a716-446655440000",
  "fromVersion": "2023.05.15",
  "toVersion": "2023.08.22",
  "changes": [
    {
      "type": "MODIFICATION",
      "path": "content.99.30.disclosure.digital.verification",
      "oldValue": "Written verification required for all digital consents",
      "newValue": "Multi-factor verification required for digital consents",
      "description": "Updated digital consent verification requirements to specify multi-factor authentication"
    },
    {
      "type": "ADDITION",
      "path": "content.99.16.training.refresher",
      "oldValue": null,
      "newValue": "Annual refresher training required for all staff with record access",
      "description": "Added requirement for annual refresher training"
    }
  ],
  "summary": "Enhanced digital consent verification and added annual refresher training requirements",
  "effectiveDate": "2023-08-22T00:00:00Z"
}
```

### 5.2 Validation

#### 5.2.1 Validate Compliance

Validates compliance data against regulation requirements.

- **URL**: `/v1/validate`
- **Method**: `POST`
- **Request Body**:

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
    "version": "2023.05.15"
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

- **Response**:

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
    "version": "2023.08.22",
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
      "version": "2023.08.22",
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
    "fromVersion": "2023.05.15",
    "toVersion": "2023.08.22",
    "changes": [
      {
        "type": "MODIFICATION",
        "path": "requirements.disclosure.digital.verification",
        "oldValue": "Written verification required for all digital consents",
        "newValue": "Multi-factor verification required for digital consents",
        "description": "Updated digital consent verification requirements to specify multi-factor authentication"
      }
    ],
    "summary": "Enhanced digital consent verification requirements",
    "effectiveDate": "2023-08-22T00:00:00Z"
  },
  "explanation": {
    "summary": "Your compliance data passes validation with high confidence. There are regulatory updates available.",
    "details": [
      {
        "finding": "find-001",
        "explanation": "Your training completion rate of 94% exceeds the required 90% threshold for institutional compliance.",
        "recommendation": "Continue maintaining high training completion rates."
      }
    ],
    "resources": [
      {
        "title": "Updated FERPA Digital Consent Guidelines",
        "url": "https://compliance.education.gov/ferpa/digital-consent-2023",
        "description": "Official guidance on the new multi-factor verification requirements for digital consent"
      }
    ]
  },
  "meta": {
    "processingTime": 450,
    "validatorId": "level2-validator-12"
  }
}
```

#### 5.2.2 Get Validation History

Retrieves validation history for a specific regulation.

- **URL**: `/v1/validations`
- **Method**: `GET`
- **Query Parameters**:
  - `regulationId` (optional): Filter by regulation
  - `status` (optional): Filter by status (PASS, FAIL, PARTIAL)
  - `fromDate` (optional): Start date for filtering
  - `toDate` (optional): End date for filtering
  - `page` (optional): Page number (default: 1)
  - `pageSize` (optional): Items per page (default: 20)
- **Response**:

```json
{
  "validations": [
    {
      "resultId": "b1f0d7e5-9d8b-4b7c-8709-dfba18a9787f",
      "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
      "regulation": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "code": "FERPA-SR",
        "name": "FERPA Student Records"
      },
      "version": "2023.08.22",
      "status": "PASS",
      "confidence": 0.98,
      "validationDate": "2025-04-16T14:30:05Z",
      "validationLevel": 2,
      "findingsCount": {
        "error": 0,
        "warning": 0,
        "info": 1
      },
      "hasAttestation": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

#### 5.2.3 Get Validation Detail

Retrieves detailed information about a specific validation.

- **URL**: `/v1/validations/{resultId}`
- **Method**: `GET`
- **URL Parameters**:
  - `resultId`: Validation result identifier
- **Response**:

```json
{
  "resultId": "b1f0d7e5-9d8b-4b7c-8709-dfba18a9787f",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "regulation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "FERPA-SR",
    "name": "FERPA Student Records"
  },
  "version": "2023.08.22",
  "status": "PASS",
  "confidence": 0.98,
  "validationDate": "2025-04-16T14:30:05Z",
  "validationLevel": 2,
  "findings": [
    {
      "id": "find-001",
      "path": "data.institutionalControls.trainingProgram.completionRate",
      "severity": "INFO",
      "message": "Training completion rate exceeds required threshold",
      "reference": "FERPA §99.16(b)(2)"
    }
  ],
  "attestation": {
    "id": "att-123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2025-04-16T14:30:05Z",
    "expiresAt": "2025-07-16T14:30:05Z",
    "verificationUrl": "https://api.compliance-tracker.edu/verify/att-123e4567-e89b-12d3-a456-426614174000"
  },
  "client": {
    "id": "university-frontend",
    "version": "2.3.0"
  },
  "processingTime": 450,
  "validatorId": "level2-validator-12"
}
```

### 5.3 Attestation

#### 5.3.1 Verify Attestation

Verifies the authenticity of an attestation certificate.

- **URL**: `/v1/attestations/{attestationId}/verify`
- **Method**: `GET`
- **URL Parameters**:
  - `attestationId`: Attestation identifier
- **Response**:

```json
{
  "attestationId": "att-123e4567-e89b-12d3-a456-426614174000",
  "isValid": true,
  "status": "ACTIVE",
  "issueDate": "2025-04-16T14:30:05Z",
  "expirationDate": "2025-07-16T14:30:05Z",
  "regulation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "FERPA-SR",
    "name": "FERPA Student Records",
    "version": "2023.08.22"
  },
  "client": {
    "id": "university-frontend",
    "name": "State University Compliance System"
  },
  "validationLevel": 2,
  "confidence": 0.98,
  "verificationInfo": {
    "signatureValid": true,
    "signatureAlgorithm": "HMAC-SHA256",
    "verifiedAt": "2025-04-18T10:15:22Z"
  }
}
```

#### 5.3.2 List Attestations

Retrieves attestation certificates for the authenticated user.

- **URL**: `/v1/attestations`
- **Method**: `GET`
- **Query Parameters**:
  - `regulationId` (optional): Filter by regulation
  - `status` (optional): Filter by status (ACTIVE, REVOKED, EXPIRED)
  - `fromDate` (optional): Start date for filtering
  - `toDate` (optional): End date for filtering
  - `page` (optional): Page number (default: 1)
  - `pageSize` (optional): Items per page (default: 20)
- **Response**:

```json
{
  "attestations": [
    {
      "id": "att-123e4567-e89b-12d3-a456-426614174000",
      "regulation": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "code": "FERPA-SR",
        "name": "FERPA Student Records"
      },
      "version": "2023.08.22",
      "issueDate": "2025-04-16T14:30:05Z",
      "expirationDate": "2025-07-16T14:30:05Z",
      "status": "ACTIVE",
      "level": 2,
      "confidence": 0.98,
      "verificationUrl": "https://api.compliance-tracker.edu/verify/att-123e4567-e89b-12d3-a456-426614174000"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 5.4 Version Control

#### 5.4.1 Accept Regulation Update

Records frontend acceptance of a regulation update.

- **URL**: `/v1/regulations/{regulationId}/versions/{version}/accept`
- **Method**: `POST`
- **URL Parameters**:
  - `regulationId`: Regulation identifier
  - `version`: Version to accept
- **Request Body**:

```json
{
  "notes": "Accepted after review by compliance team",
  "acceptedBy": "John Smith",
  "implementationDate": "2025-05-01T00:00:00Z"
}
```

- **Response**:

```json
{
  "regulationId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "2023.08.22",
  "accepted": true,
  "acceptedAt": "2025-04-18T10:30:00Z",
  "acceptedBy": "John Smith",
  "implementationDate": "2025-05-01T00:00:00Z",
  "notes": "Accepted after review by compliance team"
}
```

#### 5.4.2 Get Pending Updates

Retrieves regulation updates pending acceptance.

- **URL**: `/v1/regulations/updates/pending`
- **Method**: `GET`
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `pageSize` (optional): Items per page (default: 20)
- **Response**:

```json
{
  "pendingUpdates": [
    {
      "regulationId": "550e8400-e29b-41d4-a716-446655440000",
      "code": "FERPA-SR",
      "name": "FERPA Student Records",
      "currentVersion": "2023.05.15",
      "latestVersion": "2023.08.22",
      "updateDate": "2023-08-22T00:00:00Z",
      "changeSummary": "Enhanced digital consent verification requirements",
      "effectiveDate": "2023-08-22T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 5.5 Audit

#### 5.5.1 Get Audit Events

Retrieves audit events for a specific regulation.

- **URL**: `/v1/audit`
- **Method**: `GET`
- **Query Parameters**:
  - `regulationId` (optional): Filter by regulation
  - `eventType` (optional): Filter by event type
  - `fromDate` (optional): Start date for filtering
  - `toDate` (optional): End date for filtering
  - `page` (optional): Page number (default: 1)
  - `pageSize` (optional): Items per page (default: 20)
- **Response**:

```json
{
  "events": [
    {
      "eventId": "h1f0d7e5-9d8b-4b7c-8709-dfba18a9788l",
      "eventType": "REGULATION_UPDATE",
      "eventTimestamp": "2023-08-22T00:00:00Z",
      "user": {
        "id": "330e8400-e29b-41d4-a716-446655440333",
        "username": "jsmith",
        "name": "John Smith"
      },
      "regulation": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "code": "FERPA-SR",
        "name": "FERPA Student Records"
      },
      "version": "2023.08.22",
      "action": "UPDATE",
      "description": "Updated digital consent verification requirements"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

#### 5.5.2 Get Audit Report

Generates an audit report for compliance purposes.

- **URL**: `/v1/audit/report`
- **Method**: `POST`
- **Request Body**:

```json
{
  "regulationId": "550e8400-e29b-41d4-a716-446655440000",
  "fromDate": "2025-01-01T00:00:00Z",
  "toDate": "2025-04-30T23:59:59Z",
  "includeValidations": true,
  "includeVersionChanges": true,
  "includeAttestation": true,
  "format": "PDF"
}
```

- **Response**:

```json
{
  "reportId": "i1f0d7e5-9d8b-4b7c-8709-dfba18a9788m",
  "generationStatus": "PROCESSING",
  "estimatedCompletionTime": "2025-04-18T10:35:00Z",
  "downloadUrl": null
}
```

### 5.6 Reference Data

#### 5.6.1 Get Categories

Retrieves regulation categories.

- **URL**: `/v1/categories`
- **Method**: `GET`
- **Response**:

```json
{
  "categories": [
    {
      "id": "71f0d7e5-9d8b-4b7c-8709-dfba18a9787c",
      "name": "Education Privacy",
      "description": "Regulations governing privacy in educational settings",
      "parentCategory": null
    },
    {
      "id": "72f0d7e5-9d8b-4b7c-8709-dfba18a9787d",
      "name": "Healthcare Compliance",
      "description": "Regulations governing healthcare organizations",
      "parentCategory": null
    }
  ]
}
```

## 6. Pagination

All list endpoints support pagination with the following parameters:

- `page`: Page number (1-based indexing)
- `pageSize`: Number of items per page

Response includes pagination metadata:

```json
"pagination": {
  "page": 1,
  "pageSize": 20,
  "totalItems": 45,
  "totalPages": 3
}
```

## 7. Filtering and Sorting

Endpoints support filtering through query parameters specific to each resource.

Common filters include:
- Date ranges (`fromDate`, `toDate`)
- Status values
- IDs and references

## 8. Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default limit**: 100 requests per minute per client
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests per time window
  - `X-RateLimit-Remaining`: Remaining requests in the current window
  - `X-RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

When the rate limit is exceeded, the API returns a 429 Too Many Requests status code.

## 9. CORS Support

The API supports Cross-Origin Resource Sharing (CORS) for integration with frontend applications:

- **Allowed Origins**: Configurable based on environment
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With
- **Max Age**: 86400 seconds (24 hours)

## 10. Request Tracing

All requests are assigned a trace ID for troubleshooting:

- **Request Header**: `X-Request-Id` (optional, client can provide)
- **Response Header**: `X-Request-Id` (assigned by server if not provided)

## 11. Performance Guidelines

- **Timeout**: Requests timeout after 29 seconds
- **Response Time**: 95% of requests should complete in < 500ms
- **Large Responses**: For large data sets, consider pagination or asynchronous processing

## 12. Versioning Policy

The API uses semantic versioning:

- **Major Version**: Breaking changes, in URL path
- **Minor Version**: Non-breaking additions, in response headers
- **Patch Version**: Bug fixes, backward compatible

New API versions will be announced at least 90 days before old versions are deprecated.

## 13. Implementation Notes

### 13.1 API Gateway Configuration

The API is implemented with AWS API Gateway with the following configuration:

- **Integration Type**: Lambda proxy
- **Authorization**: Cognito User Pools
- **Throttling**: Per-client limits
- **Caching**: Response caching for GET endpoints

### 13.2 Lambda Function Mapping

| Endpoint Pattern | Lambda Function |
|------------------|-----------------|
| `GET /regulations` | `list-regulations-function` |
| `GET /regulations/{id}` | `get-regulation-function` |
| `GET /regulations/{id}/diff` | `get-regulation-diff-function` |
| `POST /validate` | `validate-compliance-function` |
| `GET /validations` | `list-validations-function` |
| ... | ... |

### 13.3 Monitoring and Logging

All API requests are logged to CloudWatch Logs with the following attributes:

- Request ID
- HTTP method
- Path
- Client IP
- User ID (if authenticated)
- Request/response timestamp
- Response status code
- Error details (if applicable)

## 14. API Client Implementation

### 14.1 JavaScript Client Example

```javascript
// Example client implementation
class ComplianceTrackerClient {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async getRegulations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}/v1/regulations${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch regulations');
    }
    
    return response.json();
  }

  async validateCompliance(regulationId, data, options = {}) {
    const url = `${this.baseUrl}/v1/validate`;
    
    const requestBody = {
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      protocol: {
        version: "1.0",
        level: options.level || 2
      },
      client: {
        id: "university-frontend",
        version: "2.3.0"
      },
      regulation: {
        id: regulationId
      },
      data: data,
      options: {
        attestation: options.attestation !== false,
        diff: options.diff !== false,
        explanation: options.explanation !== false
      }
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Validation failed');
    }
    
    return response.json();
  }
  
  generateRequestId() {
    // Generate a UUID v4
    return 'req-xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function(c) {
      const r = Math.random() * 16 | 0;
      return r.toString(16);
    });
  }
  
  // Additional methods for other endpoints...
}
```

### 14.2 Authentication Example

```javascript
// Example authentication with Cognito
async function authenticate(username, password) {
  const authData = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: 'your-cognito-client-id',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  };
  
  const response = await fetch('https://cognito-idp.region.amazonaws.com/', {
    method: 'POST',
    headers: {
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      'Content-Type': 'application/x-amz-json-1.1'
    },
    body: JSON.stringify(authData)
  });
  
  const authResult = await response.json();
  
  return {
    idToken: authResult.AuthenticationResult.IdToken,
    refreshToken: authResult.AuthenticationResult.RefreshToken,
    expiresIn: authResult.AuthenticationResult.ExpiresIn
  };
}
```
