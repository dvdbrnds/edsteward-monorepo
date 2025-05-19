/**
 * Script to create a test regulation update in the database
 * This will help demonstrate the differential view feature
 */

import { db } from './db';
import fs from 'fs';
import path from 'path';

/**
 * Creates a test regulation update in the database
 */
async function createTestUpdate() {
  try {
    console.log('Creating test regulation update...');
    
    // 1. First, let's find an existing regulation to update
    const result = await db.execute(`
      SELECT id, requirements FROM regulations 
      WHERE category = 'Title IX' OR summary LIKE '%Title IX%' 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('No Title IX regulation found. Creating with a sample regulation');
      // We need to create a sample regulation first
      const sampleRegId = await createSampleRegulation();
      if (!sampleRegId) {
        console.log('Failed to create sample regulation');
        return;
      }
      await createUpdateForRegulation(sampleRegId);
    } else {
      // Use existing regulation
      const regulation = result.rows[0];
      console.log(`Found regulation with ID ${regulation.id}`);
      await createUpdateForRegulation(regulation.id, regulation.requirements);
    }
    
    console.log('Test update created successfully!');
  } catch (error) {
    console.error('Error creating test update:', error);
  }
}

/**
 * Creates a sample regulation if needed
 */
async function createSampleRegulation() {
  try {
    // Read the original content from our test file
    const originalContent = fs.readFileSync(
      path.join(process.cwd(), 'test_regulation_original.txt'), 
      'utf8'
    );
    
    const result = await db.execute(`
      INSERT INTO regulations (
        name, item_id, topic, statute, category, jurisdiction,
        requirements, summary
      ) VALUES (
        'Title IX Educational Amendments of 1972', 
        'REG-TitleIX-2025', 
        'Educational Equity', 
        'Title IX of the Education Amendments of 1972', 
        'Title IX', 
        'federal',
        $1,
        'Prohibits discrimination on the basis of sex in educational programs receiving federal funding'
      ) RETURNING id
    `, [originalContent]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creating sample regulation:', error);
    return null;
  }
}

/**
 * Creates an update for a specific regulation
 */
async function createUpdateForRegulation(regulationId: number, originalContent?: string) {
  try {
    // Read the original and updated content from our test files
    if (!originalContent) {
      originalContent = fs.readFileSync(
        path.join(process.cwd(), 'test_regulation_original.txt'), 
        'utf8'
      );
    }
    
    const updatedContent = fs.readFileSync(
      path.join(process.cwd(), 'test_regulation_updated.txt'), 
      'utf8'
    );
    
    // Insert the regulation update
    await db.execute(
      `INSERT INTO regulation_updates (
        regulation_id, original_content, updated_content, 
        status, summary, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'pending', 
        'Updated Title IX guidelines to reflect 2023 changes', 
        NOW(), NOW()
      )`, 
      [regulationId, originalContent, updatedContent]
    );
    
    console.log(`Created update for regulation ID ${regulationId}`);
  } catch (error) {
    console.error('Error creating update for regulation:', error);
  }
}

// Run the script
createTestUpdate()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });