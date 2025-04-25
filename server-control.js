#!/usr/bin/env node

/**
 * MCP Server Control Tool
 * 
 * A simple command-line tool to start and stop MCP servers.
 * Usage:
 * - node server-control.js start registry - Start the registry API server
 * - node server-control.js start client - Start the client application
 * - node server-control.js start csra - Start the Civil Service Act MCP server
 * - node server-control.js stop csra - Stop the Civil Service Act MCP server
 * - node server-control.js status - Check the status of all servers
 * - node server-control.js start all - Start the registry, client, and upload test data
 */

import { spawn, exec } from 'child_process';
import axios from 'axios';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Configuration
const REGISTRY_PORT = 3010;
const CSRA_MANAGEMENT_PORT = 3005;
const CLIENT_PORT = 3000;

// Track running processes
const runningProcesses = {};

// Create readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
 * Start the registry API server
 */
function startRegistryServer() {
  console.log('Starting Registry API Server...');
  
  if (runningProcesses.registry) {
    console.log('Registry server is already running.');
    return;
  }
  
  const registry = spawn('node', ['src/server/registry-api/registry-server.js'], {
    stdio: 'inherit'
  });
  
  runningProcesses.registry = registry;
  
  registry.on('close', (code) => {
    console.log(`Registry server exited with code ${code}`);
    delete runningProcesses.registry;
  });
  
  console.log(`Registry API server should be running at http://localhost:${REGISTRY_PORT}`);
}

/**
 * Start the client application
 */
function startClientApp() {
  console.log('Starting Client Application...');
  
  if (runningProcesses.client) {
    console.log('Client application is already running.');
    return;
  }
  
  const client = spawn('npm', ['run', 'dev:client'], {
    stdio: 'inherit'
  });
  
  runningProcesses.client = client;
  
  client.on('close', (code) => {
    console.log(`Client application exited with code ${code}`);
    delete runningProcesses.client;
  });
  
  console.log(`Client application should be running at http://localhost:${CLIENT_PORT}`);
}

/**
 * Start the Civil Service Act MCP server
 */
async function startCsraServer() {
  console.log('Starting Civil Service Act MCP Server...');
  
  if (runningProcesses.csra) {
    console.log('CSRA MCP server is already running.');
    return;
  }
  
  // Option 1: Start via management API if available
  try {
    const response = await axios.post(`http://localhost:${CSRA_MANAGEMENT_PORT}/start-mcp-server`);
    console.log('CSRA MCP server started via management API:');
    console.log(`- Port: ${response.data.port}`);
    console.log(`- URL: ${response.data.url}`);
    return;
  } catch (error) {
    console.log('Management API not available, starting server directly...');
  }
  
  // Option 2: Start directly
  const csra = spawn('node', ['civil-service-act-mcp-server.cjs'], {
    stdio: 'inherit'
  });
  
  runningProcesses.csra = csra;
  
  csra.on('close', (code) => {
    console.log(`CSRA MCP server exited with code ${code}`);
    delete runningProcesses.csra;
  });
  
  console.log('CSRA MCP server started directly');
  console.log(`- Management API: http://localhost:${CSRA_MANAGEMENT_PORT}`);
  console.log('- MCP Server: Should be running on a dynamic port');
}

/**
 * Stop the Civil Service Act MCP server
 */
async function stopCsraServer() {
  console.log('Stopping Civil Service Act MCP Server...');
  
  // If we have a direct process, kill it
  if (runningProcesses.csra) {
    runningProcesses.csra.kill();
    console.log('CSRA MCP server process terminated');
    return;
  }
  
  // Try to stop via API
  try {
    await axios.post(`http://localhost:${CSRA_MANAGEMENT_PORT}/stop-mcp-server`);
    console.log('CSRA MCP server stopped via management API');
  } catch (error) {
    console.log('Failed to stop CSRA MCP server via API. Server may not be running.');
  }
}

/**
 * Check the status of all servers
 */
async function checkStatus() {
  console.log('\n===== Server Status =====');
  
  // Check registry server
  try {
    await axios.get(`http://localhost:${REGISTRY_PORT}/api/regulations`);
    console.log('✅ Registry API Server: Running');
  } catch (error) {
    console.log('❌ Registry API Server: Not running');
  }
  
  // Check CSRA management API
  try {
    const status = await axios.get(`http://localhost:${CSRA_MANAGEMENT_PORT}/mcp-server-status`);
    console.log('✅ CSRA Management API: Running');
    if (status.data.running) {
      console.log(`✅ CSRA MCP Server: Running on port ${status.data.port}`);
      console.log(`   URL: ${status.data.url}`);
    } else {
      console.log('❌ CSRA MCP Server: Not running');
    }
  } catch (error) {
    console.log('❌ CSRA Management API: Not running');
  }
  
  // Check client application (this is approximate since the client doesn't have a specific API)
  try {
    await axios.get(`http://localhost:${CLIENT_PORT}`);
    console.log('✅ Client Application: Likely running');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Client Application: Not running');
    } else {
      console.log('❓ Client Application: Status unknown');
    }
  }
  
  console.log('=========================\n');
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
  startRegistryServer();
  
  // Wait for registry to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Upload test regulations
  await uploadTestRegulations();
  
  // Start client
  startClientApp();
  
  console.log('\n🚀 All components started!');
  console.log('- Registry API: http://localhost:3010');
  console.log('- Client Application: http://localhost:3000');
  console.log('\nYou can now use the client to start CSRA MCP server when needed.');
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

/**
 * Show interactive menu
 */
function showMenu() {
  console.log('\n===== MCP Server Control =====');
  console.log('1. Start Registry API Server');
  console.log('2. Start Client Application');
  console.log('3. Start CSRA MCP Server');
  console.log('4. Stop CSRA MCP Server');
  console.log('5. Check Status');
  console.log('6. Start All Components');
  console.log('7. Stop All');
  console.log('8. Upload Test Regulations');
  console.log('9. Exit');
  console.log('============================');
  
  rl.question('Enter your choice: ', async (choice) => {
    switch (choice) {
      case '1':
        startRegistryServer();
        break;
      case '2':
        startClientApp();
        break;
      case '3':
        await startCsraServer();
        break;
      case '4':
        await stopCsraServer();
        break;
      case '5':
        await checkStatus();
        break;
      case '6':
        await startAll();
        break;
      case '7':
        stopAll();
        break;
      case '8':
        await uploadTestRegulations();
        break;
      case '9':
        console.log('Exiting...');
        rl.close();
        process.exit(0);
        return;
      default:
        console.log('Invalid choice');
    }
    
    // Show menu again
    showMenu();
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // If no arguments, show interactive menu
  if (args.length === 0) {
    console.log('Welcome to MCP Server Control Tool');
    showMenu();
    return;
  }
  
  // Parse command-line arguments
  const command = args[0];
  const target = args[1];
  
  switch (command) {
    case 'start':
      switch (target) {
        case 'registry':
          startRegistryServer();
          break;
        case 'client':
          startClientApp();
          break;
        case 'csra':
          await startCsraServer();
          break;
        case 'all':
          await startAll();
          break;
        default:
          console.log('Unknown target. Use: registry, client, csra, or all');
      }
      break;
    case 'stop':
      switch (target) {
        case 'csra':
          await stopCsraServer();
          break;
        case 'all':
          stopAll();
          break;
        default:
          console.log('Unknown target. Use: csra or all');
      }
      break;
    case 'status':
      await checkStatus();
      break;
    case 'upload':
      await uploadTestRegulations();
      break;
    default:
      console.log('Unknown command. Use: start, stop, status, or upload');
  }
  
  // Exit if not in interactive mode
  if (command !== 'start' || (target !== 'registry' && target !== 'client' && target !== 'all')) {
    process.exit(0);
  }
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  stopAll();
  process.exit(0);
});

// Start the program
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 