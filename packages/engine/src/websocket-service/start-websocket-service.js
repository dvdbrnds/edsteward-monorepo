#!/usr/bin/env node
/**
 * Start EdSteward WebSocket Service
 * Standalone script to start the WebSocket service on port 3003
 */
import { EdStewardWebSocketService } from './edsteward-websocket-server.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('websocket-service-starter');

async function startWebSocketService() {
  try {
    logger.info('🚀 Starting EdSteward WebSocket Service...');
    
    const service = new EdStewardWebSocketService({
      port: 3003
    });
    
    // Handle graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await service.stop();
        logger.info('✅ WebSocket service stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught exception:', error.message);
      logger.error('Stack trace:', error.stack);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
    
    // Start the service
    await service.start();
    
    logger.info('✅ EdSteward WebSocket Service started successfully');
    logger.info('🔌 Listening for EdSteward connections on ws://localhost:3003/regulation-updates');
    logger.info('📊 Service supports validation levels: A, B, C, D');
    
  } catch (error) {
    logger.error('❌ Failed to start WebSocket service:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Start the service
startWebSocketService();
