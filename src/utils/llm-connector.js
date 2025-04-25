import dotenv from 'dotenv';
import { setupLogger } from './logger.js';

// Initialize environment variables
dotenv.config();

const logger = setupLogger('llm-connector');

// Check if we should use a mock implementation
const USE_MOCK = !process.env.OPENAI_API_KEY || process.env.USE_MOCK_LLM === 'true';

// Optional: Initialize OpenAI client if API key is available
let openai;
if (!USE_MOCK) {
  try {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    logger.warn('OpenAI package not available or API key not set, using mock implementation');
  }
}

// Default LLM model to use
const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-4-turbo-preview';

/**
 * Call the LLM with the given prompt
 * 
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Additional options
 * @returns {Promise<string>} The LLM response text
 */
export async function callLLM(prompt, options = {}) {
  try {
    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 2048;
    const temperature = options.temperature || 0.3;
    
    logger.info(`Calling LLM with model: ${model}, prompt length: ${prompt.length}`);
    
    const startTime = Date.now();
    
    let response;
    
    if (USE_MOCK) {
      // Mock implementation
      logger.info('Using mock LLM implementation');
      response = generateMockResponse(prompt);
      // Add artificial delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      // Real OpenAI call
      response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature
      });
      
      response = response.choices[0].message.content;
    }
    
    const endTime = Date.now();
    logger.info(`LLM response received in ${endTime - startTime}ms`);
    
    // Return the response text
    return response;
  } catch (error) {
    logger.error(`Error calling LLM: ${error.message}`);
    throw new Error(`Failed to get LLM response: ${error.message}`);
  }
}

/**
 * Call the LLM with a structured system and user message
 * 
 * @param {Object} options - Message options
 * @param {string} options.systemMessage - System message
 * @param {string} options.userMessage - User message
 * @param {string} options.model - LLM model to use
 * @returns {Promise<string>} The LLM response text
 */
export async function callLLMWithStructuredPrompt({ systemMessage, userMessage, model }) {
  try {
    logger.info(`Calling LLM with structured prompt`);
    
    const startTime = Date.now();
    
    let response;
    
    if (USE_MOCK) {
      // Mock implementation
      logger.info('Using mock LLM implementation');
      response = generateMockResponse(`${systemMessage}\n\n${userMessage}`);
      // Add artificial delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      // Real OpenAI call
      response = await openai.chat.completions.create({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2048,
        temperature: 0.3
      });
      
      response = response.choices[0].message.content;
    }
    
    const endTime = Date.now();
    logger.info(`LLM response received in ${endTime - startTime}ms`);
    
    // Return the response text
    return response;
  } catch (error) {
    logger.error(`Error calling LLM: ${error.message}`);
    throw new Error(`Failed to get LLM response: ${error.message}`);
  }
}

/**
 * Generate a mock response based on the prompt
 * 
 * @param {string} prompt - The input prompt
 * @returns {string} A mock response
 */
function generateMockResponse(prompt) {
  // Check if this is a compliance query
  if (prompt.includes('COMPLIANCE DATA:') && prompt.includes('USER QUERY:')) {
    return `Based on the compliance data provided, here's my analysis:

For educational institutions, there are several relevant regulations to consider:

1. Title IX requirements mandate that schools must have a designated coordinator and publish non-discrimination policies. The reporting deadline is typically annual, with documentation submitted by August 14th.

2. FERPA regulations require that educational institutions provide annual notification to students about their rights regarding educational records. There is no specific filing deadline, but the notification must be provided annually at the beginning of each school year.

3. Clery Act compliance requires annual security reports to be published by October 1st each year, including crime statistics for the previous three calendar years.

To ensure compliance, your institution should:
- Maintain thorough documentation of all policies
- Conduct regular training for staff
- Implement clear procedures for handling violations
- Schedule periodic internal audits

For more specific guidance, please consult with your institution's legal counsel or compliance officer.`;
  }
  
  // Default mock response for other queries
  return `I've processed your request and can provide the following information:

The regulations you're asking about require careful consideration of several factors including deadlines, reporting requirements, and implementation strategies. Based on standard compliance practices, you should ensure all documentation is properly maintained and regularly reviewed.

For more specific guidance, please provide additional details about your particular situation or consult with a compliance specialist who can give tailored advice.`;
} 