#!/usr/bin/env node

/**
 * Federal Register Metadata Migration Script
 * Adds metadata column to regulation_updates table for enhanced Federal Register integration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neondb') ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  console.log('🚀 Starting Federal Register Metadata Migration');
  console.log('==============================================');
  
  const client = await pool.connect();
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check current schema
    console.log('\n🔍 Checking current regulation_updates table structure...');
    const currentSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'regulation_updates'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current columns:');
    currentSchema.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if metadata column already exists
    const hasMetadata = currentSchema.rows.some(row => row.column_name === 'metadata');
    
    if (hasMetadata) {
      console.log('\n⚠️ Metadata column already exists! Skipping migration.');
      console.log('✅ Federal Register integration is already ready.');
      return;
    }
    
    // Read migration SQL
    console.log('\n📄 Reading migration SQL...');
    const migrationPath = path.join(__dirname, 'migrations', 'add-federal-register-metadata.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('🔧 Executing Federal Register metadata migration...');
    await client.query('BEGIN');
    
    try {
      // Split SQL by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`   Executing: ${statement.substring(0, 50)}...`);
          await client.query(statement);
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Migration executed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify migration
    console.log('\n🔍 Verifying migration results...');
    const updatedSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'regulation_updates'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Updated table structure:');
    updatedSchema.rows.forEach(row => {
      const isNew = row.column_name === 'metadata';
      const prefix = isNew ? '🆕' : '  ';
      console.log(`${prefix} ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check indexes
    console.log('\n🔍 Checking created indexes...');
    const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'regulation_updates' 
      AND indexname LIKE '%metadata%';
    `);
    
    console.log('📋 Federal Register indexes:');
    indexes.rows.forEach(row => {
      console.log(`   ${row.indexname}: ${row.indexdef}`);
    });
    
    // Test metadata functionality
    console.log('\n🧪 Testing metadata functionality...');
    const testMetadata = {
      federal_register_enhancement: {
        attempted: true,
        successful: true,
        contexts_found: 2,
        total_documents_referenced: 25
      },
      processing_metadata: {
        processed_at: new Date().toISOString(),
        enhancement_attempted: true,
        enhancement_successful: true
      },
      source_attribution: "MCP Engine + Federal Register (Test)"
    };
    
    // Insert test record (will be cleaned up)
    const testResult = await client.query(`
      INSERT INTO regulation_updates (
        regulation_id, name, original_content, updated_content, metadata
      ) VALUES (
        1, 'Federal Register Migration Test', 'Test content', 'Test content', $1
      ) RETURNING id, metadata;
    `, [JSON.stringify(testMetadata)]);
    
    console.log('✅ Test metadata insert successful');
    console.log('📊 Test record ID:', testResult.rows[0].id);
    console.log('📊 Stored metadata keys:', Object.keys(testResult.rows[0].metadata));
    
    // Clean up test record
    await client.query('DELETE FROM regulation_updates WHERE name = $1', ['Federal Register Migration Test']);
    console.log('🧹 Test record cleaned up');
    
    console.log('\n🎉 Federal Register Migration Complete!');
    console.log('=====================================');
    console.log('✅ Metadata column added successfully');
    console.log('✅ GIN indexes created for efficient querying');
    console.log('✅ Federal Register enhancement support enabled');
    console.log('✅ EdSteward ready for 10x richer regulation packages');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Run: node test-federal-register-integration.cjs');
    console.log('2. Test enhanced MCP Engine endpoints');
    console.log('3. Verify Federal Register data processing');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check database connection');
    console.log('2. Verify migration SQL syntax');
    console.log('3. Ensure proper permissions');
    console.log('4. Check for existing metadata column');
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };











