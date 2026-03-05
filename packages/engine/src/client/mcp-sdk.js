/**
 * MCP SDK - Simple client for Model Compliance Protocol
 */
export class MCPClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'http://localhost:3000/mcp';
    this.requestId = 1;
    this.initialized = false;
    this.capabilities = null;
  }

  /**
   * Initialize the client and fetch server capabilities
   */
  async initialize() {
    try {
      const response = await fetch(`${this.endpoint}/initialize`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      this.capabilities = await response.json();
      this.initialized = true;
      return this.capabilities;
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      throw error;
    }
  }

  /**
   * Call an MCP method using JSON-RPC 2.0 format
   * @param {string} method - Method name to call
   * @param {object} params - Parameters for the method
   * @returns {Promise<any>} - Result from the method call
   */
  async callMethod(method, params = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const rpcRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rpcRequest)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message} (${result.error.code})`);
      }
      
      return result.result;
    } catch (error) {
      console.error(`Error calling method '${method}':`, error);
      throw error;
    }
  }

  /**
   * Get the available methods from the server
   * @returns {Array<string>} - Array of available method names
   */
  getAvailableMethods() {
    if (!this.initialized || !this.capabilities) {
      throw new Error('Client not initialized. Call initialize() first');
    }
    
    return this.capabilities.methods || [];
  }
}