/**
 * Batch Processing Server
 * Server for handling batch processing of compliance queries
 */
import express from 'express';
import { createExpressApp, startServer } from '../core/server-factory.js';
import { setupLogger } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('batch-server');

/**
 * Create batch routes
 */
function createBatchRoutes(options = {}) {
  const router = express.Router();
  
  // Get batch status endpoint
  router.get('/status', (req, res) => {
    res.json({
      status: 'available',
      activeJobs: 0,
      queuedJobs: 0,
      completedJobs: 0,
      lastRun: null,
      timestamp: new Date().toISOString()
    });
  });
  
  // Submit batch job endpoint
  router.post('/submit', (req, res) => {
    // This is a stub that would normally process the batch job
    logger.info('Batch job submission received', { body: req.body });
    
    res.status(202).json({
      jobId: `job-${Date.now()}`,
      status: 'queued',
      message: 'Batch job has been queued',
      timestamp: new Date().toISOString()
    });
  });
  
  return router;
}

/**
 * Start the Batch Processing server
 * @param {Object} options Configuration options
 * @returns {Object} The server instance
 */
export default async function startBatchServer(options = {}) {
  const {
    port = 3001,
    batchDir,
    outputDir,
    registry,
    processQuery
  } = options;
  
  try {
    // Create batch routes
    const batchRoutes = createBatchRoutes({ batchDir, outputDir, registry, processQuery });
    
    // Create Express app using factory
    const { app } = await createExpressApp({
      name: 'batch-server',
      routes: [
        { path: '/batch', router: batchRoutes }
      ]
    });
    
    // Start server
    const server = startServer(app, {
      port,
      name: 'batch-server',
      onReady: () => {
        logger.info(`Health check endpoint: http://localhost:${port}/health`);
        logger.info(`Batch status endpoint: http://localhost:${port}/batch/status`);
      }
    });
    
    return { server, app };
  } catch (error) {
    logger.error(`Failed to start batch server: ${error.message}`);
    throw error;
  }
} 