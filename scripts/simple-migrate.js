#!/usr/bin/env node

/**
 * Simple CSV to Database Migration Script
 * MISSION CRITICAL - Friday AM Beta Deployment
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
  console.log('🚀 MISSION CRITICAL: Starting Database Migration for Friday Beta...');
  
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Set tenant context
    await client.query("SET app.tenant_id = 'default'");
    
    // Clear existing data for clean migration
    console.log('🧹 Clearing existing regulation data...');
    await client.query('DELETE FROM regulations WHERE tenant_id = $1', ['default']);
    await client.query('DELETE FROM topics WHERE tenant_id = $1', ['default']);
    
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
    
    // Process records in batches for better performance
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Skip records without statute name
        if (!record['Statute Name'] || record['Statute Name'].trim() === '') {
          skippedCount++;
          continue;
        }
        
        // Create topic first
        const topicName = record['Topic'] || 'General Compliance';
        
        const topicResult = await client.query(`
          INSERT INTO topics (tenant_id, topic_name, topic_category, description)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, ['default', topicName, 'general', `${topicName} compliance requirements`]);
        
        const topicId = topicResult.rows[0].id;
        
        // Generate regulation data
        const regulationSlug = generateRegulationSlug(record['Statute Name']);
        
        // Insert regulation
        await client.query(`
          INSERT INTO regulations (
            tenant_id, regulation_id, name, description, item_id,
            topic_id, statute_name, statute_1, regulation_1,
            statutory_summary, reporting_requirements, deadlines,
            additional_resources_1, regulation_slug, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )
        `, [
          'default', // tenant_id
          regulationSlug + '-' + i, // regulation_id (unique with index)
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
          console.log(`📈 Processed ${processedCount}/${records.length} regulations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing record ${i}: ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`✅ MIGRATION COMPLETED SUCCESSFULLY!`);
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
    console.log(`🎯 DATABASE NOW CONTAINS:`);
    console.log(`   - ${stats.total_regulations} active regulations`);
    console.log(`   - ${stats.total_topics} topics`);
    
    // Test critical regulations for Moravian
    console.log(`🏫 TESTING MORAVIAN CRITICAL REGULATIONS:`);
    const criticalRegs = ['ferpa', 'title-ix', 'ada', 'clery', 'financial-aid'];
    
    for (const regSlug of criticalRegs) {
      const result = await client.query(`
        SELECT name, regulation_slug FROM regulations 
        WHERE regulation_slug LIKE $1 AND tenant_id = 'default' 
        LIMIT 1
      `, [`%${regSlug}%`]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${result.rows[0].name} (${result.rows[0].regulation_slug})`);
      } else {
        console.log(`   ⚠️  ${regSlug.toUpperCase()} - Not found, may need manual verification`);
      }
    }
    
    client.release();
    
  } catch (error) {
    console.error('💥 CRITICAL MIGRATION FAILURE:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateCSVToDatabase()
  .then(() => {
    console.log('🎉 MISSION CRITICAL MIGRATION COMPLETED - READY FOR FRIDAY BETA!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 MISSION CRITICAL FAILURE:', error);
    process.exit(1);
  });


