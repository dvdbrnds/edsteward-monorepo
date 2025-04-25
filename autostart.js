#!/usr/bin/env node

/**
 * MCP Server Auto-Start Script
 * 
 * A non-interactive script to automatically start all MCP server components.
 * - Starts the Registry API server
 * - Uploads test regulations
 * - Starts the client application
 * 
 * Usage: node autostart.js
 */

import { spawn, exec } from 'child_process';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Hard-coded port configuration
const PORTS = {
  REGISTRY: 3010,
  CLIENT: 3050,
  LLM_GATEWAY: 3100,
  BASE_MCP: 3200,
  BATCH_SERVER: 3001
};

// Track running processes
const runningProcesses = {};

/**
 * Execute a command and return a promise
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Kill any process using the specified port
 */
async function killProcessOnPort(port) {
  try {
    console.log(`Checking for processes on port ${port}...`);
    await executeCommand(`lsof -ti:${port} | xargs kill -9`);
    console.log(`Killed processes using port ${port}`);
    return true;
  } catch (error) {
    console.log(`No processes using port ${port}`);
    return false;
  }
}

/**
 * Wait for a server to be ready
 */
async function waitForServer(url, maxRetries = 15, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Checking if server is ready at ${url}...`);
      await axios.get(url);
      console.log(`Server at ${url} is ready!`);
      return true;
    } catch (error) {
      console.log(`Server not ready yet (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error(`Server at ${url} failed to start after ${maxRetries} attempts`);
  return false;
}

/**
 * Start the registry API server
 */
function startRegistryServer() {
  console.log('Starting Registry API Server...');
  
  const registry = spawn('node', ['src/server/registry-api/registry-server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: PORTS.REGISTRY.toString()
    }
  });
  
  runningProcesses.registry = registry;
  
  registry.on('close', (code) => {
    console.log(`Registry server exited with code ${code}`);
    delete runningProcesses.registry;
  });
  
  console.log(`Registry API server should be running at http://localhost:${PORTS.REGISTRY}`);
}

/**
 * Start the client application
 */
function startClientApp() {
  console.log('Starting Client Application...');
  
  const client = spawn('npx', ['vite', 'src/client', '--port', PORTS.CLIENT.toString()], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Ensure all environment variables are properly set
      PORT: PORTS.CLIENT.toString(),
      VITE_REGISTRY_API_URL: `http://localhost:${PORTS.REGISTRY}`,
      VITE_CLIENT_PORT: PORTS.CLIENT.toString()
    }
  });
  
  runningProcesses.client = client;
  
  client.on('close', (code) => {
    console.log(`Client application exited with code ${code}`);
    delete runningProcesses.client;
  });
  
  console.log(`Client application should be running at http://localhost:${PORTS.CLIENT}`);
}

/**
 * Upload test regulations
 */
async function uploadTestRegulations() {
  console.log('Uploading test regulations...');
  
  try {
    const output = await executeCommand('node upload-test-regulations.js');
    console.log(output);
    console.log('Test regulations uploaded successfully');
  } catch (error) {
    console.error('Failed to upload test regulations:', error);
  }
}

/**
 * Stop all running processes
 */
function stopAll() {
  console.log('Stopping all running processes...');
  
  for (const [name, process] of Object.entries(runningProcesses)) {
    console.log(`Stopping ${name}...`);
    process.kill();
  }
  
  console.log('All processes stopped');
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  stopAll();
  process.exit(0);
});

/**
 * Main function to start all services
 */
async function main() {
  console.log('=== MCP Auto-Start Script ===');
  
  // Kill all processes on required ports
  for (const [name, port] of Object.entries(PORTS)) {
    await killProcessOnPort(port);
  }
  
  // Also kill any vite or parcel processes to be safe
  try {
    await executeCommand('pkill -f vite || true');
    await executeCommand('pkill -f parcel || true');
    console.log('Stopped existing bundler processes');
  } catch (error) {
    console.log('No bundler processes found');
  }
  
  // Start the registry server
  startRegistryServer();
  
  // Wait for registry to be ready
  const registryReady = await waitForServer(`http://localhost:${PORTS.REGISTRY}/api/regulations`, 15, 1000);
  if (!registryReady) {
    console.error('Registry server failed to start. Exiting...');
    process.exit(1);
  }
  
  // Upload test regulations
  await uploadTestRegulations();
  
  // Start client application
  startClientApp();
  
  console.log('\n🚀 All components started!');
  console.log(`- Registry API: http://localhost:${PORTS.REGISTRY}`);
  console.log(`- Client Application: http://localhost:${PORTS.CLIENT}`);
  console.log('\nPress Ctrl+C to stop all components');
}

// Start the program
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 