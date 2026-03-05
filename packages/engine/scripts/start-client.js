#!/usr/bin/env node

/**
 * Simple script to start only the client application
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

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
  console.log('Starting Client Application...');
  
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
  
  // Start Vite directly from the current directory
  const viteProcess = spawn('npx', ['vite', '--port', CLIENT_PORT.toString(), clientDir], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Force development mode
      NODE_ENV: 'development'
    }
  });
  
  viteProcess.on('error', (err) => {
    console.error('Failed to start Vite:', err);
  });
  
  viteProcess.on('close', (code) => {
    console.log(`Vite exited with code ${code}`);
    process.exit(code);
  });
  
  console.log(`Client application should be running at http://localhost:${CLIENT_PORT}`);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  process.exit(0);
});

// Run the setup and start process
async function main() {
  console.log('=== Starting Client Only ===');
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