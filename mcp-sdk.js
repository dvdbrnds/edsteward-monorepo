/**
 * Simple MCP SDK Client
 * 
 * This SDK provides methods to interact with an MCP-compatible server.
 */

class MCPClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'http://localhost:3000/mcp';
    this.initialized = false;
    this.requestId = 1;
  }

  /**
   * Initialize the MCP connection
   */
  async initialize() {
    const result = await this._callMCP('initialize');
    this.initialized = true;
    return result;
  }

  /**
   * Fetch a regulation by document number
   * @param {string} documentNumber - The document identifier
   */
  async fetchRegulation(documentNumber) {
    this._checkInitialized();
    return await this._callMCP('fetchRegulation', { documentNumber });
  }

  /**
   * Extract requirements from regulation text
   * @param {string} text - The regulation text
   */
  async extractRequirements(text) {
    this._checkInitialized();
    return await this._callMCP('extractRequirements', { text });
  }

  /**
   * Create a summary of a regulation
   * @param {string} text - The regulation text
   */
  async summarizeRegulation(text) {
    this._checkInitialized();
    return await this._callMCP('summarizeRegulation', { text });
  }

  /**
   * Detect changes between two versions of a regulation
   * @param {string} oldText - The previous regulation text
   * @param {string} newText - The updated regulation text
   */
  async detectRegulationChanges(oldText, newText) {
    this._checkInitialized();
    return await this._callMCP('detectRegulationChanges', { 
      oldText, 
      newText 
    });
  }

  /**
   * Classify a regulation by topic, risk, etc.
   * @param {string} text - The regulation text
   */
  async classifyRegulation(text) {
    this._checkInitialized();
    return await this._callMCP('classifyRegulation', { text });
  }

  /**
   * Make an RPC call to the MCP server
   * @private
   */
  async _callMCP(method, params = {}) {
    // Ensure MCP is initialized except for the initialize method
    if (method !== 'initialize' && !this.initialized) {
      throw new Error('MCP client must be initialized before making calls');
    }

    const requestId = this.requestId++;
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: requestId
      })
    });

    if (!response.ok) {
      throw new Error(`MCP request failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP error: ${data.error.message}`);
    }

    return data.result;
  }

  /**
   * Check if the client is initialized
   * @private
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }
  }
}

module.exports = MCPClient;