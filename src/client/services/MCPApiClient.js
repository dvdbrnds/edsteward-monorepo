import axios from 'axios';

const API_BASE_URL = 'http://localhost:3010/api';
const MOCK_MODE = false; // Set to false to use real API calls

class MCPApiClient {
  constructor() {
    // Base API URL - typically configure this from environment variables
    this.baseUrl = API_BASE_URL;
    this.mockMode = MOCK_MODE; // Set to false to use real API calls
  }

  // Simulate a delay for mock responses
  async mockDelay(ms = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fetch all MCP servers
  async getServers() {
    try {
      if (this.mockMode) {
        // Mock response for development/testing
        await this.mockDelay();
        return {
          success: true,
          servers: this._getMockServers()
        };
      }

      const response = await axios.get(`${this.baseUrl}/servers`);
      return response.data;
    } catch (error) {
      console.error('Error fetching servers:', error);
      return { success: false, error: error.message };
    }
  }

  // Fetch a specific MCP server by ID
  async getServerById(id) {
    try {
      if (!id) {
        throw new Error('Server ID is required');
      }

      console.log(`getServerById called with ID: ${id}`);
      
      if (this.mockMode) {
        // Find the server in our mock data
        const allServers = this._getMockServers();
        const server = allServers.find(s => s.id === id || s.regulationId === id);
        if (!server) {
          throw new Error(`Server with ID ${id} not found`);
        }
        return { success: true, server };
      }

      // Use live backend data - try with both /api/regulations/:id format and without
      console.log(`Fetching regulation with ID: ${id}`);
      try {
        // First attempt - directly with ID 
        const response = await axios.get(`${this.baseUrl}/regulations/${id}`);
        const regulation = response.data;
        
        // Map regulation data to server format
        const server = { 
          ...regulation, 
          id: regulation.regulationId || id,
          regulationId: regulation.regulationId || id,
          type: 'Regulation Server',
          category: 'Regulation',
          status: regulation.server?.running ? 'running' : 'stopped',
          port: regulation.server?.port || (3010 + Math.floor(Math.random() * 100)), // Use real port if available
          uptime: regulation.server?.uptime || '1h 30m'
        };
        
        console.log('Successfully mapped server:', server);
        return { success: true, server };
      } catch (directError) {
        console.warn(`Direct fetch failed for ID ${id}, trying to list all regulations`);
        
        // Second attempt - get all regulations and find the matching one
        const allResponse = await axios.get(`${this.baseUrl}/regulations`);
        const allRegulations = allResponse.data;
        
        // Find the regulation matching either id or regulationId
        const matchingRegulation = allRegulations.find(
          r => r.regulationId === id || r.id === id
        );
        
        if (!matchingRegulation) {
          throw new Error(`Server with ID ${id} not found in regulations list`);
        }
        
        // Map the matching regulation to server format
        const server = { 
          ...matchingRegulation, 
          id: matchingRegulation.regulationId || id,
          regulationId: matchingRegulation.regulationId || id,
          type: 'Regulation Server',
          category: 'Regulation',
          status: matchingRegulation.server?.running ? 'running' : 'stopped',
          port: matchingRegulation.server?.port || (3010 + Math.floor(Math.random() * 100)),
          uptime: matchingRegulation.server?.uptime || '1h 30m'
        };
        
        console.log('Found server by matching in all regulations:', server);
        return { success: true, server };
      }
    } catch (error) {
      console.error(`Error fetching server ${id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Start an MCP server
  async startServer(id) {
    try {
      console.log(`Starting server ${id}...`);
      // Simulate API call success
      return {
        success: true,
        message: `Server ${id} started successfully`,
        server: {
          id,
          status: 'online',
          startTime: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error starting server ${id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Stop an MCP server
  async stopServer(id) {
    try {
      console.log(`Stopping server ${id}...`);
      // Simulate API call success
      return {
        success: true,
        message: `Server ${id} stopped successfully`,
        server: {
          id,
          status: 'offline',
          stopTime: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error stopping server ${id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Launch MCP Inspector for a server
  async launchInspector(serverId, port, serverType = 'regulation') {
    try {
      if (!serverId || !port) {
        throw new Error('Server ID and port are required');
      }

      console.log(`Launching inspector for server ${serverId} on port ${port}...`);

      const response = await fetch(`${API_BASE_URL}/inspector/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId,
          port,
          serverType
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to launch MCP Inspector');
      }

      return {
        success: true,
        processId: data.processId,
        message: data.message,
        inspectorUrl: data.inspectorUrl
      };
    } catch (error) {
      console.error(`Error launching inspector for server ${serverId}:`, error);
      return { 
        success: false, 
        error: error.message,
        // Include fallback URL for development purposes
        inspectorUrl: 'http://localhost:6277'
      };
    }
  }

  // Get MCP Inspector status
  async getInspectorStatus(processId) {
    try {
      if (!processId) {
        throw new Error('Process ID is required');
      }

      const response = await fetch(`${API_BASE_URL}/inspector/status/${processId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get inspector status');
      }

      return {
        success: true,
        isRunning: data.isRunning,
        serverId: data.serverId,
        serverPort: data.serverPort
      };
    } catch (error) {
      console.error(`Error getting inspector status:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get MCP Inspector output
  async getInspectorOutput(processId) {
    try {
      if (!processId) {
        throw new Error('Process ID is required');
      }

      const response = await fetch(`${API_BASE_URL}/inspector/output/${processId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get inspector output');
      }

      return {
        success: true,
        output: data.output
      };
    } catch (error) {
      console.error(`Error getting inspector output:`, error);
      return { success: false, error: error.message };
    }
  }

  // Terminate MCP Inspector
  async terminateInspector(processId) {
    try {
      if (!processId) {
        throw new Error('Process ID is required');
      }

      const response = await fetch(`${API_BASE_URL}/inspector/terminate/${processId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to terminate inspector');
      }

      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error(`Error terminating inspector:`, error);
      return { success: false, error: error.message };
    }
  }

  // Private method to get mock servers data
  _getMockServers() {
    const coreServers = [
      {
        id: 'llm-gateway',
        name: 'LLM Gateway',
        type: 'core',
        category: 'Core Server',
        status: 'online',
        port: 3001,
        uptime: '3d 5h 12m'
      },
      {
        id: 'batch-processing',
        name: 'Batch Processing Server',
        type: 'core',
        category: 'Core Server',
        status: 'online',
        port: 3002,
        uptime: '2d 14h 45m'
      },
      {
        id: 'regulation-registry',
        name: 'Regulation Registry',
        type: 'core',
        category: 'Core Server',
        status: 'online',
        port: 3003,
        uptime: '3d 5h 10m'
      }
    ];

    const regulationServers = [
      {
        id: 'ada-1975',
        name: 'Age Discrimination Act of 1975',
        type: 'regulation',
        category: 'Civil Rights',
        status: 'online',
        port: 4001,
        uptime: '1d 8h 42m'
      },
      {
        id: 'ada-1990',
        name: 'Americans with Disabilities Act of 1990',
        type: 'regulation',
        category: 'Civil Rights',
        status: 'online',
        port: 4002,
        uptime: '2d 3h 15m'
      },
      {
        id: 'adea-1967',
        name: 'Age Discrimination in Employment Act of 1967',
        type: 'regulation',
        category: 'Employment',
        status: 'offline',
        port: 4003,
        uptime: '0d 0h 0m'
      },
      {
        id: 'copyright-1976',
        name: 'Copyright Act of 1976',
        type: 'regulation',
        category: 'Intellectual Property',
        status: 'online',
        port: 4004,
        uptime: '3d 2h 10m'
      },
      {
        id: 'cpa-2010',
        name: 'Consumer Product Safety Improvement Act',
        type: 'regulation',
        category: 'Consumer Protection',
        status: 'online',
        port: 4005,
        uptime: '1d 22h 5m'
      },
      {
        id: 'ecpa-1986',
        name: 'Electronic Communications Privacy Act',
        type: 'regulation',
        category: 'Privacy',
        status: 'online',
        port: 4006,
        uptime: '0d 19h 35m'
      },
      {
        id: 'epa-1992',
        name: 'Energy Policy Act of 1992',
        type: 'regulation',
        category: 'Energy',
        status: 'offline',
        port: 4007,
        uptime: '0d 0h 0m'
      },
      {
        id: 'ferpa-1974',
        name: 'Family Educational Rights and Privacy Act',
        type: 'regulation',
        category: 'Education',
        status: 'online',
        port: 4008,
        uptime: '2d 7h 18m'
      },
      {
        id: 'fha-1968',
        name: 'Fair Housing Act',
        type: 'regulation',
        category: 'Housing',
        status: 'online',
        port: 4009,
        uptime: '1d 14h 23m'
      },
      {
        id: 'flsa-1938',
        name: 'Fair Labor Standards Act',
        type: 'regulation',
        category: 'Employment',
        status: 'online',
        port: 4010,
        uptime: '3d 0h 5m'
      },
      {
        id: 'fmla-1993',
        name: 'Family and Medical Leave Act',
        type: 'regulation',
        category: 'Employment',
        status: 'online',
        port: 4011,
        uptime: '2d 11h 42m'
      },
      {
        id: 'hipaa-1996',
        name: 'Health Insurance Portability and Accountability Act',
        type: 'regulation',
        category: 'Healthcare',
        status: 'online',
        port: 4012,
        uptime: '1d 18h 31m'
      },
      {
        id: 'idea-2004',
        name: 'Individuals with Disabilities Education Act',
        type: 'regulation',
        category: 'Education',
        status: 'online',
        port: 4013,
        uptime: '3d 5h 12m'
      },
      {
        id: 'fisma-2002',
        name: 'Federal Information Security Management Act',
        type: 'regulation',
        category: 'Information Security',
        status: 'online',
        port: 4014,
        uptime: '0d 22h 47m'
      },
      {
        id: 'glba-1999',
        name: 'Gramm-Leach-Bliley Act',
        type: 'regulation',
        category: 'Financial Privacy',
        status: 'offline',
        port: 4015,
        uptime: '0d 0h 0m'
      },
      {
        id: 'title-ix-1972',
        name: 'Title IX of the Education Amendments of 1972',
        type: 'regulation',
        category: 'Education',
        status: 'online',
        port: 4016,
        uptime: '1d 9h 14m'
      },
      {
        id: 'fcra-1970',
        name: 'Fair Credit Reporting Act',
        type: 'regulation',
        category: 'Consumer Protection',
        status: 'online',
        port: 4017,
        uptime: '2d 3h 55m'
      },
      {
        id: 'coppa-1998',
        name: "Children's Online Privacy Protection Act",
        type: 'regulation',
        category: 'Privacy',
        status: 'online',
        port: 4018,
        uptime: '1d 16h 22m'
      },
      {
        id: 'data-quality-2001',
        name: 'Data Quality Act',
        type: 'regulation',
        category: 'Information Quality',
        status: 'online',
        port: 4019,
        uptime: '3d 1h 7m'
      },
      {
        id: 'essa-2015',
        name: 'Every Student Succeeds Act',
        type: 'regulation',
        category: 'Education',
        status: 'online',
        port: 4020,
        uptime: '0d 20h 38m'
      },
      {
        id: 'hea-1965',
        name: 'Higher Education Act of 1965',
        type: 'regulation',
        category: 'Education',
        status: 'online',
        port: 4021,
        uptime: '2d 5h 50m'
      },
      {
        id: 'osha-1970',
        name: 'Occupational Safety and Health Act',
        type: 'regulation',
        category: 'Workplace Safety',
        status: 'online',
        port: 4022,
        uptime: '1d 12h 19m'
      },
      {
        id: 'wioa-2014',
        name: 'Workforce Innovation and Opportunity Act',
        type: 'regulation',
        category: 'Employment',
        status: 'offline',
        port: 4023,
        uptime: '0d 0h 0m'
      }
    ];

    return [...coreServers, ...regulationServers];
  }
}

// Create and export a singleton instance
const mcpApiClient = new MCPApiClient();
export default mcpApiClient; 