/**
 * Script to create a test regulation update in the database
 * 
 * This creates an update record for an existing regulation to allow testing
 * of the differential view feature
 */

import { pool } from './server/db.js';
import fs from 'fs';

async function createTestUpdate() {
  try {
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
  } finally {
    // Close the database connection
    await pool.end();
  }
}

createTestUpdate();