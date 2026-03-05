/**
 * Test LLM Client
 * 
 * This script simulates an LLM (Claude, ChatGPT, Gemini) making requests
 * to the LLM Gateway Service.
 * 
 * Usage: node test-llm-client.js [action] [regulation]
 * 
 * Examples:
 * - node test-llm-client.js status             # Check system status
 * - node test-llm-client.js validate FERPA     # Validate against FERPA
 * - node test-llm-client.js changes Privacy    # Check for changes in Privacy category
 */

import axios from 'axios';
import readline from 'readline';

// Configuration
const GATEWAY_URL = 'http://localhost:3100';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Parse command line arguments
const args = process.argv.slice(2);
const action = args[0] || 'status';
const regulation = args[1] || null;

/**
 * Send a request to the LLM Gateway Service
 */
async function sendRequest(endpoint, data = {}) {
  try {
    const response = await axios.post(`${GATEWAY_URL}${endpoint}`, data);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Error ${error.response.status}: ${error.response.data.message || error.response.statusText}`);
    } else {
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

/**
 * Check the status of the gateway
 */
async function checkStatus() {
  try {
    const response = await axios.get(`${GATEWAY_URL}/api/status`);
    console.log('Gateway Status:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Failed to get status:', error.message);
  }
}

/**
 * Get available regulations
 */
async function getRegulations() {
  try {
    const response = await axios.get(`${GATEWAY_URL}/api/regulations`);
    
    if (response.data.length === 0) {
      console.log('No regulations available.');
      return [];
    }
    
    console.log(`Found ${response.data.length} regulations.`);
    return response.data;
  } catch (error) {
    console.error('Failed to get regulations:', error.message);
    return [];
  }
}

/**
 * Simulate an LLM validation request
 */
async function simulateValidationRequest(regulationId) {
  const sampleContent = `
    This is a sample document to validate against regulatory requirements.
    It contains information that may be subject to compliance regulations.
    Personal data includes: John Doe, 123-45-6789, john.doe@example.com.
    Medical information includes diagnosis of hypertension and treatment plan.
    Financial information includes account number 987654321.
  `;
  
  try {
    const result = await sendRequest('/api/llm/initiate', {
      action: 'validate',
      regulationId: regulationId,
      content: sampleContent,
      context: {
        documentType: 'internal_memo',
        department: 'healthcare',
        confidentiality: 'high'
      },
      validationType: 'standard',
      llmSource: 'claude'
    });
    
    console.log('Validation Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Validation request failed:', error.message);
  }
}

/**
 * Simulate an LLM change detection request
 */
async function simulateChangeDetectionRequest(categoryName) {
  try {
    const result = await sendRequest('/api/llm/initiate', {
      action: 'changes',
      category: categoryName,
      since: '2024-01-01',
      llmSource: 'chatgpt'
    });
    
    console.log('Change Detection Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Change detection request failed:', error.message);
  }
}

/**
 * Simulate an LLM status check request
 */
async function simulateStatusCheckRequest(validationId) {
  try {
    const result = await sendRequest('/api/llm/initiate', {
      action: 'status',
      validationId,
      llmSource: 'gemini'
    });
    
    console.log('Status Check Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Status check request failed:', error.message);
  }
}

/**
 * Main function to execute the test client
 */
async function main() {
  console.log('LLM Gateway Test Client');
  console.log('----------------------');
  
  try {
    // Check if server is running
    await checkStatus();
    
    // Handle different actions
    switch (action) {
      case 'status':
        await checkStatus();
        break;
        
      case 'regulations':
        await getRegulations();
        break;
        
      case 'validate':
        if (regulation) {
          console.log(`Simulating validation request for ${regulation}...`);
          await simulateValidationRequest(regulation);
        } else {
          const regulations = await getRegulations();
          if (regulations.length > 0) {
            const firstReg = regulations[0];
            console.log(`Using first available regulation: ${firstReg.id}`);
            await simulateValidationRequest(firstReg.id);
          } else {
            console.error('No regulations available for validation');
          }
        }
        break;
        
      case 'changes':
        console.log(`Simulating change detection request for ${regulation || 'all regulations'}...`);
        await simulateChangeDetectionRequest(regulation);
        break;
        
      default:
        console.error(`Unknown action: ${action}`);
        console.log('Available actions: status, regulations, validate, changes');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the main function
main().catch(console.error); 