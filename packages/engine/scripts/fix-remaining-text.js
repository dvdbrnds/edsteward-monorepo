#!/usr/bin/env node
/**
 * Fix remaining regulations with bad/missing full text.
 * - Copies engine text for mismatched reg_keys in production
 * - Generates text via LLM for any still missing
 * - Syncs to all target DBs
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const { Pool } = pg;
const enginePool = new Pool({ connectionString: 'postgresql://localhost:5432/mcp_engine' });

const TARGETS = {
  production: 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  staging: 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-fancy-scene-a56u8gwz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
  template: 'postgresql://neondb_owner:npg_rziaUB74TlfL@ep-divine-cherry-aejfhxea.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
};

const client = new Anthropic();

async function generateText(name, statute, summary) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Write a comprehensive regulatory compliance text (2000-3000 words) for:

Name: ${name}
Statute: ${statute}
Summary: ${summary}

This must be a detailed compliance reference document covering:
- Full statutory authority and citations
- Key requirements and provisions  
- Institutional obligations
- Reporting and disclosure requirements
- Compliance deadlines and procedures
- Penalties for non-compliance

Write in a formal regulatory compliance style. Do NOT use markdown headers or formatting - write as continuous prose with clear paragraph breaks.`
    }]
  });
  return response.content[0].text;
}

async function updateAllTargets(regKey, text) {
  for (const [name, url] of Object.entries(TARGETS)) {
    const pool = new Pool({ connectionString: url });
    try {
      const res = await pool.query(
        `UPDATE regulations SET regulation_text = $1 WHERE reg_key = $2`,
        [text, regKey]
      );
      if (res.rowCount > 0) console.log(`    ${name}: updated`);
    } catch (e) {
      // Try name match for DBs without reg_key
    }
    await pool.end();
  }
}

async function updateByName(name, text) {
  for (const [tName, url] of Object.entries(TARGETS)) {
    const pool = new Pool({ connectionString: url });
    try {
      const res = await pool.query(
        `UPDATE regulations SET regulation_text = $1 WHERE LOWER(name) = LOWER($2) AND (regulation_text IS NULL OR LENGTH(regulation_text) <= 500)`,
        [text, name]
      );
      if (res.rowCount > 0) console.log(`    ${tName}: updated ${res.rowCount}`);
    } catch (e) {
      // ignore
    }
    await pool.end();
  }
}

async function main() {
  console.log('=== Step 1: Fix mismatched reg_keys in production ===\n');

  // REG-131 EPCRA -> engine has it as REG-019
  const epcra = await enginePool.query("SELECT regulation_text FROM regulations WHERE reg_key = 'REG-019' AND is_current = true");
  if (epcra.rows.length > 0 && epcra.rows[0].regulation_text?.length > 500) {
    console.log(`  REG-131 (EPCRA): using engine REG-019 text (${epcra.rows[0].regulation_text.length} chars)`);
    await updateAllTargets('REG-131', epcra.rows[0].regulation_text);
  }

  // REG-239 ADEA -> engine has it as REG-238
  const adea = await enginePool.query("SELECT regulation_text FROM regulations WHERE reg_key = 'REG-238' AND is_current = true");
  if (adea.rows.length > 0 && adea.rows[0].regulation_text?.length > 500) {
    console.log(`  REG-239 (ADEA): using engine REG-238 text (${adea.rows[0].regulation_text.length} chars)`);
    await updateAllTargets('REG-239', adea.rows[0].regulation_text);
  }

  console.log('\n=== Step 2: Generate text for engine regs with bad text ===\n');

  const badEngine = await enginePool.query(`
    SELECT id, reg_key, name, statute, summary
    FROM regulations
    WHERE is_current = true AND reg_key IS NOT NULL
    AND (regulation_text IS NULL OR LENGTH(regulation_text) <= 500 OR regulation_text LIKE '%═══%')
    AND reg_key != 'REG-TEST-001'
    ORDER BY reg_key
  `);

  console.log(`  ${badEngine.rows.length} engine regulations need text generation`);

  for (const reg of badEngine.rows) {
    console.log(`\n  Generating: ${reg.reg_key} - ${reg.name}`);
    try {
      const text = await generateText(reg.name, reg.statute || '', reg.summary || '');
      console.log(`    Generated ${text.length} chars`);

      await enginePool.query('UPDATE regulations SET regulation_text = $1 WHERE id = $2', [text, reg.id]);
      console.log('    Saved to engine');

      await updateAllTargets(reg.reg_key, text);
      await updateByName(reg.name, text);
    } catch (e) {
      console.error(`    ERROR: ${e.message}`);
    }
  }

  console.log('\n=== Step 3: Fix no-key FERPA entries with tasks in production ===\n');

  const ferpa = await enginePool.query(
    "SELECT regulation_text FROM regulations WHERE name ILIKE '%Family Educational Rights and Privacy%' AND is_current = true AND LENGTH(regulation_text) > 1000 LIMIT 1"
  );
  if (ferpa.rows.length > 0) {
    const prodPool = new Pool({ connectionString: TARGETS.production });
    const ferpaIds = [286, 295];
    for (const fid of ferpaIds) {
      await prodPool.query('UPDATE regulations SET regulation_text = $1 WHERE id = $2 AND (regulation_text IS NULL OR LENGTH(regulation_text) <= 500)', 
        [ferpa.rows[0].regulation_text, fid]);
    }
    console.log(`  Updated FERPA entries (${ferpa.rows[0].regulation_text.length} chars)`);
    await prodPool.end();
  }

  console.log('\n=== Step 4: Final verification ===\n');

  for (const [name, url] of Object.entries(TARGETS)) {
    const pool = new Pool({ connectionString: url });
    const stats = await pool.query(`
      SELECT count(*) as total,
        count(*) FILTER (WHERE regulation_text IS NOT NULL AND LENGTH(regulation_text) > 500) as good_text,
        count(*) FILTER (WHERE regulation_text IS NULL OR LENGTH(regulation_text) <= 500) as bad_text
      FROM regulations
    `);
    console.log(`  ${name}: ${stats.rows[0].good_text}/${stats.rows[0].total} with good text (${stats.rows[0].bad_text} remaining)`);
    await pool.end();
  }

  await enginePool.end();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
