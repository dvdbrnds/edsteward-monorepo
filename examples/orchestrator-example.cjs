/**
 * Orchestrator Example for Civil Service Reform Act
 * 
 * This example demonstrates how an orchestrator might interact with
 * the Civil Service Reform Act MCP server to collect and process information.
 */

const axios = require('axios');

// Configuration
const MCP_SERVERS = {
  civilServiceAct: 'http://localhost:3001/mcp'
};

let requestId = 1;

/**
 * Send a JSON-RPC request to an MCP server
 * @param {string} serverUrl - The URL of the MCP server
 * @param {string} method - The method to call
 * @param {object} params - The parameters for the method
 * @returns {Promise<object>} - The response from the server
 */
async function sendMcpRequest(serverUrl, method, params = {}) {
  try {
    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      id: requestId++,
      method,
      params
    });
    
    const { result, error } = response.data;
    
    if (error) {
      throw new Error(`MCP error: ${error.message} (${error.code})`);
    }
    
    return result;
  } catch (error) {
    if (error.response) {
      throw new Error(`Server error: ${error.response.status} ${error.response.statusText}`);
    } else {
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

/**
 * Initialize connection with an MCP server
 * @param {string} serverUrl - The URL of the MCP server
 * @returns {Promise<object>} - Initialization result
 */
async function initializeMcpServer(serverUrl) {
  return sendMcpRequest(serverUrl, 'initialize');
}

/**
 * Orchestrator class to manage interactions with multiple MCP servers
 */
class RegulatoryOrchestrator {
  constructor() {
    this.connections = {};
    this.initialized = false;
  }
  
  /**
   * Initialize connections to all MCP servers
   */
  async initialize() {
    console.log('Initializing orchestrator connections to MCP servers...');
    
    for (const [serverName, serverUrl] of Object.entries(MCP_SERVERS)) {
      console.log(`Connecting to ${serverName} MCP server at ${serverUrl}`);
      const result = await initializeMcpServer(serverUrl);
      this.connections[serverName] = {
        url: serverUrl,
        capabilities: result.capabilities
      };
    }
    
    this.initialized = true;
    console.log('Orchestrator initialized successfully');
  }
  
  /**
   * Ensure the orchestrator is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Get basic information about a regulation
   * @param {string} regulationType - Type of regulation
   * @returns {Promise<object>} - Regulation information
   */
  async getRegulationInfo(regulationType) {
    this.ensureInitialized();
    
    if (regulationType === 'civilServiceAct') {
      return sendMcpRequest(
        this.connections.civilServiceAct.url,
        'getActInfo'
      );
    } else {
      throw new Error(`Unsupported regulation type: ${regulationType}`);
    }
  }
  
  /**
   * Get key provisions of a regulation
   * @param {string} regulationType - Type of regulation
   * @returns {Promise<object>} - Regulation provisions
   */
  async getRegulationProvisions(regulationType) {
    this.ensureInitialized();
    
    if (regulationType === 'civilServiceAct') {
      return sendMcpRequest(
        this.connections.civilServiceAct.url,
        'getKeyProvisions'
      );
    } else {
      throw new Error(`Unsupported regulation type: ${regulationType}`);
    }
  }
  
  /**
   * Extract requirements from regulation text
   * @param {string} regulationType - Type of regulation
   * @param {string} text - Regulation text
   * @returns {Promise<object>} - Extracted requirements
   */
  async extractRequirements(regulationType, text) {
    this.ensureInitialized();
    
    if (regulationType === 'civilServiceAct') {
      return sendMcpRequest(
        this.connections.civilServiceAct.url,
        'extractRequirements',
        { text }
      );
    } else {
      throw new Error(`Unsupported regulation type: ${regulationType}`);
    }
  }
  
  /**
   * Get a comprehensive report on a regulation
   * @param {string} regulationType - Type of regulation
   * @returns {Promise<object>} - Comprehensive report
   */
  async getComprehensiveReport(regulationType) {
    this.ensureInitialized();
    
    if (regulationType === 'civilServiceAct') {
      // Fetch data from multiple endpoints to create a comprehensive report
      const [info, provisions, agencies, cases] = await Promise.all([
        sendMcpRequest(this.connections.civilServiceAct.url, 'getActInfo'),
        sendMcpRequest(this.connections.civilServiceAct.url, 'getKeyProvisions'),
        sendMcpRequest(this.connections.civilServiceAct.url, 'getAgenciesCreated'),
        sendMcpRequest(this.connections.civilServiceAct.url, 'getRelatedCases')
      ]);
      
      // Example of summarizing with the text
      const sampleText = "Civil Service Reform Act of 1978 text sample";
      const summary = await sendMcpRequest(
        this.connections.civilServiceAct.url,
        'summarizeRegulation',
        { text: sampleText }
      );
      
      // Combine all data into a comprehensive report
      return {
        info,
        provisions: provisions.provisions,
        agencies: agencies.agencies,
        cases: cases.cases,
        summary: summary
      };
    } else {
      throw new Error(`Unsupported regulation type: ${regulationType}`);
    }
  }
}

/**
 * Main function to demonstrate orchestrator usage
 */
async function main() {
  console.log('Starting Regulatory Orchestrator example...');
  
  const orchestrator = new RegulatoryOrchestrator();
  
  try {
    // Initialize the orchestrator
    await orchestrator.initialize();
    
    // Example 1: Get basic information about the Civil Service Reform Act
    console.log('\nExample 1: Basic Information');
    const info = await orchestrator.getRegulationInfo('civilServiceAct');
    console.log(JSON.stringify(info, null, 2));
    
    // Example 2: Get key provisions
    console.log('\nExample 2: Key Provisions');
    const provisions = await orchestrator.getRegulationProvisions('civilServiceAct');
    console.log(JSON.stringify(provisions, null, 2));
    
    // Example 3: Extract requirements from text
    console.log('\nExample 3: Extract Requirements');
    const requirements = await orchestrator.extractRequirements(
      'civilServiceAct',
      'Federal agencies must adhere to merit principles in hiring and promotions.'
    );
    console.log(JSON.stringify(requirements, null, 2));
    
    // Example 4: Generate a comprehensive report
    console.log('\nExample 4: Comprehensive Report');
    const report = await orchestrator.getComprehensiveReport('civilServiceAct');
    console.log('Comprehensive report generated with sections:');
    Object.keys(report).forEach(section => {
      console.log(` - ${section}`);
    });
    
    console.log('\nOrchestrator demonstration completed successfully');
    
  } catch (error) {
    console.error('Error in orchestrator demonstration:', error.message);
  }
}

// Run the main function
main(); 