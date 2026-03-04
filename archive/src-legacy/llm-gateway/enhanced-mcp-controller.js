/**
 * Enhanced MCP Host Controller
 * 
 * This controller extends the original MCPHostController with improved
 * registry generation and batch server management capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { generateRegistry } from '../regulation-generators/generate-regulation-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '../../regulation-servers-registry.json');
const PORT_CONFIG_PATH = path.join(__dirname, '../../mcp-server-port.json');
const SERVER_ENTRY_PATH = path.join(__dirname, '../regulation-server/base-regulation-server-entry.js');

/**
 * Enhanced MCP Host Controller class
 */
export class EnhancedMCPController {
  constructor(options = {}) {
    this.registry = {};
    this.activeMcpServers = new Map();
    this.basePort = options.basePort || 3200;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.initialized = false;
    this.priorityQueue = [];
    this.autoShutdown = options.autoShutdown || false;
    this.serverStartTimeout = options.serverStartTimeout || 30000;  // 30 seconds timeout
  }

  /**
   * Initialize the controller with an improved registry
   */
  async initialize(options = {}) {
    try {
      // Generate fresh registry if requested
      if (options.generateRegistry) {
        await generateRegistry();
      }
      
      // Load configuration
      await this.loadRegistry();
      await this.loadPortConfig();
      
      console.log(`Loaded registry with ${Object.keys(this.registry).length} regulations`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Enhanced MCP Controller:', error);
      throw error;
    }
  }

  /**
   * Load the regulation registry
   */
  async loadRegistry() {
    try {
      const registryData = await fs.readFile(REGISTRY_PATH, 'utf8');
      this.registry = JSON.parse(registryData || '{}');
    } catch (error) {
      // If file doesn't exist or is empty, generate a new registry
      if (error.code === 'ENOENT' || error.message.includes('Unexpected end')) {
        console.log('No existing registry found, generating new registry...');
        this.registry = await generateRegistry();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save the regulation registry
   */
  async saveRegistry() {
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(this.registry, null, 2), 'utf8');
  }

  /**
   * Load the port configuration
   */
  async loadPortConfig() {
    try {
      const portConfig = await fs.readFile(PORT_CONFIG_PATH, 'utf8');
      const config = JSON.parse(portConfig || '{}');
      if (config.basePort) {
        this.basePort = config.basePort;
      }
    } catch (error) {
      // If file doesn't exist, create with default config
      if (error.code === 'ENOENT') {
        await fs.writeFile(PORT_CONFIG_PATH, JSON.stringify({ basePort: this.basePort }, null, 2), 'utf8');
      } else {
        throw error;
      }
    }
  }

  /**
   * Get available regulations
   */
  async getAvailableRegulations(filter = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    let regulations = Object.values(this.registry);
    
    // Apply category filter if specified
    if (filter.category) {
      regulations = regulations.filter(reg => 
        (reg.category || '').toLowerCase() === filter.category.toLowerCase()
      );
    }
    
    return regulations;
  }

  /**
   * Get system status
   */
  async getStatus() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const activeServers = Array.from(this.activeMcpServers.keys());
    const regulationCount = Object.keys(this.registry).length;
    
    return {
      initialized: this.initialized,
      activeServerCount: activeServers.length,
      activeServers,
      regulationCount,
      basePort: this.basePort,
      maxConcurrent: this.maxConcurrent,
      priorityQueueLength: this.priorityQueue.length
    };
  }

  /**
   * Process a request from an LLM
   */
  async processLLMRequest(request) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const { regulationId, category, action, priority = 'medium', llmSource, contextData } = request;
    
    console.log(`Processing LLM request from ${llmSource} for action: ${action}`);
    
    // Determine which regulations to use for this request
    const targetRegulations = await this.resolveTargetRegulations(regulationId, category);
    
    if (targetRegulations.length === 0) {
      return {
        status: 'error',
        message: `No regulations found matching ${regulationId || category || 'criteria'}`
      };
    }
    
    console.log(`Resolved ${targetRegulations.length} target regulations`);
    
    // Initialize and start the MCP servers if needed
    const serverPromises = targetRegulations.map(regulationId => 
      this.ensureServerRunning(regulationId, priority)
    );
    
    const servers = await Promise.all(serverPromises);
    
    // Execute the appropriate action across all servers
    switch (action) {
      case 'validate':
        return this.executeValidation(servers, request);
      
      case 'status':
        return this.checkValidationStatus(servers, request);
      
      case 'changes':
        return this.checkRegulationChanges(servers, request);
      
      default:
        return {
          status: 'error',
          message: `Unsupported action: ${action}`
        };
    }
  }

  /**
   * Resolve target regulations based on ID or category
   */
  async resolveTargetRegulations(regulationId, category) {
    // If specific regulation ID provided, use that
    if (regulationId && this.registry[regulationId]) {
      return [regulationId];
    }
    
    // If category provided, find all regulations in that category
    if (category) {
      return Object.entries(this.registry)
        .filter(([_, regulation]) => regulation.category === category)
        .map(([id, _]) => id);
    }
    
    // Otherwise return all regulations
    return Object.keys(this.registry);
  }

  /**
   * Ensure an MCP server is running for a regulation
   */
  async ensureServerRunning(regulationId, priority) {
    if (this.activeMcpServers.has(regulationId)) {
      // Server already running
      return {
        regulationId,
        serverInfo: this.activeMcpServers.get(regulationId)
      };
    }
    
    // Start the server
    const port = this.getNextAvailablePort();
    
    try {
      const serverProcess = await this.startMcpServer(regulationId, port);
      
      const serverInfo = {
        regulationId,
        port,
        process: serverProcess,
        url: `http://localhost:${port}/mcp`,
        startTime: new Date().toISOString()
      };
      
      this.activeMcpServers.set(regulationId, serverInfo);
      
      // Update registry
      this.registry[regulationId].server = {
        port,
        running: true,
        lastStarted: new Date().toISOString(),
        url: `http://localhost:${port}/mcp`
      };
      
      // Save registry updates
      await this.saveRegistry();
      
      return {
        regulationId,
        serverInfo: { ...serverInfo, process: undefined } // Don't return process obj
      };
    } catch (error) {
      console.error(`Failed to start MCP server for ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Start an MCP server process
   */
  startMcpServer(regulationId, port) {
    return new Promise((resolve, reject) => {
      console.log(`Starting MCP server for ${regulationId} on port ${port}...`);
      
      // Command to start server
      const serverProcess = spawn('node', [SERVER_ENTRY_PATH, regulationId, port.toString()], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Buffer for collecting stdout
      let outputBuffer = '';
      
      // Collect output to detect server startup
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        console.log(`[${regulationId}] ${output.trim()}`);
        
        // Check if server is ready
        if (output.includes('MCP server ready') || outputBuffer.includes('MCP server ready')) {
          resolve(serverProcess);
        }
      });
      
      // Handle errors
      serverProcess.stderr.on('data', (data) => {
        console.error(`[${regulationId} Server] Error:`, data.toString());
      });
      
      // Handle process exit
      serverProcess.on('exit', (code) => {
        if (code !== 0) {
          this.activeMcpServers.delete(regulationId);
          reject(new Error(`MCP server for ${regulationId} exited with code ${code}`));
        } else {
          console.log(`[${regulationId}] Server exited normally`);
          this.activeMcpServers.delete(regulationId);
        }
      });
      
      // Set a timeout in case server doesn't start properly
      setTimeout(() => {
        if (!outputBuffer.includes('MCP server ready')) {
          serverProcess.kill();
          reject(new Error(`Timeout starting MCP server for ${regulationId}`));
        }
      }, this.serverStartTimeout);
    });
  }

  /**
   * Get the next available port for an MCP server
   */
  getNextAvailablePort() {
    // Simple implementation - increment from base port
    // In a production system, this would check if port is actually available
    const activeServerCount = this.activeMcpServers.size;
    return this.basePort + activeServerCount;
  }

  /**
   * Start servers for multiple regulations in batches
   */
  async startServerBatch(regulations, options = {}) {
    if (!Array.isArray(regulations) || regulations.length === 0) {
      throw new Error('No regulations provided for batch start');
    }
    
    const batchSize = options.batchSize || this.maxConcurrent;
    const startPort = options.startPort || this.basePort;
    
    console.log(`Starting ${regulations.length} servers in batches of ${batchSize}`);
    console.log(`Base port: ${startPort}`);
    
    let currentPort = startPort;
    const results = {
      successful: [],
      failed: []
    };
    
    // Process regulations in batches
    for (let i = 0; i < regulations.length; i += batchSize) {
      const batch = regulations.slice(i, i + batchSize);
      console.log(`\nStarting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(regulations.length / batchSize)} (${batch.length} servers)...`);
      
      // Start servers in this batch
      const promises = batch.map((regulationId, index) => {
        const port = currentPort + index;
        return this.startMcpServer(regulationId, port)
          .then(serverProcess => {
            const serverInfo = {
              regulationId,
              port,
              process: serverProcess,
              url: `http://localhost:${port}/mcp`,
              startTime: new Date().toISOString()
            };
            
            this.activeMcpServers.set(regulationId, serverInfo);
            
            // Update registry
            this.registry[regulationId].server = {
              port,
              running: true,
              lastStarted: new Date().toISOString(),
              url: `http://localhost:${port}/mcp`
            };
            
            results.successful.push({
              regulationId,
              port,
              url: `http://localhost:${port}/mcp`
            });
            
            return serverInfo;
          })
          .catch(error => {
            console.error(`Failed to start server for ${regulationId}:`, error.message);
            results.failed.push({
              regulationId,
              error: error.message
            });
            return null;
          });
      });
      
      // Wait for all servers in this batch to start
      await Promise.all(promises);
      
      // Update the port for the next batch
      currentPort += batch.length;
    }
    
    // Save updated registry
    await this.saveRegistry();
    
    // Print summary
    console.log(`\n===== Server Start Summary =====`);
    console.log(`Total regulations: ${regulations.length}`);
    console.log(`Successfully started: ${results.successful.length}`);
    console.log(`Failed: ${results.failed.length}`);
    
    return results;
  }

  /**
   * Start servers for all regulations in the registry
   */
  async startAllServers(options = {}) {
    if (!this.initialized) {
      await this.initialize({ generateRegistry: options.generateRegistry });
    }
    
    const filter = {};
    if (options.category) {
      filter.category = options.category;
    }
    
    const regulations = await this.getAvailableRegulations(filter);
    const regulationIds = regulations.map(reg => reg.id);
    
    return this.startServerBatch(regulationIds, {
      batchSize: options.batchSize || this.maxConcurrent,
      startPort: options.startPort || this.basePort
    });
  }

  /**
   * Shutdown all running MCP servers
   */
  async shutdownAllServers() {
    console.log(`Shutting down ${this.activeMcpServers.size} regulation servers...`);
    
    for (const [regulationId, serverInfo] of this.activeMcpServers.entries()) {
      console.log(`Stopping server for ${regulationId}...`);
      try {
        serverInfo.process.kill();
        
        // Update registry
        if (this.registry[regulationId]) {
          this.registry[regulationId].server.running = false;
        }
      } catch (error) {
        console.error(`Error stopping server for ${regulationId}:`, error.message);
      }
    }
    
    // Clear the active servers map
    this.activeMcpServers.clear();
    
    // Save updated registry
    await this.saveRegistry();
    
    console.log('All servers shut down');
  }

  /**
   * Execute validation action across servers
   */
  async executeValidation(servers, request) {
    const results = [];
    
    for (const server of servers) {
      try {
        // Call the MCP server to perform validation
        const response = await axios.post(server.serverInfo.url, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'validate',
          params: {
            content: request.content || request.contextData,
            validation_type: request.validationType || 'standard',
            context: request.context || {}
          }
        });
        
        results.push({
          regulationId: server.regulationId,
          status: 'success',
          result: response.data.result
        });
      } catch (error) {
        results.push({
          regulationId: server.regulationId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      status: 'completed',
      action: 'validate',
      timestamp: new Date().toISOString(),
      results
    };
  }

  /**
   * Check validation status across servers
   */
  async checkValidationStatus(servers, request) {
    const results = [];
    
    for (const server of servers) {
      try {
        // Call the MCP server to check validation status
        const response = await axios.post(server.serverInfo.url, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'query_validation_status',
          params: {
            validation_id: request.validationId
          }
        });
        
        results.push({
          regulationId: server.regulationId,
          status: 'success',
          result: response.data.result
        });
      } catch (error) {
        results.push({
          regulationId: server.regulationId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      status: 'completed',
      action: 'status',
      timestamp: new Date().toISOString(),
      results
    };
  }

  /**
   * Check for regulation changes across servers
   */
  async checkRegulationChanges(servers, request) {
    const results = [];
    
    for (const server of servers) {
      try {
        // Call the MCP server to check for changes
        const response = await axios.post(server.serverInfo.url, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'check_changes',
          params: {
            since: request.since || '1970-01-01'
          }
        });
        
        results.push({
          regulationId: server.regulationId,
          status: 'success',
          result: response.data.result
        });
      } catch (error) {
        results.push({
          regulationId: server.regulationId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      status: 'completed',
      action: 'changes',
      timestamp: new Date().toISOString(),
      results
    };
  }
} 