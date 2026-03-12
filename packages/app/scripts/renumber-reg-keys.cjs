#!/usr/bin/env node
/**
 * Renumber reg_key values:
 * - Federal regulations: REG-001, REG-002, ... ordered by risk_score DESC
 * - State regulations:   {STATE}-001, {STATE}-002, ... per state, ordered by risk_score DESC
 *
 * Usage:
 *   node scripts/renumber-reg-keys.cjs                          # uses DATABASE_URL from .env
 *   node scripts/renumber-reg-keys.cjs --db <connection_string>  # explicit DB
 *   node scripts/renumber-reg-keys.cjs --dry-run                 # preview without writing
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbIndex = args.indexOf('--db');
const dbUrl = dbIndex !== -1 ? args[dbIndex + 1] : process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('No database URL. Pass --db <url> or set DATABASE_URL in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

function pad(n) {
  return String(n).padStart(3, '0');
}

async function run() {
  console.log('============================================');
  console.log('EdSteward: Renumber REG-KEY Identifiers');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log('============================================\n');

  const client = await pool.connect();

  try {
    // Load the bulk mapping file as fallback for risk scores
    const bulkMappingPath = path.join(__dirname, '..', 'data', 'edsteward-regkey-bulk-mapping.json');
    let bulkMapping = [];
    if (fs.existsSync(bulkMappingPath)) {
      bulkMapping = JSON.parse(fs.readFileSync(bulkMappingPath, 'utf8'));
      console.log(`Loaded ${bulkMapping.length} entries from bulk mapping for risk score fallback`);
    }
    const bulkByItemId = {};
    for (const m of bulkMapping) {
      if (m.itemId) bulkByItemId[m.itemId] = m;
    }

    const { rows: allRegs } = await client.query(`
      SELECT id, reg_key, item_id, name, risk_score, risk_level,
             jurisdiction_source, state_code
      FROM regulations
      WHERE reg_key IS NOT NULL
      ORDER BY risk_score DESC NULLS LAST, reg_key ASC
    `);

    // Backfill risk scores from the bulk mapping where DB has nulls
    let backfilled = 0;
    for (const r of allRegs) {
      if (r.risk_score == null && r.item_id && bulkByItemId[r.item_id]) {
        const bm = bulkByItemId[r.item_id];
        r.risk_score = bm.riskScore;
        r.risk_level = bm.riskLevel;
        backfilled++;
      }
      // Also backfill jurisdiction/state from bulk mapping if missing
      if (!r.jurisdiction_source && r.item_id && bulkByItemId[r.item_id]) {
        r.jurisdiction_source = bulkByItemId[r.item_id].jurisdictionSource;
        r.state_code = bulkByItemId[r.item_id].stateCode;
      }
    }
    if (backfilled > 0) {
      console.log(`Backfilled risk scores from bulk mapping for ${backfilled} regulations`);
    }

    // Re-sort after backfilling
    allRegs.sort((a, b) => {
      const aScore = a.risk_score ?? 0;
      const bScore = b.risk_score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return (a.reg_key || '').localeCompare(b.reg_key || '');
    });

    // Exclude test/debug regulations
    const realRegs = allRegs.filter(r => {
      if (!r.reg_key) return false;
      if (r.reg_key.startsWith('test-')) return false;
      if ((r.name || '').toLowerCase().includes('schema test')) return false;
      return true;
    });
    const excluded = allRegs.length - realRegs.length;
    if (excluded > 0) {
      console.log(`Excluded ${excluded} test/debug regulations`);
    }
    console.log(`Processing ${realRegs.length} real regulations\n`);

    const federal = [];
    const stateByCode = {};

    for (const r of realRegs) {
      if (r.jurisdiction_source === 'state' && r.state_code) {
        const code = r.state_code.toUpperCase();
        if (!stateByCode[code]) stateByCode[code] = [];
        stateByCode[code].push(r);
      } else {
        federal.push(r);
      }
    }

    const stateCodes = Object.keys(stateByCode).sort();
    console.log(`Federal regulations: ${federal.length}`);
    for (const code of stateCodes) {
      console.log(`${code} state regulations: ${stateByCode[code].length}`);
    }
    console.log('');

    const migrationMap = [];

    // Assign federal keys
    federal.forEach((r, i) => {
      const newKey = `REG-${pad(i + 1)}`;
      migrationMap.push({
        id: r.id,
        oldKey: r.reg_key,
        newKey,
        name: r.name,
        riskScore: r.risk_score,
        riskLevel: r.risk_level,
        jurisdictionSource: r.jurisdiction_source || 'federal',
        stateCode: null,
      });
    });

    // Assign state keys per state
    for (const code of stateCodes) {
      const regs = stateByCode[code];
      regs.forEach((r, i) => {
        const newKey = `${code}-${pad(i + 1)}`;
        migrationMap.push({
          id: r.id,
          oldKey: r.reg_key,
          newKey,
          name: r.name,
          riskScore: r.risk_score,
          riskLevel: r.risk_level,
          jurisdictionSource: 'state',
          stateCode: code,
        });
      });
    }

    // Report changes
    const changed = migrationMap.filter(m => m.oldKey !== m.newKey);
    const unchanged = migrationMap.filter(m => m.oldKey === m.newKey);
    console.log(`Keys unchanged: ${unchanged.length}`);
    console.log(`Keys changing:  ${changed.length}\n`);

    console.log('--- Sample changes ---');
    changed.slice(0, 20).forEach(m => {
      console.log(`  ${m.oldKey} → ${m.newKey}  (${m.name.substring(0, 50)})`);
    });
    if (changed.length > 20) console.log(`  ... and ${changed.length - 20} more\n`);

    // Write the migration map JSON
    const mapPath = path.join(__dirname, '..', 'data', 'reg-key-migration-map.json');
    fs.writeFileSync(mapPath, JSON.stringify(migrationMap, null, 2));
    console.log(`\nMigration map written to ${mapPath}`);

    if (dryRun) {
      console.log('\nDRY RUN complete — no database changes made.');
      return;
    }

    // Apply in a transaction. Use a temp column to avoid unique constraint conflicts
    // during the rename (since two rows might swap keys).
    console.log('\nApplying changes to database...');
    await client.query('BEGIN');

    try {
      // Temporarily drop the unique constraint / index on reg_key
      await client.query(`
        ALTER TABLE regulations DROP CONSTRAINT IF EXISTS regulations_reg_key_unique;
      `);
      await client.query(`
        DROP INDEX IF EXISTS idx_regulations_reg_key;
      `);

      // Clear all reg_key values first to avoid unique conflicts during reassignment.
      // Test/debug regs get their keys permanently cleared.
      await client.query(`UPDATE regulations SET reg_key = NULL WHERE reg_key IS NOT NULL`);

      // Apply new keys and backfill risk scores
      let applied = 0;
      for (const m of migrationMap) {
        await client.query(
          `UPDATE regulations SET reg_key = $1, risk_score = COALESCE(risk_score, $3), risk_level = COALESCE(risk_level, $4) WHERE id = $2`,
          [m.newKey, m.id, m.riskScore, m.riskLevel]
        );
        applied++;
      }

      // Restore the unique constraint and index
      await client.query(`
        ALTER TABLE regulations ADD CONSTRAINT regulations_reg_key_unique UNIQUE (reg_key);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_regulations_reg_key ON regulations(reg_key);
      `);

      await client.query('COMMIT');
      console.log(`\n✅ Updated ${applied} regulations successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Verification
    console.log('\n--- Verification ---');
    const { rows: verify } = await client.query(`
      SELECT reg_key, risk_score, risk_level, name, jurisdiction_source, state_code
      FROM regulations
      WHERE reg_key IS NOT NULL
      ORDER BY
        CASE WHEN reg_key LIKE 'REG-%' THEN 0 ELSE 1 END,
        reg_key
      LIMIT 10
    `);
    verify.forEach(r => {
      console.log(`  ${r.reg_key} (score ${r.risk_score}) ${r.name.substring(0, 50)}`);
    });

    // Show state keys
    for (const code of stateCodes) {
      const { rows: stateRows } = await client.query(`
        SELECT reg_key, risk_score, name
        FROM regulations
        WHERE reg_key LIKE $1
        ORDER BY reg_key
      `, [`${code}-%`]);
      console.log(`\n${code} regulations (${stateRows.length}):`);
      stateRows.forEach(r => {
        console.log(`  ${r.reg_key} (score ${r.risk_score}) ${r.name.substring(0, 50)}`);
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
