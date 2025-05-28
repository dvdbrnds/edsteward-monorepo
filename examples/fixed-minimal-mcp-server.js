/**
 * Simplified MCP Server Implementation
 * A JSON-RPC based server for regulatory source processing
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Try to import LLM processing functions
let llmProcessing;
try {
  llmProcessing = require('./src/regulatory-sources/llm-processing');
} catch (error) {
  // Mock LLM processing if module not available
  console.log('Using mock LLM processing functions');
  llmProcessing = {
    extractRequirements: async (text) => ({
      requirements: [
        {
          subject: "Financial institutions",
          obligation: "Maintain transaction records",
          duration: "7 years",
          conditions: "For all transactions",
          penalties: "Up to $10,000 per violation"
        }
      ]
    }),
    summarizeRegulation: async (text) => ({
      title: "Record-Keeping Requirements",
      purpose: "To establish guidelines for maintaining transaction records",
      effective_date: "2023-07-01",
      key_requirements: [
        "Maintain records for 7 years",
        "Include transaction details",
        "Make records available for inspection"
      ]
    }),
    detectRegulationChanges: async (oldText, newText) => ({
      significant_changes: true,
      changes: [
        {
          type: "Addition",
          description: "Added requirement for electronic backup",
          impact: "Medium"
        }
      ]
    }),
    classifyRegulation: async (text) => ({
      topic: "Record keeping",
      industry: "Financial services",
      risk_level: "Medium",
      complexity: "Low"
    })
  };
}

// Create Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mock database for regulations
const regulationsDB = {
  '2021-14671': {
    document_number: '2021-14671',
    title: 'COVID-19 Workplace Safety: Emergency Temporary Standard',
    agency: 'Occupational Safety and Health Administration',
    publication_date: '2021-06-21'
  },
  '2013-01503': {
    document_number: '2013-01503',
    title: 'Ability-to-Repay and Qualified Mortgage Standards Under the Truth in Lending Act',
    agency: 'CFPB',
    publication_date: '2013-01-30'
  }
};

// MCP JSON-RPC endpoint
app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  
  console.log(`Received MCP request: ${method}`);
  
  // Validate request format
  if (jsonrpc !== '2.0' || !id || !method) {
    return res.json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600,
        message: 'Invalid Request'
      }
    });
  }
  
  try {
    let result;
    
    // Handle method calls
    switch (method) {
      case 'initialize':
        // Initialize the connection
        result = {
          version: '1.0.0',
          capabilities: {
            tools: ['fetchRegulation', 'extractRequirements', 'summarizeRegulation']
          }
        };
        break;
        
      case 'fetchRegulation':
        // Fetch a regulation by document number
        const { documentNumber } = params;
        const regulation = regulationsDB[documentNumber];
        
        if (!regulation) {
          throw {
            code: -31000,
            message: `Regulation with document number ${documentNumber} not found`
          };
        }
        
        result = regulation;
        break;
        
      case 'extractRequirements':
        // Extract requirements from regulation text
        const { text: reqText } = params;
        if (!reqText) {
          throw {
            code: -32602,
            message: 'Missing required parameter: text'
          };
        }
        
        result = await llmProcessing.extractRequirements(reqText);
        break;
        
      case 'summarizeRegulation':
        // Summarize regulation text
        const { text: sumText } = params;
        if (!sumText) {
          throw {
            code: -32602,
            message: 'Missing required parameter: text'
          };
        }
        
        result = await llmProcessing.summarizeRegulation(sumText);
        break;
        
      case 'detectRegulationChanges':
        // Detect changes between regulation versions
        const { oldText, newText } = params;
        if (!oldText || !newText) {
          throw {
            code: -32602,
            message: 'Missing required parameters: oldText and newText'
          };
        }
        
        result = await llmProcessing.detectRegulationChanges(oldText, newText);
        break;
        
      case 'classifyRegulation':
        // Classify regulation
        const { text: classText } = params;
        if (!classText) {
          throw {
            code: -32602,
            message: 'Missing required parameter: text'
          };
        }
        
        result = await llmProcessing.classifyRegulation(classText);
        break;
        
      default:
        // Method not found
        throw {
          code: -32601,
          message: `Method not found: ${method}`
        };
    }
    
    // Send successful response
    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
    
  } catch (error) {
    console.error(`Error processing MCP request ${method}:`, error);
    
    // Format error response
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data
      }
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP JSON-RPC endpoint available at http://localhost:${PORT}/mcp`);
});