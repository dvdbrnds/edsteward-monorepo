#!/usr/bin/env node
/**
 * Upgrade State Regulation Enhanced JSON to v2 Schema
 * 
 * Upgrades NJ and remaining PA state regulation JSON files to v2 schema:
 * - Adds schemaVersion, jurisdiction, deadlines, relationships, tags
 * - Pulls task/deadline data from PostgreSQL to populate missing fields
 * 
 * Usage: node scripts/upgrade-state-regs-to-v2.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ENHANCED_DIR = path.join(__dirname, '../enhanced-regulations');

const pool = new Pool({
  host: 'localhost',
  database: 'mcp_engine',
  port: 5432
});

const NJ_JURISDICTION = {
  source: 'state',
  countryCode: 'US',
  stateCodes: ['NJ'],
  label: 'New Jersey',
  regulatoryBody: 'NJ Office of the Secretary of Higher Education',
  actNumber: null,
  applicability: 'all'
};

const PA_JURISDICTION = {
  source: 'state',
  countryCode: 'US',
  stateCodes: ['PA'],
  label: 'Pennsylvania',
  regulatoryBody: 'Pennsylvania Department of Education',
  actNumber: null,
  applicability: 'all'
};

const JURISDICTION_MAP = {
  NJ: NJ_JURISDICTION,
  PA: PA_JURISDICTION
};

const REGULATORY_BODIES = {
  'new-jersey-campus-sex-assault-victim-bill-of-rights': 'NJ Office of the Secretary of Higher Education',
  'new-jersey-hazing-prevention': 'NJ Office of the Secretary of Higher Education',
  'new-jersey-licensure-accreditation-standards': 'NJ Office of the Secretary of Higher Education',
  'new-jersey-tuition-aid-grant-program': 'NJ Higher Education Student Assistance Authority',
  'new-jersey-uniform-crime-reporting': 'NJ State Police / Uniform Crime Reporting Unit',
  'new-jersey-veterans-benefits-compliance': 'NJ Dept. of Military and Veterans Affairs',
  'higher-education-act-recognition-of-accrediting-ag': 'Pennsylvania Department of Education',
};

const TAGS_MAP = {
  'new-jersey-campus-sex-assault-victim-bill-of-rights': ['Title IX', 'Student Safety', 'Sexual Assault Prevention'],
  'new-jersey-hazing-prevention': ['Student Safety', 'Hazing Prevention', 'Student Conduct'],
  'new-jersey-licensure-accreditation-standards': ['Accreditation', 'Institutional Standards', 'Licensure'],
  'new-jersey-tuition-aid-grant-program': ['Financial Aid', 'Tuition Assistance', 'Student Finance'],
  'new-jersey-uniform-crime-reporting': ['Campus Safety', 'Crime Reporting', 'Law Enforcement'],
  'new-jersey-veterans-benefits-compliance': ['Veterans Affairs', 'Benefits Administration', 'Military Education'],
  'higher-education-act-recognition-of-accrediting-ag': ['Accreditation', 'Institutional Standards', 'Quality Assurance'],
};

async function getDeadlinesFromDB(itemId) {
  const result = await pool.query(`
    SELECT rd.name, rd.due_date, rd.deadline_type, rd.description,
           rd.frequency, rd.recurring_month, rd.recurring_day
    FROM regulation_deadlines rd
    JOIN regulations r ON rd.regulation_id = r.id
    WHERE r.item_id = $1 AND r.is_current = TRUE
    ORDER BY rd.due_date NULLS LAST
  `, [itemId]);
  
  return result.rows.map(row => {
    const isRecurring = !!row.frequency && row.frequency !== 'one-time';
    let dateStr = 'continuous';
    if (row.recurring_month && row.recurring_day) {
      dateStr = `${String(row.recurring_month).padStart(2, '0')}-${String(row.recurring_day).padStart(2, '0')}`;
    } else if (row.due_date) {
      dateStr = row.due_date.toISOString().split('T')[0];
    }
    return {
      date: dateStr,
      label: row.name,
      type: row.deadline_type || 'compliance',
      description: row.description || '',
      isRecurring,
      recurrenceFrequency: isRecurring ? (row.frequency || 'annual') : null
    };
  });
}

async function getRegulationMeta(itemId) {
  const result = await pool.query(`
    SELECT r.state_code, r.jurisdiction_source, r.statute, r.topic
    FROM regulations r
    WHERE r.item_id = $1 AND r.is_current = TRUE
  `, [itemId]);
  return result.rows[0] || {};
}

async function upgradeToV2(filePath) {
  const slug = path.basename(filePath, '.json');
  console.log(`\n  Upgrading: ${slug}`);
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (data.schemaVersion === '2.0' && data.jurisdiction && Array.isArray(data.deadlines)) {
    console.log(`    Already v2 — skipping`);
    return false;
  }
  
  const meta = await getRegulationMeta(slug);
  const sc = meta.state_code || 'NJ';
  const baseJurisdiction = { ...JURISDICTION_MAP[sc] };
  
  if (REGULATORY_BODIES[slug]) {
    baseJurisdiction.regulatoryBody = REGULATORY_BODIES[slug];
  }
  
  const deadlines = await getDeadlinesFromDB(slug);
  
  const v2 = {
    regulationId: data.regulationId || slug,
    schemaVersion: '2.0',
    jurisdiction: data.jurisdiction || baseJurisdiction,
    enhanced: data.enhanced,
    deadlines: Array.isArray(data.deadlines) ? data.deadlines : deadlines,
    relationships: data.relationships || [],
    tags: data.tags || TAGS_MAP[slug] || [meta.topic || 'Compliance'].filter(Boolean),
    audit: data.audit,
  };
  
  if (data.statute) v2.statute = data.statute;
  else if (meta.statute) v2.statute = meta.statute;
  
  if (data.topic) v2.topic = data.topic;
  else if (meta.topic) v2.topic = meta.topic;
  
  fs.writeFileSync(filePath, JSON.stringify(v2, null, 2) + '\n');
  console.log(`    ✅ Upgraded to v2 (${deadlines.length} deadlines from DB, ${v2.tags.length} tags)`);
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 Upgrading State Regulation JSONs to v2 Schema');
  console.log('═══════════════════════════════════════════════════════');
  
  const stateFiles = [
    ...fs.readdirSync(ENHANCED_DIR)
      .filter(f => f.startsWith('new-jersey-') && f.endsWith('.json'))
      .map(f => path.join(ENHANCED_DIR, f)),
    path.join(ENHANCED_DIR, 'higher-education-act-recognition-of-accrediting-ag.json'),
  ];
  
  let upgraded = 0;
  let skipped = 0;
  
  for (const file of stateFiles) {
    if (!fs.existsSync(file)) {
      console.log(`  ⚠️  Not found: ${path.basename(file)}`);
      continue;
    }
    const result = await upgradeToV2(file);
    if (result) upgraded++;
    else skipped++;
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ Upgraded: ${upgraded} | Skipped (already v2): ${skipped}`);
  console.log('═══════════════════════════════════════════════════════');
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
