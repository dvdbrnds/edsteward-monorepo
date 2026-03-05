# MCP Engine Development Guide

## Overview

This guide covers everything you need to know to develop, extend, and contribute to the MCP Engine. The system follows modern software engineering practices with dependency injection, service layer architecture, and comprehensive testing.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Code Organization](#code-organization)
- [Adding New Features](#adding-new-features)
- [Testing Strategy](#testing-strategy)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Performance Optimization](#performance-optimization)
- [Contributing Guidelines](#contributing-guidelines)

## Development Environment Setup

### Prerequisites

```bash
# Required
Node.js 18+
npm 8+
Git

# Optional but recommended
Docker & Docker Compose
Redis (for caching)
Kubernetes (for Phase 5 deployment)
```

### Initial Setup

```bash
# Clone repository
git clone [repository-url]
cd mcp-engine

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Edit .env with your settings
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
LOG_LEVEL=debug
```

### Development Scripts

```bash
# Start LLM Gateway (refactored version)
npm run dev:gateway
# or
node src/llm-gateway/start-llm-gateway-refactored.js

# Start Frontend
npm run dev:client

# Start Phase 4 Gateway (full features)
node src/llm-gateway/start-llm-gateway-phase4.js

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### IDE Configuration

#### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

#### Recommended Extensions
- ESLint
- Prettier
- JavaScript (ES6) code snippets
- REST Client
- Docker

## Architecture Deep Dive

### Service Layer Architecture

The MCP Engine uses a sophisticated service layer with dependency injection:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  LLM Gateway    │  │   Frontend      │                  │
│  │  (Express.js)   │  │   (React)       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  LLM Service    │  │ Compliance Svc  │  │ Cache Svc   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Regulation Svc  │  │  Auth Service   │  │ Metrics Svc │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Repository Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Regulation Repo │  │   Cache Repo    │  │ Metrics Repo│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   CSV Files     │  │   Redis Cache   │  │  Memory     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Injection Container

The system uses a custom dependency injection container:

```javascript
// src/shared/container/ServiceContainer.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
  }

  register(name, serviceClass, dependencies = []) {
    this.services.set(name, { serviceClass, dependencies });
  }

  resolve(name) {
    // Resolves service with dependencies
  }
}
```

### Service Registration

Services are registered in the container:

```javascript
// Example service registration
container.register('llmService', LLMService, ['cacheService']);
container.register('complianceService', ComplianceService, ['llmService', 'regulationService']);
```

## Code Organization

### Directory Structure

```
src/
├── shared/                     # Shared components
│   ├── services/              # Business logic services
│   │   ├── LLMService.js
│   │   ├── ComplianceService.js
│   │   ├── RegulationService.js
│   │   └── CacheService.js
│   ├── repositories/          # Data access layer
│   │   ├── regulation-repository.js
│   │   └── cache-repository.js
│   ├── interfaces/            # Service interfaces
│   │   ├── service.js
│   │   └── repository.js
│   ├── cache/                 # Caching implementations
│   │   ├── CacheManager.js
│   │   ├── RedisCache.js
│   │   └── MemoryCache.js
│   ├── security/              # Security components
│   │   ├── AuthenticationManager.js
│   │   └── RateLimiter.js
│   ├── monitoring/            # Monitoring & metrics
│   │   ├── MetricsCollector.js
│   │   └── HealthChecker.js
│   ├── container/             # Dependency injection
│   │   └── ServiceContainer.js
│   └── validators/            # Input validation
├── llm-gateway/               # LLM Gateway application
│   ├── start-llm-gateway-refactored.js
│   ├── start-llm-gateway-phase4.js
│   ├── routes-refactored.js
│   └── enhanced-llm-gateway-service.js
├── client/                    # React frontend
│   ├── components/
│   ├── hooks/
│   ├── context/
│   └── lib/
└── core/                      # Core utilities
    ├── config/
    ├── logger/
    └── utils/
```

### Naming Conventions

- **Files**: kebab-case (`regulation-service.js`)
- **Classes**: PascalCase (`RegulationService`)
- **Functions**: camelCase (`processQuery`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with 'I' prefix (`IService`)

### Import/Export Patterns

```javascript
// Preferred: Named exports
export class RegulationService {
  // implementation
}

export const DEFAULT_CONFIG = {
  // config
};

// Import
import { RegulationService, DEFAULT_CONFIG } from './regulation-service.js';

// Default exports for main classes
export default class LLMService {
  // implementation
}
```

## Adding New Features

### 1. Adding a New Service

#### Step 1: Create Service Interface
```javascript
// src/shared/interfaces/my-service-interface.js
export class IMyService {
  async processData(data) {
    throw new Error('Method must be implemented');
  }
}
```

#### Step 2: Implement Service
```javascript
// src/shared/services/MyService.js
import { IMyService } from '../interfaces/my-service-interface.js';
import { logger } from '../utils/logger.js';

export class MyService extends IMyService {
  constructor(dependencies = {}) {
    super();
    this.cacheService = dependencies.cacheService;
    this.logger = logger.child({ service: 'MyService' });
  }

  async processData(data) {
    try {
      this.logger.info('Processing data', { dataSize: data.length });
      
      // Check cache first
      const cached = await this.cacheService.get(`data:${data.id}`);
      if (cached) {
        return cached;
      }

      // Process data
      const result = await this.performProcessing(data);
      
      // Cache result
      await this.cacheService.set(`data:${data.id}`, result, 3600);
      
      return result;
    } catch (error) {
      this.logger.error('Error processing data', { error: error.message });
      throw error;
    }
  }

  async performProcessing(data) {
    // Implementation
  }
}
```

#### Step 3: Register Service
```javascript
// In service registration
container.register('myService', MyService, ['cacheService']);
```

#### Step 4: Add Routes
```javascript
// src/llm-gateway/routes-refactored.js
router.post('/my-endpoint', async (req, res) => {
  try {
    const { myService } = req.services;
    const result = await myService.processData(req.body);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### 2. Adding a New Repository

```javascript
// src/shared/repositories/my-repository.js
import { BaseRepository } from './base-repository.js';

export class MyRepository extends BaseRepository {
  constructor(dataSource) {
    super();
    this.dataSource = dataSource;
  }

  async findById(id) {
    // Implementation
  }

  async findAll(filters = {}) {
    // Implementation
  }

  async create(data) {
    // Implementation
  }

  async update(id, data) {
    // Implementation
  }

  async delete(id) {
    // Implementation
  }
}
```

### 3. Adding Frontend Components

```jsx
// src/client/components/MyComponent.jsx
import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export const MyComponent = () => {
  const [data, setData] = useState(null);
  const { loading, error, request } = useApi();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await request('/api/llm/my-endpoint');
        setData(result.data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

```javascript
// src/shared/services/__tests__/MyService.test.js
import { MyService } from '../MyService.js';
import { jest } from '@jest/globals';

describe('MyService', () => {
  let myService;
  let mockCacheService;

  beforeEach(() => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn()
    };

    myService = new MyService({
      cacheService: mockCacheService
    });
  });

  describe('processData', () => {
    it('should process data successfully', async () => {
      const testData = { id: '123', content: 'test' };
      mockCacheService.get.mockResolvedValue(null);
      
      const result = await myService.processData(testData);
      
      expect(result).toBeDefined();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const testData = { id: '123' };
      const cachedResult = { processed: true };
      mockCacheService.get.mockResolvedValue(cachedResult);
      
      const result = await myService.processData(testData);
      
      expect(result).toEqual(cachedResult);
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```javascript
// src/llm-gateway/__tests__/integration.test.js
import request from 'supertest';
import { createApp } from '../app.js';

describe('LLM Gateway Integration', () => {
  let app;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/llm/query', () => {
    it('should process compliance query', async () => {
      const response = await request(app)
        .post('/api/llm/query')
        .send({
          query: 'What are FERPA requirements?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- MyService.test.js

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Debugging & Troubleshooting

### Logging

The system uses structured logging:

```javascript
import { logger } from '../utils/logger.js';

// Create service-specific logger
const serviceLogger = logger.child({ service: 'MyService' });

// Log with context
serviceLogger.info('Processing request', {
  requestId: req.id,
  userId: req.user?.id,
  operation: 'processData'
});

// Log errors with stack traces
serviceLogger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: { requestId: req.id }
});
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=mcp:* node src/llm-gateway/start-llm-gateway-refactored.js

# Debug specific modules
DEBUG=mcp:service:* node src/llm-gateway/start-llm-gateway-refactored.js
```

### Common Issues

#### Service Resolution Errors
```javascript
// Check service registration
console.log('Registered services:', container.services.keys());

// Verify dependencies
const registration = container.services.get('myService');
console.log('Dependencies:', registration.dependencies);
```

#### Import Path Issues
```javascript
// Use absolute imports from src root
import { MyService } from '../shared/services/MyService.js';

// Always include .js extension for ES modules
import { config } from './config.js';
```

#### Memory Leaks
```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  logger.info('Memory usage', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 30000);
```

## Performance Optimization

### Caching Strategy

```javascript
// Multi-level caching
class CacheManager {
  constructor() {
    this.l1Cache = new MemoryCache(); // Fast, small
    this.l2Cache = new RedisCache();  // Slower, larger
  }

  async get(key) {
    // Try L1 first
    let value = await this.l1Cache.get(key);
    if (value) return value;

    // Try L2
    value = await this.l2Cache.get(key);
    if (value) {
      // Promote to L1
      await this.l1Cache.set(key, value, 300);
      return value;
    }

    return null;
  }
}
```

### Database Optimization

```javascript
// Batch operations
async bulkCreate(items) {
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await this.processBatch(batch);
    results.push(...batchResults);
  }

  return results;
}
```

### Memory Management

```javascript
// Use streams for large data
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

async processLargeFile(filePath) {
  const readStream = createReadStream(filePath);
  const processStream = new ProcessingStream();
  const writeStream = new WriteStream();

  await pipeline(readStream, processStream, writeStream);
}
```

## Contributing Guidelines

### Code Style

```javascript
// Use ESLint configuration
{
  "extends": ["eslint:recommended"],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"]
  }
}
```

### Commit Messages

```
feat: add new regulation search endpoint
fix: resolve cache invalidation issue
docs: update API documentation
test: add unit tests for LLM service
refactor: improve service container performance
```

### Pull Request Process

1. **Fork & Branch**: Create feature branch from `main`
2. **Develop**: Implement feature with tests
3. **Test**: Ensure all tests pass
4. **Document**: Update relevant documentation
5. **PR**: Create pull request with description
6. **Review**: Address review feedback
7. **Merge**: Squash and merge when approved

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Error handling implemented
- [ ] Logging added where appropriate

## Environment Variables

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
OPENAI_API_KEY=your_key
LLM_GATEWAY_PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
OPENAI_API_KEY=your_production_key
LLM_GATEWAY_PORT=3002
REDIS_HOST=redis-service
REDIS_PORT=6379
ENABLE_METRICS=true
ENABLE_AUTH=true
```

## Monitoring & Metrics

### Custom Metrics

```javascript
// Add custom metrics
const { metricsCollector } = req.services;

// Counter
metricsCollector.incrementCounter('custom_operations_total', {
  operation: 'data_processing',
  status: 'success'
});

// Histogram
metricsCollector.recordHistogram('custom_operation_duration', 
  Date.now() - startTime, {
    operation: 'data_processing'
  }
);

// Gauge
metricsCollector.setGauge('custom_active_connections', 
  connectionPool.activeCount
);
```

### Health Checks

```javascript
// Add custom health check
class MyService {
  async healthCheck() {
    try {
      await this.ping();
      return { status: 'healthy', details: 'Service responsive' };
    } catch (error) {
      return { status: 'unhealthy', details: error.message };
    }
  }
}
```

This development guide provides a comprehensive foundation for working with the MCP Engine codebase. For specific implementation details, refer to the existing code examples and the API documentation. 