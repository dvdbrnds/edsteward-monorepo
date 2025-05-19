/**
 * Script to create a test regulation update in the database
 * This will help demonstrate the differential view feature
 */

import fs from 'fs';
import { db, pool } from './db';
import { sql } from 'drizzle-orm';

async function createRegulationUpdateTable() {
  try {
    console.log('Checking if regulation_updates table exists...');
    
    // Check if table exists
    const checkTableSql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'regulation_updates'
      );
    `;
    
    const tableExists = await pool.query(checkTableSql)
      .then(result => result.rows[0].exists)
      .catch(err => {
        console.error('Error checking table existence:', err);
        return false;
      });
    
    if (tableExists) {
      console.log('regulation_updates table already exists');
    } else {
      console.log('Creating regulation_updates table...');
      
      // Create the table
      const createTableSql = `
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
      `;
      
      await pool.query(createTableSql);
      console.log('Successfully created regulation_updates table');
    }
    
    return true;
  } catch (error) {
    console.error('Error setting up regulation updates table:', error);
    return false;
  }
}

async function createTestUpdate() {
  try {
    // First make sure the table exists
    const tableCreated = await createRegulationUpdateTable();
    if (!tableCreated) {
      console.error('Failed to create or verify regulation_updates table');
      return;
    }
    
    // Read the test regulation files
    const originalContent = fs.readFileSync('./test_regulation_original.txt', 'utf8');
    const updatedContent = fs.readFileSync('./test_regulation_updated.txt', 'utf8');
    
    // Get a random existing regulation to use as the base
    const result = await pool.query(`
      SELECT id, name, content 
      FROM regulations 
      WHERE content IS NOT NULL 
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.error('No regulations found in the database');
      return;
    }
    
    const regulation = result.rows[0];
    console.log(`Using regulation as base: ${regulation.id} - ${regulation.name}`);
    
    // Create a regulation update record
    const updateResult = await pool.query(`
      INSERT INTO regulation_updates (
        regulation_id,
        original_content,
        updated_content,
        status,
        summary,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, 'pending', 'Title IX compliance updates for 2023 amendments', NOW(), NOW()
      ) RETURNING id
    `, [regulation.id, originalContent, updatedContent]);
    
    if (updateResult.rows.length === 0) {
      console.error('Failed to create regulation update');
      return;
    }
    
    const updateId = updateResult.rows[0].id;
    console.log(`Successfully created regulation update with ID: ${updateId}`);
    console.log(`\nTo view the differential view, go to: http://localhost:5000/regulation-updates/${updateId}`);
    console.log(`To see all pending updates, go to: http://localhost:5000/regulation-updates`);
    
  } catch (error) {
    console.error('Error creating test update:', error);
  }
}

// Run the function immediately
createTestUpdate()
  .then(() => console.log('Done'))
  .catch(err => console.error('Error executing script:', err))
  .finally(() => {
    // Close the pool
    pool.end().catch(err => console.error('Error closing pool:', err));
  });

export { createTestUpdate, createRegulationUpdateTable };