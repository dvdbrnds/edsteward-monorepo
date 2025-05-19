/**
 * Script to create the regulation_updates table if it doesn't exist
 * This is needed for the differential view feature to work
 */

import { db, pool } from './server/db.js';

async function createUpdatesTable() {
  try {
    // Check if table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'regulation_updates'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (tableExists) {
      console.log('regulation_updates table already exists');
      return;
    }
    
    console.log('Creating regulation_updates table...');
    
    // Create the table
    await pool.query(`
      CREATE TABLE regulation_updates (
        id SERIAL PRIMARY KEY,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
        original_content TEXT NOT NULL,
        updated_content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        summary TEXT,
        reason TEXT,
        rejection_reason TEXT,
        deferral_reason TEXT,
        reviewer_id INTEGER,
        reviewed_at TIMESTAMP,
        signature_data TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Successfully created regulation_updates table');
    
  } catch (error) {
    console.error('Error creating updates table:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

createUpdatesTable();