#!/usr/bin/env node
/**
 * Canonical Category Backfill Script
 * 
 * 1. Populates category_mappings in the app DB with verified mappings
 * 2. Backfills regulations.canonical_category_id on all app-side regulations
 * 3. Normalizes regulations.category to canonical names in the app DB
 * 4. Normalizes regulations.category in the engine DB
 * 
 * Usage:
 *   APP_DB="postgresql://..." node scripts/backfill-category-mappings.cjs [--dry-run]
 * 
 * Engine DB is always local: postgresql://localhost:5432/mcp_engine
 */
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const ENGINE_DB = 'postgresql://localhost:5432/mcp_engine';
const APP_DB = process.env.APP_DB;

if (!APP_DB) { console.error('Set APP_DB env var'); process.exit(1); }

// Manually verified mapping: every known incoming category → canonical category name
// Canonical IDs (from canonical_categories table):
//  1=Academic Programs, 2=Human Resources, 3=Finance, 4=Campus Safety,
//  5=Information Technology, 6=Research, 7=Environmental Health & Safety,
//  8=Financial Aid, 9=Civil Rights, 10=Contracts & Procurement,
//  11=Intellectual Property, 12=Ethics & Governance, 13=Fundraising & Development,
//  14=Athletics, 15=Student Services
const CATEGORY_MAP = {
  // --- Already canonical (exact match to canonical_categories.name) ---
  'Academic Programs':              'Academic Programs',
  'Athletics':                      'Athletics',
  'Campus Safety':                  'Campus Safety',
  'Civil Rights':                   'Civil Rights',
  'Contracts & Procurement':        'Contracts & Procurement',
  'Environmental Health & Safety':  'Environmental Health & Safety',
  'Ethics & Governance':            'Ethics & Governance',
  'Finance':                        'Finance',
  'Financial Aid':                  'Financial Aid',
  'Fundraising & Development':      'Fundraising & Development',
  'Human Resources':                'Human Resources',
  'Information Technology':         'Information Technology',
  'Intellectual Property':          'Intellectual Property',
  'Research':                       'Research',
  'Student Services':               'Student Services',

  // --- Engine variants that map to canonical ---
  'Admissions':                     'Academic Programs',
  'Accounting':                     'Finance',
  'Tax':                            'Finance',
  'Fraud Prevention':               'Finance',
  'Wages':                          'Human Resources',
  'Employee Benefits':              'Human Resources',
  'Unions':                         'Human Resources',
  'Employment Law':                 'Human Resources',
  'Immigration':                    'Human Resources',
  'Retirement':                     'Human Resources',
  'Recruitment Hiring & Termination': 'Human Resources',
  'Privacy & Information Security': 'Information Technology',
  'Privacy & Data':                 'Information Technology',
  'Grants Management':              'Research',
  'Export Controls':                'Research',
  'Environmental Health and Safety':'Environmental Health & Safety',
  'Civil Rights & Accessibility':   'Civil Rights',
  'Civil Rights & Compliance':      'Civil Rights',
  'Discrimination':                 'Civil Rights',
  'Diversity/Affirmative Action':   'Civil Rights',
  'Sexual Misconduct':              'Civil Rights',
  'Sexual Violence Prevention':     'Civil Rights',
  'Disabilities':                   'Civil Rights',
  'Ethics':                         'Ethics & Governance',
  'Governance':                     'Ethics & Governance',
  'Lobbying and Political Activities': 'Ethics & Governance',
  'Intellectual Property and Technology Transfer': 'Intellectual Property',
  'Copyright & Trademark':          'Intellectual Property',
  'Program Integrity Rules':        'Financial Aid',
  'International Activities and Programs': 'Student Services',
  'Health Care and Insurance':      'Human Resources',

  // --- Comma-separated engine categories (use first meaningful match) ---
  'Discrimination,Human Resources':                'Civil Rights',
  'Contracts & Procurement,Recruitment Hiring & Termination': 'Contracts & Procurement',
  'Immigration,Recruitment Hiring & Termination':  'Human Resources',

  // --- Catch-all ---
  'Other':                          'Ethics & Governance',
};

// For the 60 "Uncategorized" engine regulations, classify by name keywords
const UNCATEGORIZED_RULES = [
  // IT/privacy — check BEFORE Financial Aid so "Health Information Technology" and "Health Insurance Portability" match here
  { pattern: /FERPA|Family Educational Rights|GLBA|Gramm.Leach|GDPR|General Data Protection|FISMA|Federal Information Security|HITECH|Health Information Technology|HIPAA|Health Insurance Portability|COPPA|Children.*Online Privacy|California Consumer Privacy|Electronic Communications Privacy/i, canonical: 'Information Technology' },
  // Research — check before Financial Aid so "Public Health Service" matches here
  { pattern: /Export Administration|ITAR|International Traffic|Arms Export|Trading with the Enemy|Foreign Assets/i, canonical: 'Research' },
  { pattern: /NSF|National Science Foundation|Public Health Service|Research Misconduct|Objectivity in Research|CREATE Act|Cooperative Research/i, canonical: 'Research' },
  // Financial Aid — use \bHEA\b word boundary to avoid matching "Health"
  { pattern: /Higher Education Act|\bHEA\b|Cohort Default|Borrower Defense|FSEOG|Work.Study|PLUS Loan|Perkins|Pell|Student Loan Default|Financial Responsibility|Aid Application|Entrance and Exit|Net Price Calculator|Penalties for Drug|Program Participation|Standard of Conduct|Information Distributed to Students|Third Party Servicers|Record Retention|Audits|Eligibility and Certification|Tuition Aid|Veterans Benefits/i, canonical: 'Financial Aid' },
  { pattern: /Title IX|Section 504|Rehabilitation Act/i, canonical: 'Civil Rights' },
  { pattern: /Clery|Campus Security|Campus Crime|Homeland Security|Drug and Alcohol Abuse Prevention/i, canonical: 'Campus Safety' },
  { pattern: /Hazing|Sex.Assault.*Bill of Rights/i, canonical: 'Campus Safety' },
  { pattern: /Uniform Crime Reporting/i, canonical: 'Campus Safety' },
  { pattern: /Teacher Preparation|English Fluency|Institutional Accreditation|Licensure.*Standards/i, canonical: 'Academic Programs' },
  { pattern: /Equity in Athletics|EADA/i, canonical: 'Athletics' },
  { pattern: /Freedom of Information/i, canonical: 'Ethics & Governance' },
  { pattern: /Emergency Planning|EPCRA|Controlled Substances/i, canonical: 'Environmental Health & Safety' },
  { pattern: /Student Right to Know/i, canonical: 'Student Services' },
];

function classifyUncategorized(name) {
  for (const rule of UNCATEGORIZED_RULES) {
    if (rule.pattern.test(name)) return rule.canonical;
  }
  return 'Ethics & Governance'; // safe fallback
}

async function main() {
  const app = new Client({ connectionString: APP_DB });
  const engine = new Client({ connectionString: ENGINE_DB });
  await app.connect();
  await engine.connect();

  console.log(DRY_RUN ? '\n=== DRY RUN ===' : '\n=== LIVE RUN ===');

  // Step 0: Load canonical categories from app DB
  const canonicals = await app.query('SELECT id, name FROM canonical_categories ORDER BY id');
  const canonicalByName = new Map();
  for (const row of canonicals.rows) {
    canonicalByName.set(row.name, row.id);
  }
  console.log(`\nLoaded ${canonicalByName.size} canonical categories`);

  // Step 1: Collect all distinct categories from engine + app
  const engineCats = await engine.query('SELECT DISTINCT category FROM regulations ORDER BY category');
  const appCats = await app.query('SELECT DISTINCT category FROM regulations ORDER BY category');

  const allIncoming = new Set();
  for (const r of engineCats.rows) allIncoming.add(r.category);
  for (const r of appCats.rows) allIncoming.add(r.category);
  console.log(`Found ${allIncoming.size} distinct incoming categories across engine + app\n`);

  // Step 2: Insert into category_mappings
  let mappingsInserted = 0;
  let unmapped = [];
  for (const incoming of allIncoming) {
    if (!incoming || incoming === 'Uncategorized') continue; // handle Uncategorized separately
    const canonical = CATEGORY_MAP[incoming];
    if (!canonical) {
      unmapped.push(incoming);
      continue;
    }
    const canonicalId = canonicalByName.get(canonical);
    if (!canonicalId) {
      console.error(`  ERROR: canonical name "${canonical}" not found in DB!`);
      continue;
    }
    if (!DRY_RUN) {
      await app.query(`
        INSERT INTO category_mappings (incoming_category, canonical_category_id, source, confidence, is_verified)
        VALUES ($1, $2, 'manual-backfill', '1.00', true)
        ON CONFLICT (incoming_category) DO UPDATE SET
          canonical_category_id = $2, is_verified = true, confidence = '1.00', updated_at = NOW()
      `, [incoming, canonicalId]);
    }
    console.log(`  mapped: "${incoming}" → "${canonical}" (ID ${canonicalId})`);
    mappingsInserted++;
  }

  if (unmapped.length > 0) {
    console.log(`\n  UNMAPPED (${unmapped.length}): ${unmapped.join(', ')}`);
  }
  console.log(`\nStep 1 complete: ${DRY_RUN ? 'would insert' : 'inserted'} ${mappingsInserted} category mappings\n`);

  // Step 3: Backfill canonical_category_id on app regulations
  // First, handle regulations with known categories via the mapping
  let updated = 0;
  if (!DRY_RUN) {
    const res = await app.query(`
      UPDATE regulations r
      SET canonical_category_id = cm.canonical_category_id,
          original_category = COALESCE(r.original_category, r.category)
      FROM category_mappings cm
      WHERE LOWER(r.category) = LOWER(cm.incoming_category)
        AND (r.canonical_category_id IS NULL OR r.canonical_category_id != cm.canonical_category_id)
    `);
    updated = res.rowCount;
  } else {
    const res = await app.query(`
      SELECT COUNT(*) as cnt FROM regulations r
      JOIN category_mappings cm ON LOWER(r.category) = LOWER(cm.incoming_category)
      WHERE r.canonical_category_id IS NULL OR r.canonical_category_id != cm.canonical_category_id
    `);
    updated = parseInt(res.rows[0]?.cnt || '0');
  }
  console.log(`Step 2: ${DRY_RUN ? 'would update' : 'updated'} ${updated} regulations with canonical_category_id\n`);

  // Step 4: Normalize regulations.category to canonical name in app DB
  let normalized = 0;
  if (!DRY_RUN) {
    const res = await app.query(`
      UPDATE regulations r
      SET category = cc.name
      FROM canonical_categories cc
      WHERE r.canonical_category_id = cc.id
        AND r.category != cc.name
    `);
    normalized = res.rowCount;
  } else {
    const res = await app.query(`
      SELECT COUNT(*) as cnt FROM regulations r
      JOIN canonical_categories cc ON r.canonical_category_id = cc.id
      WHERE r.category != cc.name
    `);
    normalized = parseInt(res.rows[0]?.cnt || '0');
  }
  console.log(`Step 3: ${DRY_RUN ? 'would normalize' : 'normalized'} ${normalized} regulation category names in app DB\n`);

  // Step 5: Normalize engine regulations.category
  let engineUpdated = 0;
  const engineRegs = await engine.query('SELECT id, name, category FROM regulations ORDER BY id');
  for (const reg of engineRegs.rows) {
    let target = CATEGORY_MAP[reg.category];
    if (!target && reg.category === 'Uncategorized') {
      target = classifyUncategorized(reg.name);
    }
    if (!target) continue;
    if (target === reg.category) continue; // already correct

    if (!DRY_RUN) {
      await engine.query('UPDATE regulations SET category = $1 WHERE id = $2', [target, reg.id]);
    }
    if (reg.category === 'Uncategorized') {
      console.log(`  engine: "${reg.name}" → "${target}" (was Uncategorized)`);
    }
    engineUpdated++;
  }
  console.log(`\nStep 4: ${DRY_RUN ? 'would update' : 'updated'} ${engineUpdated} engine regulation categories\n`);

  // Step 6: Verify final state
  const appCheck = await app.query(`
    SELECT 
      (SELECT COUNT(*) FROM regulations) as total,
      (SELECT COUNT(*) FROM regulations WHERE canonical_category_id IS NOT NULL) as with_canonical,
      (SELECT COUNT(DISTINCT category) FROM regulations) as distinct_cats,
      (SELECT COUNT(*) FROM category_mappings) as total_mappings
  `);
  const s = appCheck.rows[0];
  console.log('=== Final State (App DB) ===');
  console.log(`  Total regulations: ${s.total}`);
  console.log(`  With canonical_category_id: ${s.with_canonical}`);
  console.log(`  Distinct category values: ${s.distinct_cats}`);
  console.log(`  Category mappings: ${s.total_mappings}`);

  const engineCheck = await engine.query(`
    SELECT COUNT(DISTINCT category) as distinct_cats,
           COUNT(*) FILTER (WHERE category = 'Uncategorized') as uncategorized
    FROM regulations
  `);
  const e = engineCheck.rows[0];
  console.log('\n=== Final State (Engine DB) ===');
  console.log(`  Distinct category values: ${e.distinct_cats}`);
  console.log(`  Still "Uncategorized": ${e.uncategorized}`);

  await app.end();
  await engine.end();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
