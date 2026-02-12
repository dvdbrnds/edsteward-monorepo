#!/usr/bin/env node
/**
 * Migration: Executive Orders Tables — All Tenants
 * 
 * Creates executive_orders, eo_regulation_impacts, and eo_status_history
 * tables on tenant databases that don't have them yet. Also applies:
 *   - eo_number expanded to VARCHAR(50) (was VARCHAR(20))
 *   - affected_sections JSONB column on eo_regulation_impacts
 * 
 * Safe to run multiple times — uses IF NOT EXISTS / IF NOT EXISTS.
 * 
 * Usage:
 *   node scripts/migrate-eo-tables-all-tenants.cjs                 # Run on DATABASE_URL only
 *   node scripts/migrate-eo-tables-all-tenants.cjs --all-tenants   # Run on ALL tenants
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
    console.log(`🔌 Migrating EO tables: ${label}`);
    console.log(`${'='.repeat(60)}`);

    // ──────────────────────────────────────────
    // 1. Create executive_orders table
    // ──────────────────────────────────────────
    console.log('\n📋 executive_orders table:');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS executive_orders (
        id SERIAL PRIMARY KEY,
        eo_number VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        signed_date DATE NOT NULL,
        published_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        president VARCHAR(100),
        term VARCHAR(20),
        summary TEXT,
        full_text_url VARCHAR(500),
        pdf_url VARCHAR(500),
        federal_register_citation VARCHAR(100),
        topics TEXT[],
        enjoined_date DATE,
        enjoined_by VARCHAR(255),
        revoked_date DATE,
        revoked_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Table created/exists');

    // Expand eo_number if it's still VARCHAR(20)
    try {
      await client.query(`ALTER TABLE executive_orders ALTER COLUMN eo_number TYPE VARCHAR(50)`);
      console.log('   ✅ eo_number expanded to VARCHAR(50)');
    } catch (err) {
      if (!err.message.includes('already')) {
        console.log(`   ⏭️  eo_number: ${err.message}`);
      }
    }

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS eo_status_idx ON executive_orders(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS eo_signed_date_idx ON executive_orders(signed_date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS eo_president_idx ON executive_orders(president)`);
    console.log('   ✅ Indexes created');

    // ──────────────────────────────────────────
    // 2. Create eo_regulation_impacts table
    // ──────────────────────────────────────────
    console.log('\n📋 eo_regulation_impacts table:');

    await client.query(`
      CREATE TABLE IF NOT EXISTS eo_regulation_impacts (
        id SERIAL PRIMARY KEY,
        eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
        regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
        impact_type VARCHAR(20) NOT NULL,
        impact_severity VARCHAR(20) NOT NULL,
        impact_summary TEXT,
        affected_sections JSONB,
        assessed_by VARCHAR(100),
        assessment_date DATE,
        confidence_score DECIMAL(3,2),
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id),
        review_notes TEXT,
        review_status VARCHAR(20) DEFAULT 'pending',
        generated_task_id INTEGER REFERENCES compliance_tasks(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(eo_id, regulation_id)
      )
    `);
    console.log('   ✅ Table created/exists');

    // Add affected_sections if missing (for DBs that had the table without it)
    try {
      await client.query(`
        ALTER TABLE eo_regulation_impacts ADD COLUMN IF NOT EXISTS affected_sections JSONB
      `);
      console.log('   ✅ affected_sections column present');
    } catch (err) {
      console.log(`   ⏭️  affected_sections: ${err.message}`);
    }

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eori_regulation ON eo_regulation_impacts(regulation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eori_severity ON eo_regulation_impacts(impact_severity)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eori_review_status ON eo_regulation_impacts(review_status)`);
    console.log('   ✅ Indexes created');

    // ──────────────────────────────────────────
    // 3. Create eo_status_history table
    // ──────────────────────────────────────────
    console.log('\n📋 eo_status_history table:');

    await client.query(`
      CREATE TABLE IF NOT EXISTS eo_status_history (
        id SERIAL PRIMARY KEY,
        eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
        previous_status VARCHAR(20),
        new_status VARCHAR(20) NOT NULL,
        change_date DATE NOT NULL,
        change_reason TEXT,
        source_url VARCHAR(500),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Table created/exists');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_eo_history_eo ON eo_status_history(eo_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eo_history_date ON eo_status_history(change_date DESC)`);
    console.log('   ✅ Indexes created');

    // ──────────────────────────────────────────
    // 4. Verify
    // ──────────────────────────────────────────
    console.log('\n🔍 Verifying...');

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('executive_orders', 'eo_regulation_impacts', 'eo_status_history')
        AND table_schema = 'public'
      ORDER BY table_name
    `);

    const expected = 3;
    if (tables.rows.length === expected) {
      console.log(`   ✅ All ${expected} EO tables verified`);
    } else {
      console.log(`   ⚠️  Found ${tables.rows.length}/${expected} tables:`);
      for (const row of tables.rows) {
        console.log(`      ${row.table_name}`);
      }
    }

    // Check affected_sections column
    const affSec = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'eo_regulation_impacts' AND column_name = 'affected_sections'
    `);
    if (affSec.rows.length > 0) {
      console.log('   ✅ affected_sections column present');
    } else {
      console.log('   ⚠️  affected_sections column missing');
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
    console.log('🏢 Running EO tables migration on ALL tenant databases...\n');

    for (const envVar of TENANT_ENV_VARS) {
      const url = process.env[envVar];
      if (url) {
        await migrateDatabase(url, envVar);
      } else {
        console.log(`⏭️  Skipping ${envVar} (not configured)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 All tenant EO migrations complete');
    console.log('='.repeat(60));

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
