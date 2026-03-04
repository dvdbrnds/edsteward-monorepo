/**
 * Regulation MCP Server
 * This module creates and manages MCP servers for each regulation
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

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
  
  try {
    // Query the LLM Gateway with the regulation-specific context
    const llmResponse = await fetch('http://localhost:3002/api/llm/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `${query} (Context: ${serverInfo.name})`,
        options: {
          regulation: regulationId,
          context: serverInfo.description || `Compliance analysis for ${serverInfo.name}`
        }
      })
    });

    if (!llmResponse.ok) {
      throw new Error(`LLM Gateway returned ${llmResponse.status}: ${llmResponse.statusText}`);
    }

    const llmData = await llmResponse.json();
    
    if (!llmData.success) {
      throw new Error(`LLM Gateway error: ${llmData.error || 'Unknown error'}`);
    }

    // Return structured response with real AI analysis
    return {
      response: llmData.data.response.fullResponse,
      confidence: llmData.data.response.confidence,
      keyPoints: llmData.data.response.keyPoints,
      actionItems: llmData.data.response.actionItems,
      regulation: serverInfo.name,
      regulationId: regulationId,
      query: query,
      timestamp: llmData.data.timestamp,
      processingTime: llmData.data.processingTime,
      source: 'LLM Gateway (OpenAI)',
      note: 'Real AI-generated compliance analysis'
    };
    
  } catch (error) {
    console.error(`Error querying LLM Gateway for ${regulationId}:`, error.message);
    
    // If LLM Gateway fails, try to provide regulation-specific information
    // from the compmat.csv data instead of generic mock responses
    const regulationData = await getRegulationDataFromCSV(regulationId, serverInfo.name);
    
    return {
      response: regulationData.response,
      regulation: serverInfo.name,
      regulationId: regulationId,
      query: query,
      timestamp: new Date().toISOString(),
      source: 'Regulation Database',
      note: 'Fallback response from regulation database (LLM Gateway unavailable)',
      error: error.message
    };
  }
};

/**
 * Get regulation data from compmat.csv as fallback
 * @param {string} regulationId - The regulation ID
 * @param {string} regulationName - The regulation name
 * @returns {Promise<Object>} Regulation data response
 */
async function getRegulationDataFromCSV(regulationId, regulationName) {
  try {
    // Path to the CSV file
    const csvPath = path.join(__dirname, '../../../compmat.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('Regulation database (compmat.csv) not found');
    }

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Search for relevant regulations by name or statute
    const relevantRegulations = records.filter(record => {
      const statuteName = record['Statute Name'] || '';
      const topic = record['Topic'] || '';
      const summary = record['Statutory Summary'] || '';
      
      // Match by regulation name or search for key terms
      return statuteName.toLowerCase().includes(regulationName.toLowerCase()) ||
             topic.toLowerCase().includes(regulationName.toLowerCase()) ||
             summary.toLowerCase().includes(regulationName.toLowerCase());
    });

    if (relevantRegulations.length === 0) {
      return {
        response: `No specific information found for ${regulationName} in the regulation database. This regulation may require additional data collection or manual processing.`,
        dataSource: 'compmat.csv',
        recordsFound: 0
      };
    }

    // Build a comprehensive response from the CSV data
    const regulation = relevantRegulations[0]; // Use the first match
    let response = `**${regulation['Statute Name']}**\n\n`;
    
    if (regulation['Statutory Summary']) {
      response += `**Summary:** ${regulation['Statutory Summary']}\n\n`;
    }
    
    if (regulation['Reporting Requirements']) {
      response += `**Reporting Requirements:** ${regulation['Reporting Requirements']}\n\n`;
    }
    
    if (regulation['Deadlines']) {
      response += `**Deadlines:** ${regulation['Deadlines']}\n\n`;
    }

    // Add regulations references
    const regulations = [];
    for (let i = 1; i <= 5; i++) {
      const reg = regulation[`Regulation ${i}`];
      if (reg && reg.trim()) {
        regulations.push(reg);
      }
    }
    
    if (regulations.length > 0) {
      response += `**Related Regulations:** ${regulations.join(', ')}\n\n`;
    }

    response += `\n*Source: Compliance Matrix Database (${relevantRegulations.length} related records found)*`;

    return {
      response: response,
      dataSource: 'compmat.csv',
      recordsFound: relevantRegulations.length,
      lastUpdated: regulation['Last Updated'] || 'Unknown'
    };

  } catch (error) {
    console.error('Error reading regulation data from CSV:', error.message);
    
    return {
      response: `Unable to retrieve specific information for ${regulationName} from the regulation database. Error: ${error.message}. Please consult with compliance experts for guidance on this regulation.`,
      dataSource: 'error',
      error: error.message
    };
  }
}

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