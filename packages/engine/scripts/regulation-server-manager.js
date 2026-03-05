#!/usr/bin/env node

/**
 * Regulation MCP Server Manager
 * 
 * This utility helps manage multiple regulation-specific MCP servers.
 * It can start, stop, and manage different regulation servers.
 */

import { spawn } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for available regulation servers
const REGULATION_SERVERS = {
  'gdpr': {
    name: 'GDPR Validation Server',
    entryPoint: join(__dirname, 'src/regulation-server/gdpr-server-entry.js'),
    defaultPort: 3000,
    description: 'Validates content against GDPR (General Data Protection Regulation) requirements.'
  },
  'hipaa': {
    name: 'HIPAA Validation Server',
    entryPoint: join(__dirname, 'src/regulation-server/hipaa-server-entry.js'),
    defaultPort: 3001,
    description: 'Validates content against HIPAA (Health Insurance Portability and Accountability Act) requirements.'
  },
  'reg-66': {
    name: 'REG-66 Advanced Validation Server (Template)',
    entryPoint: join(__dirname, 'src/regulation-server/reg-66-server-entry.js'),
    defaultPort: 3366,
    description: 'Advanced template server for FERPA Section 66 compliance with enhanced features: real-time monitoring, analytics, audit trail, and custom APIs.',
    template: true,
    features: ['Real-time Monitoring', 'Analytics Dashboard', 'Audit Trail', 'Custom API', 'Compliance Scoring']
  }
};

// Store running server processes
const runningServers = new Map();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Display the main menu
 */
function showMainMenu() {
  console.clear();
  console.log('='.repeat(60));
  console.log('Regulation MCP Server Manager'.padStart(40));
  console.log('='.repeat(60));
  console.log('\nAvailable regulation servers:');
  
  Object.entries(REGULATION_SERVERS).forEach(([id, server], index) => {
    const status = runningServers.has(id) ? 
      '\x1b[32m[RUNNING]\x1b[0m' : 
      '\x1b[90m[STOPPED]\x1b[0m';
    
    console.log(`${index + 1}. ${server.name} ${status}`);
    console.log(`   ${server.description}`);
    
    if (runningServers.has(id)) {
      const port = runningServers.get(id).port;
      console.log(`   URL: http://localhost:${port}`);
      console.log(`   Inspector: npx @modelcontextprotocol/inspector connect http://localhost:${port}`);
    }
    
    console.log();
  });
  
  console.log('\nCommands:');
  console.log('  start <id>  - Start a regulation server (e.g., start gdpr)');
  console.log('  stop <id>   - Stop a running server (e.g., stop gdpr)');
  console.log('  inspect <id> - Open MCP Inspector for a running server');
  console.log('  list        - List all servers and their status');
  console.log('  quit        - Exit the manager and stop all servers');
  
  console.log('\nEnter command:');
}

/**
 * Start a regulation server
 * 
 * @param {string} id - Server ID
 * @param {number} [port] - Port to run the server on (optional)
 */
function startServer(id, port) {
  if (!REGULATION_SERVERS[id]) {
    console.log(`\x1b[31mError: Unknown server "${id}"\x1b[0m`);
    return;
  }
  
  if (runningServers.has(id)) {
    console.log(`\x1b[33mServer "${id}" is already running\x1b[0m`);
    return;
  }
  
  const server = REGULATION_SERVERS[id];
  const serverPort = port || server.defaultPort;
  
  // Check if entry point exists
  if (!fs.existsSync(server.entryPoint)) {
    console.log(`\x1b[31mError: Entry point not found: ${server.entryPoint}\x1b[0m`);
    return;
  }
  
  console.log(`Starting ${server.name} on port ${serverPort}...`);
  
  // Start the server process
  const process = spawn('node', [server.entryPoint, serverPort.toString()], {
    stdio: 'pipe',
    detached: false
  });
  
  // Store the running server info
  runningServers.set(id, {
    process,
    port: serverPort,
    startTime: new Date()
  });
  
  // Handle process output
  process.stdout.on('data', (data) => {
    console.log(`\x1b[36m[${id}]\x1b[0m ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.log(`\x1b[31m[${id} ERROR]\x1b[0m ${data.toString().trim()}`);
  });
  
  // Handle process exit
  process.on('exit', (code) => {
    console.log(`\x1b[36m[${id}]\x1b[0m Server stopped with code ${code}`);
    runningServers.delete(id);
  });
  
  console.log(`\x1b[32m${server.name} started successfully\x1b[0m`);
}

/**
 * Stop a running server
 * 
 * @param {string} id - Server ID
 */
function stopServer(id) {
  if (!runningServers.has(id)) {
    console.log(`\x1b[33mServer "${id}" is not running\x1b[0m`);
    return;
  }
  
  const serverInfo = runningServers.get(id);
  const server = REGULATION_SERVERS[id];
  
  console.log(`Stopping ${server.name}...`);
  
  // Send SIGTERM to gracefully shutdown
  serverInfo.process.kill('SIGTERM');
  
  // Wait for process to exit
  setTimeout(() => {
    if (runningServers.has(id)) {
      console.log(`\x1b[33mForcing shutdown of ${server.name}...\x1b[0m`);
      serverInfo.process.kill('SIGKILL');
      runningServers.delete(id);
    }
  }, 3000);
}

/**
 * Start the MCP Inspector for a running server
 * 
 * @param {string} id - Server ID
 */
function inspectServer(id) {
  if (!runningServers.has(id)) {
    console.log(`\x1b[33mServer "${id}" is not running. Start it first.\x1b[0m`);
    return;
  }
  
  const serverInfo = runningServers.get(id);
  const server = REGULATION_SERVERS[id];
  
  console.log(`Starting MCP Inspector for ${server.name}...`);
  
  // Start MCP Inspector
  const inspectorProcess = spawn('npx', [
    '@modelcontextprotocol/inspector', 
    'connect', 
    `http://localhost:${serverInfo.port}`
  ], {
    stdio: 'inherit',
    detached: true
  });
  
  // Don't wait for the inspector to exit
  inspectorProcess.unref();
}

/**
 * Process user input commands
 * 
 * @param {string} input - User input
 */
function processCommand(input) {
  const parts = input.trim().split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (command) {
    case 'start':
      if (args.length < 1) {
        console.log('\x1b[33mPlease specify a server ID (e.g., start gdpr)\x1b[0m');
      } else {
        const port = args.length > 1 ? parseInt(args[1]) : null;
        startServer(args[0], port);
      }
      break;
      
    case 'stop':
      if (args.length < 1) {
        console.log('\x1b[33mPlease specify a server ID (e.g., stop gdpr)\x1b[0m');
      } else {
        stopServer(args[0]);
      }
      break;
      
    case 'inspect':
      if (args.length < 1) {
        console.log('\x1b[33mPlease specify a server ID (e.g., inspect gdpr)\x1b[0m');
      } else {
        inspectServer(args[0]);
      }
      break;
      
    case 'list':
      // Just redisplay the menu
      break;
      
    case 'quit':
    case 'exit':
      console.log('Stopping all servers and exiting...');
      runningServers.forEach((_, id) => {
        stopServer(id);
      });
      
      // Give servers time to shutdown gracefully
      setTimeout(() => {
        rl.close();
        process.exit(0);
      }, 2000);
      return;
      
    default:
      console.log(`\x1b[33mUnknown command: ${command}\x1b[0m`);
      break;
  }
  
  // Show the menu again after a short delay
  setTimeout(() => {
    showMainMenu();
    rl.prompt();
  }, 500);
}

// Setup the prompt handler
rl.on('line', (input) => {
  processCommand(input);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down all servers...');
  
  runningServers.forEach((_, id) => {
    stopServer(id);
  });
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

// Display the initial menu
showMainMenu();
rl.prompt(); 