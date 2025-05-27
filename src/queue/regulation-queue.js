/**
 * BullMQ-based job queue for regulation processing
 */
// Fix import for CommonJS module
import bullmq from 'bullmq';
const { Queue, Worker, QueueScheduler } = bullmq;

import { createClient } from 'redis';
import dotenv from 'dotenv';
import { setupLogger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('regulation-queue');

// Redis connection
let redisClient;
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
};

// Queue names
const REGULATION_QUEUE = 'regulation-processing';

// Initialize Redis client
async function initRedis() {
  try {
    redisClient = createClient({
      url: `redis://${redisOptions.host}:${redisOptions.port}`,
      password: redisOptions.password
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });
    
    await redisClient.connect();
    logger.info('Redis connection established');
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// Shared connection for all queues
let connection;

/**
 * Initialize the queue and its dependencies
 */
export async function initQueue() {
  if (!connection) {
    // Create Redis connection
    await initRedis();
    connection = {
      connection: redisOptions
    };
    
    logger.info('Job queue initialized');
  }
  
  return connection;
}

// Queue and scheduler instances
let regulationQueue;
let regulationScheduler;

/**
 * Get or create the regulation queue
 */
export async function getRegulationQueue() {
  if (!regulationQueue) {
    const conn = await initQueue();
    
    regulationQueue = new Queue(REGULATION_QUEUE, {
      connection: conn.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
    
    // Create scheduler
    regulationScheduler = new QueueScheduler(REGULATION_QUEUE, {
      connection: conn.connection
    });
    
    logger.info('Regulation queue created');
  }
  
  return regulationQueue;
}

/**
 * Add a job to the regulation refresh queue
 * @param {Object} params Job parameters
 * @param {string} params.regulationId The regulation ID to refresh
 * @param {string} params.tenantId The tenant ID
 * @param {string} params.priority Job priority (high, medium, low)
 * @param {string} params.source Source of the job (cdc, api, etc.)
 * @param {Object} params.payload Additional payload data
 */
export async function addRefreshJob({
  regulationId,
  tenantId,
  priority = 'medium',
  source = 'api',
  payload = {}
}) {
  // Validate required parameters
  if (!regulationId || !tenantId) {
    throw new Error('Missing required parameters: regulationId and tenantId');
  }
  
  const queue = await getRegulationQueue();
  
  // Map priority to numeric value
  const priorityMap = {
    high: 1,
    medium: 5,
    low: 10
  };
  
  // Create job ID to enable idempotency for the same regulation
  const jobId = `${tenantId}:${regulationId}`;
  
  // Create job data
  const jobData = {
    regulationId,
    tenantId,
    source,
    timestamp: new Date().toISOString(),
    ...payload
  };
  
  // Job options
  const jobOptions = {
    priority: priorityMap[priority] || 5,
    jobId,
    attempts: 3
  };
  
  // Add job to queue
  const job = await queue.add('refresh-regulation', jobData, jobOptions);
  
  logger.info('Added regulation refresh job', {
    jobId: job.id,
    regulationId,
    tenantId,
    priority
  });
  
  return job;
}

/**
 * Process regulation refresh jobs
 */
export async function startRegulationWorker() {
  await initQueue();
  
  const worker = new Worker(
    REGULATION_QUEUE,
    async (job) => {
      const { regulationId, tenantId, source } = job.data;
      
      logger.info('Processing regulation refresh job', {
        jobId: job.id,
        regulationId,
        tenantId,
        source
      });
      
      // Implement actual regulation processing logic here
      // This could include:
      // 1. Fetching regulation data from database
      // 2. Processing and transforming the regulation
      // 3. Updating any derived data
      // 4. Notifying connected clients
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Regulation refresh completed', {
        jobId: job.id,
        regulationId,
        tenantId
      });
      
      return {
        success: true,
        regulationId,
        tenantId,
        completedAt: new Date().toISOString()
      };
    },
    {
      connection: connection.connection,
      concurrency: 5
    }
  );
  
  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id });
  });
  
  worker.on('failed', (job, error) => {
    logger.error('Job failed', { jobId: job?.id, error: error.message });
  });
  
  logger.info('Regulation worker started');
  
  return worker;
}

/**
 * Gracefully shut down all queue resources
 */
export async function closeQueues() {
  logger.info('Closing job queues...');
  
  if (regulationQueue) {
    await regulationQueue.close();
  }
  
  if (regulationScheduler) {
    await regulationScheduler.close();
  }
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  logger.info('Job queues closed');
}

// Expose queue API routes
export function setupQueueRoutes(app) {
  // Add refresh job endpoint
  app.post('/queue/refresh', async (req, res) => {
    try {
      const { regulationId, priority } = req.body;
      const tenantId = req.tenantId;
      
      if (!regulationId) {
        return res.status(400).json({ error: 'regulationId is required' });
      }
      
      const jobId = await addRefreshJob({
        regulationId,
        tenantId,
        priority: priority || 'medium',
        source: 'api'
      });
      
      res.status(201).json({ 
        message: 'Refresh job added to queue',
        jobId
      });
    } catch (error) {
      logger.error('Error adding refresh job:', error);
      res.status(500).json({ error: 'Failed to add refresh job' });
    }
  });
  
  // Get job status endpoint
  app.get('/queue/jobs/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await regulationQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Check if job belongs to this tenant
      const jobTenantId = job.data.tenantId;
      if (jobTenantId !== req.tenantId) {
        return res.status(403).json({ error: 'Not authorized to access this job' });
      }
      
      const state = await job.getState();
      const progress = job.progress || 0;
      
      res.json({
        id: job.id,
        state,
        progress,
        data: job.data,
        attempts: job.attemptsMade,
        timestamp: job.timestamp
      });
    } catch (error) {
      logger.error('Error retrieving job status:', error);
      res.status(500).json({ error: 'Failed to retrieve job status' });
    }
  });
} 