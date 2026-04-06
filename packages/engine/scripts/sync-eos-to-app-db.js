#!/usr/bin/env node
/**
 * Sync Executive Orders from MCP Engine → App databases
 *
 * Reads EOs and regulation impacts from the Engine's local PostgreSQL
 * and upserts them into the target App database(s).
 *
 * Usage:
 *   node scripts/sync-eos-to-app-db.js                       # Dry run against local dev DB
 *   node scripts/sync-eos-to-app-db.js --apply                # Apply to local dev DB
 *   node scripts/sync-eos-to-app-db.js --apply --target=prod  # Apply to production DB
 *   node scripts/sync-eos-to-app-db.js --apply --target=all   # Apply to local + production
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../app/.env') });

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
  }
  return acc;
}, {});

const ENGINE_DB = 'postgresql://localhost:5432/mcp_engine';
const dryRun = !args.apply;
const target = args.target || 'local';

function getProductionDbUrl() {
  try {
    return execSync(
      `aws ecs describe-task-definition --task-definition edsteward-saml-production ` +
      `--query 'taskDefinition.containerDefinitions[0].environment[?name==\`DATABASE_URL\`].value' --output text`,
      { encoding: 'utf8' }
    ).trim();
  } catch {
    throw new Error('Failed to fetch production DB URL from ECS. Is AWS CLI configured?');
  }
}

function getTargetDbs() {
  const targets = [];
  if (target === 'local' || target === 'all') {
    targets.push({ label: 'Local Dev (ep-summer-pine)', url: process.env.DATABASE_URL });
  }
  if (target === 'prod' || target === 'production' || target === 'all') {
    targets.push({ label: 'Production (ep-weathered-term)', url: getProductionDbUrl() });
  }
  return targets;
}

async function syncToAppDb(enginePool, appDbUrl, label, dryRun) {
  const appPool = new pg.Pool({ connectionString: appDbUrl, ssl: appDbUrl.includes('neon') ? { rejectUnauthorized: false } : false });
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Target: ${label}${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}\n`);

  try {
    // Step 1: Build reg_key mapping from Engine → App
    const engineRegs = await enginePool.query(
      `SELECT DISTINCT r.id, r.reg_key FROM regulations r
       INNER JOIN eo_regulation_impacts i ON r.id = i.regulation_id
       WHERE r.reg_key IS NOT NULL`
    );
    const appRegs = await appPool.query(`SELECT id, reg_key FROM regulations WHERE reg_key IS NOT NULL`);
    const appRegByKey = new Map(appRegs.rows.map(r => [r.reg_key, r.id]));

    let regsMapped = 0, regsMissing = 0;
    const engineToAppRegId = new Map();
    for (const er of engineRegs.rows) {
      const appId = appRegByKey.get(er.reg_key);
      if (appId) {
        engineToAppRegId.set(er.id, appId);
        regsMapped++;
      } else {
        regsMissing++;
      }
    }
    console.log(`📋 Regulation mapping: ${regsMapped} mapped, ${regsMissing} missing in app DB`);

    // Step 2: Sync executive_orders
    const engineEOs = await enginePool.query(
      `SELECT eo_number, title, signed_date, published_date, status,
              president, term, summary, full_text_url, pdf_url,
              federal_register_citation, topics,
              enjoined_date, enjoined_by, revoked_date, revoked_by
       FROM executive_orders ORDER BY signed_date DESC`
    );
    console.log(`\n⚖️  Syncing ${engineEOs.rows.length} Executive Orders...`);

    let eosInserted = 0, eosUpdated = 0;
    const eoNumberToAppId = new Map();

    for (const eo of engineEOs.rows) {
      const existing = await appPool.query(
        `SELECT id FROM executive_orders WHERE eo_number = $1`, [eo.eo_number]
      );

      if (existing.rows.length > 0) {
        if (!dryRun) {
          await appPool.query(`
            UPDATE executive_orders SET
              title = $2, signed_date = $3, published_date = $4, status = $5,
              president = $6, term = $7, summary = $8, full_text_url = $9, pdf_url = $10,
              federal_register_citation = $11, topics = $12,
              enjoined_date = $13, enjoined_by = $14, revoked_date = $15, revoked_by = $16,
              updated_at = NOW()
            WHERE eo_number = $1`,
            [eo.eo_number, eo.title, eo.signed_date, eo.published_date, eo.status,
             eo.president, eo.term, eo.summary, eo.full_text_url, eo.pdf_url,
             eo.federal_register_citation, eo.topics,
             eo.enjoined_date, eo.enjoined_by, eo.revoked_date, eo.revoked_by]
          );
        }
        eoNumberToAppId.set(eo.eo_number, existing.rows[0].id);
        eosUpdated++;
      } else {
        if (!dryRun) {
          const res = await appPool.query(`
            INSERT INTO executive_orders (
              eo_number, title, signed_date, published_date, status,
              president, term, summary, full_text_url, pdf_url,
              federal_register_citation, topics,
              enjoined_date, enjoined_by, revoked_date, revoked_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            RETURNING id`,
            [eo.eo_number, eo.title, eo.signed_date, eo.published_date, eo.status || 'active',
             eo.president, eo.term, eo.summary, eo.full_text_url, eo.pdf_url,
             eo.federal_register_citation, eo.topics,
             eo.enjoined_date, eo.enjoined_by, eo.revoked_date, eo.revoked_by]
          );
          eoNumberToAppId.set(eo.eo_number, res.rows[0].id);
        }
        eosInserted++;
      }
    }
    console.log(`   ✅ EOs: ${eosInserted} inserted, ${eosUpdated} updated`);

    // After insert, re-fetch all eo_number→id mappings from the app DB (for dry run or fresh IDs)
    if (!dryRun) {
      const allAppEOs = await appPool.query(`SELECT id, eo_number FROM executive_orders`);
      for (const r of allAppEOs.rows) eoNumberToAppId.set(r.eo_number, r.id);
    }

    // Step 3: Sync eo_regulation_impacts
    const engineImpacts = await enginePool.query(
      `SELECT i.*, e.eo_number
       FROM eo_regulation_impacts i
       JOIN executive_orders e ON i.eo_id = e.id
       ORDER BY i.id`
    );
    console.log(`\n🎯 Syncing ${engineImpacts.rows.length} EO Regulation Impacts...`);

    let impactsInserted = 0, impactsUpdated = 0, impactsSkipped = 0;

    for (const imp of engineImpacts.rows) {
      const appEoId = eoNumberToAppId.get(imp.eo_number);
      const appRegId = engineToAppRegId.get(imp.regulation_id);

      if (!appEoId || !appRegId) {
        impactsSkipped++;
        continue;
      }

      const existing = await appPool.query(
        `SELECT id FROM eo_regulation_impacts WHERE eo_id = $1 AND regulation_id = $2`,
        [appEoId, appRegId]
      );

      const confidenceStr = imp.confidence_score != null ? String(imp.confidence_score) : null;

      if (existing.rows.length > 0) {
        if (!dryRun) {
          await appPool.query(`
            UPDATE eo_regulation_impacts SET
              impact_type = $3, impact_severity = $4, impact_summary = $5,
              assessed_by = $6, assessment_date = $7, confidence_score = $8,
              updated_at = NOW()
            WHERE eo_id = $1 AND regulation_id = $2`,
            [appEoId, appRegId, imp.impact_type, imp.impact_severity, imp.impact_summary,
             imp.assessed_by, imp.assessment_date, confidenceStr]
          );
        }
        impactsUpdated++;
      } else {
        if (!dryRun) {
          await appPool.query(`
            INSERT INTO eo_regulation_impacts (
              eo_id, regulation_id, impact_type, impact_severity, impact_summary,
              assessed_by, assessment_date, confidence_score, review_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
            [appEoId, appRegId, imp.impact_type, imp.impact_severity, imp.impact_summary,
             imp.assessed_by, imp.assessment_date, confidenceStr]
          );
        }
        impactsInserted++;
      }
    }
    console.log(`   ✅ Impacts: ${impactsInserted} inserted, ${impactsUpdated} updated, ${impactsSkipped} skipped (unmapped regs)`);

    // Summary
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`  Summary for ${label}:`);
    console.log(`    EOs:     ${eosInserted} new + ${eosUpdated} updated = ${eosInserted + eosUpdated}`);
    console.log(`    Impacts: ${impactsInserted} new + ${impactsUpdated} updated = ${impactsInserted + impactsUpdated} (${impactsSkipped} skipped)`);
    console.log(`${'─'.repeat(40)}\n`);

  } finally {
    await appPool.end();
  }
}

async function main() {
  if (dryRun) {
    console.log('🔍 DRY RUN — no changes will be made. Use --apply to write.\n');
  }

  const enginePool = new pg.Pool({ connectionString: ENGINE_DB });

  try {
    const targetDbs = getTargetDbs();
    if (targetDbs.length === 0) {
      console.error('No target databases configured.');
      process.exit(1);
    }

    for (const db of targetDbs) {
      if (!db.url) {
        console.error(`⚠️  No URL for ${db.label} — skipping`);
        continue;
      }
      await syncToAppDb(enginePool, db.url, db.label, dryRun);
    }

    console.log(dryRun ? '✅ Dry run complete. Use --apply to write changes.' : '✅ All syncs complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await enginePool.end();
  }
}

main();
