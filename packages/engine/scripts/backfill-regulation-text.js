#!/usr/bin/env node
/**
 * Backfill regulation_text in the engine DB from enhanced-regulations/*.json fullText.
 * Also syncs to the app Neon DB.
 *
 * Usage:
 *   node scripts/backfill-regulation-text.js                # Engine only
 *   node scripts/backfill-regulation-text.js --sync-app     # Engine + App
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const enginePool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mcp_engine' });

const syncApp = process.argv.includes('--sync-app');

function slugify(name) {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const enhancedDir = path.join(__dirname, '..', 'enhanced-regulations');
  const files = fs.readdirSync(enhancedDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} enhanced regulation files`);

  const regs = await enginePool.query(
    'SELECT id, reg_key, name FROM regulations WHERE is_current = true ORDER BY reg_key'
  );
  console.log(`Found ${regs.rows.length} regulations in engine DB\n`);

  // Build multiple lookup maps for matching
  const bySlug = new Map();
  const byNormalized = new Map();
  for (const r of regs.rows) {
    bySlug.set(slugify(r.name), r);
    byNormalized.set(normalizeForMatch(r.name), r);
  }

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(enhancedDir, file), 'utf-8'));
    const fullText = data.enhanced?.fullText;
    if (!fullText) {
      skipped++;
      continue;
    }

    const fileSlug = data.regulationId;

    // Try matching strategies in order of specificity
    let reg = bySlug.get(fileSlug);

    if (!reg) {
      // Try normalized name match using file slug
      const normalizedSlug = normalizeForMatch(fileSlug);
      for (const [normName, r] of byNormalized) {
        if (normName === normalizedSlug || normName.includes(normalizedSlug) || normalizedSlug.includes(normName)) {
          reg = r;
          break;
        }
      }
    }

    if (!reg) {
      // Try matching by first 15 alphanumeric chars
      const prefix = normalizeForMatch(fileSlug).substring(0, 15);
      for (const [normName, r] of byNormalized) {
        if (normName.startsWith(prefix)) {
          reg = r;
          break;
        }
      }
    }

    if (!reg) {
      unmatched++;
      console.log(`  ⚠️  No match for: ${fileSlug}`);
      continue;
    }

    await enginePool.query(
      'UPDATE regulations SET regulation_text = $1 WHERE id = $2',
      [fullText, reg.id]
    );
    updated++;
  }

  console.log(`\nEngine backfill: ${updated} updated, ${skipped} skipped (no fullText), ${unmatched} unmatched`);

  // Verify
  const stats = await enginePool.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE LENGTH(regulation_text) > 500) as has_rich_text,
      avg(LENGTH(regulation_text))::int as avg_len
    FROM regulations WHERE is_current = true
  `);
  console.log('Engine text stats:', JSON.stringify(stats.rows[0]));

  if (syncApp) {
    console.log('\n--- Syncing to App DB ---');
    const appConnStr = process.env.APP_DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const appPool = new Pool({ connectionString: appConnStr });

    const engineRegs = await enginePool.query(`
      SELECT reg_key, regulation_text
      FROM regulations
      WHERE is_current = true AND regulation_text IS NOT NULL AND LENGTH(regulation_text) > 100
    `);

    let appUpdated = 0;
    for (const r of engineRegs.rows) {
      const result = await appPool.query(
        'UPDATE regulations SET regulation_text = $1 WHERE reg_key = $2',
        [r.regulation_text, r.reg_key]
      );
      appUpdated += result.rowCount;
    }
    console.log(`App sync: ${appUpdated} regulations updated`);

    const appStats = await appPool.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE regulation_text IS NOT NULL AND regulation_text != '') as has_text
      FROM regulations
    `);
    console.log('App text coverage:', JSON.stringify(appStats.rows[0]));

    await appPool.end();
  }

  await enginePool.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  enginePool.end();
  process.exit(1);
});
