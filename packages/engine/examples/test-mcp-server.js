// Basic MCP server test
import { Server } from '@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/dist/esm/server/stdio.js';

// Create a simple server
const server = new Server({
  name: "test-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {} 
  }
});

// Define a simple schema
const EchoSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Message to echo back"
    }
  },
  required: ["message"]
};

// Handle echo request
server.setRequestHandler("echo", EchoSchema, async (params) => {
  console.log(`Received: ${params.message}`);
  return {
    success: true,
    message: `Echo: ${params.message}`
  };
});

async function startServer() {
  try {
    const transport = new StdioServerTransport();
    console.log('Starting test MCP server');
    await server.connect(transport);
    console.log('Test MCP server connected and ready');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

startServer(); 