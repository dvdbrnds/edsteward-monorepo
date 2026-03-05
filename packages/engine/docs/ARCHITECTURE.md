# MCP Engine Architecture Documentation

## Overview

The MCP Engine is a sophisticated, enterprise-ready compliance management platform built with modern software engineering principles. This document provides a comprehensive overview of the system architecture, design patterns, and technical decisions that make the platform scalable, maintainable, and production-ready.

## Table of Contents

- [System Architecture](#system-architecture)
- [Service Layer Design](#service-layer-design)
- [Dependency Injection](#dependency-injection)
- [Data Flow](#data-flow)
- [Caching Strategy](#caching-strategy)
- [Security Architecture](#security-architecture)
- [Monitoring & Observability](#monitoring--observability)
- [Deployment Architecture](#deployment-architecture)
- [Design Patterns](#design-patterns)
- [Technology Stack](#technology-stack)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              External Layer                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Web Browser   │  │   Mobile App    │  │   API Clients   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                              ┌─────────────┐
                              │   Ingress   │
                              │  (NGINX)    │
                              └─────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Application Layer                                │
│  ┌─────────────────┐                    ┌─────────────────┐                │
│  │   Frontend      │                    │  LLM Gateway    │                │
│  │   (React)       │◄──────────────────►│  (Express.js)   │                │
│  │   Port: 3050    │                    │   Port: 3002    │                │
│  └─────────────────┘                    └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Service Layer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   LLM Service   │  │ Compliance Svc  │  │  Cache Service  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Regulation Svc  │  │  Auth Service   │  │ Metrics Service │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Repository Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Regulation Repo │  │   Cache Repo    │  │  Metrics Repo   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Data Layer                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   CSV Files     │  │   Redis Cache   │  │   Memory Cache  │             │
│  │   (Regulations) │  │   (Distributed) │  │   (Fallback)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           External Services                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   OpenAI API    │  │   Prometheus    │  │     Grafana     │             │
│  │     (LLM)       │  │   (Metrics)     │  │  (Dashboards)   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Frontend (React Application)
- **Purpose**: User interface for compliance queries and regulation management
- **Technology**: React 18, Vite, Modern UI components
- **Responsibilities**:
  - User authentication and session management
  - Compliance query interface
  - Regulation browsing and search
  - Real-time status updates
  - Responsive design for multiple devices

#### LLM Gateway (Express.js API)
- **Purpose**: Central API gateway for all compliance operations
- **Technology**: Express.js, Node.js 18+
- **Responsibilities**:
  - API request routing and validation
  - Authentication and authorization
  - Rate limiting and security
  - Service orchestration
  - Response formatting and error handling

#### Service Layer
- **Purpose**: Business logic implementation with dependency injection
- **Pattern**: Service-oriented architecture with IoC container
- **Responsibilities**:
  - Business rule enforcement
  - Data processing and transformation
  - External service integration
  - Caching strategy implementation
  - Metrics collection and monitoring

## Service Layer Design

### Service Architecture Pattern

The MCP Engine implements a sophisticated service layer using dependency injection and the repository pattern:

```javascript
// Service Interface Definition
export class IService {
  async initialize() {
    throw new Error('Method must be implemented');
  }
  
  async healthCheck() {
    throw new Error('Method must be implemented');
  }
}

// Service Implementation
export class LLMService extends IService {
  constructor(dependencies = {}) {
    super();
    this.cacheService = dependencies.cacheService;
    this.regulationService = dependencies.regulationService;
    this.metricsService = dependencies.metricsService;
    this.logger = logger.child({ service: 'LLMService' });
  }

  async processQuery(query, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query, options);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.metricsService.incrementCounter('llm_cache_hits');
        return cached;
      }

      // Process with LLM
      const result = await this.callLLMAPI(query, options);
      
      // Cache result
      await this.cacheService.set(cacheKey, result, 3600);
      
      // Record metrics
      this.metricsService.recordHistogram('llm_processing_duration', 
        Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.logger.error('LLM processing failed', { error: error.message });
      this.metricsService.incrementCounter('llm_errors');
      throw error;
    }
  }
}
```

### Service Registration and Resolution

```javascript
// Service Container Configuration
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
    this.initializeServices();
  }

  initializeServices() {
    // Register services with dependencies
    this.register('cacheService', CacheService, []);
    this.register('metricsService', MetricsService, []);
    this.register('regulationService', RegulationService, ['cacheService']);
    this.register('llmService', LLMService, ['cacheService', 'regulationService', 'metricsService']);
    this.register('complianceService', ComplianceService, ['llmService', 'regulationService']);
  }

  register(name, serviceClass, dependencies = []) {
    this.services.set(name, { serviceClass, dependencies });
  }

  resolve(name) {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Resolve dependencies
    const dependencies = {};
    for (const dep of registration.dependencies) {
      dependencies[dep] = this.resolve(dep);
    }

    // Create instance
    const instance = new registration.serviceClass(dependencies);
    this.instances.set(name, instance);
    
    return instance;
  }
}
```

## Dependency Injection

### IoC Container Implementation

The system uses a custom Inversion of Control (IoC) container for dependency management:

```javascript
// Container with lifecycle management
export class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
    this.singletons = new Set();
    this.initializing = new Set();
  }

  // Singleton registration
  registerSingleton(name, serviceClass, dependencies = []) {
    this.register(name, serviceClass, dependencies);
    this.singletons.add(name);
  }

  // Transient registration
  registerTransient(name, serviceClass, dependencies = []) {
    this.register(name, serviceClass, dependencies);
  }

  // Factory registration
  registerFactory(name, factory, dependencies = []) {
    this.services.set(name, { factory, dependencies, isFactory: true });
  }

  async resolveAsync(name) {
    // Prevent circular dependencies
    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    this.initializing.add(name);
    
    try {
      const instance = await this.createInstance(name);
      
      // Initialize if method exists
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }
      
      return instance;
    } finally {
      this.initializing.delete(name);
    }
  }
}
```

### Service Lifecycle Management

```javascript
// Service with lifecycle hooks
export class BaseService {
  constructor() {
    this.initialized = false;
    this.healthy = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.onInitialize();
      this.initialized = true;
      this.healthy = true;
    } catch (error) {
      this.healthy = false;
      throw error;
    }
  }

  async onInitialize() {
    // Override in derived classes
  }

  async healthCheck() {
    if (!this.initialized) {
      return { status: 'unhealthy', reason: 'Not initialized' };
    }

    try {
      const result = await this.onHealthCheck();
      return { status: 'healthy', ...result };
    } catch (error) {
      return { status: 'unhealthy', reason: error.message };
    }
  }

  async onHealthCheck() {
    // Override in derived classes
    return {};
  }

  async dispose() {
    if (typeof this.onDispose === 'function') {
      await this.onDispose();
    }
    this.initialized = false;
    this.healthy = false;
  }
}
```

## Data Flow

### Request Processing Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───►│   Ingress   │───►│  Gateway    │───►│  Service    │
│  Request    │    │   (NGINX)   │    │ (Express)   │    │   Layer     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                              │                   │
                                              ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │◄───│   Ingress   │◄───│  Gateway    │◄───│ Repository  │
│  Response   │    │   (NGINX)   │    │ (Express)   │    │   Layer     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Compliance Query Processing

```javascript
// Detailed request flow
async function processComplianceQuery(req, res) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  try {
    // 1. Request validation
    const validatedQuery = await validateQuery(req.body);
    
    // 2. Authentication & authorization
    const user = await authenticateRequest(req);
    await authorizeQuery(user, validatedQuery);
    
    // 3. Rate limiting check
    await checkRateLimit(user.id);
    
    // 4. Service resolution
    const { complianceService } = req.services;
    
    // 5. Business logic processing
    const result = await complianceService.processQuery(validatedQuery, {
      userId: user.id,
      requestId,
      context: extractContext(req)
    });
    
    // 6. Response formatting
    const response = formatResponse(result, requestId);
    
    // 7. Metrics recording
    recordMetrics('compliance_query', {
      duration: Date.now() - startTime,
      status: 'success',
      userId: user.id
    });
    
    res.json(response);
    
  } catch (error) {
    // Error handling and logging
    handleError(error, requestId, res);
  }
}
```

### Data Transformation Pipeline

```javascript
// Multi-stage data processing
class DataTransformationPipeline {
  constructor() {
    this.stages = [
      new ValidationStage(),
      new NormalizationStage(),
      new EnrichmentStage(),
      new CachingStage(),
      new FormattingStage()
    ];
  }

  async process(data, context) {
    let result = data;
    
    for (const stage of this.stages) {
      try {
        result = await stage.process(result, context);
        context.stageResults.push({
          stage: stage.name,
          duration: stage.lastDuration,
          success: true
        });
      } catch (error) {
        context.stageResults.push({
          stage: stage.name,
          error: error.message,
          success: false
        });
        throw error;
      }
    }
    
    return result;
  }
}
```

## Caching Strategy

### Multi-Level Caching Architecture

```javascript
// Hierarchical caching system
class CacheManager {
  constructor() {
    this.l1Cache = new MemoryCache({     // L1: In-memory (fastest)
      maxSize: 1000,
      ttl: 300                           // 5 minutes
    });
    
    this.l2Cache = new RedisCache({      // L2: Redis (distributed)
      host: process.env.REDIS_HOST,
      ttl: 3600                          // 1 hour
    });
    
    this.l3Cache = new FileCache({       // L3: File system (persistent)
      directory: './cache',
      ttl: 86400                         // 24 hours
    });
  }

  async get(key) {
    // Try L1 first (fastest)
    let value = await this.l1Cache.get(key);
    if (value) {
      this.recordCacheHit('l1', key);
      return value;
    }

    // Try L2 (distributed)
    value = await this.l2Cache.get(key);
    if (value) {
      // Promote to L1
      await this.l1Cache.set(key, value, 300);
      this.recordCacheHit('l2', key);
      return value;
    }

    // Try L3 (persistent)
    value = await this.l3Cache.get(key);
    if (value) {
      // Promote to L2 and L1
      await this.l2Cache.set(key, value, 3600);
      await this.l1Cache.set(key, value, 300);
      this.recordCacheHit('l3', key);
      return value;
    }

    this.recordCacheMiss(key);
    return null;
  }

  async set(key, value, ttl) {
    // Write to all levels
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, 300)),
      this.l2Cache.set(key, value, Math.min(ttl, 3600)),
      this.l3Cache.set(key, value, ttl)
    ]);
  }
}
```

### Cache Invalidation Strategy

```javascript
// Event-driven cache invalidation
class CacheInvalidationManager {
  constructor(cacheManager, eventBus) {
    this.cacheManager = cacheManager;
    this.eventBus = eventBus;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Regulation updates
    this.eventBus.on('regulation.updated', async (event) => {
      await this.invalidateRegulationCache(event.regulationId);
    });

    // Bulk invalidation
    this.eventBus.on('regulations.bulk_update', async (event) => {
      await this.invalidateAllRegulationCaches();
    });

    // Time-based invalidation
    setInterval(() => {
      this.performScheduledInvalidation();
    }, 60000); // Every minute
  }

  async invalidateRegulationCache(regulationId) {
    const patterns = [
      `regulation:${regulationId}:*`,
      `query:*:regulation:${regulationId}`,
      `search:*:regulation:${regulationId}`
    ];

    for (const pattern of patterns) {
      await this.cacheManager.deletePattern(pattern);
    }
  }
}
```

## Security Architecture

### Authentication & Authorization Flow

```javascript
// Multi-layer security implementation
class SecurityManager {
  constructor() {
    this.authManager = new AuthenticationManager();
    this.authzManager = new AuthorizationManager();
    this.rateLimiter = new RateLimiter();
    this.auditLogger = new AuditLogger();
  }

  async authenticateRequest(req) {
    const token = this.extractToken(req);
    
    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Validate token format and signature
    const payload = await this.authManager.validateToken(token);
    
    // Check token blacklist
    if (await this.authManager.isTokenBlacklisted(token)) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Load user context
    const user = await this.authManager.loadUserContext(payload.userId);
    
    // Log authentication event
    await this.auditLogger.logAuthentication(user.id, req.ip);
    
    return user;
  }

  async authorizeRequest(user, resource, action) {
    // Check user permissions
    const hasPermission = await this.authzManager.checkPermission(
      user.id, resource, action
    );

    if (!hasPermission) {
      await this.auditLogger.logAuthorizationFailure(
        user.id, resource, action
      );
      throw new AuthorizationError('Insufficient permissions');
    }

    // Check rate limits
    await this.rateLimiter.checkLimit(user.id, action);
    
    return true;
  }
}
```

### API Security Layers

```javascript
// Security middleware stack
const securityMiddleware = [
  helmet({                              // Security headers
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  }),
  
  cors({                               // CORS configuration
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3050'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }),
  
  rateLimit({                          // Rate limiting
    windowMs: 15 * 60 * 1000,         // 15 minutes
    max: 100,                         // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  express.json({ limit: '10mb' }),     // Body parsing with size limit
  
  requestLogger,                       // Request logging
  
  authenticationMiddleware,            // Authentication
  
  authorizationMiddleware              // Authorization
];
```

## Monitoring & Observability

### Metrics Collection Architecture

```javascript
// Comprehensive metrics system
class MetricsCollector {
  constructor() {
    this.prometheus = require('prom-client');
    this.register = new this.prometheus.Registry();
    this.setupDefaultMetrics();
    this.setupCustomMetrics();
  }

  setupCustomMetrics() {
    // Request metrics
    this.requestCounter = new this.prometheus.Counter({
      name: 'mcp_requests_total',
      help: 'Total number of requests',
      labelNames: ['method', 'endpoint', 'status'],
      registers: [this.register]
    });

    this.requestDuration = new this.prometheus.Histogram({
      name: 'mcp_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    // Business metrics
    this.complianceQueries = new this.prometheus.Counter({
      name: 'mcp_compliance_queries_total',
      help: 'Total compliance queries processed',
      labelNames: ['status', 'user_type'],
      registers: [this.register]
    });

    this.cacheHitRate = new this.prometheus.Gauge({
      name: 'mcp_cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.register]
    });

    // System metrics
    this.activeConnections = new this.prometheus.Gauge({
      name: 'mcp_active_connections',
      help: 'Number of active connections',
      registers: [this.register]
    });
  }

  recordRequest(method, endpoint, status, duration) {
    this.requestCounter.inc({ method, endpoint, status });
    this.requestDuration.observe({ method, endpoint }, duration);
  }

  recordComplianceQuery(status, userType) {
    this.complianceQueries.inc({ status, userType });
  }

  updateCacheHitRate(rate) {
    this.cacheHitRate.set(rate);
  }

  getMetrics() {
    return this.register.metrics();
  }
}
```

### Distributed Tracing

```javascript
// OpenTelemetry integration
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

class TracingManager {
  constructor() {
    this.sdk = new NodeSDK({
      traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
      }),
      instrumentations: [getNodeAutoInstrumentations()]
    });
  }

  initialize() {
    this.sdk.start();
  }

  createSpan(name, attributes = {}) {
    const tracer = opentelemetry.trace.getTracer('mcp-engine');
    return tracer.startSpan(name, { attributes });
  }

  async traceAsyncOperation(name, operation, attributes = {}) {
    const span = this.createSpan(name, attributes);
    
    try {
      const result = await operation();
      span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

## Deployment Architecture

### Kubernetes Architecture

```yaml
# Production deployment architecture
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-engine
  labels:
    environment: production
    version: "5.0"
---
# Resource quotas and limits
apiVersion: v1
kind: ResourceQuota
metadata:
  name: mcp-engine-quota
  namespace: mcp-engine
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    persistentvolumeclaims: "10"
    services: "20"
---
# Network policies for security
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mcp-engine-netpol
  namespace: mcp-engine
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Auto-scaling Configuration

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-gateway-hpa
  namespace: mcp-engine
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_requests
      target:
        type: AverageValue
        averageValue: "10"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Design Patterns

### Repository Pattern Implementation

```javascript
// Base repository with common functionality
export class BaseRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
    this.cache = new Map();
  }

  async findById(id) {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const entity = await this.dataSource.findById(id);
    if (entity) {
      this.cache.set(id, entity);
    }
    
    return entity;
  }

  async findAll(criteria = {}) {
    const cacheKey = this.generateCacheKey(criteria);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const entities = await this.dataSource.findAll(criteria);
    this.cache.set(cacheKey, entities);
    
    return entities;
  }

  async create(entity) {
    const created = await this.dataSource.create(entity);
    this.invalidateCache();
    return created;
  }

  async update(id, updates) {
    const updated = await this.dataSource.update(id, updates);
    this.cache.delete(id);
    this.invalidateCache();
    return updated;
  }

  async delete(id) {
    const result = await this.dataSource.delete(id);
    this.cache.delete(id);
    this.invalidateCache();
    return result;
  }

  invalidateCache() {
    this.cache.clear();
  }

  generateCacheKey(criteria) {
    return JSON.stringify(criteria);
  }
}
```

### Observer Pattern for Events

```javascript
// Event-driven architecture
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.middleware = [];
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  async emit(event, data) {
    // Apply middleware
    for (const middleware of this.middleware) {
      data = await middleware(event, data);
    }

    // Notify listeners
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event);
      await Promise.all(listeners.map(listener => listener(data)));
    }
  }

  use(middleware) {
    this.middleware.push(middleware);
  }
}

// Usage example
const eventBus = new EventBus();

// Add logging middleware
eventBus.use(async (event, data) => {
  console.log(`Event: ${event}`, data);
  return data;
});

// Add audit middleware
eventBus.use(async (event, data) => {
  await auditLogger.log(event, data);
  return data;
});

// Register event handlers
eventBus.on('regulation.created', async (regulation) => {
  await cacheManager.invalidatePattern('regulation:*');
  await searchIndex.addRegulation(regulation);
});
```

### Factory Pattern for Service Creation

```javascript
// Service factory with configuration
class ServiceFactory {
  constructor() {
    this.configurations = new Map();
    this.instances = new Map();
  }

  registerConfiguration(name, config) {
    this.configurations.set(name, config);
  }

  createService(name, overrides = {}) {
    const config = this.configurations.get(name);
    if (!config) {
      throw new Error(`No configuration found for service: ${name}`);
    }

    const finalConfig = { ...config, ...overrides };
    const serviceClass = finalConfig.class;
    
    return new serviceClass(finalConfig);
  }

  createSingleton(name, overrides = {}) {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const instance = this.createService(name, overrides);
    this.instances.set(name, instance);
    
    return instance;
  }
}

// Configuration
const factory = new ServiceFactory();

factory.registerConfiguration('llmService', {
  class: LLMService,
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo-preview',
  timeout: 30000,
  retries: 3
});

factory.registerConfiguration('cacheService', {
  class: CacheService,
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  memory: {
    maxSize: 1000,
    ttl: 300
  }
});
```

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 18.x | User interface |
| | Vite | 4.x | Build tool and dev server |
| | React Router | 6.x | Client-side routing |
| **Backend** | Node.js | 18.x | Runtime environment |
| | Express.js | 4.x | Web framework |
| | ES Modules | Native | Module system |
| **Caching** | Redis | 7.x | Distributed cache |
| | Memory Cache | Custom | In-memory fallback |
| **Monitoring** | Prometheus | Latest | Metrics collection |
| | Grafana | Latest | Dashboards |
| | Jaeger | Latest | Distributed tracing |
| **Orchestration** | Kubernetes | 1.25+ | Container orchestration |
| | Helm | 3.x | Package management |
| | Docker | 20.x | Containerization |

### External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **OpenAI API** | LLM processing | REST API |
| **Redis** | Distributed caching | Redis client |
| **Prometheus** | Metrics storage | HTTP endpoints |
| **Grafana** | Visualization | Prometheus data source |
| **Jaeger** | Tracing | OpenTelemetry |

### Development Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | Code linting | `.eslintrc.js` |
| **Prettier** | Code formatting | `.prettierrc` |
| **Jest** | Unit testing | `jest.config.js` |
| **Nodemon** | Development server | `nodemon.json` |
| **Docker Compose** | Local development | `docker-compose.yml` |

This architecture documentation provides a comprehensive overview of the MCP Engine's design and implementation. The system is built with scalability, maintainability, and production readiness in mind, following modern software engineering best practices. 