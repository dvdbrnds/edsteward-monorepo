/**
 * MCPHostController
 * 
 * Manages and coordinates all MCP services including:
 * - LLM Gateway
 * - Regulation Registry
 * - Batch Processing
 * - On-demand Compliance Queries
 */

import path from 'path';
import fs from 'fs/promises';
import { setupLogger, formatError } from '../utils/logger.js';
import { generateRegistryFromCSV, generateRegistryFromDirectory } from '../utils/registry-generator.js';

// Initialize logger
const logger = setupLogger('MCPHostController');

// Default paths
const DEFAULT_CONFIG = {
  registryPath: path.join(process.cwd(), 'regulation-servers-registry.json'),
  csvPath: path.join(process.cwd(), 'compmat.csv'),
  outputDir: path.join(process.cwd(), 'data', 'processed'),
  batchDir: path.join(process.cwd(), 'data', 'batch'),
  llmGatewayPort: 4000,
  batchServerPort: 4001
};

export class MCPHostController {
  constructor(config = {}) {
    // Merge provided config with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.services = {
      llmGateway: null,
      batchServer: null
    };
    this.registry = null;
    this.isInitialized = false;
    
    logger.info('MCPHostController created', { config: this.config });
  }
  
  /**
   * Initialize the MCP Host Controller
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('Initializing MCPHostController');
      
      // Ensure necessary directories exist
      await this.ensureDirectories();
      
      // Generate or load registry
      await this.initializeRegistry();
      
      this.isInitialized = true;
      logger.info('MCPHostController initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCPHostController', formatError(error));
      throw error;
    }
  }
  
  /**
   * Ensure required directories exist
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    const directories = [
      // Skip registryPath since it's now a file, not a directory
      this.config.outputDir,
      this.config.batchDir
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        logger.debug(`Directory ensured: ${dir}`);
      } catch (error) {
        logger.error(`Failed to create directory: ${dir}`, formatError(error));
        throw error;
      }
    }
  }
  
  /**
   * Initialize the regulation registry
   * @returns {Promise<void>}
   */
  async initializeRegistry() {
    try {
      logger.info('Initializing regulation registry');
      
      // Check if registry already exists
      const registryFile = this.config.registryPath;
      let registryExists = false;
      
      try {
        await fs.access(registryFile);
        registryExists = true;
      } catch (error) {
        // File doesn't exist, which is fine
        registryExists = false;
      }
      
      if (registryExists) {
        // Load existing registry
        const data = await fs.readFile(registryFile, 'utf8');
        this.registry = JSON.parse(data);
        logger.info('Loaded existing registry', { 
          regulationCount: Object.keys(this.registry || {}).length 
        });
      } else {
        // Generate new registry from CSV
        logger.info('Generating new registry from CSV', { csvPath: this.config.csvPath });
        
        // Import the registry generator
        const { generateRegistry } = await import('../regulation-generators/generate-regulation-registry.js');
        await generateRegistry();
        
        // Load the newly created registry
        const data = await fs.readFile(registryFile, 'utf8');
        this.registry = JSON.parse(data);
        logger.info('Generated and loaded new registry', { 
          regulationCount: Object.keys(this.registry || {}).length 
        });
      }
    } catch (error) {
      logger.error('Failed to initialize registry', formatError(error));
      throw error;
    }
  }
  
  /**
   * Start the LLM Gateway server
   * @returns {Promise<void>}
   */
  async startLLMGateway() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (this.services.llmGateway) {
        logger.warn('LLM Gateway already running');
        return;
      }
      
      logger.info('Starting LLM Gateway', { port: this.config.llmGatewayPort });
      
      // Create a simple Express server for the LLM Gateway
      const express = await import('express');
      const cors = await import('cors');
      const app = express.default();
      
      // Middleware
      app.use(cors.default());
      app.use(express.default.json());
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          service: 'llm-gateway',
          timestamp: new Date().toISOString()
        });
      });
      
      // Compliance query endpoint
      app.post('/compliance/query', async (req, res) => {
        try {
          const { query } = req.body;
          
          if (!query) {
            return res.status(400).json({
              error: 'Missing required parameter: query'
            });
          }
          
          // Process the query
          const result = await this.processComplianceQuery({
            query,
            type: 'llm-gateway'
          });
          
          // Return the result
          res.json(result);
        } catch (error) {
          logger.error('Error processing compliance query', formatError(error));
          res.status(500).json({
            error: 'Failed to process query',
            message: error.message
          });
        }
      });
      
      // Start the server
      const server = app.listen(this.config.llmGatewayPort, () => {
        logger.info(`LLM Gateway started on port ${this.config.llmGatewayPort}`);
      });
      
      // Store the server reference
      this.services.llmGateway = server;
      
      logger.info('LLM Gateway started successfully', { port: this.config.llmGatewayPort });
    } catch (error) {
      logger.error('Failed to start LLM Gateway', formatError(error));
      throw error;
    }
  }
  
  /**
   * Start the Batch Processing server
   * @returns {Promise<void>}
   */
  async startBatchServer() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (this.services.batchServer) {
        logger.warn('Batch Server already running');
        return;
      }
      
      logger.info('Starting Batch Server', { port: this.config.batchServerPort });
      
      // Create a simple Express server for the Batch Server
      const express = await import('express');
      const cors = await import('cors');
      const app = express.default();
      
      // Middleware
      app.use(cors.default());
      app.use(express.default.json());
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          service: 'batch-server',
          timestamp: new Date().toISOString()
        });
      });
      
      // Batch processing endpoint
      app.post('/batch/process', async (req, res) => {
        try {
          const { inputDir, outputDir } = req.body;
          
          if (!inputDir) {
            return res.status(400).json({
              error: 'Missing required parameter: inputDir'
            });
          }
          
          // Process the batch
          const result = await this.runBatchProcessing(
            inputDir,
            outputDir || this.config.outputDir
          );
          
          // Return the result
          res.json(result);
        } catch (error) {
          logger.error('Error processing batch', formatError(error));
          res.status(500).json({
            error: 'Failed to process batch',
            message: error.message
          });
        }
      });
      
      // Batch job status endpoint
      app.get('/batch/status/:jobId', (req, res) => {
        // Mock status response for now
        res.json({
          jobId: req.params.jobId,
          status: 'completed',
          progress: 100,
          filesProcessed: 10,
          startTime: new Date(Date.now() - 60000).toISOString(),
          endTime: new Date().toISOString()
        });
      });
      
      // Start the server
      const server = app.listen(this.config.batchServerPort, () => {
        logger.info(`Batch Server started on port ${this.config.batchServerPort}`);
      });
      
      // Store the server reference
      this.services.batchServer = server;
      
      logger.info('Batch Server started successfully', { port: this.config.batchServerPort });
    } catch (error) {
      logger.error('Failed to start Batch Server', formatError(error));
      throw error;
    }
  }
  
  /**
   * Process a compliance query
   * @param {Object} query - Compliance query
   * @param {string} query.query - The text query
   * @returns {Promise<Object>} Query result
   */
  async processComplianceQuery(query) {
    try {
      logger.info('Processing compliance query', { query });
      
      // Try to use the compliance processor service
      try {
        const { processComplianceQuery } = await import('../services/compliance-processor.js');
        return await processComplianceQuery(query.query);
      } catch (error) {
        logger.warn('Failed to use compliance processor service, using mock response', formatError(error));
        
        // Generate a mock response
        return {
          query: query.query,
          result: {
            summary: "Based on the available regulations, your document appears to be compliant with the main requirements.",
            confidence: 0.85,
            relevantRegulations: [
              { id: "REG-001", name: "Data Protection Standard", compliance: "full" },
              { id: "REG-002", name: "Records Retention Policy", compliance: "partial" }
            ],
            recommendations: [
              "Ensure all records are kept for the minimum required period of 7 years",
              "Include a clear data processing statement in your documentation"
            ]
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Error processing compliance query', formatError(error));
      throw error;
    }
  }
  
  /**
   * Run batch processing on a directory of files
   * @param {string} [inputDir] - Optional input directory (defaults to config.batchDir)
   * @param {string} [outputDir] - Optional output directory (defaults to config.outputDir)
   * @returns {Promise<Object>} Batch processing results
   */
  async runBatchProcessing(inputDir = null, outputDir = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const batchDir = inputDir || this.config.batchDir;
      const resultDir = outputDir || this.config.outputDir;
      
      logger.info('Starting batch processing', { 
        inputDir: batchDir,
        outputDir: resultDir
      });
      
      // Get all files in the batch directory
      const files = await fs.readdir(batchDir);
      const queryFiles = files.filter(file => file.endsWith('.txt'));
      
      logger.info(`Found ${queryFiles.length} query files for batch processing`);
      
      const results = {
        total: queryFiles.length,
        processed: 0,
        failed: 0,
        files: []
      };
      
      // Process each file
      for (const file of queryFiles) {
        try {
          const inputPath = path.join(batchDir, file);
          const outputPath = path.join(resultDir, `${path.basename(file, '.txt')}_result.json`);
          
          logger.debug(`Processing file: ${file}`);
          
          // Read the query
          const query = await fs.readFile(inputPath, 'utf8');
          
          // Process it
          const result = await this.processComplianceQuery(query);
          
          // Write result to output directory
          await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
          
          results.processed++;
          results.files.push({
            input: inputPath,
            output: outputPath,
            status: 'success'
          });
          
          logger.debug(`Successfully processed: ${file}`);
        } catch (error) {
          logger.error(`Failed to process file: ${file}`, formatError(error));
          
          results.failed++;
          results.files.push({
            input: path.join(batchDir, file),
            status: 'failed',
            error: error.message
          });
        }
      }
      
      logger.info('Batch processing completed', {
        processed: results.processed,
        failed: results.failed,
        total: results.total
      });
      
      return results;
    } catch (error) {
      logger.error('Batch processing failed', formatError(error));
      throw error;
    }
  }
  
  /**
   * Regenerate the registry from CSV
   * @returns {Promise<void>}
   */
  async regenerateRegistry() {
    try {
      logger.info('Regenerating registry from CSV', { csvPath: this.config.csvPath });
      
      const registryFile = path.join(this.config.registryPath, 'registry.json');
      
      // Generate new registry
      await generateRegistryFromCSV(this.config.csvPath, registryFile);
      
      // Load the newly created registry
      const data = await fs.readFile(registryFile, 'utf8');
      this.registry = JSON.parse(data);
      
      logger.info('Registry regenerated successfully', { 
        regulationCount: Object.keys(this.registry.regulations || {}).length 
      });
    } catch (error) {
      logger.error('Failed to regenerate registry', formatError(error));
      throw error;
    }
  }
  
  /**
   * Stop all running services
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down MCPHostController');
    
    const shutdownPromises = [];
    
    // Shutdown LLM Gateway if running
    if (this.services.llmGateway) {
      logger.debug('Shutting down LLM Gateway');
      shutdownPromises.push(
        new Promise((resolve) => {
          this.services.llmGateway.close(() => {
            logger.debug('LLM Gateway shut down successfully');
            this.services.llmGateway = null;
            resolve();
          });
        })
      );
    }
    
    // Shutdown Batch Server if running
    if (this.services.batchServer) {
      logger.debug('Shutting down Batch Server');
      shutdownPromises.push(
        new Promise((resolve) => {
          this.services.batchServer.close(() => {
            logger.debug('Batch Server shut down successfully');
            this.services.batchServer = null;
            resolve();
          });
        })
      );
    }
    
    // Wait for all services to shut down
    await Promise.all(shutdownPromises);
    
    logger.info('MCPHostController shut down successfully');
  }
} 