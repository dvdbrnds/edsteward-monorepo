const fetch = require('node-fetch');

/**
 * Client for interacting directly with MCP Engine API
 */
class MCPDirectClient {
  /**
   * Create a new MCP client
   * @param {string} serverUrl - URL of the MCP server
   * @param {Object} options - Configuration options
   */
  constructor(serverUrl = 'http://localhost:3000/mcp', options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      timeout: 30000, // 30 second default timeout
      ...options
    };
    this.initialized = false;
  }

  /**
   * Initialize connection to MCP server
   * @returns {Promise<Object>} - Connection result
   */
  async initialize() {
    try {
      const response = await this._callMCP('Filesystem_list_allowed_directories', {
        random_string: 'check-connection'
      });
      this.initialized = true;
      return response;
    } catch (error) {
      console.error('Failed to initialize MCP connection:', error);
      throw new Error(`MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Fetch a regulation by document number
   * @param {string} documentNumber - Federal Register document number
   * @returns {Promise<Object>} - Regulation data
   */
  async fetchRegulation(documentNumber) {
    return this._callMCP('RegulatorySource_fetchRegulationByDocumentNumber', {
      documentNumber
    });
  }

  /**
   * Extract structured requirements from regulation text
   * @param {string} text - Regulation text
   * @returns {Promise<Object>} - Extracted requirements
   */
  async extractRequirements(text) {
    return this._callMCP('RegulatorySource_extractRegulationRequirements', {
      text
    });
  }

  /**
   * Summarize regulation text
   * @param {string} text - Regulation text
   * @returns {Promise<Object>} - Regulation summary
   */
  async summarizeRegulation(text) {
    return this._callMCP('RegulatorySource_summarizeRegulation', {
      text
    });
  }

  /**
   * Detect changes between versions of regulation text
   * @param {string} oldText - Original regulation text
   * @param {string} newText - Updated regulation text
   * @returns {Promise<Object>} - Changes analysis
   */
  async detectRegulationChanges(oldText, newText) {
    return this._callMCP('RegulatorySource_detectRegulationChanges', {
      oldText,
      newText
    });
  }

  /**
   * Classify regulation by topic, industry, risk, etc.
   * @param {string} text - Regulation text
   * @returns {Promise<Object>} - Classification results
   */
  async classifyRegulation(text) {
    return this._callMCP('RegulatorySource_classifyRegulation', {
      text
    });
  }

  /**
   * Generic method to call any MCP function
   * @param {string} functionName - MCP function name
   * @param {Object} parameters - Function parameters
   * @returns {Promise<any>} - Function results
   */
  async call(functionName, parameters) {
    return this._callMCP(functionName, parameters);
  }

  /**
   * Internal method to make MCP API calls
   * @private
   * @param {string} functionName - MCP function name
   * @param {Object} parameters - Function parameters
   * @returns {Promise<any>} - API response
   */
  async _callMCP(functionName, parameters) {
    if (!this.initialized && functionName !== 'Filesystem_list_allowed_directories') {
      await this.initialize();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: functionName,
          parameters
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`MCP API request timed out after ${this.options.timeout}ms`);
      }
      throw error;
    }
  }
}

// Example usage function
async function runExample() {
  const client = new MCPDirectClient();
  
  try {
    console.log('Initializing MCP client...');
    const initResult = await client.initialize();
    console.log('MCP client initialized:', initResult);
    
    console.log('\nFetching regulation...');
    const regulation = await client.fetchRegulation('2021-14671');
    console.log('Fetched regulation title:', regulation.title);
    
    const sampleText = `§ 1026.43 Minimum standards for transactions secured by a dwelling.
    (a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, as defined in § 1026.2(a)(19), including any real property attached to a dwelling, other than:
    (1) A home equity line of credit subject to § 1026.40;
    (2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
    (3) For purposes of paragraphs (c) through (f) of this section:
    (i) A reverse mortgage subject to § 1026.33;
    (ii) A temporary or "bridge" loan with a term of 12 months or less, such as a loan to finance the purchase of a new dwelling where the consumer plans to sell a current dwelling within 12 months or a loan to finance the initial construction of a dwelling;
    (iii) A construction phase of 12 months or less of a construction-to-permanent loan;`;
    
    console.log('\nExtracting requirements...');
    const requirements = await client.extractRequirements(sampleText);
    console.log('Extracted requirements:', requirements);
    
    console.log('\nSummarizing regulation...');
    const summary = await client.summarizeRegulation(sampleText);
    console.log('Regulation summary:', summary);
    
    console.log('\nClassifying regulation...');
    const classification = await client.classifyRegulation(sampleText);
    console.log('Regulation classification:', classification);
    
    const updatedText = `§ 1026.43 Minimum standards for transactions secured by a dwelling.
    (a) Scope. This section applies to any consumer credit transaction that is secured by a dwelling, as defined in § 1026.2(a)(19), including any real property attached to a dwelling, other than:
    (1) A home equity line of credit subject to § 1026.40;
    (2) A mortgage transaction secured by a consumer's interest in a timeshare plan, as defined in 11 U.S.C. 101(53D); or
    (3) For purposes of paragraphs (c) through (f) of this section:
    (i) A reverse mortgage subject to § 1026.33;
    (ii) A temporary or "bridge" loan with a term of 12 months or less, such as a loan to finance the purchase of a new dwelling where the consumer plans to sell a current dwelling within 12 months or a loan to finance the initial construction of a dwelling;
    (iii) A construction phase of 12 months or less of a construction-to-permanent loan;
    (iv) An extension of credit made pursuant to a program administered by a Housing Finance Agency, as defined under 24 CFR 266.5;`;
    
    console.log('\nDetecting changes...');
    const changes = await client.detectRegulationChanges(sampleText, updatedText);
    console.log('Detected changes:', changes);
    
  } catch (error) {
    console.error('Error in MCP example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

module.exports = { MCPDirectClient };