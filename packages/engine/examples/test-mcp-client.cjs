/**
 * Test MCP Client
 * 
 * A minimal client for testing the MCP server. This client uses the JSON-RPC 2.0
 * protocol to communicate with the server.
 */

// We use axios for HTTP requests
const axios = require('axios');

// MCP client class
class MCPClient {
  constructor(serverUrl = 'http://localhost:3000/mcp') {
    this.serverUrl = serverUrl;
    this.requestId = 1;
    this.initialized = false;
  }

  /**
   * Initialize connection to the MCP server
   */
  async initialize() {
    if (this.initialized) {
      return { status: 'already initialized' };
    }
    
    const result = await this._callRPC('initialize', {});
    this.initialized = true;
    console.log('MCP connection initialized with capabilities:', result.capabilities);
    return result;
  }

  /**
   * Fetch a regulation by document number
   */
  async fetchRegulation(documentNumber) {
    this._checkInitialized();
    return await this._callRPC('fetchRegulation', { documentNumber });
  }

  /**
   * Extract requirements from regulation text
   */
  async extractRequirements(text) {
    this._checkInitialized();
    return await this._callRPC('extractRequirements', { text });
  }

  /**
   * Summarize regulation text
   */
  async summarizeRegulation(text) {
    this._checkInitialized();
    return await this._callRPC('summarizeRegulation', { text });
  }

  /**
   * Detect changes between two versions of regulation text
   */
  async detectRegulationChanges(oldText, newText) {
    this._checkInitialized();
    return await this._callRPC('detectRegulationChanges', { oldText, newText });
  }

  /**
   * Classify regulation by topic, industry, risk, etc.
   */
  async classifyRegulation(text) {
    this._checkInitialized();
    return await this._callRPC('classifyRegulation', { text });
  }

  /**
   * Make a JSON-RPC call to the MCP server
   */
  async _callRPC(method, params) {
    try {
      const requestId = this.requestId++;
      
      const response = await axios.post(this.serverUrl, {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (data.error) {
        throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
      }
      
      return data.result;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP error (${error.response.status}): ${error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Ensure client is initialized before making requests
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  async function runExample() {
    const client = new MCPClient();
    
    try {
      // Initialize connection
      console.log('Initializing MCP connection...');
      await client.initialize();
      
      // Fetch a regulation
      console.log('\nFetching regulation...');
      try {
        const regulation = await client.fetchRegulation('2013-01503');
        console.log('Regulation title:', regulation.title);
        console.log('Agency:', regulation.agency);
      } catch (error) {
        console.error('Error fetching regulation:', error.message);
      }
      
      // Extract requirements
      console.log('\nExtracting requirements...');
      const sampleText = `
        §1026.43 Minimum standards for transactions secured by a dwelling.
        (a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, 
        as defined in §1026.2(a)(19), including any real property attached to a dwelling, other than:
        (1) A home equity line of credit subject to §1026.40;
        (2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
        (3) For purposes of paragraphs (c) through (f) of this section:
        (i) A reverse mortgage subject to §1026.33;
      `;
      
      try {
        const requirements = await client.extractRequirements(sampleText);
        console.log('Extracted requirements:', JSON.stringify(requirements, null, 2));
      } catch (error) {
        console.error('Error extracting requirements:', error.message);
      }
      
      // Summarize regulation
      console.log('\nSummarizing regulation...');
      try {
        const summary = await client.summarizeRegulation(sampleText);
        console.log('Regulation summary:', JSON.stringify(summary, null, 2));
      } catch (error) {
        console.error('Error summarizing regulation:', error.message);
      }
      
      // Classify regulation
      console.log('\nClassifying regulation...');
      try {
        const classification = await client.classifyRegulation(sampleText);
        console.log('Regulation classification:', JSON.stringify(classification, null, 2));
      } catch (error) {
        console.error('Error classifying regulation:', error.message);
      }
      
      // Detect changes
      console.log('\nDetecting regulation changes...');
      const updatedText = sampleText.replace('12 months', '6 months');
      
      try {
        const changes = await client.detectRegulationChanges(sampleText, updatedText);
        console.log('Detected changes:', JSON.stringify(changes, null, 2));
      } catch (error) {
        console.error('Error detecting changes:', error.message);
      }
      
    } catch (error) {
      console.error('MCP client error:', error.message);
    }
  }
  
  runExample().catch(console.error);
}

// Export for use in other modules
module.exports = MCPClient;