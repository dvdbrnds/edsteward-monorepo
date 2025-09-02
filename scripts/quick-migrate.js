#!/usr/bin/env node

/**
 * Quick CSV to Database Migration Script
 * Simplified version for immediate execution
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

// Database configuration
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'app_user',
  password: process.env.PG_PASSWORD || 'app_password',
  database: process.env.PG_DATABASE || 'regulations'
};

const pool = new pg.Pool(pgConfig);

/**
 * Generate regulation slug from statute name
 */
function generateRegulationSlug(statuteName) {
  if (!statuteName) return 'unknown-regulation';
  
  return statuteName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Main migration function
 */
async function migrateCSVToDatabase() {
  console.log('🚀 Starting Quick CSV to Database Migration...');
  
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Set tenant context
    await client.query("SET app.tenant_id = 'default'");
    
    // Read CSV file
    const csvPath = path.resolve(process.cwd(), 'compmat.csv');
    console.log(`📖 Reading CSV file: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`📊 Found ${records.length} records in CSV`);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
      try {
        // Skip records without statute name
        if (!record['Statute Name'] || record['Statute Name'].trim() === '') {
          skippedCount++;
          continue;
        }
        
        // Get or create topic
        const topicName = record['Topic'] || 'General Compliance';
        
        const topicResult = await client.query(`
          INSERT INTO topics (tenant_id, topic_name, topic_category, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tenant_id, topic_name) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, ['default', topicName, 'general', `${topicName} compliance requirements`]);
        
        const topicId = topicResult.rows[0].id;
        
        // Generate regulation data
        const regulationSlug = generateRegulationSlug(record['Statute Name']);
        
        // Insert or update regulation
        await client.query(`
          INSERT INTO regulations (
            tenant_id, regulation_id, name, description, item_id,
            topic_id, statute_name, statute_1, regulation_1,
            statutory_summary, reporting_requirements, deadlines,
            additional_resources_1, regulation_slug, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )
          ON CONFLICT (tenant_id, regulation_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
        `, [
          'default', // tenant_id
          regulationSlug, // regulation_id (using slug as ID)
          record['Statute Name'] || 'Unknown Regulation', // name
          record['Statutory Summary'] || 'No description available', // description
          parseInt(record['Item ID']) || null, // item_id
          topicId, // topic_id
          record['Statute Name'] || '', // statute_name
          record['Statute 1'] || '', // statute_1
          record['Regulation 1'] || '', // regulation_1
          record['Statutory Summary'] || '', // statutory_summary
          record['Reporting Requirements'] || '', // reporting_requirements
          record['Deadlines'] || '', // deadlines
          record['Additional Resources 1'] || '', // additional_resources_1
          regulationSlug, // regulation_slug
          true // is_active
        ]);
        
        processedCount++;
        
        if (processedCount % 50 === 0) {
          console.log(`📈 Processed ${processedCount} regulations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing record ${record['Item ID']}: ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Processed: ${processedCount} regulations`);
    console.log(`⏭️  Skipped: ${skippedCount} records`);
    
    // Verify migration
    const countResult = await client.query(`
      SELECT COUNT(*) as total_regulations,
             COUNT(DISTINCT topic_id) as total_topics
      FROM regulations 
      WHERE tenant_id = 'default' AND is_active = true
    `);
    
    const stats = countResult.rows[0];
    console.log(`🎯 Database now contains:`);
    console.log(`   - ${stats.total_regulations} active regulations`);
    console.log(`   - ${stats.total_topics} topics`);
    
    client.release();
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateCSVToDatabase()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
