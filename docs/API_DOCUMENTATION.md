# MCP Engine API Documentation

## Overview

The MCP Engine provides a RESTful API for compliance management, regulation processing, and LLM-powered analysis. All endpoints are prefixed with `/api/llm` and return JSON responses.

## Base URLs

- **Local Development**: `http://localhost:3002/api/llm`
- **Docker**: `http://localhost:3002/api/llm`
- **Production**: `https://api.mcp-engine.com/api/llm`

## Authentication

### API Key Authentication
```http
Authorization: Bearer your-api-key
```

### JWT Authentication
```http
Authorization: Bearer your-jwt-token
```

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {}
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## Core Endpoints

### Health & Status

#### Get Health Status
```http
GET /api/llm/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "llmService": {
        "status": "healthy",
        "available": true,
        "lastCheck": "2024-01-15T10:30:00Z"
      },
      "cacheService": {
        "status": "healthy",
        "type": "redis",
        "connected": true
      },
      "regulationService": {
        "status": "healthy",
        "regulationsLoaded": 1042
      }
    },
    "uptime": 3600,
    "version": "5.0.0"
  }
}
```

#### Get System Statistics
```http
GET /api/llm/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 15420,
      "successful": 14890,
      "failed": 530
    },
    "cache": {
      "hits": 8920,
      "misses": 2340,
      "hitRate": 0.792
    },
    "regulations": {
      "total": 1042,
      "indexed": 1042
    }
  }
}
```

### Compliance Queries

#### Process Compliance Query
```http
POST /api/llm/query
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "What are FERPA requirements for student data protection?",
  "options": {
    "temperature": 0.3,
    "maxTokens": 1000,
    "includeReferences": true,
    "searchDepth": "comprehensive"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "What are FERPA requirements for student data protection?",
    "response": {
      "answer": "FERPA (Family Educational Rights and Privacy Act) requires...",
      "confidence": 0.92,
      "relevantRegulations": [
        {
          "id": "FERPA-001",
          "title": "Student Privacy Rights",
          "section": "§ 99.3",
          "relevance": 0.95
        }
      ],
      "sources": ["20 USC 1232g", "34 CFR Part 99"]
    },
    "metadata": {
      "processingTime": 1.2,
      "tokensUsed": 450,
      "cacheHit": false
    }
  }
}
```

### Regulation Management

#### List All Regulations
```http
GET /api/llm/regulations
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 50, max: 1000)
- `category` (string): Filter by category
- `status` (string): Filter by status (active, draft, archived)

**Response:**
```json
{
  "success": true,
  "data": {
    "regulations": [
      {
        "id": "REG-001",
        "title": "Student Privacy Protection",
        "category": "Education",
        "status": "active",
        "version": "1.2",
        "lastUpdated": "2024-01-10T15:30:00Z",
        "summary": "Regulations governing student data privacy..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1042,
      "pages": 21
    }
  }
}
```

#### Search Regulations
```http
GET /api/llm/regulations/search
```

**Query Parameters:**
- `q` (string, required): Search query
- `category` (string): Filter by category
- `limit` (integer): Max results (default: 20)
- `fuzzy` (boolean): Enable fuzzy search (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "student data privacy",
    "results": [
      {
        "id": "REG-001",
        "title": "Student Privacy Protection",
        "score": 0.95,
        "highlights": ["student data", "privacy protection"],
        "category": "Education"
      }
    ],
    "totalResults": 15,
    "searchTime": 0.045
  }
}
```

#### Get Regulation by ID
```http
GET /api/llm/regulations/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "REG-001",
    "title": "Student Privacy Protection",
    "content": "Full regulation text...",
    "category": "Education",
    "status": "active",
    "version": "1.2",
    "metadata": {
      "created": "2023-06-15T10:00:00Z",
      "lastUpdated": "2024-01-10T15:30:00Z",
      "author": "Compliance Team",
      "tags": ["privacy", "education", "FERPA"]
    },
    "references": [
      {
        "type": "law",
        "citation": "20 USC 1232g",
        "url": "https://www.law.cornell.edu/uscode/text/20/1232g"
      }
    ]
  }
}
```

#### Create New Regulation
```http
POST /api/llm/regulations
Content-Type: application/json
Authorization: Bearer your-api-key
```

**Request Body:**
```json
{
  "title": "New Privacy Regulation",
  "content": "Detailed regulation content...",
  "category": "Privacy",
  "status": "draft",
  "metadata": {
    "author": "Legal Team",
    "tags": ["privacy", "data protection"]
  },
  "references": [
    {
      "type": "law",
      "citation": "GDPR Article 6",
      "url": "https://gdpr-info.eu/art-6-gdpr/"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "REG-1043",
    "title": "New Privacy Regulation",
    "status": "draft",
    "version": "1.0",
    "created": "2024-01-15T10:30:00Z"
  },
  "message": "Regulation created successfully"
}
```

#### Update Regulation
```http
PUT /api/llm/regulations/:id
Content-Type: application/json
Authorization: Bearer your-api-key
```

**Request Body:** (Same as create, all fields optional)

#### Delete Regulation
```http
DELETE /api/llm/regulations/:id
Authorization: Bearer your-api-key
```

### Bulk Operations

#### Bulk Create Regulations
```http
POST /api/llm/regulations/bulk
Content-Type: application/json
Authorization: Bearer your-api-key
```

**Request Body:**
```json
{
  "regulations": [
    {
      "title": "Regulation 1",
      "content": "Content 1...",
      "category": "Privacy"
    },
    {
      "title": "Regulation 2", 
      "content": "Content 2...",
      "category": "Security"
    }
  ]
}
```

#### Bulk Update Regulations
```http
PUT /api/llm/regulations/bulk
Content-Type: application/json
Authorization: Bearer your-api-key
```

### Monitoring & Metrics

#### Get Prometheus Metrics
```http
GET /api/llm/metrics
```

**Response:** (Prometheus format)
```
# HELP mcp_requests_total Total number of requests
# TYPE mcp_requests_total counter
mcp_requests_total{method="GET",endpoint="/health"} 1542

# HELP mcp_cache_hits_total Total cache hits
# TYPE mcp_cache_hits_total counter
mcp_cache_hits_total 8920
```

#### Get Detailed Metrics
```http
GET /api/llm/metrics/detailed
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 15420,
      "byEndpoint": {
        "/health": 3240,
        "/query": 8920,
        "/regulations": 3260
      },
      "byMethod": {
        "GET": 12180,
        "POST": 2890,
        "PUT": 250,
        "DELETE": 100
      }
    },
    "performance": {
      "averageResponseTime": 245,
      "p95ResponseTime": 890,
      "p99ResponseTime": 1540
    },
    "errors": {
      "total": 530,
      "byType": {
        "validation": 320,
        "authentication": 120,
        "server": 90
      }
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limiting

- **Default Limit**: 100 requests per minute per API key
- **Burst Limit**: 20 requests per second
- **Headers**: 
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Webhooks

### Regulation Updates
```http
POST /api/llm/webhooks/regulations
Content-Type: application/json
```

**Payload:**
```json
{
  "event": "regulation.updated",
  "data": {
    "id": "REG-001",
    "title": "Updated Regulation",
    "version": "1.3",
    "changes": ["content", "metadata"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const MCPClient = require('@mcp-engine/client');

const client = new MCPClient({
  baseURL: 'http://localhost:3002/api/llm',
  apiKey: 'your-api-key'
});

// Query compliance
const result = await client.query({
  query: 'What are GDPR requirements?',
  options: { temperature: 0.3 }
});

// Search regulations
const regulations = await client.regulations.search('privacy');
```

### Python
```python
from mcp_engine import MCPClient

client = MCPClient(
    base_url='http://localhost:3002/api/llm',
    api_key='your-api-key'
)

# Query compliance
result = client.query(
    query='What are GDPR requirements?',
    options={'temperature': 0.3}
)

# Search regulations
regulations = client.regulations.search('privacy')
```

### cURL Examples

#### Health Check
```bash
curl -X GET http://localhost:3002/api/llm/health
```

#### Compliance Query
```bash
curl -X POST http://localhost:3002/api/llm/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "query": "What are FERPA requirements?",
    "options": {"temperature": 0.3}
  }'
```

#### Search Regulations
```bash
curl -X GET "http://localhost:3002/api/llm/regulations/search?q=privacy&limit=10" \
  -H "Authorization: Bearer your-api-key"
```

## Testing

### Test Endpoints
- `GET /api/llm/test` - Basic connectivity test
- `POST /api/llm/test/echo` - Echo request body
- `GET /api/llm/test/error` - Trigger test error

### Health Checks
- `GET /api/llm/health/live` - Liveness probe
- `GET /api/llm/health/ready` - Readiness probe

## Changelog

### v5.0.0 (Current)
- Added Kubernetes support
- Enhanced monitoring and metrics
- Improved error handling
- Added bulk operations

### v4.0.0
- Added authentication and authorization
- Implemented caching layer
- Enhanced regulation management
- Added comprehensive monitoring

### v3.0.0
- Frontend integration
- Modern UI components
- Client-server architecture

### v2.0.0
- Service layer implementation
- Dependency injection
- Repository pattern

### v1.0.0
- Initial API implementation
- Basic compliance queries
- CSV data loading 