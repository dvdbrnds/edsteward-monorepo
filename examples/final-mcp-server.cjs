// Minimal MCP Server example

console.log("Loading MCP SDK...");

// Direct imports
const serverModule = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.js');
const stdioModule = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');

const Server = serverModule.Server;
const StdioTransport = stdioModule.StdioTransport;

console.log("Creating MCP server...");

// Initialize server
const server = new Server({
  name: "regulatory-sources-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Define the schema for the echo function
const echoSchema = {
  method: "echo",
  params: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Message to echo back"
      }
    },
    required: ["message"]
  }
};

// Register request handler
server.setRequestHandler(echoSchema, async (params) => {
  console.log(`Received message: ${params.message}`);
  return {
    echoed: params.message
  };
});

// Connect to transport
async function startServer() {
  try {
    const transport = new StdioTransport();
    console.log("Starting MCP server with stdio transport...");
    await server.connect(transport);
    console.log("MCP server connected and ready!");
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

// Start server
startServer(); 