#!/usr/bin/env node
/**
 * Sync regulations + compliance_tasks from production to template DB.
 * Usage: node scripts/sync-prod-to-template.cjs <PROD_URL> <TEMPLATE_URL>
 */
const { Pool } = require('pg');

const PROD_URL = process.argv[2];
const TEMPLATE_URL = process.argv[3];

if (!PROD_URL || !TEMPLATE_URL) {
  console.error('Usage: node scripts/sync-prod-to-template.cjs <PROD_URL> <TEMPLATE_URL>');
  process.exit(1);
}

const src = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
const dst = new Pool({ connectionString: TEMPLATE_URL, ssl: { rejectUnauthorized: false } });

function serialize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value;
}

async function copyTable(name, seqName) {
  const { rows } = await src.query(`SELECT * FROM public.${name}`);
  if (!rows.length) { console.log(`${name}: 0 rows in source`); return; }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');
  let inserted = 0;

  for (const row of rows) {
    const vals = cols.map(c => serialize(row[c]));
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await dst.query(`INSERT INTO public.${name} (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
      inserted++;
    } catch (e) {
      console.error(`  Skip row in ${name}:`, e.message.slice(0, 120));
    }
  }

  if (seqName) {
    await dst.query(`SELECT setval('${seqName}', (SELECT COALESCE(MAX(id), 0) + 1 FROM public.${name}), false)`);
  }
  console.log(`${name}: ${inserted}/${rows.length} rows copied`);
}

(async () => {
  try {
    console.log('Copying regulations from production to template...');
    await copyTable('regulations', 'regulations_id_seq');
    await copyTable('compliance_tasks', 'compliance_tasks_id_seq');

    const r = await dst.query('SELECT COUNT(*) as c FROM public.regulations');
    const t = await dst.query('SELECT COUNT(*) as c FROM public.compliance_tasks');
    const k = await dst.query('SELECT COUNT(reg_key) as c FROM public.regulations WHERE is_current = true');
    console.log(`\nTemplate now has: ${r.rows[0].c} regulations (${k.rows[0].c} with reg_key), ${t.rows[0].c} tasks`);
  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  } finally {
    await src.end();
    await dst.end();
  }
})();
