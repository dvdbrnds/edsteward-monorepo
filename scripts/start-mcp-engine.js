/**
 * MCP Engine Startup Script
 * 
 * This script starts the registry server and provides instructions
 * for starting the full application.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

console.log('Starting MCP Engine components...');

// Start the registry server
console.log('\n🚀 Starting Registry API Server...');
const registryServer = spawn('node', ['src/server/registry-api/registry-server.js'], {
  stdio: 'inherit'
});

// Handle server process events
registryServer.on('error', (err) => {
  console.error('❌ Failed to start Registry API Server:', err);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP Engine components...');
  registryServer.kill('SIGINT');
  process.exit(0);
});

// Display startup message with instructions
setTimeout(() => {
  console.log('\n✅ Registry API Server should be running on http://localhost:3010');
  console.log('\n📋 Next steps:');
  console.log('  1. In a new terminal, run: npm run dev:client');
  console.log('     This will start the React client application');
  console.log('\n  2. You can then access the application at:');
  console.log('     http://localhost:3000');
  console.log('\n  3. To upload test regulations, run in another terminal:');
  console.log('     node upload-test-regulations.js');
  console.log('\n🔍 Press Ctrl+C to stop the servers');
}, 2000); 