#!/usr/bin/env tsx

/**
 * Migration script to add institution_configurations table to all tenant databases
 * This ensures pure tenant database isolation for institution configuration
 */

import { Pool } from 'pg';
import { config } from '../server/config/environment';

const TENANT_DATABASE_CONFIGS = {
  'admin': process.env.ADMIN_DATABASE_URL || config.DATABASE_URL,
  'moravian': process.env.MORAVIAN_DATABASE_URL || config.DATABASE_URL,
  'test': process.env.TEST_DATABASE_URL || config.DATABASE_URL,
  'staging': process.env.STAGING_DATABASE_URL || config.DATABASE_URL,
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS institution_configurations (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  primary_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  hide_non_applicable BOOLEAN NOT NULL DEFAULT true,
  allow_users_to_toggle BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tenant_config UNIQUE (tenant_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_institution_configurations_tenant_id 
ON institution_configurations(tenant_id);
`;

async function migrateDatabase(tenantId: string, databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neondb') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log(`\n🔄 Migrating database for tenant: ${tenantId}`);
    console.log(`📍 Database: ${databaseUrl.split('/').pop()?.split('?')[0]}`);
    
    // Test connection
    const client = await pool.connect();
    console.log(`✅ Connected to ${tenantId} database`);
    
    // Run migration
    await client.query(CREATE_TABLE_SQL);
    console.log(`✅ Created institution_configurations table for ${tenantId}`);
    
    // Check if table exists and show structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'institution_configurations'
      ORDER BY ordinal_position;
    `);
    
    console.log(`📋 Table structure for ${tenantId}:`);
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    client.release();
    
  } catch (error) {
    console.error(`❌ Error migrating ${tenantId} database:`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('🚀 Starting Institution Configuration Migration');
  console.log('📦 Adding institution_configurations table to all tenant databases');
  console.log('🎯 Ensuring pure tenant database isolation\n');
  
  const tenantIds = Object.keys(TENANT_DATABASE_CONFIGS);
  console.log(`🏢 Found ${tenantIds.length} tenant databases to migrate:`);
  tenantIds.forEach(id => console.log(`   - ${id}`));
  
  for (const [tenantId, databaseUrl] of Object.entries(TENANT_DATABASE_CONFIGS)) {
    try {
      await migrateDatabase(tenantId, databaseUrl);
    } catch (error) {
      console.error(`❌ Failed to migrate ${tenantId}:`, error);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 Migration completed successfully!');
  console.log('✅ All tenant databases now have institution_configurations table');
  console.log('🔒 Pure tenant database isolation is now enforced');
}

// Run the migration if this file is executed directly
main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

export { main as migrateInstitutionConfig }; 