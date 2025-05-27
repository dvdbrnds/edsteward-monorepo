/**
 * Main application entry point
 * Integrates all components and starts the server
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';
import { setupLogger } from './utils/logger.js';
import { startCdcConsumer } from './cdc/cdc-consumer.js';
import { startRegulationWorker } from './queue/regulation-queue.js';
import { setupDebeziumConnector } from './cdc/setup-debezium.js';
import adminRoutes from './routes/adminRoutes.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('app');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3050'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  credentials: true
};

app.use(cors(corsOptions));

// Request logging
app.use(morgan('dev'));

// Parse JSON request body
app.use(express.json());

// Apply rate limiting if enabled
if (process.env.ENABLE_RATE_LIMIT === 'true') {
  try {
    const { applyRateLimiters } = await import('./middleware/rateLimiter.js');
    applyRateLimiters(app);
    logger.info('Rate limiting enabled');
  } catch (error) {
    logger.warn('Failed to apply rate limiting:', error.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/v1/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

/**
 * Start the application
 */
export async function startApp() {
  try {
    // Start CDC consumer
    if (process.env.ENABLE_CDC === 'true') {
      logger.info('Starting CDC consumer...');
      await startCdcConsumer();
      
      // Set up Debezium connector
      logger.info('Setting up Debezium connector...');
      await setupDebeziumConnector();
    }
    
    // Start regulation worker
    if (process.env.ENABLE_WORKER === 'true') {
      logger.info('Starting regulation worker...');
      await startRegulationWorker();
    }
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`);
      logger.info('Environment: ' + process.env.NODE_ENV);
    });
    
    // Handle graceful shutdown
    setupGracefulShutdown();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  // Graceful shutdown handler
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    try {
      // Cleanup resources
      if (process.env.ENABLE_CDC === 'true') {
        const { stopCdcConsumer } = await import('./cdc/cdc-consumer.js');
        await stopCdcConsumer();
      }
      
      if (process.env.ENABLE_WORKER === 'true') {
        const { closeQueues } = await import('./queue/regulation-queue.js');
        await closeQueues();
      }
      
      const { closePool } = await import('./database/connection.js');
      await closePool();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };
  
  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Start application if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startApp();
}

// Export app for testing
export default app; 