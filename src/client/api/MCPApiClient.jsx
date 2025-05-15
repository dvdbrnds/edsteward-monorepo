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
    
    // In-memory state to track server statuses for demonstration
    this.serverStates = new Map();
  }
  
  // Server Management API
  
  /**
   * Get all MCP servers including regulation servers from the registry
   * @returns {Promise<Object>} Response with server data
   */
  async getServers() {
    try {
      // Get core servers
      const coreServers = await this.getServerStatus();
      
      // Get regulation servers from registry file
      let regulationServers = [];
      try {
        console.log('Trying to fetch regulation servers from registry file...');
        // Try to fetch the regulation servers directly from the registry file
        // Using window.location.origin to ensure we access from the correct domain
        const origin = window.location.origin || '';
        const response = await axios.get(`${origin}/regulation-servers-registry.json`);
        
        if (response.data && typeof response.data === 'object') {
          console.log('Found regulation data in registry file:', response.data);
          // Convert object of servers to array
          regulationServers = Object.entries(response.data).map(([id, regulation]) => {
            // Check if this is a test data server
            const isTestData = !!(
              regulation.name?.toLowerCase().includes('gdpr') || 
              id.toLowerCase().includes('gdpr') || 
              id.toLowerCase().includes('test') || 
              regulation.name?.toLowerCase().includes('test') || 
              regulation.description?.toLowerCase().includes('test data') || 
              regulation.version?.includes('test')
            );
            
            // Standardize regulation IDs for consistency with backend
            let standardId = id;
            const nameLower = regulation.name?.toLowerCase() || '';
            const idLower = id.toLowerCase();
            
            // Map to standard regulation IDs
            if (idLower.includes('gdpr') || nameLower.includes('gdpr') || 
                nameLower.includes('data protection') || nameLower.includes('general data')) {
              standardId = 'gdpr-2018';
            } else if (idLower.includes('hipaa') || nameLower.includes('hipaa') || 
                      nameLower.includes('health') || nameLower.includes('insurance')) {
              standardId = 'hipaa-1996';
            } else if (idLower.includes('ccpa') || nameLower.includes('ccpa') || 
                      nameLower.includes('california') || nameLower.includes('consumer privacy')) {
              standardId = 'ccpa-2018';
            }
              
            // Extract server info
            return {
              id: `regulation-${standardId}`,
              name: regulation.name || `Regulation ${standardId}`,
              type: 'Regulation Server',
              category: 'Regulation',
              description: regulation.description || `MCP server for regulation`,
              status: (regulation.server?.running ? 'running' : 'stopped').toLowerCase(),
              port: regulation.server?.port || null,
              uptime: regulation.server?.lastStarted ? 
                this.formatUptime(new Date(regulation.server.lastStarted)) : '—',
              url: regulation.server?.url || null,
              regulationId: standardId,
              isTestData: isTestData,
              originalId: id // Keep the original ID for reference
            };
          });
          
          console.log('Found regulation servers from registry file:', regulationServers);
        }
      } catch (error) {
        console.error('Error fetching regulation servers from registry file:', error);
        // Try API fallback
        try {
          const regulationServersResponse = await this.regulationRegistry.get('/api/mcp/servers');
          if (regulationServersResponse.data && Array.isArray(regulationServersResponse.data)) {
            // Map regulation servers to match the server object format
            regulationServers = regulationServersResponse.data.map(server => {
              // Check if this is a test data server
              const isTestData = !!(
                server.name?.toLowerCase().includes('gdpr') || 
                server.regulationId?.toLowerCase().includes('gdpr') || 
                server.regulationId?.toLowerCase().includes('test') || 
                server.name?.toLowerCase().includes('test') || 
                server.description?.toLowerCase().includes('test data') || 
                server.version?.includes('test')
              );
              
              // Standardize regulation IDs
              let standardId = server.regulationId;
              const nameLower = server.name?.toLowerCase() || '';
              const idLower = server.regulationId?.toLowerCase() || '';
              
              // Map to standard regulation IDs
              if (idLower.includes('gdpr') || nameLower.includes('gdpr') || 
                  nameLower.includes('data protection') || nameLower.includes('general data')) {
                standardId = 'gdpr-2018';
              } else if (idLower.includes('hipaa') || nameLower.includes('hipaa') || 
                        nameLower.includes('health') || nameLower.includes('insurance')) {
                standardId = 'hipaa-1996';
              } else if (idLower.includes('ccpa') || nameLower.includes('ccpa') || 
                        nameLower.includes('california') || nameLower.includes('consumer privacy')) {
                standardId = 'ccpa-2018';
              }
              
              return {
                id: `regulation-${standardId}`,
                name: server.name || `Regulation ${standardId}`,
                type: 'Regulation Server',
                category: 'Regulation',
                description: `MCP server for ${server.name || 'regulation'}`,
                status: (server.status || 'unknown').toLowerCase(),
                startTime: server.startTime,
                port: server.port || null,
                uptime: server.uptime || '0m',
                url: server.url || 'N/A',
                regulationId: standardId,
                isTestData: isTestData,
                originalId: server.regulationId // Keep the original ID for reference
              };
            });
          }
        } catch (apiError) {
          console.error('Error fetching regulation servers from API:', apiError);
        }
      }
      
      // Combine core servers with regulation servers and normalize status values
      const allServers = [...coreServers, ...regulationServers].map(server => ({
        ...server,
        status: (server.status || 'unknown').toLowerCase()
      }));
      
      return {
        success: true,
        data: allServers
      };
    } catch (error) {
      console.error('Error fetching servers:', error);
      throw error;
    }
  }
  
  /**
   * Format uptime from a timestamp
   * @param {Date} startDate - The start date
   * @returns {string} Formatted uptime
   */
  formatUptime(startDate) {
    if (!startDate) return '—';
    
    const now = new Date();
    const diff = now - startDate;
    
    // Convert to hours and minutes
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  /**
   * Get status of all MCP servers
   * @returns {Promise<Array>} Array of server status objects
   */
  async getServerStatus() {
    try {
      console.log('========== getServerStatus called ==========');
      console.log('Current server states:', Object.fromEntries(this.serverStates));
      
      // Initialize core servers
      const servers = [
        {
          id: 'llm-gateway',
          name: 'LLM Gateway',
          type: 'API Server',
          status: 'unknown',
          category: 'Core',
          address: 'http://localhost:3100'
        },
        {
          id: 'batch-server',
          name: 'Batch Processing Server',
          type: 'Processing Server',
          status: 'unknown',
          category: 'Core',
          address: 'http://localhost:3110'
        },
        {
          id: 'registry-api',
          name: 'Registry API',
          type: 'Registry Server',
          status: 'unknown',
          category: 'Core',
          address: 'http://localhost:3010'
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
        const serverId = servers[index].id;
        
        // First check if we have a manually set state for this server
        if (this.serverStates.has(serverId)) {
          const serverState = this.serverStates.get(serverId);
          console.log(`Server ${serverId} has a stored state:`, serverState);
          
          // Check for persistent state flag and prioritize it
          if (serverState.persistentState) {
            console.log(`Server ${serverId} using persistent state: ${serverState.persistentState}`);
            servers[index].status = serverState.persistentState;
          } else {
            servers[index].status = serverState.status;
          }
          
          servers[index].startTime = serverState.startTime || new Date().toISOString();
          servers[index].uptime = serverState.uptime || this.formatUptime(new Date(serverState.startTime));
          return;
        } else {
          console.log(`Server ${serverId} has no stored state`);
        }
        
        // Otherwise use the health check result
        if (result.status === 'fulfilled' && result.value.status === 200) {
          console.log(`Server ${serverId} health check passed, setting status to running`);
          servers[index].status = 'running';
          servers[index].startTime = new Date().toISOString(); // Mock start time
          servers[index].uptime = '1h 30m'; // Mock uptime
          servers[index].version = result.value.data.version || '1.0.0';
        } else {
          console.log(`Server ${serverId} health check failed, setting status to stopped`);
          servers[index].status = 'stopped';
          servers[index].error = result.reason?.message || 'Server not responding';
        }
      });
      
      // Fetch regulation MCP servers from the registry API
      try {
        const regulationServersResponse = await this.regulationRegistry.get('/api/mcp/servers');
        if (regulationServersResponse.data && Array.isArray(regulationServersResponse.data)) {
          // Map regulation servers to match the server object format
          const regulationServers = regulationServersResponse.data.map(server => {
            // Standardize regulation IDs
            let standardId = server.regulationId;
            const nameLower = server.name?.toLowerCase() || '';
            const idLower = server.regulationId?.toLowerCase() || '';
            
            // Map to standard regulation IDs
            if (idLower.includes('gdpr') || nameLower.includes('gdpr') || 
                nameLower.includes('data protection') || nameLower.includes('general data')) {
              standardId = 'gdpr-2018';
            } else if (idLower.includes('hipaa') || nameLower.includes('hipaa') || 
                      nameLower.includes('health') || nameLower.includes('insurance')) {
              standardId = 'hipaa-1996';
            } else if (idLower.includes('ccpa') || nameLower.includes('ccpa') || 
                      nameLower.includes('california') || nameLower.includes('consumer privacy')) {
              standardId = 'ccpa-2018';
            }
            
            // Check if this is a test data server
            const isTestData = !!(
              server.name?.toLowerCase().includes('gdpr') || 
              server.regulationId?.toLowerCase().includes('gdpr') || 
              server.regulationId?.toLowerCase().includes('test') || 
              server.name?.toLowerCase().includes('test') || 
              server.description?.toLowerCase().includes('test data') || 
              server.version?.includes('test')
            );
            
            const serverId = `regulation-${standardId}`;
            
            // Create the server object
            const serverObj = {
              id: serverId,
              name: server.name,
              type: 'Regulation Server',
              category: 'Regulation',
              description: `MCP server for ${server.name} regulation`,
              status: server.status || 'unknown',
              startTime: server.startTime,
              pid: server.pid,
              port: server.port || 3200 + Math.floor(Math.random() * 100),
              uptime: this.formatUptime(new Date(server.startTime)),
              url: server.url || `http://localhost:${server.port || 3200}`,
              regulationId: standardId,
              originalId: server.regulationId,
              isTestData: isTestData
            };
            
            // Check if we have a manually set state for this server
            if (this.serverStates.has(serverId)) {
              const serverState = this.serverStates.get(serverId);
              console.log(`Regulation server ${serverId} has a stored state:`, serverState);
              
              // Check for persistent state flag and prioritize it
              if (serverState.persistentState) {
                console.log(`Regulation server ${serverId} using persistent state: ${serverState.persistentState}`);
                serverObj.status = serverState.persistentState;
              } else {
                serverObj.status = serverState.status;
              }
              if (serverState.startTime) serverObj.startTime = serverState.startTime;
              if (serverState.uptime) serverObj.uptime = serverState.uptime;
            } else {
              console.log(`Regulation server ${serverId} has no stored state, using default status: ${serverObj.status}`);
            }
            
            return serverObj;
          });
          
          // Add to servers list
          servers.push(...regulationServers);
        }
      } catch (error) {
        console.error('Error fetching MCP servers from registry:', error);
      }
      
      return servers;
    } catch (error) {
      console.error('Error getting server status:', error);
      return [];
    }
  }
  
  /**
   * Start a specific MCP server
   * @param {string} serverId - ID of the server to start
   * @returns {Promise<Object>} Status response
   */
  async startServer(serverId) {
    try {
      console.log(`Starting server ${serverId}...`);
      
      // Update our in-memory state to track this server as running
      // and clear any persistent status flag
      this.serverStates.set(serverId, {
        status: 'running',
        startTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        persistentState: null // Clear any persistent state
      });
      
      // In a production environment, this would call a server management endpoint
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Server ${serverId} started successfully`);
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
      console.log(`Stopping server ${serverId}...`);
      
      // Ensure the server is marked as permanently stopped by setting multiple flags
      const stoppedState = {
        status: 'stopped',
        persistentState: 'stopped',
        isPermanentlyStopped: true,  // Additional flag to be absolutely sure
        stopTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uptime: '0m'
      };
      
      // Update our in-memory state to track this server as stopped
      this.serverStates.set(serverId, stoppedState);
      
      // Log the updated state for debugging
      console.log(`Updated server state for ${serverId}:`, this.serverStates.get(serverId));
      
      // Force an immediate save of this state
      this._saveServerStates();
      
      // In a production environment, this would call a server management endpoint
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Double-check the state is still as expected after the delay
      if (this.serverStates.has(serverId)) {
        if (this.serverStates.get(serverId).status !== 'stopped') {
          console.warn(`Server state for ${serverId} changed unexpectedly during stop operation`);
          // Force it back to stopped
          this.serverStates.set(serverId, stoppedState);
        }
      }
      
      console.log(`Server ${serverId} stopped successfully`);
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
   * Internal method to save server states
   * @private
   */
  _saveServerStates() {
    console.log('Saving server states:', Object.fromEntries(this.serverStates));
    // In a real app, this might persist to localStorage
    // For now it just ensures we have the in-memory copy
  }
  
  /**
   * Restart a specific MCP server
   * @param {string} serverId - ID of the server to restart
   * @returns {Promise<Object>} Status response
   */
  async restartServer(serverId) {
    try {
      console.log(`Restarting server ${serverId}...`);
      
      // First update state to restarting
      this.serverStates.set(serverId, {
        status: 'restarting',
        updatedAt: new Date().toISOString(),
        persistentState: null // Clear any persistent state
      });
      
      // In a production environment, this would call a server management endpoint
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // After "restart" is complete, set to running
      this.serverStates.set(serverId, {
        status: 'running',
        startTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uptime: '0m',
        persistentState: null // Ensure persistent state is cleared
      });
      
      console.log(`Server ${serverId} restarted successfully`);
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

  /**
   * Launch the MCP Inspector for a specific server
   * @param {Object} params - Parameters for launching the inspector
   * @param {string} params.serverId - ID of the server to inspect
   * @param {number} params.port - Port of the server
   * @param {string} params.serverType - Type of the server
   * @param {string} params.command - Command to execute
   * @returns {Promise<Object>} Response from the server
   */
  async launchInspector(params) {
    try {
      console.log('Launching MCP Inspector for server:', params);
      
      // IMPORTANT: Skip the real API call and use the simulated response directly
      // Since we don't actually have an Inspector API server running at localhost:9000
      console.warn('Using simulated MCP Inspector response for development');
      
      // Get the correct server URL based on server type
      let serverUrl;
      if (params.serverId === 'llm-gateway') {
        serverUrl = this.config.llmGatewayUrl;
      } else if (params.serverId === 'batch-server') {
        serverUrl = this.config.batchServerUrl;
      } else if (params.serverId === 'regulation-registry') {
        serverUrl = this.config.regulationRegistryUrl;
      } else if (params.serverId.includes('gdpr')) {
        serverUrl = `http://localhost:3200`;
      } else if (params.serverId.includes('hipaa')) {
        serverUrl = `http://localhost:3201`;
      } else if (params.serverId.includes('ccpa')) {
        serverUrl = `http://localhost:3202`;
      } else {
        // Default to the provided port or 3200
        serverUrl = `http://localhost:${params.port || 3200}`;
      }
      
      // Set the output message for the simulated response
      const outputMessage = 
        `Launching MCP Inspector for ${params.serverId} at ${serverUrl}\n` +
        `Command: ${params.command}\n\n` +
        `🚀 Inspector started successfully!\n` +
        `📋 Server Type: ${params.serverType}\n` +
        `🔍 Inspecting MCP Server at ${serverUrl}\n\n` +
        `Detected server capabilities:\n` +
        `- Resources: 2\n` +
        `- Prompts: 3\n` +
        `- Tools: 1\n\n` +
        `For a detailed interactive interface, visit: https://mcp-inspector.modelcontextprotocol.org/\n`;
      
      // Show inspectorUrl based on server type
      const inspectorUrl = `https://mcp-inspector.modelcontextprotocol.org/?url=${encodeURIComponent(serverUrl)}`;
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return a simulated response
      return {
        success: true,
        message: 'MCP Inspector launch process initiated (simulated)',
        serverId: params.serverId,
        processId: Math.floor(Math.random() * 10000), // Simulated process ID
        commandExecuted: params.command,
        isSimulated: true,
        inspectorUrl: inspectorUrl,
        output: outputMessage
      };
    } catch (error) {
      console.error(`Error launching MCP Inspector for server ${params.serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get the console output from an MCP Inspector process
   * @param {string} serverId - ID of the server being inspected
   * @returns {Promise<Object>} Console output from the inspector process
   */
  async getInspectorOutput(serverId) {
    try {
      console.log('Getting MCP Inspector output for server:', serverId);
      
      // Skip API call and use simulated output directly
      console.warn('Using simulated MCP Inspector output for development');
      
      // Get the correct server URL based on server type
      let serverUrl;
      if (serverId === 'llm-gateway') {
        serverUrl = this.config.llmGatewayUrl;
      } else if (serverId === 'batch-server') {
        serverUrl = this.config.batchServerUrl;
      } else if (serverId === 'regulation-registry') {
        serverUrl = this.config.regulationRegistryUrl;
      } else if (serverId.includes('gdpr')) {
        serverUrl = `http://localhost:3200`;
      } else if (serverId.includes('hipaa')) {
        serverUrl = `http://localhost:3201`;
      } else if (serverId.includes('ccpa')) {
        serverUrl = `http://localhost:3202`;
      } else {
        // Default to port 3200
        serverUrl = `http://localhost:3200`;
      }
      
      // Set the output message for the simulated response
      // Add some random progress to make it seem like it's updating
      const randomProgress = [
        'Inspecting server capabilities...',
        'Analyzing MCP endpoints...',
        'Examining regulation content...',
        'Detecting available tools...',
        'Checking server health...',
        'Mapping resource structure...',
        'Validating compliance rules...',
        'Reading server configuration...'
      ];
      
      const progress = randomProgress[Math.floor(Math.random() * randomProgress.length)];
      
      const outputMessage = 
        `Launching MCP Inspector for ${serverId} at ${serverUrl}\n` +
        `\n` +
        `🚀 Inspector running...\n` +
        `📋 Status: Active\n` +
        `🔍 ${progress}\n\n` +
        `Detected server capabilities:\n` +
        `- Resources: 2\n` +
        `- Prompts: 3\n` +
        `- Tools: 1\n\n` +
        `For a detailed interactive interface, visit: https://mcp-inspector.modelcontextprotocol.org/\n`;
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Return simulated output
      return {
        success: true,
        serverId,
        output: outputMessage,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error getting MCP Inspector output for server ${serverId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
const mcpApiClient = new MCPApiClient();
export default mcpApiClient;