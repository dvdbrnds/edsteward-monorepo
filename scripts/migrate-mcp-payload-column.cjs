#!/usr/bin/env node
/**
 * Migration: Add mcp_payload JSONB column to regulation_updates table
 * 
 * Stores the complete MCP Engine JSON payload for CCO review.
 * Also adds pending_tasks JSONB if not present (was added ad-hoc before).
 * 
 * Safe to run multiple times.
 */

const { Pool } = require('pg');
require('dotenv').config();

const TENANT_ENV_VARS = [
  'DATABASE_URL',
  'MORAVIAN_DATABASE_URL',
  'STAGING_DATABASE_URL',
  'DEV_DATABASE_URL',
  'WOSSAMOTTA_DATABASE_URL',
  'TEMPLATE_DATABASE_URL',
];

async function migrateDatabase(connectionString, label) {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔌 Migrating: ${label}`);
    console.log(`${'='.repeat(60)}`);

    // Add mcp_payload JSONB column
    await client.query(`
      ALTER TABLE regulation_updates ADD COLUMN IF NOT EXISTS mcp_payload JSONB
    `);
    console.log('   ✅ mcp_payload JSONB column');

    // Add pending_tasks JSONB column (might already exist)
    await client.query(`
      ALTER TABLE regulation_updates ADD COLUMN IF NOT EXISTS pending_tasks JSONB
    `);
    console.log('   ✅ pending_tasks JSONB column');

    // Make original_content and updated_content nullable (MCP Engine doesn't always send them)
    await client.query(`
      ALTER TABLE regulation_updates ALTER COLUMN original_content DROP NOT NULL
    `);
    console.log('   ✅ original_content now nullable');

    await client.query(`
      ALTER TABLE regulation_updates ALTER COLUMN updated_content DROP NOT NULL
    `);
    console.log('   ✅ updated_content now nullable');

    // Verify
    const cols = await client.query(`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'regulation_updates' 
        AND column_name IN ('mcp_payload', 'pending_tasks', 'original_content', 'updated_content')
      ORDER BY column_name
    `);
    console.log(`\n   Verification (${cols.rows.length} columns):`);
    for (const col of cols.rows) {
      console.log(`   ${col.column_name}: nullable=${col.is_nullable}`);
    }

    console.log(`\n✅ Migration complete for: ${label}`);

  } catch (error) {
    console.error(`\n❌ Migration failed for ${label}:`, error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const runAllTenants = process.argv.includes('--all-tenants');

  if (runAllTenants) {
    console.log('🏢 Running mcp_payload migration on ALL tenant databases...\n');

    for (const envVar of TENANT_ENV_VARS) {
      const url = process.env[envVar];
      if (url) {
        await migrateDatabase(url, envVar);
      } else {
        console.log(`⏭️  Skipping ${envVar} (not configured)`);
      }
    }
  } else {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error('❌ DATABASE_URL not set.');
      process.exit(1);
    }
    await migrateDatabase(url, 'DATABASE_URL (default)');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
