#!/usr/bin/env node

/**
 * Regulation Collection Initialization Script
 * 
 * This script triggers the initial collection of regulations from all configured sources.
 * It can be run manually or scheduled to run periodically to refresh the regulation database.
 * 
 * Usage: 
 *   node initialize-collection.js [--source=SOURCE_CODE] [--no-save]
 * 
 * Options:
 *   --source=SOURCE_CODE  Only collect from the specified source (e.g., FEDERAL_REGISTER)
 *   --no-save             Don't save the collected regulations to the database
 * 
 * Examples:
 *   node initialize-collection.js                         # Collect from all sources and save
 *   node initialize-collection.js --source=FEDERAL_REGISTER # Only collect from Federal Register
 *   node initialize-collection.js --no-save               # Collect but don't save to database
 */

const axios = require('axios');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  sources: undefined, // Undefined means all sources
  saveToDatabase: true
};

// Parse arguments
args.forEach(arg => {
  if (arg.startsWith('--source=')) {
    const source = arg.split('=')[1];
    options.sources = [source];
  } else if (arg === '--no-save') {
    options.saveToDatabase = false;
  }
});

// MCP server URL (default to localhost)
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

/**
 * Run the initial collection process
 */
async function runInitialCollection() {
  console.log('Starting regulation collection process...');
  
  try {
    // First, list available sources
    const sourcesResponse = await axios.post(MCP_SERVER_URL, {
      type: 'execute',
      name: 'listAvailableSources',
      parameters: {}
    });
    
    const sources = sourcesResponse.data.result.sources;
    console.log(`Available sources: ${sources.map(s => s.sourceCode).join(', ')}`);
    
    // Execute the collection process
    console.log('Initializing collection process...');
    const response = await axios.post(MCP_SERVER_URL, {
      type: 'execute',
      name: 'initializeRegulationCollection',
      parameters: options
    });
    
    // Process the results
    const result = response.data.result;
    
    if (result.success) {
      console.log('Collection completed successfully!');
    } else {
      console.warn('Collection completed with errors.');
      
      if (result.errors && result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach(error => {
          console.error(`  ${error.sourceCode}: ${error.error}`);
        });
      }
    }
    
    // Print the collection summary
    console.log('\nCollection Summary:');
    Object.entries(result.results).forEach(([sourceCode, sourceResult]) => {
      if (sourceResult.success) {
        console.log(`  ${sourceCode}: ${sourceResult.count} regulations collected at ${sourceResult.timestamp}`);
      } else {
        console.log(`  ${sourceCode}: Failed - ${sourceResult.error}`);
      }
    });
    
    return result.success ? 0 : 1;
  } catch (error) {
    console.error('Collection process failed:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`  Error: ${error.message}`);
    }
    return 1;
  }
}

// Run the collection process and exit with appropriate code
runInitialCollection()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 