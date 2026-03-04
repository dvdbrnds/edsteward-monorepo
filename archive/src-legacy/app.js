/**
 * Main application entry point
 * Integrates all components and starts the server
 */
import { createExpressApp, startServer } from './core/server-factory.js';
import { startCdcConsumer, stopCdcConsumer } from './cdc/cdc-consumer.js';
import { startRegulationWorker, closeQueues } from './queue/regulation-queue.js';
import { setupDebeziumConnector } from './cdc/setup-debezium.js';
import { closePool } from './database/connection.js';
import { setupLogger } from './utils/logger.js';
import adminRoutes from './routes/adminRoutes.js';

// Initialize logger
const logger = setupLogger('app');

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    try {
      // Cleanup resources
      if (process.env.ENABLE_CDC === 'true') {
        await stopCdcConsumer();
      }
      
      if (process.env.ENABLE_WORKER === 'true') {
        await closeQueues();
      }
      
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

/**
 * Start background services
 */
async function startBackgroundServices() {
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
  } catch (error) {
    logger.error('Failed to start background services:', error);
    throw error;
  }
}

/**
 * Start the application
 */
export async function startApp() {
  try {
    // Start background services
    await startBackgroundServices();
    
    // Create Express app using factory
    const { app } = await createExpressApp({
      name: 'app',
      routes: [
        { path: '/v1/admin', router: adminRoutes }
      ],
      enableRateLimit: true
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    startServer(app, {
      port: PORT,
      name: 'app',
      onReady: () => {
        logger.info('Environment: ' + process.env.NODE_ENV);
      }
    });
    
    // Handle graceful shutdown
    setupGracefulShutdown();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start application if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startApp();
}

// Export for testing
export { setupGracefulShutdown, startBackgroundServices }; 