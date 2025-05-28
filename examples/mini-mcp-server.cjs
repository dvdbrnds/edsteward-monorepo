// Minimal MCP server

// Import directly from the node_modules directory structure
const serverModule = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.js');
const stdioModule = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');

const Server = serverModule.Server;
const StdioTransport = stdioModule.StdioTransport;

console.log("Creating MCP server...");

// Create a basic server instance
const server = new Server(
  {
    name: "basic-regulatory-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define a simple echo tool schema
const echoSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Message to echo back"
    }
  },
  required: ["message"]
};

// Register the echo handler
server.setRequestHandler("echo", echoSchema, async (params) => {
  console.log(`Received message: ${params.message}`);
  return {
    echoed: params.message
  };
});

// Connect to stdio transport
async function startServer() {
  try {
    const transport = new StdioTransport();
    console.log("Starting Basic MCP Server...");
    await server.connect(transport);
    console.log("MCP Server connected and ready for requests");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Start the server
startServer(); 