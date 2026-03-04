/**
 * LLM Gateway Service (Refactored)
 * Starting point for the LLM Gateway service using the new architecture
 */
import { createExpressApp, startServer } from '../core/server-factory.js';
import routesRefactored from './routes-refactored.js';
import { setupServices } from '../shared/container/service-registry.js';
import { config, getServiceConfig } from '../core/config.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('llm-gateway-refactored');

/**
 * Start the LLM Gateway service with new architecture
 */
async function startLLMGatewayRefactored() {
  try {
    logger.info('Starting LLM Gateway service (refactored)...');
    
    // Initialize services first
    logger.info('Initializing service layer...');
    await setupServices();
    logger.info('Service layer initialized successfully');
    
    // Get service-specific configuration
    const serviceConfig = getServiceConfig('llm-gateway');
    
    // Create Express app with custom configuration
    const { app, logger: appLogger } = await createExpressApp({
      name: 'llm-gateway-refactored',
      routes: [
        { path: '/api/llm', router: routesRefactored }
      ],
      cors: {
        origin: config.security.allowedOrigins,
        credentials: true
      }
    });
    
    // Add service-specific middleware
    app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });
    
    // Add response time header
    app.use((req, res, next) => {
      res.on('finish', () => {
        const responseTime = Date.now() - req.startTime;
        logger.debug(`Request completed: ${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`);
      });
      next();
    });
    
    // Mount routes
    logger.info('Mounting routes...');
    logger.info('Routes object type:', typeof routesRefactored);
    logger.info('Routes object:', routesRefactored);
    
    logger.info('Routes mounted successfully at /api/llm');
    
    // Add specific error handling for LLM service
    app.use((error, req, res, next) => {
      logger.error('LLM Gateway error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body
      });
      
      // Return appropriate error response
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code || 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    });
    
    // Start server
    const port = serviceConfig.port || 3002;
    const server = startServer(app, {
      port,
      name: 'llm-gateway-refactored',
      onReady: () => {
        logger.info(`LLM Gateway (refactored) running on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/api/llm/health`);
        logger.info(`Service endpoints: http://localhost:${port}/api/llm/`);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start LLM Gateway (refactored):', error.message);
    process.exit(1);
  }
}

// Start service if this file is run directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('start-llm-gateway-refactored.js');

if (isMainModule) {
  logger.info('Starting service from command line...');
  startLLMGatewayRefactored().catch(error => {
    logger.error('Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  });
} else {
  logger.debug('Module loaded but not executed directly');
}

export { startLLMGatewayRefactored }; 