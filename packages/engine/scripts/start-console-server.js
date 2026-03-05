#!/usr/bin/env node

/**
 * Console Server Startup Script
 * Starts the frontend console server for dynamic regulation consoles
 */

import FrontendConsoleServer from '../src/client/console-server.js';

const consoleServer = new FrontendConsoleServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down console server...');
  consoleServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down console server...');
  consoleServer.stop();
  process.exit(0);
});

// Start the server
async function start() {
  try {
    await consoleServer.start();
    console.log('✅ Console server started successfully');
  } catch (error) {
    console.error('❌ Failed to start console server:', error);
    process.exit(1);
  }
}

start();
