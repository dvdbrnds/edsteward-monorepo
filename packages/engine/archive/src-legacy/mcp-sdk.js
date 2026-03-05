/**
 * MCP SDK - Multi-Channel Protocol Client
 * 
 * A simple client SDK for interacting with MCP-compatible servers.
 */

const https = require('https');
const http = require('http');
const URL = require('url');

class MCPClient {
  /**
   * Create a new MCP client
   * @param {Object} config - Configuration options
   * @param {string} config.serverUrl - URL of the MCP server
   * @param {number} [config.timeout=10000] - Request timeout in ms
   */
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3000/mcp';
    this.timeout = config.timeout || 10000;
    this.session = {
      initialized: false,
      sessionId: null
    };
  }

  /**
   * Initialize the MCP session
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    const result = await this._callMcpMethod('initialize', {});
    this.session.initialized = true;
    this.session.sessionId = result.session_id || 'default-session';
    return result;
  }

  /**
   * Fetch a regulation by document number
   * @param {Object} params - Parameters
   * @param {string} params.document_number - Document number
   * @returns {Promise<Object>} Regulation data
   */
  async fetchRegulation(params) {
    this._ensureInitialized();
    return await this._callMcpMethod('fetchRegulation', params);
  }

  /**
   * Extract requirements from regulation text
   * @param {Object} params - Parameters
   * @param {string} params.text - Regulation text
   * @returns {Promise<Object>} Extracted requirements
   */
  async extractRequirements(params) {
    this._ensureInitialized();
    return await this._callMcpMethod('extractRequirements', params);
  }

  /**
   * Summarize a regulation
   * @param {Object} params - Parameters
   * @param {string} params.text - Regulation text
   * @returns {Promise<Object>} Regulation summary
   */
  async summarizeRegulation(params) {
    this._ensureInitialized();
    return await this._callMcpMethod('summarizeRegulation', params);
  }

  /**
   * Detect changes between regulation versions
   * @param {Object} params - Parameters
   * @param {string} params.old_text - Previous regulation text
   * @param {string} params.new_text - New regulation text
   * @returns {Promise<Object>} Detected changes
   */
  async detectRegulationChanges(params) {
    this._ensureInitialized();
    return await this._callMcpMethod('detectRegulationChanges', params);
  }

  /**
   * Classify a regulation
   * @param {Object} params - Parameters
   * @param {string} params.text - Regulation text
   * @returns {Promise<Object>} Classification results
   */
  async classifyRegulation(params) {
    this._ensureInitialized();
    return await this._callMcpMethod('classifyRegulation', params);
  }

  /**
   * Make a call to an MCP method
   * @private
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @returns {Promise<Object>} Method result
   */
  async _callMcpMethod(method, params) {
    const payload = {
      jsonrpc: '2.0',
      method,
      params: {
        ...params,
        session_id: this.session.sessionId
      },
      id: Date.now()
    };

    try {
      const response = await this._makeHttpRequest(payload);
      
      if (response.error) {
        throw new Error(response.error.message || 'Unknown MCP error');
      }
      
      return response.result || {};
    } catch (error) {
      throw new Error(`MCP Error (${method}): ${error.message}`);
    }
  }

  /**
   * Make an HTTP request to the MCP server
   * @private
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} Response data
   */
  _makeHttpRequest(payload) {
    return new Promise((resolve, reject) => {
      const url = URL.parse(this.serverUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: this.timeout
      };

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            reject(new Error(`Invalid response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeout}ms`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  /**
   * Ensure the client is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.session.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }
  }
}

module.exports = MCPClient;