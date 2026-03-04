import { MCPHostController } from './controllers/MCPHostController.js';
import { setupLogger } from './utils/logger.js';

// Initialize logger
const logger = setupLogger('MCP-Server');

/**
 * Start all MCP servers
 */
async function startServers() {
  try {
    logger.info('Starting MCP Servers...');
    
    // Create and initialize the MCP Host Controller
    const controller = new MCPHostController();
    await controller.initialize();
    
    // Start the LLM Gateway
    await controller.startLLMGateway();
    
    // Start the Batch Server
    await controller.startBatchServer();
    
    logger.info('All MCP Servers started successfully');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP Servers...');
      await controller.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Shutting down MCP Servers...');
      await controller.shutdown();
      process.exit(0);
    });
    
    return controller;
  } catch (error) {
    logger.error('Failed to start MCP Servers', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the servers
startServers(); 