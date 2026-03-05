/**
 * Start CDC components without starting the full application
 * This script initializes the Debezium connector and CDC consumer
 */
import dotenv from 'dotenv';
import { setupLogger } from './utils/logger.js';
import { startCdcConsumer } from './cdc/cdc-consumer.js';
import { setupDebeziumConnector } from './cdc/setup-debezium.js';

// Load environment variables
dotenv.config();

// Set environment variables for CDC
process.env.ENABLE_CDC = 'true';

// Initialize logger
const logger = setupLogger('cdc-starter');

/**
 * Start CDC components
 */
async function startCdc() {
  try {
    // Initialize CDC consumer
    logger.info('Starting CDC consumer...');
    await startCdcConsumer();
    
    // Set up Debezium connector
    logger.info('Setting up Debezium connector...');
    await setupDebeziumConnector();
    
    logger.info('CDC system started successfully');
    
    // Keep process running
    logger.info('CDC system is now running - Press Ctrl+C to stop');
  } catch (error) {
    logger.error('Failed to start CDC system:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down CDC system...');
  await shutdown();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down CDC system...');
  await shutdown();
});

/**
 * Gracefully shut down CDC components
 */
async function shutdown() {
  try {
    // Stop CDC consumer
    const { stopCdcConsumer } = await import('./cdc/cdc-consumer.js');
    await stopCdcConsumer();
    
    logger.info('CDC system shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during CDC system shutdown:', error);
    process.exit(1);
  }
}

// Start CDC system
startCdc(); 