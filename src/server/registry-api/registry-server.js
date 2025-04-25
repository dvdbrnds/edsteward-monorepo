import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import MCP server implementation
import { createMCPServer, stopMCPServer, getActiveServers, initializeServers, queryRegulation } from '../mcp/regulation-mcp-server.js';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors());
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

// API Routes

// Get all regulations
app.get('/api/regulations', (req, res) => {
  const regulations = readRegulations();
  res.json(regulations);
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
      res.json(response);
    } catch (error) {
      console.error(`Error querying regulation ${regulation.regulationId}:`, error);
      
      // Fall back to mock responses if MCP server query fails
      const mockResponses = {
        'GDPR': 'The GDPR (General Data Protection Regulation) provides several rights to data subjects including: right to access, right to rectification, right to erasure, right to restriction of processing, right to data portability, right to object, and rights related to automated decision making and profiling.',
        'HIPAA': 'HIPAA (Health Insurance Portability and Accountability Act) provides patients with several rights including: right to access their health information, right to request corrections, right to receive a notice of privacy practices, right to request restrictions, right to confidential communications, right to an accounting of disclosures, and right to file complaints.',
        'CCPA': 'The CCPA (California Consumer Privacy Act) provides California residents with rights including: right to know what personal information is collected, right to delete personal information, right to opt-out of the sale of personal information, and right to non-discrimination for exercising these rights.',
        default: 'This regulation has not been fully processed yet. Please check back later or initiate data collection.'
      };
      
      const response = mockResponses[regulation.name] || mockResponses.default;
      res.json({ 
        response, 
        regulation: regulation.name, 
        query,
        note: 'Response generated from fallback system as MCP server was unavailable'
      });
    }
  } catch (error) {
    console.error('Error querying regulation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get MCP server status
app.get('/api/mcp/servers', (req, res) => {
  try {
    const servers = getActiveServers();
    res.json(servers);
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

// Start the server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Registry API server running on http://0.0.0.0:${PORT}`);
  
  // Initialize MCP servers after the API server is running
  await initializeMCPServers();
}); 