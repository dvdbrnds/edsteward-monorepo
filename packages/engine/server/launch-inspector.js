#!/usr/bin/env node

/**
 * MCP Inspector Launcher Script
 * This script launches the MCP Inspector with a specific configuration
 * to avoid port conflicts
 */

const { spawn } = require('child_process');
const path = require('path');

// Get the server ID from command line arguments
const serverId = process.argv[2];
if (!serverId) {
    console.error('Server ID is required');
    process.exit(1);
}

// Set environment variables for the inspector
process.env.INSPECTOR_PORT = '9001'; // Use a different port than the main app
process.env.SERVER_ID = serverId;

// Launch the inspector process
const inspectorProcess = spawn('npx', ['@mcp/inspector'], {
    stdio: 'inherit',
    shell: true
});

inspectorProcess.on('error', (error) => {
    console.error('Failed to start inspector:', error);
    process.exit(1);
});

inspectorProcess.on('exit', (code) => {
    console.log('Inspector process exited with code:', code);
    process.exit(code);
});