#!/usr/bin/env node

/**
 * Start LLM Gateway Service
 * 
 * This script starts the LLM Gateway Service that allows LLMs (Claude, ChatGPT, Gemini)
 * to interact with the regulation MCP servers.
 * 
 * Usage: node start-llm-gateway.js [port]
 */

import { createExpressApp, startServer } from '../core/server-factory.js';
import llmRoutes, { loadRegulations } from './routes.js';
import { fileURLToPath } from 'url';

// Constants
const DEFAULT_PORT = 3002;

/**
 * Start the LLM Gateway server
 */
async function startLLMGateway() {
  try {
    // Load regulations from CSV
    await loadRegulations();
    
    // Create Express app using factory
    const { app } = await createExpressApp({
      name: 'llm-gateway',
      routes: [
        { path: '/api', router: llmRoutes },
        { path: '/compliance', router: llmRoutes }
      ]
    });

    // Start server
    const PORT = process.env.PORT || DEFAULT_PORT;
    startServer(app, {
      port: PORT,
      name: 'llm-gateway',
      onReady: () => {
        console.log(`Health check endpoint: http://localhost:${PORT}/health`);
        console.log(`Compliance query endpoint: http://localhost:${PORT}/compliance/query`);
      }
    });
  } catch (error) {
    console.error(`Failed to start LLM Gateway: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if this file is being run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  startLLMGateway().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { startLLMGateway }; 