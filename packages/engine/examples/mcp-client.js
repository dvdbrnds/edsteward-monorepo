// MCP Client for Node.js
const axios = require('axios');

class MCPClient {
  constructor(baseUrl = 'http://localhost:3000', options = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || 30000;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check server availability and compatibility
      await this.call('Filesystem_list_allowed_directories', { random_string: 'init' });
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize MCP client:', error.message);
      throw new Error(`MCP initialization failed: ${error.message}`);
    }
  }

  async call(functionName, parameters = {}) {
    if (!this.initialized && functionName !== 'Filesystem_list_allowed_directories') {
      await this.initialize();
    }

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mcp`,
        data: {
          name: functionName,
          parameters
        },
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(`MCP API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error(`MCP request timeout: ${error.message}`);
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`MCP request error: ${error.message}`);
      }
    }
  }

  // Convenience methods for regulatory source functions
  async fetchRegulationByDocumentNumber(documentNumber) {
    return this.call('RegulatorySource_fetchRegulationByDocumentNumber', { documentNumber });
  }

  async extractRegulationRequirements(text) {
    return this.call('RegulatorySource_extractRegulationRequirements', { text });
  }

  async summarizeRegulation(text) {
    return this.call('RegulatorySource_summarizeRegulation', { text });
  }

  async detectRegulationChanges(oldText, newText) {
    return this.call('RegulatorySource_detectRegulationChanges', { oldText, newText });
  }

  async classifyRegulation(text) {
    return this.call('RegulatorySource_classifyRegulation', { text });
  }
}

module.exports = { MCPClient };

// Example usage
async function runExample() {
  try {
    const client = new MCPClient('http://localhost:3000');
    await client.initialize();
    console.log('MCP Client initialized successfully');

    // Fetch a regulation (commented out to avoid actual API calls)
    /*
    const regulation = await client.fetchRegulationByDocumentNumber('2022-12345');
    console.log('Fetched regulation:', regulation.title);
    */

    // Extract requirements from sample text
    const sampleText = `
      Section 123.45 Compliance Requirements
      (a) All covered entities must submit annual reports by March 31st.
      (b) Reports must include:
        (1) Financial statements
        (2) Risk assessments
        (3) Compliance certifications
      (c) Failure to comply may result in penalties up to $10,000 per violation.
    `;

    const requirements = await client.extractRegulationRequirements(sampleText);
    console.log('Extracted requirements:', requirements);

    // Summarize regulation
    const summary = await client.summarizeRegulation(sampleText);
    console.log('Regulation summary:', summary);

    // Classify regulation
    const classification = await client.classifyRegulation(sampleText);
    console.log('Regulation classification:', classification);

    // Detect changes
    const updatedText = `
      Section 123.45 Compliance Requirements
      (a) All covered entities must submit annual reports by April 30th.
      (b) Reports must include:
        (1) Financial statements
        (2) Risk assessments
        (3) Compliance certifications
        (4) Executive attestations
      (c) Failure to comply may result in penalties up to $25,000 per violation.
    `;

    const changes = await client.detectRegulationChanges(sampleText, updatedText);
    console.log('Detected changes:', changes);

  } catch (error) {
    console.error('Error in MCP client example:', error.message);
  }
}

// Uncomment to run the example
// runExample();