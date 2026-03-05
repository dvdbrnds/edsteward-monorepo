#!/usr/bin/env node

/**
 * Simple script to start only the registry server
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const REGISTRY_PORT = 3010;

// Kill any existing process on the registry port
async function cleanPort() {
  return new Promise((resolve, reject) => {
    console.log(`Checking for processes on port ${REGISTRY_PORT}...`);
    exec(`lsof -ti:${REGISTRY_PORT} | xargs kill -9`, (error) => {
      if (error) {
        console.log(`No processes found using port ${REGISTRY_PORT}`);
      } else {
        console.log(`Killed processes using port ${REGISTRY_PORT}`);
      }
      resolve();
    });
  });
}

// Start the registry server
async function startRegistry() {
  console.log('Starting Registry Server...');
  
  // Get the path to the registry server script
  const registryScriptPath = path.join(process.cwd(), 'src/server/registry-api/registry-server.js');
  
  // Check that the file exists
  if (!fs.existsSync(registryScriptPath)) {
    console.error(`Error: Registry server script not found at ${registryScriptPath}`);
    process.exit(1);
  } else {
    console.log(`Found registry server script at ${registryScriptPath}`);
  }
  
  // Start the registry server
  const registryProcess = spawn('node', [registryScriptPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: REGISTRY_PORT.toString(),
      // Explicitly enable CORS for all origins
      CORS_ENABLED: 'true',
      CORS_ORIGIN: '*'
    }
  });
  
  registryProcess.on('error', (err) => {
    console.error('Failed to start registry server:', err);
  });
  
  registryProcess.on('close', (code) => {
    console.log(`Registry server exited with code ${code}`);
    process.exit(code);
  });
  
  console.log(`Registry server should be running at http://localhost:${REGISTRY_PORT}`);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  process.exit(0);
});

// Run the setup and start process
async function main() {
  console.log('=== Starting Registry Server Only ===');
  try {
    await cleanPort();
    await startRegistry();
    
    // Upload test regulations after a delay
    setTimeout(async () => {
      try {
        console.log('Uploading test regulations...');
        await new Promise((resolve, reject) => {
          exec('node upload-test-regulations.js', (error, stdout, stderr) => {
            if (error) {
              console.error('Failed to upload test regulations:', error);
              reject(error);
              return;
            }
            console.log(stdout);
            console.log('Test regulations uploaded successfully');
            resolve();
          });
        });
      } catch (error) {
        console.error('Error uploading test regulations:', error);
      }
    }, 5000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 