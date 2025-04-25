#!/usr/bin/env node

/**
 * Script to start the React client using Vite
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_PORT = 3050;

// Kill any existing process on the client port
async function cleanPort() {
  return new Promise((resolve, reject) => {
    console.log(`Checking for processes on port ${CLIENT_PORT}...`);
    exec(`lsof -ti:${CLIENT_PORT} | xargs kill -9`, (error) => {
      if (error) {
        console.log(`No processes found using port ${CLIENT_PORT}`);
      } else {
        console.log(`Killed processes using port ${CLIENT_PORT}`);
      }
      resolve();
    });
  });
}

// Kill any existing vite processes
async function killVite() {
  return new Promise((resolve, reject) => {
    console.log(`Checking for Vite processes...`);
    exec(`pkill -f vite || true`, (error) => {
      if (error) {
        console.log(`No Vite processes found`);
      } else {
        console.log(`Killed Vite processes`);
      }
      resolve();
    });
  });
}

// Start the client application directly with Vite
async function startClient() {
  console.log('Starting React Client Application...');
  
  // Get the absolute path to the client directory
  const clientDir = path.join(process.cwd(), 'src/client');
  console.log(`Client directory: ${clientDir}`);
  
  // Check that the directory exists
  if (!fs.existsSync(clientDir)) {
    console.error(`Error: Client directory not found at ${clientDir}`);
    process.exit(1);
  }
  
  // Check that index.html exists
  const indexPath = path.join(clientDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`Error: index.html not found at ${indexPath}`);
    process.exit(1);
  } else {
    console.log(`Found index.html at ${indexPath}`);
  }

  // Ensure vite config exists
  const viteConfigPath = path.join(process.cwd(), 'vite.config.js');
  if (!fs.existsSync(viteConfigPath)) {
    console.error(`Error: vite.config.js not found at ${viteConfigPath}`);
    process.exit(1);
  } else {
    console.log(`Found vite.config.js at ${viteConfigPath}`);
  }
  
  // Start Vite with the config file explicitly
  const viteProcess = spawn('npx', [
    'vite',
    '--config', viteConfigPath,
    '--force',
    '--port', CLIENT_PORT.toString()
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Force development mode
      NODE_ENV: 'development',
      // Ensure we connect to the right registry API
      VITE_REGISTRY_API_URL: 'http://localhost:3010',
      // Debug
      DEBUG: 'vite:*'
    }
  });
  
  viteProcess.on('error', (err) => {
    console.error('Failed to start Vite:', err);
  });
  
  viteProcess.on('close', (code) => {
    console.log(`Vite exited with code ${code}`);
    process.exit(code);
  });
  
  console.log(`React client application should be running at http://localhost:${CLIENT_PORT}`);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  process.exit(0);
});

// Run the setup and start process
async function main() {
  console.log('=== Starting React Client ===');
  try {
    await cleanPort();
    await killVite();
    await startClient();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 