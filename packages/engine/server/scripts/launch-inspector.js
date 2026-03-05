#!/usr/bin/env node

/**
 * MCP Inspector Launch Script
 * 
 * This script launches an MCP Inspector for a specific MCP server.
 * 
 * Required environment variables:
 * - MCP_SERVER_ID: The ID of the server to inspect
 * - MCP_SERVER_PORT: The port of the server to inspect
 * - MCP_SERVER_TYPE: The type of server to inspect
 * 
 * Optional environment variables:
 * - MCP_LOG_PATH: Path to save log output
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Validate required environment variables
const serverId = process.env.MCP_SERVER_ID;
const serverPort = process.env.MCP_SERVER_PORT;
const serverType = process.env.MCP_SERVER_TYPE;
const logPath = process.env.MCP_LOG_PATH;

if (!serverId || !serverPort || !serverType) {
  console.error('Missing required environment variables');
  console.error('Required: MCP_SERVER_ID, MCP_SERVER_PORT, MCP_SERVER_TYPE');
  process.exit(1);
}

// Setup logging
let logStream = null;
if (logPath) {
  try {
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch (error) {
    console.error(`Failed to create log file at ${logPath}:`, error.message);
  }
}

// Log function that writes to both console and log file if available
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  
  console.log(formattedMessage);
  
  if (logStream) {
    logStream.write(formattedMessage + '\n');
  }
}

// Launch the inspector
function launchInspector() {
  try {
    log(`Launching MCP Inspector for server ${serverId} (${serverType}) on port ${serverPort}`);
    
    // For simplicity, we'll use a direct command instead of npx
    // We'll create a cleaner command that's less likely to have issues
    const inspectorProcess = spawn('npx', ['--yes', '@mcp/inspector', 'start', '--browser-only'], {
      env: {
        ...process.env,
        MCP_SERVER_ID: serverId,
        MCP_SERVER_PORT: serverPort,
        MCP_SERVER_TYPE: serverType
      },
      detached: true,
      stdio: 'ignore'
    });
    
    // Immediately output the PID and exit this script
    log(`MCP Inspector process started with PID: ${inspectorProcess.pid}`);
    console.log(inspectorProcess.pid); // This is what the controller will parse
    
    // Detach the process so it can run independently
    inspectorProcess.unref();
    
    // Exit this script
    process.exit(0);
  } catch (error) {
    log(`Error launching MCP Inspector: ${error.message}`);
    if (logStream) {
      logStream.end();
    }
    process.exit(1);
  }
}

// Start the launcher
launchInspector(); 