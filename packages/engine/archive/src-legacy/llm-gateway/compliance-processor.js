import { loadComplianceData } from '../utils/data-loader.js';
import { callLLM } from '../utils/llm-connector.js';
import { setupLogger } from '../utils/logger.js';

const logger = setupLogger('compliance-processor');

/**
 * Process a compliance query using the LLM
 * 
 * @param {string} query - The user's compliance query
 * @returns {object} The processed compliance information
 */
export async function processComplianceQuery(query) {
  try {
    // Load compliance data
    const complianceData = await loadComplianceData();
    
    // Create a prompt with the compliance data context
    const prompt = createCompliancePrompt(query, complianceData);
    
    // Call LLM to process the query
    const llmResponse = await callLLM(prompt);
    
    // Process and format the LLM response
    const formattedResponse = formatLLMResponse(llmResponse);
    
    return {
      query,
      response: formattedResponse,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Error in processComplianceQuery: ${error.message}`);
    throw new Error(`Failed to process compliance query: ${error.message}`);
  }
}

/**
 * Create a prompt for the LLM with compliance data context
 * 
 * @param {string} query - The user's query
 * @param {Array} complianceData - Array of compliance regulations
 * @returns {string} Formatted prompt for the LLM
 */
function createCompliancePrompt(query, complianceData) {
  // Create a condensed context from the compliance data
  const context = complianceData
    .map(item => {
      return `ID: ${item.id}
Title: ${item.title}
Statute: ${item.statute || 'N/A'}
Regulation: ${item.regulation || 'N/A'}
Summary: ${item.summary || 'N/A'}
Reporting Requirements: ${item.reportingRequirements || 'N/A'}
Deadline: ${item.deadline || 'N/A'}
`;
    })
    .join('\n---\n');

  // Create the final prompt
  return `
You are an expert compliance assistant for educational institutions. 
Use the following compliance regulations data to answer the query:

COMPLIANCE DATA:
${context}

USER QUERY: ${query}

Please provide a detailed and accurate response focusing only on the relevant regulations.
Include all relevant deadlines, reporting requirements, and implementation steps.
If the information isn't available in the provided data, clearly state that.
`;
}

/**
 * Format the LLM response for the client
 * 
 * @param {string} llmResponse - Raw response from the LLM
 * @returns {object} Formatted response object
 */
function formatLLMResponse(llmResponse) {
  // Basic formatting and cleaning of the response
  const cleanedResponse = llmResponse.trim();
  
  // Extract relevant sections if needed
  // For now, return the full response
  return {
    fullResponse: cleanedResponse,
    relevantRegulations: extractRegulationReferences(cleanedResponse)
  };
}

/**
 * Extract regulation references from the LLM response
 * 
 * @param {string} response - LLM response text
 * @returns {Array} Array of regulation IDs mentioned in the response
 */
function extractRegulationReferences(response) {
  // This is a simplified version - in a real implementation,
  // you would use more robust pattern matching or NLP techniques
  const regulationPattern = /ID:\s*([A-Z0-9-]+)/g;
  const matches = [...response.matchAll(regulationPattern)];
  
  return matches.map(match => match[1]);
} 