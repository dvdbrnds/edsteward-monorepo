// test-mcp-server.mjs
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioTransport } from '@modelcontextprotocol/sdk/server/transports/stdio';

async function main() {
  try {
    // Create server
    const server = new Server({
      name: "test-regulatory-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Define a simple echo tool
    const echoSchema = {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to echo"
        }
      },
      required: ["message"]
    };

    // Register the handler
    server.setRequestHandler("echo", echoSchema, async (params) => {
      console.log(`Received message: ${params.message}`);
      return {
        echoed: params.message
      };
    });

    // Connect with stdio transport
    const transport = new StdioTransport();
    console.log("Starting MCP server...");
    await server.connect(transport);
    console.log("MCP server running - waiting for requests");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main(); 