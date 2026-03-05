/**
 * Minimal MCP-compatible server that demonstrates the core requirements
 * for serving MCP requests locally
 */

const express = require('express');
const cors = require('cors');
const { callLLM } = require('./src/regulatory-sources/llm-processing');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock regulation database
const regulationsDB = {
  '2021-14671': {
    title: 'COVID-19 Workplace Safety: Emergency Temporary Standard',
    agency: 'Occupational Safety and Health Administration',
    publication_date: '2021-06-21',
    document_number: '2021-14671',
    html_url: 'https://www.federalregister.gov/documents/2021/06/21/2021-14671/covid-19-workplace-safety-emergency-temporary-standard'
  }
};

// MCP Endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { name, parameters } = req.body;
    console.log(`Received MCP request for function: ${name}`);
    
    // Function router
    switch (name) {
      case 'initialize':
        return res.json({ success: true, message: 'MCP connection established' });
        
      case 'fetchRegulation':
        return handleFetchRegulation(parameters, res);
        
      case 'extractRequirements':
      case 'summarizeRegulation':
      case 'detectRegulationChanges':
      case 'classifyRegulation':
        return handleLLMProcessing(name, parameters, res);
        
      default:
        return res.status(400).json({ 
          error: 'Unknown function', 
          message: `Function '${name}' is not supported` 
        });
    }
  } catch (error) {
    console.error('Error processing MCP request:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: error.message || 'An unexpected error occurred' 
    });
  }
});

// Handler for fetching regulations
function handleFetchRegulation(parameters, res) {
  const { document_number } = parameters;
  
  if (!document_number) {
    return res.status(400).json({ 
      error: 'Missing parameter', 
      message: 'document_number is required' 
    });
  }
  
  const regulation = regulationsDB[document_number];
  
  if (!regulation) {
    return res.status(404).json({ 
      error: 'Not found', 
      message: `Regulation with document number '${document_number}' not found` 
    });
  }
  
  return res.json(regulation);
}

// Handler for LLM-based processing functions
async function handleLLMProcessing(functionName, parameters, res) {
  try {
    let prompt;
    
    switch (functionName) {
      case 'extractRequirements':
        if (!parameters.text) {
          return res.status(400).json({ error: 'Missing parameter', message: 'text is required' });
        }
        prompt = `Extract the compliance requirements from the following regulation text. For each requirement, identify the subject, obligation, conditions, and penalties if specified:

Text: ${parameters.text}

Format your response as a JSON object with this structure:
{
  "requirements": [
    {
      "subject": "Who must comply",
      "obligation": "What must be done",
      "conditions": "Under what circumstances",
      "penalties": "Consequences for non-compliance"
    }
  ]
}`;
        break;
        
      case 'summarizeRegulation':
        if (!parameters.text) {
          return res.status(400).json({ error: 'Missing parameter', message: 'text is required' });
        }
        prompt = `Provide a comprehensive summary of the following regulation. Include the title, purpose, effective date, key requirements, and affected parties:

Text: ${parameters.text}

Format your response as a JSON object with this structure:
{
  "title": "Title of the regulation",
  "purpose": "Main purpose of the regulation",
  "effective_date": "When the regulation takes effect",
  "key_requirements": ["Requirement 1", "Requirement 2"],
  "affected_parties": ["Party 1", "Party 2"]
}`;
        break;
        
      case 'detectRegulationChanges':
        if (!parameters.old_text || !parameters.new_text) {
          return res.status(400).json({ 
            error: 'Missing parameters', 
            message: 'Both old_text and new_text are required' 
          });
        }
        prompt = `Compare these two versions of regulatory text and identify significant changes that would impact compliance:

OLD VERSION:
${parameters.old_text}

NEW VERSION:
${parameters.new_text}

Format your response as a JSON object with this structure:
{
  "changes": [
    {
      "type": "addition|modification|removal",
      "description": "Description of the change",
      "impact": "How this affects compliance",
      "severity": "high|medium|low"
    }
  ]
}`;
        break;
        
      case 'classifyRegulation':
        if (!parameters.text) {
          return res.status(400).json({ error: 'Missing parameter', message: 'text is required' });
        }
        prompt = `Classify the following regulation by topic, industry, risk level, and implementation complexity:

Text: ${parameters.text}

Format your response as a JSON object with this structure:
{
  "topic": "Financial|Healthcare|Environmental|Consumer Protection|Other",
  "industry": "Banking|Insurance|Healthcare|Manufacturing|Retail|Other",
  "risk_level": "High|Medium|Low",
  "implementation_complexity": "High|Medium|Low",
  "justification": "Brief explanation of the classification"
}`;
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Unsupported function', 
          message: `Function '${functionName}' implementation is missing` 
        });
    }
    
    // Call LLM with prepared prompt
    const llmResponse = await callLLM(prompt);
    
    // Extract JSON from the response
    try {
      // First try to parse the entire response as JSON
      const result = JSON.parse(llmResponse);
      return res.json(result);
    } catch (e) {
      // If that fails, try to extract JSON from the text
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          return res.json(result);
        } catch (e2) {
          // If JSON extraction fails, return the raw text
          return res.json({ raw_response: llmResponse });
        }
      } else {
        // No JSON found, return raw text
        return res.json({ raw_response: llmResponse });
      }
    }
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return res.status(500).json({ 
      error: 'Processing error', 
      message: error.message || 'Failed to process the request' 
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint available at http://localhost:${PORT}/mcp`);
});

// Export for testing
module.exports = app;