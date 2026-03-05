import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListResourcesRequestSchema, 
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read regulation info from file (passed as command line arg)
const regulationId = process.argv[2];
const dataDir = path.join(__dirname, 'data', regulationId);
const regulationInfoFile = path.join(dataDir, 'regulation-info.json');

if (!fs.existsSync(regulationInfoFile)) {
  console.error(`Regulation info file not found: ${regulationInfoFile}`);
  process.exit(1);
}

const regulation = JSON.parse(fs.readFileSync(regulationInfoFile, 'utf8'));

const server = new Server(
  {
    name: `regulation-${regulation.regulationId}`,
    version: regulation.version || "1.0.0"
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    }
  }
);

// Handle resource listing requests
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: `regulation://${regulation.regulationId}`,
        name: regulation.name,
        description: regulation.description || `${regulation.name} Regulation`
      }
    ]
  };
});

// Handle resource content requests
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === `regulation://${regulation.regulationId}`) {
    return {
      contents: [{
        uri: request.params.uri,
        text: JSON.stringify(regulation, null, 2)
      }]
    };
  }
  
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "query",
      description: `Query the ${regulation.name} regulation`,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }]
  };
});

// Handle regulation queries
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    // In a real implementation, this would analyze the regulation data
    // and possibly use an LLM to answer the query
    return {
      content: [{
        type: "text", 
        text: `Query response for: ${request.params.arguments.query} regarding ${regulation.name}`
      }]
    };
  }
  
  throw new Error(`Tool not found: ${request.params.name}`);
});

// Connect transport - use stdio for communication with parent process
const transport = new StdioServerTransport();
await server.connect(transport);

console.log(`MCP server started for ${regulation.name} (${regulation.regulationId})`);
    