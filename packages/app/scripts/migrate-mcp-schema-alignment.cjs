#!/usr/bin/env node
/**
 * Migration: MCP Engine Schema Alignment (Feb 2026)
 * 
 * Adds new columns to support the expanded 48-field regulation payloads,
 * 21-field compliance tasks, and 22-field executive orders from MCP Engine.
 * 
 * Tables affected:
 *   - regulations: publicLaw, purpose, scope, reportingRequirements, riskAssessment
 *   - compliance_tasks: estimatedEffort, deliverable, deliverableTemplateUrl
 *   - eo_regulation_impacts: affectedSections
 * 
 * Usage:
 *   node scripts/migrate-mcp-schema-alignment.cjs                    # Run on DATABASE_URL (default/dev)
 *   node scripts/migrate-mcp-schema-alignment.cjs --all-tenants      # Run on ALL tenant databases
 *   DATABASE_URL=<url> node scripts/migrate-mcp-schema-alignment.cjs # Run on specific database
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

    // ──────────────────────────────────────────
    // 1. REGULATIONS TABLE — 5 new columns
    // ──────────────────────────────────────────
    console.log('\n📋 regulations table:');

    const regColumns = [
      { name: 'public_law', type: 'TEXT', comment: 'e.g. "Public Law 101-542"' },
      { name: 'purpose', type: 'TEXT', comment: 'Regulation purpose statement' },
      { name: 'scope', type: 'TEXT', comment: 'Regulation scope description' },
      { name: 'reporting_requirements', type: 'JSONB', comment: 'Structured reporting requirements' },
      { name: 'risk_assessment', type: 'JSONB', comment: 'Full risk assessment object from MCP' },
    ];

    for (const col of regColumns) {
      try {
        await client.query(`
          ALTER TABLE regulations ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`   ✅ ${col.name} (${col.type}) — ${col.comment}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`   ⏭️  ${col.name} already exists`);
        } else {
          console.error(`   ❌ ${col.name}: ${err.message}`);
        }
      }
    }

    // ──────────────────────────────────────────
    // 2. COMPLIANCE_TASKS TABLE — 3 new columns
    // ──────────────────────────────────────────
    console.log('\n📋 compliance_tasks table:');

    const taskColumns = [
      { name: 'estimated_effort', type: 'TEXT', comment: 'e.g. "2-4 hours", "1 week"' },
      { name: 'deliverable', type: 'TEXT', comment: 'Expected output description' },
      { name: 'deliverable_template_url', type: 'TEXT', comment: 'Link to template document' },
    ];

    for (const col of taskColumns) {
      try {
        await client.query(`
          ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`   ✅ ${col.name} (${col.type}) — ${col.comment}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`   ⏭️  ${col.name} already exists`);
        } else {
          console.error(`   ❌ ${col.name}: ${err.message}`);
        }
      }
    }

    // ──────────────────────────────────────────
    // 3. EO_REGULATION_IMPACTS TABLE — 1 new column
    // ──────────────────────────────────────────
    console.log('\n📋 eo_regulation_impacts table:');

    try {
      await client.query(`
        ALTER TABLE eo_regulation_impacts ADD COLUMN IF NOT EXISTS affected_sections JSONB
      `);
      console.log(`   ✅ affected_sections (JSONB) — Which regulation sections are affected`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`   ⏭️  affected_sections already exists`);
      } else {
        console.error(`   ❌ affected_sections: ${err.message}`);
      }
    }

    // ──────────────────────────────────────────
    // 4. VERIFY
    // ──────────────────────────────────────────
    console.log('\n🔍 Verifying...');

    const verify = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE (table_name = 'regulations' AND column_name IN ('public_law', 'purpose', 'scope', 'reporting_requirements', 'risk_assessment'))
         OR (table_name = 'compliance_tasks' AND column_name IN ('estimated_effort', 'deliverable', 'deliverable_template_url'))
         OR (table_name = 'eo_regulation_impacts' AND column_name IN ('affected_sections'))
      ORDER BY table_name, column_name
    `);

    const expected = 9; // 5 + 3 + 1
    if (verify.rows.length === expected) {
      console.log(`   ✅ All ${expected} new columns verified`);
    } else {
      console.log(`   ⚠️  Found ${verify.rows.length}/${expected} columns:`);
      for (const row of verify.rows) {
        console.log(`      ${row.table_name}.${row.column_name} (${row.data_type})`);
      }
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
    console.log('🏢 Running migration on ALL tenant databases...\n');

    for (const envVar of TENANT_ENV_VARS) {
      const url = process.env[envVar];
      if (url) {
        await migrateDatabase(url, envVar);
      } else {
        console.log(`⏭️  Skipping ${envVar} (not configured)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 All tenant migrations complete');
    console.log('='.repeat(60));

  } else {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error('❌ DATABASE_URL not set. Run with --all-tenants or set DATABASE_URL.');
      process.exit(1);
    }
    await migrateDatabase(url, 'DATABASE_URL (default)');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
