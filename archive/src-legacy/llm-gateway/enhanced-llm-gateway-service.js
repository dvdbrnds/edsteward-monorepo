/**
 * Enhanced LLM Gateway Service
 * 
 * Provides an enhanced gateway service with the ability to:
 * - Start and manage multiple regulation servers
 * - Preload regulation servers for specific categories
 * - Route compliance queries to appropriate regulation servers
 * - Manage server lifecycle based on usage patterns
 */

import express from 'express';
import cors from 'cors';
import { MCPHostController } from '../controllers/MCPHostController.js';
import { setupLogger } from '../utils/logger.js';
import axios from 'axios';

/**
 * Initialize the enhanced LLM gateway service
 * @param {Object} options Configuration options
 * @returns {Object} Service info including app, controller, and helper functions
 */
export async function initializeService(options = {}) {
  const config = {
    port: options.port || 3100,
    baseMcpPort: options.baseMcpPort || 3200,
    maxConcurrentServers: options.maxConcurrentServers || 10,
    autoShutdown: options.autoShutdown !== false,
    idleTimeout: options.idleTimeout || 300000, // 5 minutes by default
    serverStartTimeout: options.serverStartTimeout || 30000, // 30 seconds
    ...options
  };

  const logger = setupLogger(options.loggerName || 'enhanced-llm-gateway');
  const app = express();

  // Configure middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize MCP Host Controller
  const controller = new MCPHostController({
    basePort: config.baseMcpPort,
    maxConcurrent: config.maxConcurrentServers,
    autoShutdown: config.autoShutdown,
    idleTimeout: config.idleTimeout,
    serverStartTimeout: config.serverStartTimeout,
    logger
  });

  // Setup routes
  setupRoutes(app, controller, logger);

  // Start the server
  const server = app.listen(config.port, () => {
    logger.info(`Enhanced LLM Gateway Service started on port ${config.port}`);
  });

  // Create a shutdown function
  const shutdown = async () => {
    logger.info('Shutting down Enhanced LLM Gateway Service...');
    
    // Stop all running MCP servers
    await controller.stopAllRunningServers({ force: true });
    
    // Close the HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });
  };

  // Handle graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Helper function to preload servers for specific categories
  const preloadServers = async (categories = []) => {
    if (!categories || categories.length === 0) {
      logger.info('No categories specified for preloading');
      return { success: true, message: 'No categories specified for preloading' };
    }

    logger.info(`Preloading servers for categories: ${categories.join(', ')}`);
    
    const results = {
      success: true,
      categories: {}
    };

    // Start servers for each category
    for (const category of categories) {
      try {
        logger.info(`Starting servers for category: ${category}`);
        const servers = await controller.startAllServers({ category });
        
        results.categories[category] = {
          success: true,
          servers: servers.map(server => ({
            port: server.port,
            regulationId: server.regulationId || 'default'
          }))
        };
        
        logger.info(`Successfully started ${servers.length} servers for category: ${category}`);
      } catch (error) {
        logger.error(`Failed to start servers for category: ${category}`, { error: error.message });
        
        results.success = false;
        results.categories[category] = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  };

  // Return the service info
  return {
    app,
    server,
    controller,
    shutdown,
    preloadServers,
    config
  };
}

/**
 * Setup routes for the enhanced LLM gateway
 * @param {Object} app Express app
 * @param {Object} controller MCP Host Controller
 * @param {Object} logger Logger instance
 */
function setupRoutes(app, controller, logger) {
  // Health check endpoint
  app.get('/health', (req, res) => {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      serverStatus: controller.getStatus()
    };
    res.json(status);
  });

  // Get registry endpoint
  app.get('/registry', async (req, res) => {
    try {
      const forceGenerate = req.query.forceGenerate === 'true';
      const category = req.query.category || null;
      
      logger.info('Registry requested', { forceGenerate, category });
      
      const registry = await controller.getRegistry({
        forceGenerate,
        category
      });
      
      res.json(registry);
    } catch (error) {
      logger.error('Failed to get registry', { error: error.message });
      res.status(500).json({
        error: 'Failed to get registry',
        message: error.message
      });
    }
  });

  // Start server endpoint
  app.post('/servers/start', async (req, res) => {
    try {
      const { category, regulationId } = req.body;
      
      if (!category) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Category is required'
        });
      }
      
      logger.info('Starting server', { category, regulationId });
      
      const serverInfo = await controller.startServer({
        category,
        regulationId
      });
      
      res.json({
        success: true,
        server: serverInfo
      });
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      res.status(500).json({
        error: 'Failed to start server',
        message: error.message
      });
    }
  });

  // Start all servers for a category endpoint
  app.post('/servers/start-all', async (req, res) => {
    try {
      const { category, generateRegistry } = req.body;
      
      if (!category) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Category is required'
        });
      }
      
      logger.info('Starting all servers for category', { 
        category, 
        generateRegistry 
      });
      
      const servers = await controller.startAllServers({
        category,
        generateRegistry
      });
      
      res.json({
        success: true,
        servers
      });
    } catch (error) {
      logger.error('Failed to start all servers', { error: error.message });
      res.status(500).json({
        error: 'Failed to start all servers',
        message: error.message
      });
    }
  });

  // Stop server endpoint
  app.post('/servers/stop', async (req, res) => {
    try {
      const { category, regulationId, force } = req.body;
      
      if (!category) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Category is required'
        });
      }
      
      logger.info('Stopping server', { category, regulationId, force });
      
      const result = await controller.stopServer({
        category,
        regulationId,
        force
      });
      
      res.json({
        success: result
      });
    } catch (error) {
      logger.error('Failed to stop server', { error: error.message });
      res.status(500).json({
        error: 'Failed to stop server',
        message: error.message
      });
    }
  });

  // Stop all servers for a category endpoint
  app.post('/servers/stop-all', async (req, res) => {
    try {
      const { category, force } = req.body;
      
      if (!category) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Category is required'
        });
      }
      
      logger.info('Stopping all servers for category', { category, force });
      
      const result = await controller.stopAllServers({
        category,
        force
      });
      
      res.json({
        success: result
      });
    } catch (error) {
      logger.error('Failed to stop all servers', { error: error.message });
      res.status(500).json({
        error: 'Failed to stop all servers',
        message: error.message
      });
    }
  });

  // Stop all running servers endpoint
  app.post('/servers/stop-all-running', async (req, res) => {
    try {
      const { force } = req.body;
      
      logger.info('Stopping all running servers', { force });
      
      const result = await controller.stopAllRunningServers({
        force
      });
      
      res.json({
        success: result
      });
    } catch (error) {
      logger.error('Failed to stop all running servers', { error: error.message });
      res.status(500).json({
        error: 'Failed to stop all running servers',
        message: error.message
      });
    }
  });

  // Get server status endpoint
  app.get('/servers/status', (req, res) => {
    const status = controller.getStatus();
    res.json(status);
  });

  // Compliance query endpoint
  app.post('/compliance/query', async (req, res) => {
    try {
      const { query, context = {}, category } = req.body;
      
      if (!query) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Query is required'
        });
      }
      
      if (!category) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Category is required'
        });
      }
      
      logger.info('Processing compliance query', { category });
      
      // Start the server for this category if needed
      let serverInfo;
      try {
        // Check if we have a category-specific or regulation-specific query
        const regulationId = context.regulationId || null;
        
        serverInfo = await controller.startServer({
          category,
          regulationId
        });
        
        logger.info(`Using server on port ${serverInfo.port} for query`);
      } catch (error) {
        logger.error('Failed to start server for query', { error: error.message });
        return res.status(500).json({
          error: 'Failed to start server for query',
          message: error.message
        });
      }
      
      // Forward the query to the MCP server
      try {
        const mcpResponse = await axios.post(`http://localhost:${serverInfo.port}/query`, {
          query,
          context
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        });
        
        // Return the response from the MCP server
        res.json(mcpResponse.data);
      } catch (error) {
        logger.error('Failed to process query with MCP server', {
          error: error.message,
          serverInfo
        });
        
        // Forward error message from MCP server if available
        if (error.response && error.response.data) {
          return res.status(error.response.status || 500).json(error.response.data);
        }
        
        // Generic error message
        res.status(500).json({
          error: 'Failed to process query',
          message: error.message
        });
      }
    } catch (error) {
      logger.error('Unexpected error processing compliance query', { error: error.message });
      res.status(500).json({
        error: 'Unexpected error processing compliance query',
        message: error.message
      });
    }
  });

  // Batch compliance query endpoint
  app.post('/compliance/batch-query', async (req, res) => {
    try {
      const { queries, parallelLimit = 3 } = req.body;
      
      if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({
          error: 'Invalid queries parameter',
          message: 'Queries must be a non-empty array'
        });
      }
      
      logger.info(`Processing batch of ${queries.length} compliance queries`);
      
      // Function to process a single query
      const processQuery = async (queryData, index) => {
        try {
          const { query, context = {}, category } = queryData;
          
          if (!query || !category) {
            return {
              success: false,
              index,
              error: 'Missing required parameters: query and category are required'
            };
          }
          
          // Start the server for this category if needed
          let serverInfo;
          try {
            const regulationId = context.regulationId || null;
            
            serverInfo = await controller.startServer({
              category,
              regulationId
            });
          } catch (error) {
            logger.error(`Failed to start server for query ${index}`, { error: error.message });
            return {
              success: false,
              index,
              error: `Failed to start server: ${error.message}`
            };
          }
          
          // Forward the query to the MCP server
          try {
            const mcpResponse = await axios.post(`http://localhost:${serverInfo.port}/query`, {
              query,
              context
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 60000 // 60 second timeout
            });
            
            return {
              success: true,
              index,
              result: mcpResponse.data
            };
          } catch (error) {
            logger.error(`Failed to process query ${index} with MCP server`, {
              error: error.message,
              serverInfo
            });
            
            // Extract error message from MCP server if available
            let errorMessage = error.message;
            let errorDetails = null;
            
            if (error.response && error.response.data) {
              if (error.response.data.error) {
                errorMessage = error.response.data.error;
              }
              if (error.response.data.message) {
                errorDetails = error.response.data.message;
              }
            }
            
            return {
              success: false,
              index,
              error: errorMessage,
              details: errorDetails
            };
          }
        } catch (error) {
          logger.error(`Unexpected error processing query ${index}`, { error: error.message });
          return {
            success: false,
            index,
            error: `Unexpected error: ${error.message}`
          };
        }
      };
      
      // Process queries with parallelism limit
      const results = [];
      const limit = Math.min(parallelLimit, 10); // Cap at 10 parallel requests
      
      // Process in batches
      for (let i = 0; i < queries.length; i += limit) {
        const batch = queries.slice(i, i + limit);
        const batchPromises = batch.map((query, batchIndex) => 
          processQuery(query, i + batchIndex)
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      // Count successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      logger.info(`Batch processing complete: ${successes} successful, ${failures} failed`);
      
      res.json({
        success: true,
        totalQueries: queries.length,
        successfulQueries: successes,
        failedQueries: failures,
        results
      });
    } catch (error) {
      logger.error('Unexpected error processing batch queries', { error: error.message });
      res.status(500).json({
        error: 'Unexpected error processing batch queries',
        message: error.message
      });
    }
  });
} 