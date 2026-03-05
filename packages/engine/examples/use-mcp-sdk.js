// Simple MCP client using the SDK

const mcpEndpoint = 'http://localhost:3000/mcp';

async function callMcpMethod(method, params = {}) {
  const requestId = Math.floor(Math.random() * 10000);
  
  const requestBody = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params
  };
  
  console.log(`Calling method: ${method}`);
  
  try {
    const response = await fetch(mcpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }
    
    return result.result;
  } catch (error) {
    console.error(`Error calling ${method}:`, error);
    throw error;
  }
}

async function main() {
  try {
    // Initialize connection
    console.log('Initializing MCP connection...');
    const initResult = await callMcpMethod('initialize', { session_id: 'test-session' });
    console.log('Initialization result:', initResult);
    
    // Fetch regulation
    console.log('\nFetching regulation data...');
    const regulationData = await callMcpMethod('fetchRegulation', { 
      documentNumber: 'test-doc-123'
    });
    console.log('Regulation data received:', regulationData);
    
    // Extract requirements from regulation text
    console.log('\nExtracting requirements from regulation...');
    const requirements = await callMcpMethod('extractRequirements', {
      text: 'Entities must maintain records of all transactions for a period of 7 years. Failure to comply may result in penalties up to $10,000 per violation.'
    });
    console.log('Extracted requirements:', JSON.stringify(requirements, null, 2));
    
    // Summarize regulation
    console.log('\nSummarizing regulation text...');
    const summary = await callMcpMethod('summarizeRegulation', {
      text: 'This regulation establishes guidelines for financial institutions regarding record-keeping practices. All financial institutions must maintain transaction records for a minimum of 7 years from the date of transaction. These records must include the transaction date, parties involved, transaction amount, and purpose. Records may be maintained in electronic format provided they can be readily accessed and printed if required by regulators. Institutions failing to comply with these requirements may face penalties of up to $10,000 per violation.'
    });
    console.log('Regulation summary:', JSON.stringify(summary, null, 2));
    
    console.log('\nAll MCP operations completed successfully!');
  } catch (error) {
    console.error('Error during MCP operations:', error);
  }
}

// Check if fetch is available, provide polyfill info if needed
if (typeof fetch !== 'function') {
  console.error('Fetch API not available. If running in Node.js environment, you may need to:');
  console.error('1. Use Node.js version 18+ which includes native fetch');
  console.error('2. Or install a polyfill: npm install node-fetch');
  console.error('3. For Node.js <18: const fetch = require("node-fetch")');
  process.exit(1);
}

main();