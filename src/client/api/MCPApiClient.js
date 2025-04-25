import axios from 'axios';

/**
 * MCP API Client
 * 
 * Client-side module for interacting with MCP servers
 */
class MCPApiClient {
  constructor(config = {}) {
    this.config = {
      llmGatewayUrl: 'http://localhost:3000',
      batchServerUrl: 'http://localhost:3001',
      regulationRegistryUrl: 'http://localhost:3010',
      ...config
    };
    
    // Create axios instances for different services
    this.llmGateway = axios.create({
      baseURL: this.config.llmGatewayUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.batchServer = axios.create({
      baseURL: this.config.batchServerUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.regulationRegistry = axios.create({
      baseURL: this.config.regulationRegistryUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Server Management API
  
  /**
   * Get status of all MCP servers
   * @returns {Promise<Array>} Array of server status objects
   */
  async getServerStatus() {
    try {
      const servers = [
        {
          id: 'llm-gateway',
          name: 'LLM Gateway',
          type: 'gateway',
          category: 'core',
          description: 'Handles LLM queries and compliance processing',
          status: 'unknown',
          url: this.config.llmGatewayUrl
        },
        {
          id: 'batch-server',
          name: 'Batch Processing Server',
          type: 'batch',
          category: 'core',
          description: 'Processes batches of documents for compliance',
          status: 'unknown',
          url: this.config.batchServerUrl
        },
        {
          id: 'regulation-registry',
          name: 'Regulation Registry',
          type: 'registry',
          category: 'core',
          description: 'Manages regulation definitions and metadata',
          status: 'unknown',
          url: this.config.regulationRegistryUrl
        }
      ];
      
      // Check each server's health endpoint
      const results = await Promise.allSettled([
        this.llmGateway.get('/health'),
        this.batchServer.get('/health'),
        this.regulationRegistry.get('/health')
      ]);
      
      // Update status based on responses
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.status === 200) {
          servers[index].status = 'running';
          servers[index].startTime = new Date().toISOString(); // Mock start time
          servers[index].uptime = '1h 30m'; // Mock uptime
          servers[index].version = result.value.data.version || '1.0.0';
        } else {
          servers[index].status = 'stopped';
          servers[index].error = result.reason?.message || 'Server not responding';
        }
      });
      
      // Fetch regulation MCP servers from the registry API
      try {
        const regulationServersResponse = await this.regulationRegistry.get('/api/mcp/servers');
        if (regulationServersResponse.data && Array.isArray(regulationServersResponse.data)) {
          // Map regulation servers to match the server object format
          const regulationServers = regulationServersResponse.data.map(server => ({
            id: `regulation-${server.regulationId}`,
            name: server.name,
            type: 'Regulation Server',
            category: 'Regulation',
            description: `MCP server for ${server.name} regulation`,
            status: server.status || 'unknown',
            startTime: server.startTime,
            pid: server.pid,
            uptime: server.uptime || '0m',
            url: server.url || 'N/A',
            regulationId: server.regulationId
          }));
          
          // Add regulation servers to the servers array
          servers.push(...regulationServers);
        }
      } catch (error) {
        console.error('Error fetching regulation MCP servers:', error);
        // Continue with the core servers even if regulation servers couldn't be fetched
      }
      
      return servers;
    } catch (error) {
      console.error('Error fetching server status:', error);
      throw error;
    }
  }
  
  /**
   * Start a specific MCP server
   * @param {string} serverId - ID of the server to start
   * @returns {Promise<Object>} Status response
   */
  async startServer(serverId) {
    try {
      // In a production environment, this would call a server management endpoint
      // For now, we'll just return a mock success response
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        success: true,
        message: `Server ${serverId} started successfully`,
        serverId
      };
    } catch (error) {
      console.error(`Error starting server ${serverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Stop a specific MCP server
   * @param {string} serverId - ID of the server to stop
   * @returns {Promise<Object>} Status response
   */
  async stopServer(serverId) {
    try {
      // In a production environment, this would call a server management endpoint
      // For now, we'll just return a mock success response
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        success: true,
        message: `Server ${serverId} stopped successfully`,
        serverId
      };
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Restart a specific MCP server
   * @param {string} serverId - ID of the server to restart
   * @returns {Promise<Object>} Status response
   */
  async restartServer(serverId) {
    try {
      // In a production environment, this would call a server management endpoint
      // For now, we'll just return a mock success response
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        success: true,
        message: `Server ${serverId} restarted successfully`,
        serverId
      };
    } catch (error) {
      console.error(`Error restarting server ${serverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get server logs
   * @param {string} serverId - ID of the server
   * @param {Object} options - Options for log retrieval
   * @returns {Promise<Array>} Array of log entries
   */
  async getServerLogs(serverId, options = {}) {
    try {
      // Mock log data
      const logTypes = ['info', 'warn', 'error', 'debug'];
      const mockLogs = Array(20).fill().map((_, i) => ({
        id: `log_${Date.now()}_${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        level: logTypes[Math.floor(Math.random() * logTypes.length)],
        message: `Sample log message for ${serverId}`,
        details: { serverId, requestId: `req_${i}` }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockLogs;
    } catch (error) {
      console.error(`Error getting logs for server ${serverId}:`, error);
      throw error;
    }
  }
  
  // LLM Gateway API
  
  /**
   * Process a compliance query
   * @param {string} query - The query text
   * @param {string} regulationId - Optional regulation ID to query against
   * @returns {Promise<Object>} The compliance response
   */
  async processComplianceQuery(query, regulationId = null) {
    try {
      const payload = { query };
      if (regulationId) {
        payload.regulationId = regulationId;
      }
      
      const response = await this.llmGateway.post('/compliance/query', payload);
      return response.data;
    } catch (error) {
      console.error('Error processing compliance query:', error);
      throw error;
    }
  }
  
  // Batch Processing API
  
  /**
   * Start a batch processing job
   * @param {Array} files - Array of file objects to process
   * @param {string} regulationId - Regulation ID to check compliance against
   * @returns {Promise<Object>} Batch job information
   */
  async startBatchJob(files, regulationId) {
    try {
      // In a real implementation, this would upload files and start processing
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        jobId: `job_${Date.now()}`,
        status: 'started',
        fileCount: files.length,
        regulationId,
        startTime: new Date().toISOString(),
        estimatedCompletionTime: new Date(Date.now() + 120000).toISOString()
      };
    } catch (error) {
      console.error('Error starting batch job:', error);
      throw error;
    }
  }
  
  /**
   * Get status of a batch processing job
   * @param {string} jobId - ID of the batch job
   * @returns {Promise<Object>} Batch job status
   */
  async getBatchJobStatus(jobId) {
    try {
      // In a real implementation, this would fetch the status from the server
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const progress = Math.random();
      return {
        jobId,
        status: progress < 1 ? 'processing' : 'completed',
        progress: Math.min(Math.floor(progress * 100), 100),
        filesProcessed: 10,
        filesTotal: 10,
        startTime: new Date(Date.now() - 60000).toISOString(),
        completionTime: progress < 1 ? null : new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error getting batch job status for ${jobId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get results of a completed batch job
   * @param {string} jobId - ID of the batch job
   * @returns {Promise<Array>} Batch job results
   */
  async getBatchJobResults(jobId) {
    try {
      // In a real implementation, this would fetch results from the server
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const complianceStatus = ['compliant', 'non_compliant', 'partial'];
      
      return Array(10).fill().map((_, i) => ({
        fileId: `file_${i}`,
        fileName: `document_${i}.pdf`,
        status: complianceStatus[Math.floor(Math.random() * complianceStatus.length)],
        score: Math.random() * 100,
        issues: Math.floor(Math.random() * 5),
        details: {
          analyzed: true,
          processingTime: `${Math.floor(Math.random() * 10) + 1}s`,
          sections: Math.floor(Math.random() * 10) + 1
        }
      }));
    } catch (error) {
      console.error(`Error getting batch job results for ${jobId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
const mcpApiClient = new MCPApiClient();
export default mcpApiClient; 