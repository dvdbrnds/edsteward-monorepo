/**
 * MCP Host Controller
 * 
 * This controller manages the lifecycle of regulation MCP servers and processes
 * requests from LLMs to interact with these servers.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '../../regulation-servers-registry.json');
const PORT_CONFIG_PATH = path.join(__dirname, '../../mcp-server-port.json');

/**
 * MCP Host Controller class
 */
export class MCPHostController {
  constructor() {
    this.registry = {};
    this.activeMcpServers = new Map();
    this.basePort = 3200;
    this.initialized = false;
    this.priorityQueue = [];
  }

  /**
   * Initialize the controller
   */
  async initialize() {
    try {
      // Load configuration
      await this.loadRegistry();
      await this.loadPortConfig();
      
      console.log(`Loaded registry with ${Object.keys(this.registry).length} regulations`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize MCP Host Controller:', error);
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
      // If file doesn't exist or is empty, initialize with empty object
      if (error.code === 'ENOENT' || error.message.includes('Unexpected end')) {
        this.registry = {};
        await this.saveRegistry();
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
  async getAvailableRegulations() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return Object.values(this.registry);
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
      // Path to base server template
      const serverEntryPath = path.join(__dirname, '../regulation-server/base-regulation-server-entry.js');
      
      // Command to start server
      const serverProcess = spawn('node', [serverEntryPath, regulationId, port.toString()], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Buffer for collecting stdout
      let outputBuffer = '';
      
      // Collect output to detect server startup
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
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
          reject(new Error(`MCP server for ${regulationId} exited with code ${code}`));
        }
      });
      
      // Set a timeout in case server doesn't start properly
      setTimeout(() => {
        if (!outputBuffer.includes('MCP server ready')) {
          serverProcess.kill();
          reject(new Error(`Timeout starting MCP server for ${regulationId}`));
        }
      }, 10000);
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