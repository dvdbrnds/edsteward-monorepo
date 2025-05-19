/**
 * MCP Integration Initialization Script
 * 
 * This script initializes the MCP client integration by creating the necessary database tables:
 * - regulation_versions
 * - validation_status
 * - sync_control
 * - notification_queue
 * - version_conflicts
 * 
 * Run with: tsx init-mcp-integration.ts
 */

import { db, pool, initializeLogging } from './server/db';
import { syslog, LogLevel, LogFacility } from './server/services/syslog';

async function initMCPIntegration() {
  console.log('Starting MCP client integration initialization...');
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting MCP client integration initialization");
  
  try {
    // Check if tables already exist to avoid duplicate initialization
    const tablesExist = await checkIfTablesExist();
    
    if (tablesExist) {
      console.log('MCP integration tables already exist. Skipping initialization.');
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "MCP integration tables already exist, initialization skipped");
      return;
    }
    
    // Begin transaction
    await db.execute('BEGIN');
    
    // Create regulation_versions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS regulation_versions (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        version_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        source TEXT NOT NULL DEFAULT 'local',
        source_id TEXT,
        validation_status JSONB
      )
    `);
    console.log('Created regulation_versions table');
    
    // Create validation_status table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS validation_status (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        version_id INTEGER REFERENCES regulation_versions(id),
        level TEXT NOT NULL,
        status TEXT NOT NULL,
        details JSONB,
        validated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        validated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('Created validation_status table');
    
    // Create sync_control table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_control (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        last_sync_attempt TIMESTAMP,
        last_successful_sync TIMESTAMP,
        sync_errors JSONB,
        next_scheduled_sync TIMESTAMP,
        sync_state TEXT NOT NULL DEFAULT 'idle',
        sync_settings JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created sync_control table');
    
    // Create notification_queue table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        user_id INTEGER REFERENCES users(id),
        type TEXT NOT NULL,
        content JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMP,
        priority TEXT NOT NULL DEFAULT 'normal',
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMP
      )
    `);
    console.log('Created notification_queue table');
    
    // Create version_conflicts table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS version_conflicts (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id),
        local_version_id INTEGER REFERENCES regulation_versions(id),
        remote_version_id TEXT NOT NULL,
        conflicts JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        resolution_method TEXT,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created version_conflicts table');
    
    // Create indexes for performance
    await db.execute(`CREATE INDEX idx_regulation_versions_regulation_id ON regulation_versions(regulation_id)`);
    await db.execute(`CREATE INDEX idx_validation_status_regulation_id ON validation_status(regulation_id)`);
    await db.execute(`CREATE INDEX idx_validation_status_version_id ON validation_status(version_id)`);
    await db.execute(`CREATE INDEX idx_sync_control_regulation_id ON sync_control(regulation_id)`);
    await db.execute(`CREATE INDEX idx_notification_queue_regulation_id ON notification_queue(regulation_id)`);
    await db.execute(`CREATE INDEX idx_notification_queue_status ON notification_queue(status)`);
    await db.execute(`CREATE INDEX idx_version_conflicts_regulation_id ON version_conflicts(regulation_id)`);
    await db.execute(`CREATE INDEX idx_version_conflicts_status ON version_conflicts(status)`);
    
    console.log('Created indexes for MCP integration tables');
    
    // Commit transaction
    await db.execute('COMMIT');
    
    console.log('Successfully created all MCP integration tables');
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "MCP client integration initialization completed successfully");
  } catch (error) {
    // Rollback transaction on error
    await db.execute('ROLLBACK');
    console.error('Error creating MCP integration tables:', error);
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error during MCP client integration initialization", {
      error: String(error)
    });
    throw error;
  }
}

// Helper function to check if tables already exist
async function checkIfTablesExist(): Promise<boolean> {
  try {
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'regulation_versions'
      )
    `);
    
    // Result is an array with the first element containing an object with the EXISTS property
    return result[0].exists;
  } catch (error) {
    console.error('Error checking if tables exist:', error);
    return false;
  }
}

// Run initialization
initMCPIntegration()
  .then(() => {
    console.log('MCP client integration initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('MCP client integration initialization failed:', error);
    process.exit(1);
  });