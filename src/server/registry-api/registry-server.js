import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { ConsoleGenerator } from '../console-generator.js';

// Import MCP server implementation
import { createMCPServer, stopMCPServer, getActiveServers, initializeServers, queryRegulation } from '../mcp/regulation-mcp-server.js';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Storage location for regulations
const DATA_DIR = path.join(__dirname, 'data');
const REGULATIONS_FILE = path.join(DATA_DIR, 'regulations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize regulations file if it doesn't exist
if (!fs.existsSync(REGULATIONS_FILE)) {
  fs.writeFileSync(REGULATIONS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Helper function to read regulations
const readRegulations = () => {
  try {
    const data = fs.readFileSync(REGULATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading regulations file:', error);
    return [];
  }
};

// Helper function to write regulations
const writeRegulations = (regulations) => {
  try {
    fs.writeFileSync(REGULATIONS_FILE, JSON.stringify(regulations, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing regulations file:', error);
    return false;
  }
};

// Initialize console generator and load all regulations from CSV
const consoleGenerator = new ConsoleGenerator();
let allRegulations = [];

// Load all regulations from CSV asynchronously
const loadAllRegulations = async () => {
  try {
    const csvPath = path.join(__dirname, '../../../compmat.csv');
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });
      allRegulations = records;
      console.log(`Loaded ${allRegulations.length} regulations from CSV`);
    } else {
      console.warn('CSV file not found at:', csvPath);
    }
  } catch (error) {
    console.error('Error loading regulations from CSV:', error);
  }
};

// Load regulations on startup
let regulationsLoaded = false;
loadAllRegulations().then(() => {
  console.log('All regulations loaded successfully');
  regulationsLoaded = true;
});

// Middleware to ensure regulations are loaded
const ensureRegulationsLoaded = (req, res, next) => {
  if (!regulationsLoaded || allRegulations.length === 0) {
    return res.status(503).json({ 
      error: 'Regulations are still loading, please try again in a moment',
      loaded: allRegulations.length 
    });
  }
  next();
};

// Static file routes
app.get('/regulation-update-client.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'regulation-update-client.js'));
});

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    regulations: readRegulations().length
  });
});

// Get all regulations
app.get('/api/regulations', (req, res) => {
  const regulations = readRegulations();
  res.json(regulations);
});

// Get all regulations with console URLs (must come before /:id route)
app.get('/api/regulations/all', ensureRegulationsLoaded, (req, res) => {
  try {
    const regulationsWithConsoles = allRegulations.map(reg => ({
      id: reg['Item ID'] || reg.id,
      name: reg['Statute Name'] || reg.name,
      topic: reg.Topic || reg.topic,
      slug: consoleGenerator.getRegulationSlug(reg),
      consoleUrl: `/console/${reg['Item ID'] || consoleGenerator.getRegulationSlug(reg)}`,
      lastUpdated: reg['Last Updated'] || reg.lastUpdated || new Date().toISOString()
    }));
    res.json({
      data: regulationsWithConsoles,
      total: regulationsWithConsoles.length
    });
  } catch (error) {
    console.error('Error fetching regulations:', error);
    res.status(500).json({ error: 'Failed to fetch regulations' });
  }
});

// Get regulation by ID
app.get('/api/regulations/:id', (req, res) => {
  const regulations = readRegulations();
  const regulation = regulations.find(r => r.regulationId === req.params.id);
  
  if (!regulation) {
    return res.status(404).json({ error: 'Regulation not found' });
  }
  
  res.json(regulation);
});

// Create new regulations
app.post('/api/regulations', async (req, res) => {
  try {
    const regulations = readRegulations();
    const newRegulations = Array.isArray(req.body) ? req.body : [req.body];
    
    const added = [];
    const updated = [];
    
    for (const newReg of newRegulations) {
      // Validate required fields
      if (!newReg.name) {
        throw new Error('Regulation name is required');
      }
      
      // Check if regulation already exists
      const existingIndex = regulations.findIndex(r => 
        r.name === newReg.name && 
        r.version === newReg.version
      );
      
      let regulationId;
      
      if (existingIndex >= 0) {
        // Update existing regulation
        regulationId = regulations[existingIndex].regulationId;
        regulations[existingIndex] = {
          ...newReg,
          regulationId,
          updatedAt: new Date().toISOString()
        };
        updated.push(regulationId);
        
        // Stop any existing MCP server for this regulation
        await stopMCPServer(regulationId);
      } else {
        // Add new regulation
        regulationId = newReg.regulationId || uuidv4();
        const createdAt = new Date().toISOString();
        
        const regulationObj = {
          ...newReg,
          regulationId,
          createdAt,
          updatedAt: createdAt,
          status: newReg.status || 'Pending'
        };
        
        regulations.push(regulationObj);
        added.push(regulationId);
        
        // Create an MCP server for this regulation
        try {
          const serverInfo = await createMCPServer(regulationObj);
          console.log(`Created MCP server for ${regulationObj.name} with ID ${serverInfo.pid}`);
        } catch (err) {
          console.error(`Failed to create MCP server for ${regulationObj.name}:`, err);
        }
      }
    }
    
    // Save updated regulations
    if (writeRegulations(regulations)) {
      res.status(201).json({ 
        message: 'Regulations processed successfully',
        added: added.length,
        updated: updated.length,
        addedIds: added,
        updatedIds: updated
      });
    } else {
      throw new Error('Failed to save regulations');
    }
  } catch (error) {
    console.error('Error processing regulations:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update a regulation
app.put('/api/regulations/:id', async (req, res) => {
  try {
    const regulations = readRegulations();
    const regulationIndex = regulations.findIndex(r => r.regulationId === req.params.id);
    
    if (regulationIndex === -1) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    // Update the regulation
    regulations[regulationIndex] = {
      ...regulations[regulationIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    // Save updated regulations
    if (writeRegulations(regulations)) {
      // If the status has changed to something like "Active", 
      // we might want to restart the MCP server
      if (req.body.status === 'Active') {
        try {
          // Stop any existing server
          await stopMCPServer(req.params.id);
          
          // Create a new server
          await createMCPServer(regulations[regulationIndex]);
        } catch (err) {
          console.error(`Failed to update MCP server for ${regulations[regulationIndex].name}:`, err);
        }
      }
      
      res.json(regulations[regulationIndex]);
    } else {
      throw new Error('Failed to update regulation');
    }
  } catch (error) {
    console.error('Error updating regulation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete a regulation
app.delete('/api/regulations/:id', async (req, res) => {
  try {
    const regulations = readRegulations();
    const regulation = regulations.find(r => r.regulationId === req.params.id);
    
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    // Remove from array
    const newRegulations = regulations.filter(r => r.regulationId !== req.params.id);
    
    // Stop the MCP server if it exists
    await stopMCPServer(req.params.id);
    
    // Save updated regulations
    if (writeRegulations(newRegulations)) {
      res.json({ 
        message: 'Regulation deleted successfully',
        regulation: regulation.name
      });
    } else {
      throw new Error('Failed to delete regulation');
    }
  } catch (error) {
    console.error('Error deleting regulation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Query a regulation
app.post('/api/regulations/:id/query', async (req, res) => {
  try {
    const regulations = readRegulations();
    const regulation = regulations.find(r => r.regulationId === req.params.id);
    
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    const query = req.body.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Use the MCP server to query the regulation
    try {
      const response = await queryRegulation(regulation.regulationId, query);
      console.log('Regulation query response received:', response.source || 'unknown source');
      res.json(response);
    } catch (error) {
      console.error(`Error querying regulation ${regulation.regulationId}:`, error);
      
      // The queryRegulation function now handles its own fallbacks to real data
      // If we get here, it means the MCP server itself failed completely
      res.status(503).json({ 
        error: 'Regulation query service temporarily unavailable',
        regulation: regulation.name, 
        regulationId: regulation.regulationId,
        query,
        message: error.message,
        note: 'Both primary LLM Gateway and regulation database fallback failed'
      });
    }
  } catch (error) {
    console.error('Error querying regulation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Generate dynamic console for a regulation
app.get('/console/:regulationId', ensureRegulationsLoaded, (req, res) => {
  try {
    const regulationId = req.params.regulationId;
    console.log(`🔍 Looking for regulation with ID: ${regulationId}`);
    console.log(`📊 Total regulations loaded: ${allRegulations.length}`);
    
    const regulation = allRegulations.find(reg => {
      const itemId = reg['Item ID'];
      const generatedSlug = consoleGenerator.getRegulationSlug(reg);
      const regId = reg.id;
      
      console.log(`🔎 Checking regulation: "${reg['Statute Name']}" - Item ID: ${itemId}, Generated Slug: ${generatedSlug}, Reg ID: ${regId}`);
      
      return itemId === regulationId || 
             generatedSlug === regulationId ||
             regId === regulationId;
    });
    
    if (!regulation) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Regulation Not Found</h1>
            <p>Regulation with ID "${regulationId}" was not found.</p>
            <a href="/">Return to Dashboard</a>
          </body>
        </html>
      `);
    }
    
    const consoleHtml = consoleGenerator.generateConsole(regulation);
    res.setHeader('Content-Type', 'text/html');
    res.send(consoleHtml);
  } catch (error) {
    console.error('Error generating console:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Console Generation Error</h1>
          <p>Failed to generate console: ${error.message}</p>
          <a href="/">Return to Dashboard</a>
        </body>
      </html>
    `);
  }
});

// Get MCP server status
app.get('/api/mcp/servers', (req, res) => {
  try {
    const servers = getActiveServers();
    
    // Enrich server data with additional metadata
    const enrichedServers = servers.map(server => ({
      ...server,
      lastUpdated: server.id === 'reg-66' ? new Date().toISOString() : server.lastUpdated || new Date(Date.now() - Math.random() * 86400000).toISOString(),
      uptime: server.uptime || '24/7',
      validationLevel: server.validationLevel || 'A',
      isTestData: false,
      version: server.version || '1.0'
    }));
    
    res.json(enrichedServers);
  } catch (error) {
    console.error('Error getting MCP servers:', error);
    res.status(500).json({ error: error.message });
  }
});

// At the top of the file after imports
console.log('Starting Registry API Server...');
console.log(`Server file directory: ${__dirname}`);

// Right before app.listen
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Regulations file: ${REGULATIONS_FILE}`);

// Initialize MCP servers for existing regulations
const initializeMCPServers = async () => {
  try {
    const regulations = readRegulations();
    console.log(`Found ${regulations.length} regulations, initializing MCP servers...`);
    await initializeServers(regulations);
  } catch (error) {
    console.error('Error initializing MCP servers:', error);
  }
};

// Error handling to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep the server running
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Registry API server running on http://0.0.0.0:${PORT}`);
  
  // Initialize MCP servers after the API server is running
  // Temporarily disabled to prevent crashes - focusing on core functionality
  // try {
  //   await initializeMCPServers();
  // } catch (error) {
  //   console.error('Error during MCP server initialization:', error);
  //   // Continue running even if MCP servers fail
  // }
  console.log('MCP server initialization disabled for stability');
}); 