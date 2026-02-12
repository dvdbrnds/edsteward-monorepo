#!/usr/bin/env node

/**
 * Non-interactive script to start all MCP components
 */

import { spawn } from 'child_process';
import axios from 'axios';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// Configuration
const REGISTRY_PORT = 3010;
const LLM_GATEWAY_PORT = 3004;
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
 * Start the registry API server (PostgreSQL mode - authoritative source of truth)
 */
function startRegistryServer() {
  console.log('Starting Registry API Server (PostgreSQL)...');
  
  const registry = spawn('node', ['start-registry-postgres.js'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  runningProcesses.registry = registry;
  console.log(`Registry API Server PID: ${registry.pid}`);
  
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

// Utility to kill any process using a given port
async function killProcessOnPort(port) {
  try {
    const { execSync } = await import('child_process');
    const command = `lsof -ti tcp:${port}`;
    console.log(`Finding processes on port ${port}...`);
    
    const stdout = execSync(command).toString();
    const pids = stdout.split('\n').filter(Boolean);
    if (pids.length > 0) {
      console.log(`Killing process(es) on port ${port}: ${pids.join(', ')}`);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`);
          console.log(`Successfully killed PID ${pid} on port ${port}`);
        } catch (e) {
          console.warn(`Failed to kill PID ${pid}:`, e.message);
        }
      }
    } else {
      console.log(`No processes found using port ${port}`);
    }
  } catch (e) {
    console.log(`No process found using port ${port} or lsof not available`);
  }
}

// Ensure dependencies are installed in a directory
function ensureDependencies(dir) {
  if (!existsSync(path.join(dir, 'node_modules'))) {
    console.log(`Installing dependencies in ${dir}...`);
    execSync('npm install', { cwd: dir, stdio: 'inherit' });
  }
}

/**
 * Start the Vite dev server
 */
function startViteDevServer() {
  console.log('Starting Vite Dev Server on port', CLIENT_PORT);
  // Explicitly pass the port and strictPort flags
  const vite = spawn('npx', ['vite', 'src/client', '--port', CLIENT_PORT.toString(), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
    shell: true,
  });

  runningProcesses.vite = vite;
  console.log(`Vite Dev Server PID: ${vite.pid}`);

  vite.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[Vite] ${output}`);
    if (output.includes('Local:')) {
      const match = output.match(/Local:\s*(http:\/\/[^\s]+)/);
      if (match && match[1]) {
        console.log(`\n🔗 Vite Dev Server is accessible at: ${match[1]}\n`);
      }
    }
  });

  vite.stderr.on('data', (data) => {
    console.error(`[Vite Error] ${data.toString().trim()}`);
  });

  vite.on('close', (code) => {
    console.log(`Vite dev server exited with code ${code}`);
    delete runningProcesses.vite;
    process.exit(1);
  });
}

/**
 * Start the LLM Gateway
 */
function startLLMGateway() {
  console.log(`Starting LLM Gateway on port ${LLM_GATEWAY_PORT}...`);

  const llmGateway = spawn('node', ['src/llm-gateway/start-llm-gateway-phase4.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, LLM_GATEWAY_PORT: LLM_GATEWAY_PORT.toString() }
  });

  runningProcesses.llmGateway = llmGateway;
  console.log(`LLM Gateway PID: ${llmGateway.pid}`);

  llmGateway.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[LLM Gateway] ${output}`);
    if (output.includes('Health check endpoint:')) {
      const match = output.match(/Health check endpoint: (http:\/\/[^\s]+)/);
      if (match && match[1]) {
        console.log(`\n🔗 LLM Gateway Health: ${match[1]}\n`);
      }
    }
  });

  llmGateway.stderr.on('data', (data) => {
    console.error(`[LLM Gateway Error] ${data.toString().trim()}`);
  });

  llmGateway.on('close', (code) => {
    console.log(`LLM Gateway exited with code ${code}`);
    delete runningProcesses.llmGateway;
    process.exit(1);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start all components
 */
async function startAll() {
  try {
    // Force kill any running node processes that might be using our ports
    try {
      const { execSync } = await import('child_process');
      console.log('Forcefully terminating potential conflicting processes...');
      execSync('pkill -f "node.*start-all.js" || true');
      execSync('pkill -f "vite" || true');
      execSync('pkill -f "registry-server.js" || true');
      execSync('pkill -f "start-llm-gateway.js" || true');
      console.log('Process cleanup complete');
    } catch (e) {
      console.log('Process cleanup warning:', e.message);
    }

    // Ensure dependencies in all relevant directories
    ensureDependencies(process.cwd()); // root
    ensureDependencies(path.join(process.cwd(), 'src/client'));
    ensureDependencies(path.join(process.cwd(), 'server'));

    // Kill any process using the required ports
    await killProcessOnPort(REGISTRY_PORT);    // 3010
    await killProcessOnPort(LLM_GATEWAY_PORT); // 3002
    await killProcessOnPort(CLIENT_PORT);      // 3050

    // Wait a bit to ensure ports are released
    await sleep(2000);

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
    
    // Start LLM Gateway
    startLLMGateway();

    // Start Vite dev server
    startViteDevServer();
    
    console.log('\n🚀 All components started!');
    console.log(`- Registry API: http://localhost:${REGISTRY_PORT}`);
    console.log(`- LLM Gateway: http://localhost:${LLM_GATEWAY_PORT}`);
    console.log(`- Client application (Vite): http://localhost:${CLIENT_PORT}`);
    console.log('Press Ctrl+C to stop all servers');
  } catch (error) {
    console.error('Failed to start components:', error);
    process.exit(1);
  }
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