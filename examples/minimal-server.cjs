// Minimal MCP Server implementation using Express
// Uses CommonJS format to avoid module issues

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Mock LLM processing functions
const extractRequirements = (text) => {
  console.log(`Extracting requirements from text (${text.length} chars)`);
  return [
    { id: "REQ-1", subject: "Schools", obligation: "Must provide equal access", criticality: "high" },
    { id: "REQ-2", subject: "Teachers", obligation: "Must be certified", criticality: "high" }
  ];
};

const summarizeRegulation = (text) => {
  console.log(`Summarizing regulation text (${text.length} chars)`);
  return {
    title: "Education Compliance Regulation",
    purpose: "To ensure educational institutions meet compliance standards",
    key_requirements: ["Equal access", "Certification requirements"]
  };
};

// Mock regulations database
const regulations = {
  "ED-2023-001": {
    documentNumber: "ED-2023-001",
    title: "Educational Compliance Standard A",
    full_text: "This is the full text of regulation ED-2023-001 about educational compliance standards.",
    agency: "Department of Education",
    publicationDate: "2023-04-15",
    effectiveDate: "2023-07-01"
  },
  "ED-2023-002": {
    documentNumber: "ED-2023-002",
    title: "Educational Compliance Standard B",
    full_text: "This is the full text of regulation ED-2023-002 covering additional educational requirements.",
    agency: "Department of Education",
    publicationDate: "2023-06-10",
    effectiveDate: "2023-09-01"
  }
};

// MCP endpoint using JSON-RPC 2.0
app.post('/mcp', (req, res) => {
  const request = req.body;
  console.log('Received MCP request:', JSON.stringify(request, null, 2));

  // Validate JSON-RPC 2.0 request
  if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request'
      },
      id: request.id || null
    });
  }

  // Process based on method
  try {
    let result;

    switch (request.method) {
      case 'fetchRegulation':
        const documentNumber = request.params?.documentNumber;
        if (!documentNumber) {
          throw { code: -32602, message: 'Invalid params: missing documentNumber' };
        }
        
        const regulation = regulations[documentNumber];
        if (!regulation) {
          throw { code: -31000, message: `Regulation not found: ${documentNumber}` };
        }
        
        result = { success: true, regulation };
        break;

      case 'extractRequirements':
        const textToAnalyze = request.params?.regulationText || 
                            (request.params?.documentNumber ? 
                              regulations[request.params.documentNumber]?.full_text : null);
        
        if (!textToAnalyze) {
          throw { code: -32602, message: 'Invalid params: missing text or valid documentNumber' };
        }
        
        const requirements = extractRequirements(textToAnalyze);
        result = { 
          success: true, 
          requirements,
          documentNumber: request.params.documentNumber
        };
        break;

      case 'summarizeRegulation':
        const textToSummarize = request.params?.regulationText || 
                             (request.params?.documentNumber ? 
                               regulations[request.params.documentNumber]?.full_text : null);
                               
        if (!textToSummarize) {
          throw { code: -32602, message: 'Invalid params: missing text or valid documentNumber' };
        }
        
        const summary = summarizeRegulation(textToSummarize);
        result = { 
          success: true, 
          summary,
          documentNumber: request.params.documentNumber
        };
        break;

      default:
        throw { code: -32601, message: `Method not found: ${request.method}` };
    }

    return res.json({
      jsonrpc: '2.0',
      result,
      id: request.id
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error'
      },
      id: request.id
    });
  }
});

// Server initialization route
app.post('/mcp/initialize', (req, res) => {
  // Return capabilities
  res.json({
    jsonrpc: '2.0',
    result: {
      capabilities: {
        tools: [
          {
            name: 'fetchRegulation',
            description: 'Fetch a regulation by document number',
            parameters: {
              type: 'object',
              properties: {
                documentNumber: {
                  type: 'string',
                  description: 'Document number to fetch'
                }
              },
              required: ['documentNumber']
            }
          },
          {
            name: 'extractRequirements',
            description: 'Extract requirements from regulation text',
            parameters: {
              type: 'object',
              properties: {
                regulationText: {
                  type: 'string',
                  description: 'Regulation text to analyze'
                },
                documentNumber: {
                  type: 'string',
                  description: 'Document number to analyze'
                }
              },
              oneOf: [
                { required: ['regulationText'] },
                { required: ['documentNumber'] }
              ]
            }
          },
          {
            name: 'summarizeRegulation',
            description: 'Summarize a regulation',
            parameters: {
              type: 'object',
              properties: {
                regulationText: {
                  type: 'string',
                  description: 'Regulation text to summarize'
                },
                documentNumber: {
                  type: 'string',
                  description: 'Document number to summarize'
                }
              },
              oneOf: [
                { required: ['regulationText'] },
                { required: ['documentNumber'] }
              ]
            }
          }
        ]
      },
      serverInfo: {
        name: 'minimal-regulatory-server',
        version: '1.0.0'
      }
    },
    id: req.body.id
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Server running at http://localhost:${PORT}/mcp`);
});