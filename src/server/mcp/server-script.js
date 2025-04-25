
      import { Server } from "@modelcontextprotocol/sdk/server/index.js";
      import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
      
      const server = new Server({
        name: `regulation-${regulation.regulationId}`,
        version: regulation.version || "1.0.0"
      }, {
        capabilities: {
          resources: {}
        }
      });

      // Handle resource listing requests
      server.setRequestHandler("list_resources", async () => {
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
      server.setRequestHandler("get_resource_content", async (request) => {
        if (request.uri === `regulation://${regulation.regulationId}`) {
          return {
            content: JSON.stringify(regulation, null, 2),
            mimeType: "application/json"
          };
        }
        
        throw new Error(`Resource not found: ${request.uri}`);
      });

      // Handle regulation queries
      server.setRequestHandler("query", async (request) => {
        // In a real implementation, this would analyze the regulation data
        // and possibly use an LLM to answer the query
        return {
          response: `Query response for: ${request.query} regarding ${regulation.name}`,
          regulation: regulation.name
        };
      });

      // Connect transport - use stdio for communication with parent process
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      console.log(`MCP server started for ${regulation.name} (${regulation.regulationId})`);
    