#!/usr/bin/env node
/**
 * Migration: Add ON DELETE CASCADE to task-dependent FK constraints
 * 
 * Fixes: "update or delete on table compliance_tasks violates foreign key constraint
 *         task_attestation_tokens_task_id_fkey on table task_attestation_tokens"
 * 
 * Tables affected:
 *   - task_attestation_tokens.task_id → compliance_tasks.id
 *   - task_evidence.task_id → compliance_tasks.id
 *   - task_activity.task_id → compliance_tasks.id
 * 
 * Safe to run multiple times.
 * 
 * Usage:
 *   node scripts/migrate-task-fk-cascade.cjs                 # Run on DATABASE_URL only
 *   node scripts/migrate-task-fk-cascade.cjs --all-tenants   # Run on ALL tenants
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

// FK constraints to update: [table, column, referenced_table, constraint_name_pattern]
const FK_UPDATES = [
  {
    table: 'task_attestation_tokens',
    column: 'task_id',
    refTable: 'compliance_tasks',
    refColumn: 'id',
  },
  {
    table: 'task_evidence',
    column: 'task_id',
    refTable: 'compliance_tasks',
    refColumn: 'id',
  },
  {
    table: 'task_activity',
    column: 'task_id',
    refTable: 'compliance_tasks',
    refColumn: 'id',
  },
];

async function migrateDatabase(connectionString, label) {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔌 Migrating FK cascades: ${label}`);
    console.log(`${'='.repeat(60)}`);

    for (const fk of FK_UPDATES) {
      // Check if the table exists
      const tableCheck = await client.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [fk.table]);

      if (tableCheck.rows.length === 0) {
        console.log(`   ⏭️  ${fk.table} — table doesn't exist, skipping`);
        continue;
      }

      // Find the existing FK constraint name
      const fkResult = await client.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
      `, [fk.table, fk.column]);

      if (fkResult.rows.length === 0) {
        console.log(`   ⏭️  ${fk.table}.${fk.column} — no FK constraint found, skipping`);
        continue;
      }

      const constraintName = fkResult.rows[0].constraint_name;

      // Check if it already has CASCADE
      const cascadeCheck = await client.query(`
        SELECT rc.delete_rule
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_name = $1
      `, [constraintName]);

      if (cascadeCheck.rows.length > 0 && cascadeCheck.rows[0].delete_rule === 'CASCADE') {
        console.log(`   ✅ ${fk.table}.${fk.column} — already CASCADE`);
        continue;
      }

      // Drop and recreate with CASCADE
      await client.query(`
        ALTER TABLE ${fk.table} 
        DROP CONSTRAINT ${constraintName}
      `);
      await client.query(`
        ALTER TABLE ${fk.table} 
        ADD CONSTRAINT ${constraintName} 
        FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn}) ON DELETE CASCADE
      `);
      console.log(`   ✅ ${fk.table}.${fk.column} — updated to ON DELETE CASCADE (was ${cascadeCheck.rows[0]?.delete_rule || 'NO ACTION'})`);
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
    console.log('🏢 Running FK cascade migration on ALL tenant databases...\n');

    for (const envVar of TENANT_ENV_VARS) {
      const url = process.env[envVar];
      if (url) {
        await migrateDatabase(url, envVar);
      } else {
        console.log(`⏭️  Skipping ${envVar} (not configured)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 All tenant FK cascade migrations complete');
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
