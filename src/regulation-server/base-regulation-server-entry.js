/**
 * Base Regulation MCP Server Entry
 * 
 * This file serves as the entry point for starting a regulation-specific MCP server.
 * It handles command line arguments for regulation ID and port number.
 * 
 * Usage: node base-regulation-server-entry.js <regulationId> <port>
 */

import path from 'path';
import fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

// Local imports
import * as ValidationProtocol from '../protocol/mcp-validation-protocol.js';
import { BaseRegulationServer } from './base-regulation-server.js';
import { loadRegulationData } from '../protocol/regulation-data-loader.js';

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const [,, regulationId, portStr] = process.argv;
const port = parseInt(portStr, 10) || 3200;

// Validate required arguments
if (!regulationId) {
  console.error('Error: Regulation ID is required');
  console.error('Usage: node base-regulation-server-entry.js <regulationId> <port>');
  process.exit(1);
}

/**
 * Initialize and start the MCP server
 */
async function startMcpServer() {
  try {
    console.log(`Starting MCP server for regulation: ${regulationId} on port ${port}`);
    
    // Load regulation data
    const regulationData = await loadRegulationData(regulationId);
    if (!regulationData) {
      throw new Error(`Regulation data not found for ID: ${regulationId}`);
    }
    
    // Create regulation-specific server instance
    const server = new BaseRegulationServer({
      regulationId,
      name: regulationData.name || `${regulationId}-validation-server`,
      description: regulationData.description || `Validation server for ${regulationId}`,
      version: regulationData.version || '1.0.0'
    });
    
    // Initialize the server
    await server.start();
    
    // Create Express app for HTTP transport
    const app = express();
    app.use(express.json());
    app.use(cors());
    
    // Main MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        const { jsonrpc, id, method, params } = req.body;
        
        if (jsonrpc !== '2.0') {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32600,
              message: 'Invalid Request: Not a valid JSON-RPC 2.0 request'
            }
          });
        }
        
        // Handle the request via the server instance
        const result = await server.handleRequest(method, params, id);
        
        // Send the response
        res.json({
          jsonrpc: '2.0',
          id,
          result
        });
      } catch (error) {
        console.error('Error processing request:', error);
        
        // Send error response
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        regulationId,
        serverName: server.name,
        version: server.version
      });
    });
    
    // Server metadata endpoint
    app.get('/info', (req, res) => {
      res.json({
        regulationId,
        name: server.name,
        description: server.description,
        version: server.version,
        capabilities: server.capabilities
      });
    });
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Start listening
    httpServer.listen(port, () => {
      console.log(`MCP server for ${regulationId} listening on port ${port}`);
      console.log('MCP server ready');
    });
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(`Shutting down MCP server for ${regulationId}...`);
      await server.stop();
      httpServer.close(() => {
        console.log('Server shut down successfully');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server
startMcpServer(); 