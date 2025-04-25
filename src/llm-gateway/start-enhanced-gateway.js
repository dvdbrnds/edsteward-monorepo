#!/usr/bin/env node

/**
 * Start Enhanced LLM Gateway Service
 * 
 * This script starts the Enhanced LLM Gateway Service with optional
 * configuration settings from environment variables or command line arguments.
 * It also supports preloading servers for specific categories.
 */

import dotenv from 'dotenv';
import { program } from 'commander';
import { initializeService } from './enhanced-llm-gateway-service.js';
import { setupLogger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Set up logger
const logger = setupLogger('enhanced-gateway-launcher');

// Parse command line arguments
program
  .option('-p, --port <number>', 'Port to run the gateway service on', parseInt)
  .option('-b, --base-port <number>', 'Base port for MCP servers', parseInt)
  .option('-m, --max-concurrent <number>', 'Maximum concurrent servers', parseInt)
  .option('-i, --idle-timeout <number>', 'Idle timeout for servers (ms)', parseInt)
  .option('-t, --start-timeout <number>', 'Server start timeout (ms)', parseInt)
  .option('-c, --categories <items>', 'Categories to preload (comma-separated)')
  .option('-a, --auto-shutdown <boolean>', 'Enable auto shutdown of idle servers', val => val === 'true')
  .option('-l, --log-level <level>', 'Log level (debug, info, warn, error)')
  .option('-r, --registry-path <path>', 'Path to registry file')
  .option('-s, --server-script <path>', 'Path to server script')
  .option('--no-preload', 'Disable category preloading')
  .parse(process.argv);

const options = program.opts();

// Build configuration from environment variables and command line options
const config = {
  port: options.port || parseInt(process.env.LLM_GATEWAY_PORT || '3100'),
  baseMcpPort: options.basePort || parseInt(process.env.BASE_MCP_PORT || '3200'),
  maxConcurrentServers: options.maxConcurrent || parseInt(process.env.MAX_CONCURRENT_SERVERS || '10'),
  autoShutdown: options.autoShutdown !== undefined 
    ? options.autoShutdown 
    : process.env.AUTO_SHUTDOWN === 'true',
  idleTimeout: options.idleTimeout || parseInt(process.env.IDLE_TIMEOUT || '300000'),
  serverStartTimeout: options.startTimeout || parseInt(process.env.SERVER_START_TIMEOUT || '30000'),
  logLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
  registryPath: options.registryPath || process.env.REGISTRY_PATH,
  serverScript: options.serverScript || process.env.SERVER_SCRIPT
};

// Extract categories to preload
const categoriesToPreload = options.categories 
  ? options.categories.split(',').map(c => c.trim())
  : process.env.PRELOAD_CATEGORIES 
    ? process.env.PRELOAD_CATEGORIES.split(',').map(c => c.trim())
    : [];

// Log startup info
logger.info('Starting Enhanced LLM Gateway Service...', { 
  config,
  categoriesToPreload 
});

// Start the service
async function startService() {
  try {
    // Initialize the service
    const service = await initializeService(config);
    
    logger.info(`Enhanced LLM Gateway Service started on port ${config.port}`);
    
    // Preload categories if specified
    if (categoriesToPreload.length > 0 && options.preload !== false) {
      logger.info(`Preloading servers for categories: ${categoriesToPreload.join(', ')}`);
      
      try {
        const preloadResults = await service.preloadServers(categoriesToPreload);
        logger.info('Preloading completed', { preloadResults });
      } catch (error) {
        logger.error('Error during preloading', { error: error.message });
      }
    }
    
    // Export the service for testing
    return service;
  } catch (error) {
    logger.error('Failed to start Enhanced LLM Gateway Service', { 
      error: error.message,
      stack: error.stack
    });
    
    // Exit with error code
    process.exit(1);
  }
}

// Start the service if not imported as a module
if (process.env.NODE_ENV !== 'test') {
  startService();
}

export default startService; 