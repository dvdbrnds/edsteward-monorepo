#!/usr/bin/env node

/**
 * Non-interactive script to start all MCP components
 */

import { spawn } from 'child_process';
import axios from 'axios';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration
const REGISTRY_PORT = 3010;
const CLIENT_PORT = 3050;

// Track running processes
const runningProcesses = {};

/**
 * Execute a command and return a promise
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
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
 * Wait for a server to be ready
 */
async function waitForServer(url, maxRetries = 10, delay = 1000) {
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
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  runningProcesses.registry = registry;
  
  registry.stdout.on('data', (data) => {
    console.log(`[Registry API] ${data.toString().trim()}`);
  });
  
  registry.stderr.on('data', (data) => {
    console.error(`[Registry API Error] ${data.toString().trim()}`);
  });
  
  registry.on('close', (code) => {
    console.log(`Registry server exited with code ${code}`);
    delete runningProcesses.registry;
    process.exit(1);
  });
  
  console.log(`Registry API server should be running at http://localhost:${REGISTRY_PORT}`);
}

/**
 * Start the client application
 */
function startClientApp() {
  console.log('Starting Client Application...');
  
  // Navigate to client directory
  const clientDir = path.join(process.cwd(), 'src/client');
  
  const client = spawn('npm', ['run', 'start'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: clientDir
  });
  
  runningProcesses.client = client;
  
  client.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[Client] ${output}`);
    
    // If client is ready, extract the URL
    if (output.includes('Server running at http://')) {
      const match = output.match(/Server running at (http:\/\/[^\s]+)/);
      if (match && match[1]) {
        console.log(`\n🔗 Client is accessible at: ${match[1]}\n`);
      }
    }
  });
  
  client.stderr.on('data', (data) => {
    console.error(`[Client Error] ${data.toString().trim()}`);
  });
  
  client.on('close', (code) => {
    console.log(`Client application exited with code ${code}`);
    delete runningProcesses.client;
    process.exit(1);
  });
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
 * Start all components
 */
async function startAll() {
  // Start registry server
  startRegistryServer();
  
  // Wait for registry to be ready
  const registryReady = await waitForServer(`http://localhost:${REGISTRY_PORT}/health`, 15, 1000);
  if (!registryReady) {
    console.error('Registry server failed to start. Exiting...');
    process.exit(1);
  }
  
  // Upload test regulations
  await uploadTestRegulations();
  
  // Start client application
  startClientApp();
  
  console.log('\n🚀 All components started!');
  console.log(`- Registry API: http://localhost:${REGISTRY_PORT}`);
  console.log('- Client application should be available at the URL above\n');
  
  console.log('Press Ctrl+C to stop all servers');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down all servers...');
  for (const [name, process] of Object.entries(runningProcesses)) {
    console.log(`Stopping ${name}...`);
    process.kill();
  }
  process.exit(0);
});

// Start everything
startAll().catch(error => {
  console.error('Failed to start components:', error);
  process.exit(1);
}); 