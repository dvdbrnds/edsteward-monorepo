import express from 'express';
import cors from 'cors';
import { setupLogger } from '../utils/logger.js';

// Initialize logger
const logger = setupLogger('BatchServer');

/**
 * Start the Batch Processing server
 * @param {Object} options Configuration options
 * @returns {Object} The server instance
 */
export default async function startBatchServer(options = {}) {
  // Default options
  const {
    port = 3001,
    batchDir,
    outputDir,
    registry,
    processQuery
  } = options;
  
  // Create Express app
  const app = express();
  
  // Add middleware
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'batch-server',
      timestamp: new Date().toISOString()
    });
  });
  
  // Get batch status endpoint
  app.get('/batch/status', (req, res) => {
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
  app.post('/batch/submit', (req, res) => {
    // This is a stub that would normally process the batch job
    logger.info('Batch job submission received', { body: req.body });
    
    res.status(202).json({
      jobId: `job-${Date.now()}`,
      status: 'queued',
      message: 'Batch job has been queued',
      timestamp: new Date().toISOString()
    });
  });
  
  // Start the server
  const server = app.listen(port, () => {
    logger.info(`Batch server started on port ${port}`);
    logger.info(`Health check endpoint: http://localhost:${port}/health`);
    logger.info(`Batch status endpoint: http://localhost:${port}/batch/status`);
  });
  
  return { server, app };
} 