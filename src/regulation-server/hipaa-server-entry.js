#!/usr/bin/env node

/**
 * HIPAA MCP Server Entry Point
 * 
 * This is the main entry point for the HIPAA MCP validation server.
 * Run with: npx @modelcontextprotocol/inspector node src/regulation-server/hipaa-server-entry.js
 */

import { HipaaServer } from './hipaa-server.js';
import { createServer } from 'http';

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3001;

// Create and start the HIPAA server
const server = new HipaaServer({
  name: "hipaa-validation-server",
  version: "1.0.0",
  description: "MCP Server for HIPAA compliance validation"
});

// Create HTTP server to handle MCP requests over JSON-RPC
const httpServer = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ 
      error: { 
        code: -32700, 
        message: "Method not allowed. Use POST for JSON-RPC requests." 
      } 
    }));
    return;
  }
  
  // Read the request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse the JSON-RPC request
      const rpcRequest = JSON.parse(body);
      
      // Validate JSON-RPC 2.0 request
      if (rpcRequest.jsonrpc !== '2.0' || !rpcRequest.method) {
        res.statusCode = 400;
        res.end(JSON.stringify({ 
          jsonrpc: '2.0', 
          id: rpcRequest.id || null,
          error: { 
            code: -32600, 
            message: "Invalid JSON-RPC 2.0 request" 
          } 
        }));
        return;
      }
      
      // Log incoming request
      console.log(`Received request: ${rpcRequest.method}, id: ${rpcRequest.id}`);
      
      // Process the request using our server
      const response = await server.handleRequest(
        rpcRequest.method, 
        rpcRequest.params || {}, 
        rpcRequest.id
      );
      
      // Add JSON-RPC wrapper to response
      const rpcResponse = {
        jsonrpc: '2.0',
        id: rpcRequest.id,
        ...response
      };
      
      // Send response
      res.statusCode = 200;
      res.end(JSON.stringify(rpcResponse));
    } catch (error) {
      // Handle parse errors
      console.error('Error processing request:', error);
      
      res.statusCode = 400;
      res.end(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: null,
        error: { 
          code: -32700, 
          message: `Parse error: ${error.message}` 
        } 
      }));
    }
  });
});

// Start HTTP server
httpServer.listen(port, () => {
  console.log(`HIPAA MCP server listening at http://localhost:${port}`);
  console.log(`To test with MCP Inspector: npx @modelcontextprotocol/inspector connect http://localhost:${port}`);
});

// Start the server implementation
server.start()
  .then(info => {
    console.log('HIPAA validation server started successfully:', info);
  })
  .catch(error => {
    console.error('Failed to start HIPAA validation server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down HIPAA server...');
  
  try {
    await server.stop();
    httpServer.close(() => {
      console.log('Server stopped successfully');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 