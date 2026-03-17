#!/usr/bin/env node

/**
 * Schema Sync — compares the local/staging DB schema against a target DB
 * and applies additive-only migrations (ADD COLUMN, CREATE TABLE).
 *
 * Usage:
 *   node scripts/sync-schema.js <target-db-url>
 *   node scripts/sync-schema.js --production    (fetches URL from ECS task def)
 *   node scripts/sync-schema.js --dry-run <target-db-url>
 *
 * Called automatically by deploy-staging.sh and deploy-production.sh.
 * Safe to run multiple times — all operations are IF NOT EXISTS.
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const DRIZZLE_TO_PG = {
  'text': 'text',
  'integer': 'integer',
  'serial': 'serial',
  'boolean': 'boolean DEFAULT false',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'jsonb': 'jsonb',
  'json': 'json',
  'date': 'date',
  'character varying': 'varchar',
  'numeric': 'numeric',
  'real': 'real',
  'double precision': 'double precision',
  'bigint': 'bigint',
  'smallint': 'smallint',
};

// Tables that are local-only backups/dev artifacts — skip syncing these
const SKIP_TABLES = new Set([
  'compliance_tasks_backup_pre_alignment',
  'compliance_tasks_pre_cleanup_backup',
  'compliance_tasks_pre_resync_backup',
  'regulations_backup_pre_alignment',
  'regulations_pre_cleanup_backup',
  'regulation_topics_pre_cleanup_backup',
]);

async function getTargetUrl() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filtered = args.filter(a => a !== '--dry-run');

  if (filtered[0] === '--production') {
    const url = execSync(
      "aws ecs describe-task-definition --task-definition edsteward-saml-production " +
      "--query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text",
      { encoding: 'utf8' }
    ).trim();
    return { url, dryRun, label: 'production' };
  }

  if (filtered[0] === '--staging') {
    const url = execSync(
      "aws ecs describe-task-definition --task-definition edsteward-staging-task " +
      "--query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text",
      { encoding: 'utf8' }
    ).trim();
    return { url, dryRun, label: 'staging' };
  }

  if (filtered[0]) {
    return { url: filtered[0], dryRun, label: 'target' };
  }

  console.error('Usage: node scripts/sync-schema.js <target-db-url | --production | --staging> [--dry-run]');
  process.exit(1);
}

async function getColumns(client) {
  const result = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const map = {};
  for (const row of result.rows) {
    if (!map[row.table_name]) map[row.table_name] = {};
    map[row.table_name][row.column_name] = row;
  }
  return map;
}

async function getTables(client) {
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return new Set(result.rows.map(r => r.table_name));
}

function buildColumnDef(col) {
  let type = col.data_type;
  if (type === 'ARRAY') type = col.udt_name.replace(/^_/, '') + '[]';
  if (type === 'USER-DEFINED') type = col.udt_name;

  let def = `${type}`;
  if (col.column_default && !col.column_default.startsWith('nextval')) {
    def += ` DEFAULT ${col.column_default}`;
  }
  if (col.is_nullable === 'NO' && col.column_default) {
    def += ' NOT NULL';
  }
  return def;
}

async function main() {
  const { url: targetUrl, dryRun, label } = await getTargetUrl();

  require('dotenv').config();
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({ connectionString: targetUrl });
  const sc = await sourcePool.connect();
  const tc = await targetPool.connect();

  console.log(`\n🔍 Schema sync: local → ${label}${dryRun ? ' (DRY RUN)' : ''}\n`);

  const sourceTables = await getTables(sc);
  const targetTables = await getTables(tc);
  const sourceColumns = await getColumns(sc);
  const targetColumns = await getColumns(tc);

  const statements = [];

  // 1. Missing tables — get full CREATE TABLE from source
  for (const table of sourceTables) {
    if (targetTables.has(table) || SKIP_TABLES.has(table)) continue;

    const cols = sourceColumns[table];
    if (!cols) continue;

    const colDefs = Object.entries(cols).map(([name, col]) => {
      if (col.column_default && col.column_default.startsWith('nextval')) {
        return `"${name}" serial`;
      }
      let def = `"${name}" ${buildColumnDef(col)}`;
      return def;
    });

    // Find the primary key
    const pkResult = await sc.query(`
      SELECT a.attname FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [table]);
    const pk = pkResult.rows.map(r => r.attname);

    let sql = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${colDefs.join(',\n  ')}`;
    if (pk.length > 0) {
      sql += `,\n  PRIMARY KEY (${pk.map(k => `"${k}"`).join(', ')})`;
    }
    sql += '\n)';

    statements.push({ type: 'CREATE TABLE', table, sql });
  }

  // 2. Missing columns on existing tables
  for (const table of sourceTables) {
    if (!targetTables.has(table) || SKIP_TABLES.has(table)) continue;

    const sCols = sourceColumns[table] || {};
    const tCols = targetColumns[table] || {};

    for (const [colName, col] of Object.entries(sCols)) {
      if (tCols[colName]) continue;

      const colDef = buildColumnDef(col);
      const sql = `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${colName}" ${colDef}`;
      statements.push({ type: 'ADD COLUMN', table, column: colName, sql });
    }
  }

  if (statements.length === 0) {
    console.log('✅ Schema is in sync — no changes needed.\n');
    sc.release(); tc.release();
    await sourcePool.end(); await targetPool.end();
    process.exit(0);
  }

  console.log(`Found ${statements.length} schema difference(s):\n`);
  for (const stmt of statements) {
    if (stmt.type === 'CREATE TABLE') {
      console.log(`  📦 CREATE TABLE ${stmt.table}`);
    } else {
      console.log(`  ➕ ADD COLUMN ${stmt.table}.${stmt.column}`);
    }
  }

  if (dryRun) {
    console.log('\n--- DRY RUN — SQL that would be executed: ---\n');
    for (const stmt of statements) {
      console.log(stmt.sql + ';\n');
    }
    sc.release(); tc.release();
    await sourcePool.end(); await targetPool.end();
    process.exit(0);
  }

  // Apply
  console.log('\nApplying...');
  try {
    await tc.query('BEGIN');
    for (const stmt of statements) {
      try {
        await tc.query(stmt.sql);
        console.log(`  ✅ ${stmt.type} ${stmt.table}${stmt.column ? '.' + stmt.column : ''}`);
      } catch (err) {
        console.error(`  ❌ ${stmt.type} ${stmt.table}${stmt.column ? '.' + stmt.column : ''}: ${err.message}`);
      }
    }
    await tc.query('COMMIT');
    console.log(`\n✅ Applied ${statements.length} schema change(s) to ${label}.\n`);
  } catch (err) {
    await tc.query('ROLLBACK');
    console.error(`\n❌ Schema sync failed, rolled back: ${err.message}\n`);
    process.exit(1);
  }

  sc.release(); tc.release();
  await sourcePool.end(); await targetPool.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
