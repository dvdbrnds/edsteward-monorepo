/**
 * Script to run the MCP integration tables migration
 * 
 * This script creates the necessary database tables for the MCP client integration:
 * - regulation_versions
 * - validation_status
 * - sync_control
 * - notification_queue
 * - version_conflicts
 * 
 * Usage: node run-mcp-integration-migration.js
 */

import { createMCPIntegrationTables } from './server/migrations/create-mcp-integration-tables.js';

async function runMigration() {
  console.log('Starting MCP integration migration...');
  
  try {
    await createMCPIntegrationTables();
    console.log('MCP integration migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('MCP integration migration failed:', error);
    process.exit(1);
  }
}

runMigration();