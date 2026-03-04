/**
 * Regulation MCP Server Registry
 * 
 * A system for managing multiple MCP servers for different regulations.
 * This registry maintains a record of all imported regulations and provides
 * functionality to create, start, stop, and manage MCP servers for each.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Registry database file
const REGISTRY_FILE = path.join(__dirname, 'regulation-servers-registry.json');

// Initialize the registry
let serverRegistry = {};
let runningServers = {};

// Load existing registry if available
function initializeRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      serverRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(serverRegistry).length} regulations from registry`);
    } else {
      console.log('No existing registry found, creating new registry');
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify({}));
    }
  } catch (error) {
    console.error('Error initializing registry:', error);
    serverRegistry = {};
  }
}

// Save registry to file
function saveRegistry() {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(serverRegistry, null, 2));
  } catch (error) {
    console.error('Error saving registry:', error);
  }
}

// Create MCP server template for a regulation
function createMcpServerTemplate(regulation) {
  return {
    name: regulation.name,
    regulationId: regulation.regulationId,
    version: regulation.version || '1.0',
    description: regulation.description || '',
    id: regulation.regulationId,
    info: {
      title: regulation.name,
      enacted: regulation.enactedDate || 'Unknown',
      public_law: regulation.publicLaw || 'N/A',
      description: regulation.description || '',
      full_text_url: regulation.fullTextUrl || ''
    },
    key_provisions: regulation.keyProvisions || [],
    agencies_created: regulation.agenciesCreated || [],
    server: {
      port: null,
      running: false,
      lastStarted: null,
      url: null
    }
  };
}

// Create Express app for a specific regulation
function createRegulationMcpApp(regulation) {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Regulation data from registry
  const regulationData = serverRegistry[regulation.regulationId];

  // MCP JSON-RPC endpoint
  app.post('/mcp', async (req, res) => {
    const { jsonrpc, id, method, params } = req.body;
    
    console.log(`Received MCP request for ${regulation.name}: ${method}`);
    
    // Validate request format
    if (jsonrpc !== '2.0' || !id || !method) {
      return res.json({
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      });
    }
    
    try {
      let result;
      
      // Handle method calls
      switch (method) {
        case 'initialize':
          // Initialize the connection
          result = {
            version: regulationData.version,
            capabilities: {
              tools: [
                'getRegulationInfo', 
                'getKeyProvisions', 
                'getAgenciesCreated', 
                'getFullText'
              ]
            }
          };
          break;
          
        case 'getRegulationInfo':
          // Return basic information about the regulation
          result = regulationData.info;
          break;
          
        case 'getKeyProvisions':
          // Return key provisions
          result = {
            provisions: regulationData.key_provisions
          };
          break;
          
        case 'getAgenciesCreated':
          // Return agencies created
          result = {
            agencies: regulationData.agencies_created
          };
          break;
          
        case 'getFullText':
          // Return URL to full text
          result = {
            url: regulationData.info.full_text_url,
            message: "Full text available at the provided URL"
          };
          break;
        
        case 'shutdown':
          // Handle shutdown request
          result = { message: "Shutting down server" };
          
          // Set a timeout to shut down the server after responding
          setTimeout(() => {
            console.log(`Shutting down MCP server for ${regulation.name} due to shutdown request`);
            stopServer(regulation.regulationId);
          }, 100);
          break;
          
        default:
          // Method not found
          throw {
            code: -32601,
            message: `Method not found: ${method}`
          };
      }
      
      // Send successful response
      res.json({
        jsonrpc: '2.0',
        id,
        result
      });
      
    } catch (error) {
      console.error(`Error processing MCP request ${method}:`, error);
      
      // Format error response
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: error.code || -32603,
          message: error.message || 'Internal error',
          data: error.data
        }
      });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      version: regulationData.version,
      name: `${regulation.name} MCP Server`,
      ephemeral: true
    });
  });

  return app;
}

// Start a server for a specific regulation
async function startServer(regulationId) {
  if (!serverRegistry[regulationId]) {
    throw new Error(`Regulation ${regulationId} not found in registry`);
  }
  
  // If server is already running, return its info
  if (runningServers[regulationId]) {
    return {
      regulationId,
      port: serverRegistry[regulationId].server.port,
      url: serverRegistry[regulationId].server.url
    };
  }
  
  const regulation = serverRegistry[regulationId];
  const app = createRegulationMcpApp({ regulationId, name: regulation.name });
  
  // Create the server using ephemeral port
  const server = http.createServer(app);
  
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port;
      console.log(`${regulation.name} MCP Server running on port ${port}`);
      console.log(`MCP JSON-RPC endpoint available at http://localhost:${port}/mcp`);
      
      // Update registry
      regulation.server.port = port;
      regulation.server.running = true;
      regulation.server.lastStarted = Date.now();
      regulation.server.url = `http://localhost:${port}/mcp`;
      
      // Save to running servers
      runningServers[regulationId] = {
        server,
        port,
        startTime: Date.now()
      };
      
      saveRegistry();
      
      resolve({
        regulationId,
        port,
        url: regulation.server.url
      });
    });
    
    server.on('error', (error) => {
      console.error(`Failed to start MCP server for ${regulation.name}:`, error);
      reject(error);
    });
  });
}

// Stop a server for a specific regulation
function stopServer(regulationId) {
  if (!runningServers[regulationId]) {
    console.log(`No running server found for regulation ${regulationId}`);
    return { success: false, message: 'Server not running' };
  }
  
  try {
    const { server } = runningServers[regulationId];
    server.close();
    
    // Update registry
    serverRegistry[regulationId].server.running = false;
    serverRegistry[regulationId].server.port = null;
    serverRegistry[regulationId].server.url = null;
    
    // Remove from running servers
    delete runningServers[regulationId];
    
    saveRegistry();
    
    return { success: true };
  } catch (error) {
    console.error(`Error stopping server for ${regulationId}:`, error);
    return { success: false, error: error.message };
  }
}

// Add a new regulation to the registry
function addRegulation(regulation) {
  // Skip if regulation already exists with same version
  if (serverRegistry[regulation.regulationId]) {
    const existing = serverRegistry[regulation.regulationId];
    if (existing.version === (regulation.version || '1.0')) {
      console.log(`Regulation ${regulation.regulationId} already exists with version ${existing.version}`);
      return {
        success: false,
        duplicate: true,
        message: `Regulation already exists with same version`
      };
    }
  }
  
  // Create server template
  const serverTemplate = createMcpServerTemplate(regulation);
  
  // Add to registry
  serverRegistry[regulation.regulationId] = serverTemplate;
  
  saveRegistry();
  
  return {
    success: true,
    regulationId: regulation.regulationId
  };
}

// Add multiple regulations to the registry
function addRegulations(regulations) {
  const results = {
    added: [],
    duplicates: [],
    errors: []
  };
  
  for (const regulation of regulations) {
    try {
      // Skip if required fields are missing
      if (!regulation.regulationId || !regulation.name) {
        results.errors.push({
          regulation,
          message: 'Missing required fields (regulationId, name)'
        });
        continue;
      }
      
      const result = addRegulation(regulation);
      if (result.success) {
        results.added.push(regulation.regulationId);
      } else if (result.duplicate) {
        results.duplicates.push(regulation.regulationId);
      } else {
        results.errors.push({
          regulation,
          message: result.message
        });
      }
    } catch (error) {
      results.errors.push({
        regulation,
        message: error.message
      });
    }
  }
  
  return results;
}

// Get list of all regulations in registry
function getAllRegulations() {
  return Object.values(serverRegistry).map(reg => ({
    regulationId: reg.regulationId,
    name: reg.name,
    version: reg.version,
    description: reg.description,
    serverRunning: reg.server.running,
    serverUrl: reg.server.url,
    lastStarted: reg.server.lastStarted
  }));
}

// Get details of a specific regulation
function getRegulationDetails(regulationId) {
  return serverRegistry[regulationId] || null;
}

// Create registry management API
function createRegistryApi() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  
  // List all regulations
  app.get('/api/regulations', (req, res) => {
    res.json(getAllRegulations());
  });
  
  // Get specific regulation details
  app.get('/api/regulations/:regulationId', (req, res) => {
    const regulation = getRegulationDetails(req.params.regulationId);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    res.json(regulation);
  });
  
  // Add regulations
  app.post('/api/regulations', (req, res) => {
    const regulations = Array.isArray(req.body) ? req.body : [req.body];
    const results = addRegulations(regulations);
    res.json(results);
  });
  
  // Start server for a regulation
  app.post('/api/regulations/:regulationId/start-server', async (req, res) => {
    try {
      const result = await startServer(req.params.regulationId);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Stop server for a regulation
  app.post('/api/regulations/:regulationId/stop-server', (req, res) => {
    const result = stopServer(req.params.regulationId);
    res.json(result);
  });
  
  // Get server status for a regulation
  app.get('/api/regulations/:regulationId/server-status', (req, res) => {
    const regulation = getRegulationDetails(req.params.regulationId);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    res.json({
      regulationId: regulation.regulationId,
      running: regulation.server.running,
      port: regulation.server.port,
      url: regulation.server.url,
      lastStarted: regulation.server.lastStarted
    });
  });
  
  return app;
}

// Initialize the registry on start
initializeRegistry();

// Create and start the registry API
const REGISTRY_PORT = 3010;
const registryApp = createRegistryApi();

registryApp.listen(REGISTRY_PORT, () => {
  console.log(`Regulation MCP Server Registry API running on http://localhost:${REGISTRY_PORT}`);
  console.log(`Registry contains ${Object.keys(serverRegistry).length} regulations`);
});

// Cleanup on process exit
process.on('SIGINT', () => {
  console.log('Shutting down all regulation MCP servers...');
  Object.keys(runningServers).forEach(stopServer);
  process.exit(0);
});

// Expose for programmatic usage
module.exports = {
  addRegulation,
  addRegulations,
  startServer,
  stopServer,
  getAllRegulations,
  getRegulationDetails
}; 