/**
 * Start All Regulation Servers
 * 
 * This script starts MCP servers for all regulations in the registry.
 * It provides command-line options for batch processing and load management.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { generateRegistry } from './generate-regulation-registry.js';

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '../../regulation-servers-registry.json');
const SERVER_ENTRY_PATH = path.join(__dirname, '../regulation-server/base-regulation-server-entry.js');

// Command line arguments
const args = process.argv.slice(2);
const MAX_CONCURRENT = args.find(arg => arg.startsWith('--max=')) 
  ? parseInt(args.find(arg => arg.startsWith('--max=')).split('=')[1], 10) 
  : 10;
const START_PORT = args.find(arg => arg.startsWith('--port=')) 
  ? parseInt(args.find(arg => arg.startsWith('--port=')).split('=')[1], 10) 
  : 3200;
const CATEGORY_FILTER = args.find(arg => arg.startsWith('--category=')) 
  ? args.find(arg => arg.startsWith('--category=')).split('=')[1] 
  : null;
const GENERATE_FIRST = args.includes('--generate');

// Store running server processes
const activeServers = new Map();

/**
 * Load the regulation registry
 */
async function loadRegistry() {
  try {
    const data = await fs.readFile(REGISTRY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Registry file not found, generating new registry...');
      return generateRegistry();
    }
    throw error;
  }
}

/**
 * Start an MCP server for a specific regulation
 */
async function startRegulationServer(regulationId, port) {
  return new Promise((resolve, reject) => {
    console.log(`Starting server for ${regulationId} on port ${port}...`);
    
    // Spawn the server process
    const serverProcess = spawn('node', [SERVER_ENTRY_PATH, regulationId, port.toString()], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Collect stdout to detect when server is ready
    let outputBuffer = '';
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      process.stdout.write(`[${regulationId}] ${output}`);
      
      // Detect when server is ready
      if (output.includes('MCP server ready') || outputBuffer.includes('MCP server ready')) {
        resolve({
          regulationId,
          port,
          process: serverProcess,
          url: `http://localhost:${port}/mcp`,
          startTime: new Date().toISOString()
        });
      }
    });
    
    // Handle stderr
    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[${regulationId}] ERROR: ${data.toString()}`);
    });
    
    // Handle process exit
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[${regulationId}] Server exited with code ${code}`);
        activeServers.delete(regulationId);
        reject(new Error(`Server exited with code ${code}`));
      } else {
        console.log(`[${regulationId}] Server exited normally`);
        activeServers.delete(regulationId);
      }
    });
    
    // Set timeout for server startup
    const timeout = setTimeout(() => {
      if (!outputBuffer.includes('MCP server ready')) {
        serverProcess.kill();
        reject(new Error(`Timeout starting server for ${regulationId}`));
      }
    }, 30000);
    
    // Clear timeout when server is ready
    serverProcess.once('exit', () => clearTimeout(timeout));
  });
}

/**
 * Start all regulation servers in batches
 */
async function startAllServers() {
  try {
    // Generate registry if requested
    if (GENERATE_FIRST) {
      await generateRegistry();
    }
    
    // Load registry
    const registry = await loadRegistry();
    
    // Get regulations based on filters
    let regulations = Object.entries(registry).map(([id, reg]) => ({ id, ...reg }));
    
    // Apply category filter if specified
    if (CATEGORY_FILTER) {
      regulations = regulations.filter(reg => 
        (reg.category || '').toLowerCase() === CATEGORY_FILTER.toLowerCase()
      );
      console.log(`Filtered to ${regulations.length} regulations in category "${CATEGORY_FILTER}"`);
    }
    
    console.log(`Starting servers for ${regulations.length} regulations with max concurrent: ${MAX_CONCURRENT}`);
    console.log(`Base port: ${START_PORT}`);
    
    // Process regulations in batches
    let currentPort = START_PORT;
    for (let i = 0; i < regulations.length; i += MAX_CONCURRENT) {
      const batch = regulations.slice(i, i + MAX_CONCURRENT);
      console.log(`\nStarting batch ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(regulations.length / MAX_CONCURRENT)} (${batch.length} servers)...`);
      
      // Start servers in this batch
      const promises = batch.map((regulation, index) => {
        const port = currentPort + index;
        return startRegulationServer(regulation.id, port)
          .then(serverInfo => {
            activeServers.set(regulation.id, serverInfo);
            // Update registry with server info
            registry[regulation.id].server.port = port;
            registry[regulation.id].server.running = true;
            registry[regulation.id].server.lastStarted = new Date().toISOString();
            registry[regulation.id].server.url = `http://localhost:${port}/mcp`;
            return serverInfo;
          })
          .catch(error => {
            console.error(`Failed to start server for ${regulation.id}:`, error.message);
            return null;
          });
      });
      
      // Wait for all servers in this batch to start
      const results = await Promise.all(promises);
      const successCount = results.filter(Boolean).length;
      console.log(`Batch complete: ${successCount}/${batch.length} servers started successfully`);
      
      // Update the port for the next batch
      currentPort += batch.length;
    }
    
    // Save updated registry
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
    
    // Print summary
    const activeCount = activeServers.size;
    console.log(`\n===== Server Start Summary =====`);
    console.log(`Total regulations: ${regulations.length}`);
    console.log(`Active servers: ${activeCount}`);
    console.log(`Failed: ${regulations.length - activeCount}`);
    
    // Set up process signal handlers for cleanup
    process.on('SIGINT', shutdownAllServers);
    process.on('SIGTERM', shutdownAllServers);
    
    console.log(`\nAll servers started. Press Ctrl+C to shut down all servers.`);
    
  } catch (error) {
    console.error('Failed to start servers:', error);
    await shutdownAllServers();
    process.exit(1);
  }
}

/**
 * Shutdown all running regulation servers
 */
async function shutdownAllServers() {
  console.log(`\nShutting down ${activeServers.size} regulation servers...`);
  
  for (const [regulationId, serverInfo] of activeServers.entries()) {
    console.log(`Stopping server for ${regulationId}...`);
    try {
      serverInfo.process.kill();
    } catch (error) {
      console.error(`Error stopping server for ${regulationId}:`, error.message);
    }
  }
  
  // Clear the active servers map
  activeServers.clear();
  
  console.log('All servers shut down');
}

// Start all servers if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startAllServers()
    .catch(error => {
      console.error('Error in main process:', error);
      shutdownAllServers()
        .finally(() => process.exit(1));
    });
}

export { startAllServers, shutdownAllServers }; 