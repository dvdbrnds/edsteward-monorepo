/**
 * LLM Processing for Regulatory Data
 * 
 * This module provides functions for using LLMs to extract, analyze,
 * and process regulatory data from various sources.
 */

const axios = require('axios');

// Configuration for LLM API calls
const LLM_CONFIG = {
  apiEndpoint: process.env.LLM_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
  apiKey: process.env.LLM_API_KEY,
  defaultModel: process.env.LLM_DEFAULT_MODEL || 'gpt-4o',
  defaultTemperature: 0.1, // Low temperature for more deterministic responses
  requestTimeout: 60000, // 60 seconds
};

/**
 * Call the LLM API with a structured prompt
 * 
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Additional options for the API call
 * @returns {Promise<string>} - The LLM response
 */
async function callLLM(prompt, options = {}) {
  const {
    temperature = LLM_CONFIG.defaultTemperature,
    model = LLM_CONFIG.defaultModel,
    responseFormat = null,
  } = options;

  if (!LLM_CONFIG.apiKey) {
    throw new Error('LLM API key not configured. Set LLM_API_KEY environment variable.');
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a regulatory compliance expert assistant specialized in analyzing, structuring, and extracting information from regulatory documents. Always provide output in the exact format requested.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const requestBody = {
      model,
      messages,
      temperature,
    };

    // Add response format if specified
    if (responseFormat) {
      requestBody.response_format = responseFormat;
    }

    const response = await axios.post(
      LLM_CONFIG.apiEndpoint,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: LLM_CONFIG.requestTimeout
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('LLM API call failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`LLM API call failed: ${error.message}`);
  }
}

/**
 * Extract structured requirements from regulation text
 * 
 * @param {string} regulationText - The text of the regulation
 * @param {Object} options - LLM API options
 * @returns {Promise<Array>} - Array of structured requirements
 */
async function extractRequirements(regulationText, options = {}) {
  // Set response format to JSON to ensure structured output
  options.responseFormat = { type: 'json_object' };
  
  const prompt = `
Analyze the following regulation text and extract all compliance requirements as structured data.
For each requirement:
1. Identify who needs to comply (the subject)
2. What action is required (the obligation)
3. Any conditions or timeframes
4. Any exceptions
5. Any penalties for non-compliance
6. The section or paragraph number where this requirement appears

Format your response as a JSON array of objects, where each object has these fields:
- "id": A unique identifier for this requirement (string)
- "subject": Who needs to comply (string)
- "obligation": The specific action required (string)
- "conditions": Any conditions that trigger or modify this requirement (string or null)
- "deadline": Any timeframe or deadline for compliance (string or null)
- "exceptions": Any exceptions to this requirement (string or null)
- "penalties": Any penalties for non-compliance (string or null)
- "section": The section or paragraph number in the document (string or null)
- "criticality": Rate the importance of this requirement (high, medium, low)

Regulation Text:
${regulationText.substring(0, 8000)} ${regulationText.length > 8000 ? '[text truncated due to length]' : ''}
`;

  try {
    const response = await callLLM(prompt, options);
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(response);
      
      // Ensure the response has the expected structure
      if (!Array.isArray(parsedResponse.requirements)) {
        // Try to extract from the overall response if not properly structured
        if (Array.isArray(parsedResponse)) {
          return parsedResponse;
        }
        
        // Look for any array field that might contain the requirements
        for (const key in parsedResponse) {
          if (Array.isArray(parsedResponse[key])) {
            return parsedResponse[key];
          }
        }
        
        throw new Error('Response does not contain an array of requirements');
      }
      
      return parsedResponse.requirements;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError.message);
      console.error('Raw response:', response);
      throw new Error('Failed to parse LLM response as structured data');
    }
  } catch (error) {
    console.error('Failed to extract requirements:', error.message);
    throw error;
  }
}

/**
 * Generate a structured summary of a regulation
 * 
 * @param {string} regulationText - The text of the regulation
 * @param {Object} options - LLM API options
 * @returns {Promise<Object>} - Structured summary
 */
async function summarizeRegulation(regulationText, options = {}) {
  // Set response format to JSON to ensure structured output
  options.responseFormat = { type: 'json_object' };
  
  const prompt = `
Analyze the following regulation and create a comprehensive, structured summary.
Your summary should be in JSON format with the following fields:
- "title": A concise title for this regulation
- "purpose": The main purpose and goals of this regulation (1-2 sentences)
- "effective_date": When this regulation takes effect (if specified)
- "target_audience": The primary stakeholders affected by this regulation
- "key_requirements": Array of the most important requirements (limit to 5-7 items)
- "obligations": Key obligations for regulated entities
- "deadlines": Any important deadlines or dates
- "penalties": Potential penalties for non-compliance
- "exceptions": Any notable exceptions or exclusions
- "implementation_complexity": Rate as "high", "medium", or "low" with brief reasoning
- "keywords": Array of 5-10 relevant keywords or phrases

Focus on extracting the most significant information that would be relevant for compliance officers.

Regulation Text:
${regulationText.substring(0, 8000)} ${regulationText.length > 8000 ? '[text truncated due to length]' : ''}
`;

  try {
    const response = await callLLM(prompt, options);
    
    try {
      const parsedResponse = JSON.parse(response);
      return parsedResponse;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError.message);
      console.error('Raw response:', response);
      throw new Error('Failed to parse LLM response as structured data');
    }
  } catch (error) {
    console.error('Failed to summarize regulation:', error.message);
    throw error;
  }
}

/**
 * Compare two versions of regulatory text to identify significant changes
 * 
 * @param {string} oldText - Previous version of the regulation
 * @param {string} newText - New version of the regulation
 * @param {Object} options - LLM API options
 * @returns {Promise<Object>} - Structured analysis of changes
 */
async function detectRegulationChanges(oldText, newText, options = {}) {
  // Set response format to JSON to ensure structured output
  options.responseFormat = { type: 'json_object' };
  
  // Truncate texts if they are too long
  const maxLength = 6000; // Limit to allow room for prompt instructions
  const truncatedOldText = oldText.length > maxLength 
    ? oldText.substring(0, maxLength) + ' [text truncated]' 
    : oldText;
  
  const truncatedNewText = newText.length > maxLength
    ? newText.substring(0, maxLength) + ' [text truncated]'
    : newText;
  
  const prompt = `
As a regulatory analysis expert, compare these two versions of a regulation and identify significant changes.
Focus on substantive changes that impact compliance requirements, not minor wording or formatting differences.

For each significant change:
1. Identify the specific section or paragraph where the change occurs
2. Describe what changed (added, removed, or modified)
3. Analyze the compliance impact of this change
4. Rate the significance of the change (high, medium, low)
5. Identify any new deadlines or requirements introduced

Format your response as a JSON object with these fields:
- "summary": Brief summary of overall changes (1-3 sentences)
- "significant_changes": Array of change objects with:
  - "section": The section where the change occurred
  - "change_type": "addition", "removal", "modification"
  - "description": Description of what changed
  - "compliance_impact": Analysis of how this affects compliance
  - "significance": "high", "medium", or "low"
  - "deadlines": Any new deadlines (or null)
- "new_requirements": Array of any completely new requirements
- "removed_requirements": Array of any requirements that were removed
- "overall_impact": Assessment of the overall compliance impact (high, medium, low)

Previous version:
${truncatedOldText}

New version:
${truncatedNewText}
`;

  try {
    const response = await callLLM(prompt, options);
    
    try {
      const parsedResponse = JSON.parse(response);
      return parsedResponse;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError.message);
      console.error('Raw response:', response);
      throw new Error('Failed to parse LLM response as structured data');
    }
  } catch (error) {
    console.error('Failed to detect regulation changes:', error.message);
    throw error;
  }
}

/**
 * Classify a regulation by topic, industry, risk level, and implementation complexity
 * 
 * @param {string} regulationText - The text of the regulation
 * @param {Object} options - LLM API options
 * @returns {Promise<Object>} - Classification results
 */
async function classifyRegulation(regulationText, options = {}) {
  // Set response format to JSON to ensure structured output
  options.responseFormat = { type: 'json_object' };
  
  const prompt = `
Analyze this regulation text and classify it according to several dimensions.
Provide a structured analysis with the following classifications:

1. Topic categories (select all that apply):
   - Financial reporting
   - Data privacy
   - Consumer protection
   - Environmental protection
   - Health and safety
   - Labor and employment
   - Cybersecurity
   - Anti-money laundering
   - Corporate governance
   - Other (specify)

2. Primary industries affected (select all that apply):
   - Banking and financial services
   - Healthcare
   - Education
   - Technology
   - Manufacturing
   - Retail
   - Energy
   - Transportation
   - Other (specify)

3. Risk assessment:
   - Non-compliance risk level (high, medium, low)
   - Potential financial impact (high, medium, low)
   - Reputational risk (high, medium, low)
   - Operational risk (high, medium, low)

4. Implementation assessment:
   - Implementation complexity (high, medium, low)
   - Resource requirements (high, medium, low)
   - Technology requirements (high, medium, low)
   - Timeline for implementation (short, medium, long term)

Format your response as a JSON object with these classifications and include a brief justification for each assessment.

Regulation Text:
${regulationText.substring(0, 8000)} ${regulationText.length > 8000 ? '[text truncated due to length]' : ''}
`;

  try {
    const response = await callLLM(prompt, options);
    
    try {
      const parsedResponse = JSON.parse(response);
      return parsedResponse;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError.message);
      console.error('Raw response:', response);
      throw new Error('Failed to parse LLM response as structured data');
    }
  } catch (error) {
    console.error('Failed to classify regulation:', error.message);
    throw error;
  }
}

module.exports = {
  extractRequirements,
  summarizeRegulation,
  detectRegulationChanges,
  classifyRegulation,
  callLLM
}; 