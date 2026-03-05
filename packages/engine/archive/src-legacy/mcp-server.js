/**
 * MCP Server Handler
 * Processes MCP protocol requests and routes them to appropriate tool handlers
 */

const { 
  regulationTools, 
  handleFetchRegulationsFromFederalRegister, 
  handleFetchRegulationByDocumentNumber,
  handleInitializeRegulationCollection,
  handleListAvailableSources
} = require('./regulatory-sources/mcp-tools');

/**
 * Main MCP handler function
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.handler = async (req, res) => {
  // Parse request body
  const body = req.body;
  
  try {
    // Validate the request
    if (!body || !body.type) {
      return res.status(400).json({
        error: 'Invalid request format: missing type'
      });
    }
    
    // Handle tool listing
    if (body.type === 'list') {
      return res.json({
        tools: regulationTools
      });
    }
    
    // Handle tool execution
    if (body.type === 'execute') {
      const { name, parameters = {} } = body;
      
      if (!name) {
        return res.status(400).json({
          error: 'Invalid request format: missing tool name'
        });
      }
      
      let result;
      
      // Route to appropriate handler
      switch (name) {
        case 'fetchRegulationsFromFederalRegister':
          result = await handleFetchRegulationsFromFederalRegister(parameters);
          break;
          
        case 'fetchRegulationByDocumentNumber':
          result = await handleFetchRegulationByDocumentNumber(parameters);
          break;
          
        case 'initializeRegulationCollection':
          result = await handleInitializeRegulationCollection(parameters);
          break;
          
        case 'listAvailableSources':
          result = await handleListAvailableSources();
          break;
          
        default:
          return res.status(400).json({
            error: `Unknown tool: ${name}`
          });
      }
      
      return res.json({ result });
    }
    
    // Invalid request type
    return res.status(400).json({
      error: `Invalid request type: ${body.type}`
    });
  } catch (error) {
    console.error('MCP server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * AWS Lambda handler (for serverless deployment)
 */
exports.lambdaHandler = async (event, context) => {
  // Extract the request body from the Lambda event
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
  }
  
  // Create mock request and response objects
  const req = { body };
  const res = {
    status: (statusCode) => ({
      json: (data) => ({
        statusCode,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
    }),
    json: (data) => ({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
  };
  
  // Call the handler
  return await exports.handler(req, res);
};

/**
 * Express middleware for integrating with Express.js
 */
exports.expressMiddleware = (req, res, next) => {
  exports.handler(req, res).catch(next);
};

// If running as a standalone server
if (require.main === module) {
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  // Middleware
  app.use(express.json());
  
  // MCP endpoint
  app.post('/mcp', exports.expressMiddleware);
  
  // Start server
  app.listen(PORT, () => {
    console.log(`MCP Server running on port ${PORT}`);
  });
} 