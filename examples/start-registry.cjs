/**
 * MCP Regulation Server Registry Starter
 * 
 * Run this script to start the MCP Regulation Server Registry.
 * This registry manages multiple MCP servers for different regulations.
 */

// Just require the registry module to start it
require('./regulation-mcp-server-registry.cjs');

console.log('MCP Regulation Server Registry started.');
console.log('To upload regulations, use the web interface at http://localhost:PORT');
console.log('');
console.log('Press Ctrl+C to stop the registry and all running MCP servers.'); 