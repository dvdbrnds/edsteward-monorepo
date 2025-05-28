/**
 * Enhanced LLM Gateway - Phase 4
 * Production-ready gateway with advanced caching, security, monitoring, and regulation management
 */

import express from 'express';
import cors from 'cors';
import { ServiceContainer } from '../shared/container/service-container.js';
import { ComplianceService } from '../shared/services/compliance-service.js';
import { LLMService } from '../shared/services/llm-service.js';
import { RegulationRepository } from '../shared/repositories/regulation-repository.js';
import { AdvancedRegulationService } from '../shared/services/AdvancedRegulationService.js';
import { cacheManager } from '../shared/cache/CacheManager.js';
import { authManager } from '../shared/security/AuthenticationManager.js';
import { metricsCollector } from '../shared/monitoring/MetricsCollector.js';
import { logger } from '../utils/logger.js';

class EnhancedLLMGateway {
  constructor() {
    this.app = express();
    this.port = process.env.LLM_GATEWAY_PORT || 3002;
    this.container = new ServiceContainer();
    this.isInitialized = false;
  }

  /**
   * Initialize the enhanced gateway
   */
  async initialize() {
    try {
      logger.info('[enhanced-llm-gateway] Starting Phase 4 initialization...');

      // Initialize core systems
      await this.initializeServices();
      await this.setupMiddleware();
      await this.setupRoutes();
      await this.setupErrorHandling();
      await this.setupMonitoring();

      this.isInitialized = true;
      logger.info('[enhanced-llm-gateway] Phase 4 initialization completed successfully');

    } catch (error) {
      logger.error('[enhanced-llm-gateway] Failed to initialize:', {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace available',
        name: error.name || 'Unknown error type',
        cause: error.cause || 'No cause specified',
        code: error.code || 'No error code'
      });
      throw error;
    }
  }

  /**
   * Initialize all services with advanced features
   */
  async initializeServices() {
    try {
      // Initialize cache manager first
      await cacheManager.initialize();
      logger.info('[enhanced-llm-gateway] Cache manager initialized');

      // Initialize authentication manager
      await authManager.initialize();
      logger.info('[enhanced-llm-gateway] Authentication manager initialized');

      // Initialize metrics collector
      await metricsCollector.initialize();
      logger.info('[enhanced-llm-gateway] Metrics collector initialized');

      // Register repositories
      const regulationRepository = new RegulationRepository();
      this.container.registerInstance('regulationRepository', regulationRepository);

      // Register advanced services
      const advancedRegulationService = new AdvancedRegulationService(regulationRepository, {
        enableVersioning: true,
        enableSearch: true,
        enableBulkOperations: true,
        enableMetadata: true,
        cacheEnabled: true
      });
      this.container.registerInstance('advancedRegulationService', advancedRegulationService);

      // Register core services
      const llmService = new LLMService();
      const complianceService = new ComplianceService({
        regulationRepository,
        llmService
      });
      
      this.container.registerInstance('llmService', llmService);
      this.container.registerInstance('complianceService', complianceService);

      // Initialize services that have initialize methods
      try {
        await advancedRegulationService.initialize();
        logger.info('[enhanced-llm-gateway] Advanced regulation service initialized');
      } catch (initError) {
        logger.error('[enhanced-llm-gateway] Advanced regulation service initialization failed:', {
          message: initError.message,
          stack: initError.stack,
          name: initError.name
        });
        throw initError;
      }

      logger.info('[enhanced-llm-gateway] All services registered successfully');

    } catch (error) {
      logger.error('[enhanced-llm-gateway] Service initialization failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      throw error;
    }
  }

  /**
   * Setup middleware with security and monitoring
   */
  async setupMiddleware() {
    // Security headers
    this.app.use(authManager.securityHeadersMiddleware());

    // CORS with authentication support
    this.app.use(authManager.corsMiddleware());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Metrics collection
    this.app.use(metricsCollector.expressMiddleware());

    // Authentication (optional for development)
    if (process.env.NODE_ENV === 'production') {
      this.app.use('/api/llm', authManager.authMiddleware());
    }

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`[enhanced-llm-gateway] ${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        auth: req.auth ? { keyId: req.auth.keyData?.id } : null
      });
      next();
    });

    logger.info('[enhanced-llm-gateway] Middleware configured');
  }

  /**
   * Setup enhanced API routes
   */
  async setupRoutes() {
    const router = express.Router();

    // Enhanced health endpoint with comprehensive checks
    router.get('/health', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('health_check');
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '4.0.0',
          phase: 'Phase 4 - Production Ready',
          services: {},
          features: {
            advancedCaching: true,
            authentication: true,
            monitoring: true,
            advancedRegulations: true,
            bulkOperations: true,
            versioning: true,
            search: true
          }
        };

        // Check all service health
        const services = [
          { name: 'cacheManager', service: cacheManager },
          { name: 'authManager', service: authManager },
          { name: 'metricsCollector', service: metricsCollector },
          { name: 'advancedRegulationService', service: this.container.resolve('advancedRegulationService') },
          { name: 'complianceService', service: this.container.resolve('complianceService') },
          { name: 'llmService', service: this.container.resolve('llmService') }
        ];

        for (const { name, service } of services) {
          try {
            const serviceHealth = await service.getHealth();
            health.services[name] = serviceHealth;
            
            if (serviceHealth.status === 'unhealthy') {
              health.status = 'unhealthy';
            } else if (serviceHealth.status === 'degraded' && health.status === 'healthy') {
              health.status = 'degraded';
            }
          } catch (error) {
            health.services[name] = { status: 'unhealthy', error: error.message };
            health.status = 'unhealthy';
          }
        }

        timer.end();
        res.json(health);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Health check failed:', {
          message: error.message || 'Unknown error',
          stack: error.stack || 'No stack trace available',
          name: error.name || 'Unknown error type',
          cause: error.cause || 'No cause specified'
        });
        res.status(500).json({
          status: 'unhealthy',
          error: error.message || 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Enhanced metrics endpoint
    router.get('/metrics', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('metrics_fetch');
        const timeRange = req.query.range || '1h';
        
        const metrics = {
          realTime: metricsCollector.getRealTimeMetrics(),
          aggregated: metricsCollector.getAggregatedMetrics(timeRange),
          cache: cacheManager.getMetrics(),
          auth: authManager.getMetrics()
        };

        timer.end();
        res.json(metrics);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Metrics fetch failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Enhanced regulations endpoint with advanced features
    router.get('/regulations', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulations_fetch');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const {
          search,
          category,
          type,
          status = 'active',
          page = 1,
          limit = 50,
          sort = 'updatedAt',
          order = 'desc',
          includeMetadata = false
        } = req.query;

        let result;

        if (search) {
          // Advanced search
          result = await advancedRegulationService.searchRegulations(search, {
            filters: { category, type, status },
            sort: { field: sort, order },
            pagination: { page: parseInt(page), limit: parseInt(limit) },
            includeMetadata: includeMetadata === 'true'
          });
        } else {
          // Filter-based fetch
          result = await advancedRegulationService.searchRegulations('', {
            filters: { category, type, status },
            sort: { field: sort, order },
            pagination: { page: parseInt(page), limit: parseInt(limit) },
            includeMetadata: includeMetadata === 'true'
          });
        }

        timer.end();
        res.json(result);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Regulations fetch failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations' });
        res.status(500).json({ error: error.message });
      }
    });

    // Regulation management endpoints
    router.post('/regulations', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulation_create');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const regulation = await advancedRegulationService.createRegulation(req.body);
        
        timer.end();
        res.status(201).json(regulation);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Regulation creation failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations', method: 'POST' });
        res.status(400).json({ error: error.message });
      }
    });

    router.put('/regulations/:id', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulation_update');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const regulation = await advancedRegulationService.updateRegulation(req.params.id, req.body);
        
        timer.end();
        res.json(regulation);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Regulation update failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations/:id', method: 'PUT' });
        res.status(400).json({ error: error.message });
      }
    });

    router.delete('/regulations/:id', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulation_delete');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const softDelete = req.query.soft !== 'false';
        const result = await advancedRegulationService.deleteRegulation(req.params.id, softDelete);
        
        timer.end();
        res.json({ success: true, softDelete, result });

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Regulation deletion failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations/:id', method: 'DELETE' });
        res.status(400).json({ error: error.message });
      }
    });

    // Bulk operations
    router.post('/regulations/bulk', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulations_bulk_create');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const { regulations } = req.body;
        const result = await advancedRegulationService.bulkCreateRegulations(regulations);
        
        timer.end();
        res.json(result);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Bulk regulation creation failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations/bulk', method: 'POST' });
        res.status(400).json({ error: error.message });
      }
    });

    // Regulation versions
    router.get('/regulations/:id/versions', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('regulation_versions_fetch');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const versions = await advancedRegulationService.getRegulationVersions(req.params.id);
        
        timer.end();
        res.json(versions);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Regulation versions fetch failed:', error);
        metricsCollector.recordError(error, { endpoint: '/regulations/:id/versions' });
        res.status(400).json({ error: error.message });
      }
    });

    // Enhanced compliance query with caching
    router.post('/query', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('compliance_query');
        const complianceService = this.container.resolve('complianceService');
        
        const { content, options = {} } = req.body;
        
        if (!content) {
          return res.status(400).json({ error: 'Content is required' });
        }

        // Check cache first
        const cacheKey = `query:${Buffer.from(content).toString('base64').substring(0, 32)}`;
        let result = await cacheManager.get(cacheKey);
        
        if (!result) {
          result = await complianceService.analyzeCompliance(content, options);
          
          // Cache successful results
          if (result && !result.error) {
            await cacheManager.set(cacheKey, result, { 
              ttl: 3600, // 1 hour
              tags: ['compliance_queries']
            });
          }
        } else {
          result.cached = true;
        }

        timer.end();
        res.json(result);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Compliance query failed:', error);
        metricsCollector.recordError(error, { endpoint: '/query', method: 'POST' });
        res.status(500).json({ error: error.message });
      }
    });

    // Enhanced stats with advanced metrics
    router.get('/stats', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('stats_fetch');
        const advancedRegulationService = this.container.resolve('advancedRegulationService');
        
        const stats = {
          regulations: await advancedRegulationService.getRegulationStats(),
          cache: cacheManager.getMetrics(),
          auth: authManager.getMetrics(),
          metrics: metricsCollector.getRealTimeMetrics(),
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version,
            platform: process.platform
          }
        };

        timer.end();
        res.json(stats);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Stats fetch failed:', error);
        metricsCollector.recordError(error, { endpoint: '/stats' });
        res.status(500).json({ error: error.message });
      }
    });

    // Cache management endpoints
    router.post('/cache/clear', async (req, res) => {
      try {
        const timer = metricsCollector.createTimer('cache_clear');
        const { tags, pattern } = req.body;
        
        let cleared = 0;
        
        if (tags) {
          cleared = await cacheManager.invalidateByTags(tags);
        } else if (pattern) {
          cleared = await cacheManager.invalidateByPattern(pattern);
        } else {
          await cacheManager.clear();
          cleared = 'all';
        }

        timer.end();
        res.json({ success: true, cleared });

      } catch (error) {
        logger.error('[enhanced-llm-gateway] Cache clear failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // API key management (admin only)
    router.get('/admin/api-keys', async (req, res) => {
      try {
        if (!req.auth?.permissions?.includes('admin')) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const apiKeys = authManager.listApiKeys();
        res.json(apiKeys);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] API keys fetch failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/admin/api-keys', async (req, res) => {
      try {
        if (!req.auth?.permissions?.includes('admin')) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const apiKey = await authManager.createApiKey(req.body);
        res.status(201).json(apiKey);

      } catch (error) {
        logger.error('[enhanced-llm-gateway] API key creation failed:', error);
        res.status(400).json({ error: error.message });
      }
    });

    this.app.use('/api/llm', router);
    logger.info('[enhanced-llm-gateway] Enhanced routes configured');
  }

  /**
   * Setup error handling
   */
  async setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('[enhanced-llm-gateway] Unhandled error:', error);
      metricsCollector.recordError(error, { 
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    });

    logger.info('[enhanced-llm-gateway] Error handling configured');
  }

  /**
   * Setup monitoring and alerting
   */
  async setupMonitoring() {
    // Listen for alerts
    metricsCollector.on('alert', (alert) => {
      logger.warn('[enhanced-llm-gateway] Alert triggered:', alert);
      // In production, send to alerting system
    });

    // Listen for health changes
    metricsCollector.on('health', (health) => {
      if (health.status !== 'healthy') {
        logger.warn('[enhanced-llm-gateway] Health status changed:', health.status);
      }
    });

    logger.info('[enhanced-llm-gateway] Monitoring configured');
  }

  /**
   * Start the enhanced gateway
   */
  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const server = this.app.listen(this.port, () => {
        logger.info(`[enhanced-llm-gateway] Phase 4 Enhanced LLM Gateway running on port ${this.port}`);
        logger.info('[enhanced-llm-gateway] Features enabled:');
        logger.info('  ✅ Advanced Redis Caching with intelligent fallback');
        logger.info('  ✅ API Key Authentication & Rate Limiting');
        logger.info('  ✅ Advanced Regulation Management with versioning');
        logger.info('  ✅ Comprehensive Monitoring & Observability');
        logger.info('  ✅ Bulk Operations & Advanced Search');
        logger.info('  ✅ Production Security Headers & CORS');
        logger.info('  ✅ Performance Tracking & Alerting');
        logger.info('  ✅ Health Checks & Metrics Collection');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown(server));
      process.on('SIGINT', () => this.shutdown(server));

      return server;

    } catch (error) {
      logger.error('[enhanced-llm-gateway] Failed to start:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(server) {
    logger.info('[enhanced-llm-gateway] Shutting down gracefully...');
    
    server.close(() => {
      logger.info('[enhanced-llm-gateway] Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('[enhanced-llm-gateway] Force shutdown');
      process.exit(1);
    }, 10000);
  }
}

// Start the enhanced gateway
const gateway = new EnhancedLLMGateway();
gateway.start().catch(error => {
  logger.error('[enhanced-llm-gateway] Startup failed:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  process.exit(1);
});

export default EnhancedLLMGateway; 