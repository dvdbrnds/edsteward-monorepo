/**
 * Civil Service Reform Act MCP Client
 * A simple client to test the Civil Service Reform Act MCP server
 */

const axios = require('axios');

// MCP Server configuration
const MCP_SERVER_URL = 'http://localhost:3001/mcp';
let requestId = 1;

/**
 * Send a JSON-RPC request to the MCP server
 * @param {string} method - The method to call
 * @param {object} params - The parameters for the method
 * @returns {Promise<object>} - The response from the server
 */
async function sendRequest(method, params = {}) {
  console.log(`Sending request: ${method}`);
  
  try {
    const response = await axios.post(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      id: requestId++,
      method,
      params
    });
    
    const { result, error } = response.data;
    
    if (error) {
      console.error(`Error from server: ${error.message} (${error.code})`);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error(`Network error: ${error.message}`);
    return null;
  }
}

/**
 * Initialize the connection with the MCP server
 */
async function initialize() {
  const result = await sendRequest('initialize');
  console.log('Initialized connection with MCP server');
  console.log('Server capabilities:', result.capabilities);
  return result;
}

/**
 * Main function to demonstrate client usage
 */
async function main() {
  console.log('Starting Civil Service Reform Act MCP client...');
  
  // Initialize the connection
  await initialize();
  
  // Get basic information about the Act
  const actInfo = await sendRequest('getActInfo');
  console.log('\nCivil Service Reform Act Basic Information:');
  console.log(`Title: ${actInfo.title}`);
  console.log(`Enacted: ${actInfo.enacted}`);
  console.log(`Public Law: ${actInfo.public_law}`);
  console.log(`Description: ${actInfo.description}`);
  
  // Get key provisions
  const provisions = await sendRequest('getKeyProvisions');
  console.log('\nKey Provisions:');
  provisions.provisions.forEach((provision, index) => {
    console.log(`${index + 1}. ${provision.title}: ${provision.description}`);
  });
  
  // Get agencies created
  const agencies = await sendRequest('getAgenciesCreated');
  console.log('\nAgencies Created:');
  agencies.agencies.forEach((agency, index) => {
    console.log(`${index + 1}. ${agency.name}: ${agency.role}`);
  });
  
  // Extract requirements (with mock text)
  const requirements = await sendRequest('extractRequirements', { 
    text: 'Sample regulation text for Civil Service Reform Act of 1978' 
  });
  console.log('\nExtracted Requirements:');
  requirements.requirements.forEach((req, index) => {
    console.log(`${index + 1}. ${req.subject} must ${req.obligation} (${req.statutory_reference})`);
  });
  
  // Get related cases
  const cases = await sendRequest('getRelatedCases');
  console.log('\nRelated Legal Cases:');
  cases.cases.forEach((case_, index) => {
    console.log(`${index + 1}. ${case_.name} (${case_.citation}): ${case_.significance}`);
  });
  
  // Get full text URL
  const fullText = await sendRequest('getFullText');
  console.log('\nFull Text URL:');
  console.log(fullText.url);
  
  console.log('\nClient demonstration completed');
}

// Run the main function
main().catch(error => {
  console.error('Error running client:', error);
}); 