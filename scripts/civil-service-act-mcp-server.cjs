/**
 * Civil Service Reform Act of 1978 MCP Server
 * A JSON-RPC based server for collecting and processing information 
 * about the Civil Service Reform Act of 1978
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Function to create an Express app
function createMcpApp() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock database with Civil Service Reform Act information
  const civilServiceActInfo = {
    id: 'civil-service-reform-act-1978',
    title: 'Civil Service Reform Act of 1978',
    enacted: 'October 13, 1978',
    public_law: '95-454',
    description: 'A comprehensive legislative reform of the federal civil service system that replaced the Civil Service Commission with the Office of Personnel Management, the Merit Systems Protection Board, and the Federal Labor Relations Authority.',
    key_provisions: [
      {
        title: 'Merit System Principles',
        description: 'Established nine merit system principles that federal personnel management should be based on.'
      },
      {
        title: 'Senior Executive Service',
        description: 'Created the Senior Executive Service (SES) for top-level management positions.'
      },
      {
        title: 'Performance Management',
        description: 'Introduced a performance appraisal system linking employee performance to organizational goals.'
      },
      {
        title: 'Federal Labor Relations',
        description: 'Provided a statutory basis for labor relations in the federal government.'
      },
      {
        title: 'Whistleblower Protection',
        description: 'Included provisions to protect federal employees who disclose government waste, fraud, and abuse.'
      }
    ],
    agencies_created: [
      {
        name: 'Office of Personnel Management (OPM)',
        role: 'Manages the federal civilian workforce, administers benefits, and provides human resources leadership.'
      },
      {
        name: 'Merit Systems Protection Board (MSPB)',
        role: 'Protects federal merit systems against prohibited personnel practices and adjudicates employee appeals.'
      },
      {
        name: 'Federal Labor Relations Authority (FLRA)',
        role: 'Promotes stable labor-management relations and resolves disputes under the Federal Service Labor-Management Relations Statute.'
      }
    ],
    full_text_url: 'https://www.govinfo.gov/content/pkg/STATUTE-92/pdf/STATUTE-92-Pg1111.pdf'
  };

  // LLM processing functions for the Civil Service Reform Act
  const csraProcessing = {
    extractRequirements: async (text) => ({
      requirements: [
        {
          subject: "Federal agencies",
          obligation: "Implement merit system principles",
          duration: "Permanent",
          conditions: "For all personnel actions",
          statutory_reference: "5 U.S.C. § 2301"
        },
        {
          subject: "Federal agencies",
          obligation: "Prohibit certain personnel practices",
          duration: "Permanent",
          conditions: "For all personnel actions",
          statutory_reference: "5 U.S.C. § 2302"
        },
        {
          subject: "Federal agencies",
          obligation: "Establish performance appraisal systems",
          duration: "Permanent",
          conditions: "For all employees",
          statutory_reference: "5 U.S.C. § 4302"
        }
      ]
    }),
    
    summarizeRegulation: async (text) => ({
      title: "Civil Service Reform Act of 1978",
      purpose: "To reform the civil service system to improve government efficiency and ensure merit principles",
      effective_date: "1978-10-13",
      key_requirements: [
        "Establish merit system principles",
        "Create Senior Executive Service",
        "Implement performance-based management",
        "Codify labor-management relations",
        "Protect whistleblowers"
      ]
    }),
    
    detectRegulationChanges: async (oldText, newText) => ({
      significant_changes: false,
      changes: [
        {
          type: "Amendment",
          description: "Various amendments have been made since 1978, particularly to whistleblower protections",
          impact: "Medium"
        }
      ]
    }),
    
    classifyRegulation: async (text) => ({
      topic: "Civil service management",
      sector: "Government",
      impact_areas: ["Personnel management", "Labor relations", "Merit systems"],
      risk_level: "Medium",
      complexity: "High"
    }),
    
    getRelatedCases: async () => ({
      cases: [
        {
          name: "United States v. Fausto",
          citation: "484 U.S. 439 (1988)",
          significance: "Supreme Court case interpreting the Civil Service Reform Act's provisions regarding judicial review"
        },
        {
          name: "NASA v. Nelson",
          citation: "562 U.S. 134 (2011)",
          significance: "Supreme Court case involving background checks of federal contractors under civil service laws"
        }
      ]
    })
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
              tools: [
                'getActInfo', 
                'getKeyProvisions', 
                'getAgenciesCreated', 
                'extractRequirements', 
                'summarizeRegulation',
                'classifyRegulation',
                'detectRegulationChanges',
                'getRelatedCases',
                'getFullText'
              ]
            }
          };
          break;
          
        case 'getActInfo':
          // Return basic information about the Civil Service Reform Act
          result = {
            id: civilServiceActInfo.id,
            title: civilServiceActInfo.title,
            enacted: civilServiceActInfo.enacted,
            public_law: civilServiceActInfo.public_law,
            description: civilServiceActInfo.description
          };
          break;
          
        case 'getKeyProvisions':
          // Return key provisions of the Act
          result = {
            provisions: civilServiceActInfo.key_provisions
          };
          break;
          
        case 'getAgenciesCreated':
          // Return agencies created by the Act
          result = {
            agencies: civilServiceActInfo.agencies_created
          };
          break;
          
        case 'extractRequirements':
          // Extract requirements from regulation text
          const { text: reqText } = params || {};
          if (!reqText) {
            throw {
              code: -32602,
              message: 'Missing required parameter: text'
            };
          }
          
          result = await csraProcessing.extractRequirements(reqText);
          break;
          
        case 'summarizeRegulation':
          // Summarize regulation text
          const { text: sumText } = params || {};
          if (!sumText) {
            throw {
              code: -32602,
              message: 'Missing required parameter: text'
            };
          }
          
          result = await csraProcessing.summarizeRegulation(sumText);
          break;
          
        case 'detectRegulationChanges':
          // Detect changes between regulation versions
          const { oldText, newText } = params || {};
          if (!oldText || !newText) {
            throw {
              code: -32602,
              message: 'Missing required parameters: oldText and newText'
            };
          }
          
          result = await csraProcessing.detectRegulationChanges(oldText, newText);
          break;
          
        case 'classifyRegulation':
          // Classify regulation
          const { text: classText } = params || {};
          if (!classText) {
            throw {
              code: -32602,
              message: 'Missing required parameter: text'
            };
          }
          
          result = await csraProcessing.classifyRegulation(classText);
          break;
          
        case 'getRelatedCases':
          // Get related legal cases
          result = await csraProcessing.getRelatedCases();
          break;
          
        case 'getFullText':
          // Return URL to full text
          result = {
            url: civilServiceActInfo.full_text_url,
            message: "Full text available at the provided URL"
          };
          break;
        
        case 'shutdown':
          // Handle shutdown request
          result = { message: "Shutting down server" };
          
          // Set a timeout to shut down the server after responding
          setTimeout(() => {
            console.log("Shutting down MCP server due to shutdown request");
            if (serverInstance) {
              serverInstance.close();
            }
          }, 100);
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
    res.json({ 
      status: 'ok', 
      version: '1.0.0',
      name: 'Civil Service Reform Act MCP Server',
      ephemeral: true
    });
  });

  // API documentation endpoint
  app.get('/api-docs', (req, res) => {
    res.json({
      server_name: 'Civil Service Reform Act MCP Server',
      version: '1.0.0',
      description: 'MCP server for collecting and processing information about the Civil Service Reform Act of 1978',
      methods: [
        {
          name: 'getActInfo',
          description: 'Get basic information about the Act'
        },
        {
          name: 'getKeyProvisions',
          description: 'Get key provisions of the Act'
        },
        {
          name: 'getAgenciesCreated',
          description: 'Get agencies created by the Act'
        },
        {
          name: 'extractRequirements',
          description: 'Extract requirements from regulation text',
          params: ['text']
        },
        {
          name: 'summarizeRegulation',
          description: 'Get a summary of the regulation',
          params: ['text']
        },
        {
          name: 'classifyRegulation',
          description: 'Classify the regulation by topic and impact',
          params: ['text']
        },
        {
          name: 'detectRegulationChanges',
          description: 'Detect changes between versions of the regulation',
          params: ['oldText', 'newText']
        },
        {
          name: 'getRelatedCases',
          description: 'Get related legal cases'
        },
        {
          name: 'getFullText',
          description: 'Get URL to full text of the Act'
        }
      ]
    });
  });

  return app;
}

// Variable to store the server instance
let serverInstance = null;

// Function to start a new MCP server with an ephemeral port
function startMcpServer() {
  const app = createMcpApp();
  
  // Create the server using ephemeral port (port 0 lets the OS assign a port)
  serverInstance = http.createServer(app);
  
  return new Promise((resolve, reject) => {
    serverInstance.listen(0, () => {
      const port = serverInstance.address().port;
      console.log(`Civil Service Reform Act MCP Server running on ephemeral port ${port}`);
      console.log(`MCP JSON-RPC endpoint available at http://localhost:${port}/mcp`);
      
      // Write port to a temporary file for client discovery
      const portFile = path.join(__dirname, 'mcp-server-port.json');
      fs.writeFileSync(portFile, JSON.stringify({ port, serverType: 'csra-mcp', timestamp: Date.now() }));
      
      resolve({ server: serverInstance, port });
    });
    
    serverInstance.on('error', (error) => {
      console.error('Failed to start MCP server:', error);
      reject(error);
    });
  });
}

// Create a management endpoint for starting the MCP server
const managementApp = express();
managementApp.use(cors());
managementApp.use(bodyParser.json());

// Endpoint to start the MCP server
managementApp.post('/start-mcp-server', async (req, res) => {
  try {
    // If there's already a server running, close it
    if (serverInstance) {
      console.log('Stopping existing MCP server instance');
      await new Promise(resolve => serverInstance.close(resolve));
      serverInstance = null;
    }
    
    // Start a new server
    const { server, port } = await startMcpServer();
    
    res.json({
      success: true,
      port,
      url: `http://localhost:${port}/mcp`
    });
  } catch (error) {
    console.error('Error starting MCP server:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to check if server is running
managementApp.get('/mcp-server-status', (req, res) => {
  const portFile = path.join(__dirname, 'mcp-server-port.json');
  
  try {
    if (fs.existsSync(portFile)) {
      const data = JSON.parse(fs.readFileSync(portFile, 'utf8'));
      const isRunning = serverInstance !== null;
      
      res.json({
        running: isRunning,
        port: isRunning ? data.port : null,
        url: isRunning ? `http://localhost:${data.port}/mcp` : null,
        serverType: data.serverType,
        startedAt: data.timestamp
      });
    } else {
      res.json({
        running: false
      });
    }
  } catch (error) {
    res.json({
      running: false,
      error: error.message
    });
  }
});

// Start the management server on a fixed port
const MANAGEMENT_PORT = 3005;
managementApp.listen(MANAGEMENT_PORT, () => {
  console.log(`MCP Server Management API running on http://localhost:${MANAGEMENT_PORT}`);
});

// If this script is run directly, export the server creation function for other modules to use
if (require.main === module) {
  console.log('MCP Server management system started.');
  console.log(`To start an MCP server, make a POST request to http://localhost:${MANAGEMENT_PORT}/start-mcp-server`);
}

// Expose functions for programmatic usage
module.exports = {
  createMcpApp,
  startMcpServer
}; 