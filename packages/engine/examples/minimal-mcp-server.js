/**
 * Minimal MCP Server
 * A lightweight Express server that exposes MCP functions through a REST API
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { mcpTools } = require('./src/regulatory-sources/mcp-tools');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { name, parameters } = req.body;
    
    // Validate request
    if (!name || !parameters) {
      return res.status(400).json({ 
        error: 'Invalid request. Both name and parameters are required.' 
      });
    }
    
    // Find the requested function
    const tool = mcpTools.find(t => t.name === name);
    if (!tool) {
      return res.status(404).json({ 
        error: `Function "${name}" not found` 
      });
    }
    
    // Execute the function
    console.log(`Executing MCP function: ${name}`);
    console.log('Parameters:', parameters);
    
    const result = await tool.function(parameters);
    return res.json(result);
  } catch (error) {
    console.error('Error in MCP endpoint:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// List available MCP functions
app.get('/mcp/functions', (req, res) => {
  const functions = mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
  
  res.json({ functions });
});

// Start server
app.listen(port, () => {
  console.log(`MCP Server running on port ${port}`);
  console.log(`Available endpoints:
  - POST /mcp - Call MCP functions
  - GET /mcp/functions - List available functions
  - GET /health - Health check`);
});