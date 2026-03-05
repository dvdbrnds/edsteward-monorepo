/**
 * Mock Server
 * Simple mock server for testing API endpoints
 */
import express from 'express';
import { createExpressApp, startServer } from './core/server-factory.js';
import { setupLogger } from './utils/logger.js';

const logger = setupLogger('mock-server');

/**
 * Create mock routes
 */
function createMockRoutes() {
  const router = express.Router();
  
  // Compliance query endpoint
  router.post('/query', (req, res) => {
    const { query, regulationId } = req.body;
    
    if (!query) {
      logger.error('Missing query in request body');
      return res.status(400).json({
        error: 'Missing query in request body'
      });
    }
    
    logger.info(`Processing compliance query: ${query}`);
    
    // Mock response
    setTimeout(() => {
      res.json({
        result: Math.random() > 0.3 ? 'compliant' : 'non_compliant',
        confidence: (0.7 + Math.random() * 0.3).toFixed(2),
        timestamp: new Date().toISOString(),
        processingTime: '235ms',
        regulation: regulationId || 'default',
        details: {
          analysis: 'The document was analyzed for compliance with relevant regulations.',
          findings: Math.random() > 0.5 ? [
            { type: 'info', text: 'Privacy policy present' },
            { type: 'warning', text: 'Data retention policy could be more specific' }
          ] : []
        }
      });
    }, 500); // Simulate processing time
  });
  
  return router;
}

/**
 * Start the mock server
 */
async function startMockServer() {
  try {
    // Request logging middleware
    const requestLogger = (req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    };
    
    // Create mock routes
    const mockRoutes = createMockRoutes();
    
    // Create Express app using factory
    const { app } = await createExpressApp({
      name: 'mock-server',
      routes: [
        { path: '/compliance', router: mockRoutes }
      ],
      middleware: [requestLogger]
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    startServer(app, {
      port: PORT,
      name: 'mock-server'
    });
  } catch (error) {
    logger.error(`Failed to start mock server: ${error.message}`);
    process.exit(1);
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockServer();
} 