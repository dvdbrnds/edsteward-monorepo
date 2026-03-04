/**
 * LLM Gateway Service
 * 
 * This service acts as an entry point for LLMs (Claude, ChatGPT, Gemini) to interact
 * with the regulation MCP servers. It handles the initialization, routing, and
 * response formatting for LLM-initiated requests.
 */

import express from 'express';
import cors from 'cors';
import { MCPHostController } from './mcp-host-controller.js';

// Create the controller instance
const mcpController = new MCPHostController();

// Create Express server
const app = express();
app.use(express.json());
app.use(cors());

// Endpoint for LLMs to initiate server interactions
app.post('/api/llm/initiate', async (req, res) => {
  const llmRequest = req.body;
  
  // Basic validation
  if (!llmRequest.action) {
    return res.status(400).json({ 
      error: 'Missing required action',
      message: 'The request must include an action field' 
    });
  }
  
  try {
    // Process the request through the controller
    const result = await mcpController.processLLMRequest(llmRequest);
    res.json(result);
  } catch (error) {
    console.error('Error processing LLM request:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Endpoint to check server status
app.get('/api/status', async (req, res) => {
  try {
    const status = await mcpController.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get available regulations
app.get('/api/regulations', async (req, res) => {
  try {
    const regulations = await mcpController.getAvailableRegulations();
    res.json(regulations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.LLM_GATEWAY_PORT || 3100;
app.listen(PORT, () => {
  console.log(`LLM Gateway Service running on port ${PORT}`);
  console.log(`Ready to receive requests from Claude, ChatGPT, and Gemini`);
});

// Initialize the MCP controller
mcpController.initialize()
  .then(() => {
    console.log('MCP Host Controller initialized successfully');
  })
  .catch(error => {
    console.error('Failed to initialize MCP Host Controller:', error);
  });

export default app; 