/**
 * Express Server Factory
 * Creates configured Express applications with common middleware
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupLogger } from '../utils/logger.js';
import { config } from './config.js';
import { createErrorResponse, logError, isAppError } from './error-types.js';

/**
 * Create a configured Express application
 * @param {Object} options Configuration options
 * @param {string} options.name Service name for logging
 * @param {Array} options.routes Route definitions
 * @param {Object} options.cors CORS configuration
 * @param {boolean} options.enableAuth Enable authentication middleware
 * @param {boolean} options.enableRateLimit Enable rate limiting
 * @param {Array} options.middleware Additional middleware
 * @returns {Object} Configured Express app and logger
 */
export async function createExpressApp(options = {}) {
  const {
    name = 'app',
    routes = [],
    cors: corsConfig = null,
    enableAuth = false,
    enableRateLimit = false,
    middleware = []
  } = options;

  const logger = setupLogger(name);
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration using centralized config
  const defaultCorsOptions = {
    origin: config.security.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true
  };

  app.use(cors(corsConfig || defaultCorsOptions));

  // Request logging
  if (config.logging.enableConsole) {
    app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // Parse JSON request body
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Authentication middleware (if enabled)
  if (enableAuth) {
    try {
      const { authMiddleware } = await import('../middleware/authentication.js');
      app.use(authMiddleware);
      logger.info('Authentication middleware enabled');
    } catch (error) {
      logger.warn('Failed to load authentication middleware:', error.message);
    }
  }

  // Rate limiting (if enabled)
  if (enableRateLimit || config.security.rateLimitEnabled) {
    try {
      const { applyRateLimiters } = await import('../middleware/rateLimiter.js');
      applyRateLimiters(app);
      logger.info('Rate limiting enabled');
    } catch (error) {
      logger.warn('Failed to apply rate limiting:', error.message);
    }
  }

  // Custom middleware
  middleware.forEach(mw => {
    app.use(mw);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      service: name,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.NODE_ENV
    });
  });

  // Apply routes
  routes.forEach(({ path, router }) => {
    app.use(path, router);
    logger.info(`Registered routes for ${path}`);
  });

  // Global error handling middleware
  app.use((err, req, res, next) => {
    // Log the error
    logError(logger, err, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Send appropriate response
    if (isAppError(err)) {
      res.status(err.statusCode).json(createErrorResponse(err));
    } else {
      // Handle unexpected errors
      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          message: config.NODE_ENV === 'development' 
            ? err.message 
            : 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      }
    });
  });

  return { app, logger };
}

/**
 * Start an Express server
 * @param {Object} app Express application
 * @param {Object} options Server options
 * @param {number} options.port Port number
 * @param {string} options.name Service name
 * @param {Function} options.onReady Callback when server is ready
 * @returns {Object} Server instance
 */
export function startServer(app, options = {}) {
  const {
    port = config.server.port,
    name = 'app',
    onReady
  } = options;

  const logger = setupLogger(name);

  const server = app.listen(port, () => {
    logger.info(`${name} server started on port ${port}`);
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${port}/health`);
    if (onReady) onReady();
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use`);
      process.exit(1);
    } else {
      logger.error('Server error:', error);
    }
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after timeout
    setTimeout(() => {
      logger.warn('Forcing server shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
} 