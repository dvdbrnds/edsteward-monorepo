/**
 * Regulation MCP Server
 * This module creates and manages MCP servers for each regulation
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage for active MCP servers
const activeServers = new Map();

/**
 * Create an MCP server for a specific regulation
 * @param {Object} regulation - The regulation object
 * @returns {Promise<Object>} Server information
 */
export const createMCPServer = async (regulation) => {
  // Check if we already have a server for this regulation
  if (activeServers.has(regulation.regulationId)) {
    console.log(`MCP server for ${regulation.name} already exists`);
    return activeServers.get(regulation.regulationId);
  }

  // Create a directory for this regulation's data
  const regulationDir = path.join(__dirname, 'data', regulation.regulationId);
  if (!fs.existsSync(regulationDir)) {
    fs.mkdirSync(regulationDir, { recursive: true });
  }

  // Write regulation info to a file for the server to access
  const regulationInfoFile = path.join(regulationDir, 'regulation-info.json');
  fs.writeFileSync(regulationInfoFile, JSON.stringify(regulation, null, 2), 'utf8');

  // The path to the server script
  const serverScriptPath = path.join(__dirname, 'server-script.js');

  // Create the server script if it doesn't exist
  if (!fs.existsSync(serverScriptPath)) {
    const serverTemplate = `
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
        console.error(\`Regulation info file not found: \${regulationInfoFile}\`);
        process.exit(1);
      }

      const regulation = JSON.parse(fs.readFileSync(regulationInfoFile, 'utf8'));
      
      const server = new Server({
        name: \`regulation-\${regulation.regulationId}\`,
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
              uri: \`regulation://\${regulation.regulationId}\`,
              name: regulation.name,
              description: regulation.description || \`\${regulation.name} Regulation\`
            }
          ]
        };
      });

      // Handle resource content requests
      server.setRequestHandler("get_resource_content", async (request) => {
        if (request.uri === \`regulation://\${regulation.regulationId}\`) {
          return {
            content: JSON.stringify(regulation, null, 2),
            mimeType: "application/json"
          };
        }
        
        throw new Error(\`Resource not found: \${request.uri}\`);
      });

      // Handle regulation queries
      server.setRequestHandler("query", async (request) => {
        // In a real implementation, this would analyze the regulation data
        // and possibly use an LLM to answer the query
        return {
          response: \`Query response for: \${request.query} regarding \${regulation.name}\`,
          regulation: regulation.name
        };
      });

      // Connect transport - use stdio for communication with parent process
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      console.log(\`MCP server started for \${regulation.name} (\${regulation.regulationId})\`);
    `;

    fs.writeFileSync(serverScriptPath, serverTemplate, 'utf8');
  }

  try {
    // Spawn the MCP server process
    const serverProcess = spawn('node', [serverScriptPath, regulation.regulationId], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    const serverInfo = {
      regulationId: regulation.regulationId,
      name: regulation.name,
      process: serverProcess,
      startTime: new Date(),
      pid: serverProcess.pid,
      port: 0, // We're using stdio communication, not a network port
      status: 'starting'
    };

    // Listen for server output
    serverProcess.stdout.on('data', (data) => {
      console.log(`MCP server (${regulation.name}): ${data.toString().trim()}`);
      if (data.toString().includes('MCP server started')) {
        serverInfo.status = 'running';
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`MCP server (${regulation.name}) error: ${data.toString().trim()}`);
    });

    // Handle server exit
    serverProcess.on('exit', (code) => {
      console.log(`MCP server for ${regulation.name} exited with code ${code}`);
      activeServers.delete(regulation.regulationId);
    });

    // Store server info
    activeServers.set(regulation.regulationId, serverInfo);
    
    return serverInfo;
  } catch (error) {
    console.error(`Error creating MCP server for ${regulation.name}:`, error);
    throw error;
  }
};

/**
 * Stop an MCP server
 * @param {string} regulationId - The ID of the regulation
 * @returns {Promise<boolean>} Success status
 */
export const stopMCPServer = async (regulationId) => {
  if (!activeServers.has(regulationId)) {
    console.log(`No active MCP server found for regulation ${regulationId}`);
    return false;
  }

  const serverInfo = activeServers.get(regulationId);
  
  try {
    // Send SIGTERM to gracefully shut down the server
    serverInfo.process.kill();
    
    // Remove from active servers
    activeServers.delete(regulationId);
    return true;
  } catch (error) {
    console.error(`Error stopping MCP server for regulation ${regulationId}:`, error);
    return false;
  }
};

/**
 * Get information about active MCP servers
 * @returns {Array} Array of server info objects
 */
export const getActiveServers = () => {
  const servers = [];
  
  for (const [regulationId, serverInfo] of activeServers.entries()) {
    // Create a copy without the process object (not serializable)
    const info = { ...serverInfo };
    delete info.process;
    servers.push(info);
  }
  
  return servers;
};

/**
 * Query a regulation through its MCP server
 * @param {string} regulationId - The ID of the regulation to query
 * @param {string} query - The query text
 * @returns {Promise<Object>} The query response
 */
export const queryRegulation = async (regulationId, query) => {
  // Check if we have an active server for this regulation
  if (!activeServers.has(regulationId)) {
    throw new Error(`No active MCP server found for regulation ${regulationId}`);
  }

  const serverInfo = activeServers.get(regulationId);
  
  // In a real implementation, we would use the MCP client SDK to send a query
  // to the server. For now, we'll simulate a response.
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    response: `This is a simulated response for your query: ${query}`,
    regulation: serverInfo.name,
    query
  };
};

/**
 * Create MCP servers for all regulations at startup
 * @param {Array} regulations - Array of regulation objects
 */
export const initializeServers = async (regulations) => {
  console.log(`Initializing MCP servers for ${regulations.length} regulations...`);
  
  for (const regulation of regulations) {
    try {
      await createMCPServer(regulation);
    } catch (error) {
      console.error(`Failed to initialize MCP server for ${regulation.name}:`, error);
    }
  }
  
  console.log(`Initialized ${activeServers.size} MCP servers`);
}; 