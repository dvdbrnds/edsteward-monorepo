#!/usr/bin/env node
/**
 * Backfill confidential flags on existing compliance tasks.
 *
 * Usage:
 *   node scripts/backfill-confidential-tasks.cjs                      # uses DATABASE_URL from .env
 *   node scripts/backfill-confidential-tasks.cjs "postgresql://..."   # explicit DB URL
 *   node scripts/backfill-confidential-tasks.cjs --dry-run            # preview only
 */

const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.argv.find(a => a.startsWith('postgresql://')) || process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

if (!dbUrl) {
  console.error('No DATABASE_URL — pass as argument or set in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

// Regulation name patterns → confidential data types
const CONFIDENTIAL_PATTERNS = [
  { regex: /ferpa/i,                      types: ['student_records'] },
  { regex: /student.*(record|privacy)/i,  types: ['student_records'] },
  { regex: /clery|campus.*(security|safety)/i, types: ['security_plans'] },
  { regex: /hipaa|health.*(privacy|insurance)/i, types: ['health_records'] },
  { regex: /title.ix/i,                   types: ['conduct_reports', 'student_records'] },
  { regex: /vawa|violence.against.women/i, types: ['conduct_reports'] },
  { regex: /drug.free|substance/i,        types: ['conduct_reports', 'health_records'] },
  { regex: /financial.aid|title.iv/i,     types: ['financial_aid', 'student_records'] },
  { regex: /gramm.leach|glba/i,          types: ['financial_aid'] },
  { regex: /disability|ada|section.504/i, types: ['health_records', 'student_records'] },
  { regex: /employee.*(privacy|record)/i, types: ['employment_records'] },
  { regex: /whistleblow/i,               types: ['employment_records', 'legal_proceedings'] },
  { regex: /research.*(misconduct|integrity)/i, types: ['research_data'] },
  { regex: /export.control|itar/i,       types: ['research_data'] },
  { regex: /donor|endowment/i,           types: ['donor_information'] },
];

// Task-level keyword patterns
const TASK_KEYWORD_PATTERNS = [
  { regex: /conduct.*(report|record|file|case|hearing)/i, types: ['conduct_reports'] },
  { regex: /student.*(record|transcript|file)/i,          types: ['student_records'] },
  { regex: /disciplin/i,                                   types: ['conduct_reports'] },
  { regex: /medical|health.*(record|information)/i,        types: ['health_records'] },
  { regex: /disability.*(accommodation|documentation)/i,   types: ['health_records'] },
  { regex: /financial.*(aid|record)/i,                     types: ['financial_aid'] },
  { regex: /personnel.*(file|record)/i,                    types: ['employment_records'] },
  { regex: /security.*(plan|assessment|audit)/i,           types: ['security_plans'] },
  { regex: /investigation.*(report|file)/i,                types: ['legal_proceedings'] },
];

function detectConfidential(regName, taskTitle, taskDescription) {
  const dataTypes = new Set();

  for (const { regex, types } of CONFIDENTIAL_PATTERNS) {
    if (regex.test(regName)) types.forEach(t => dataTypes.add(t));
  }

  const combinedText = `${taskTitle || ''} ${taskDescription || ''}`;
  for (const { regex, types } of TASK_KEYWORD_PATTERNS) {
    if (regex.test(combinedText)) types.forEach(t => dataTypes.add(t));
  }

  return dataTypes.size > 0 ? [...dataTypes] : null;
}

async function backfill() {
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log(dryRun ? 'DRY RUN — PREVIEW CONFIDENTIAL TASK BACKFILL' : 'BACKFILLING CONFIDENTIAL TASK FLAGS');
  console.log(`Database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log('='.repeat(70));

  try {
    const { rows: tasks } = await client.query(`
      SELECT ct.id, ct.title, ct.description, ct.is_confidential, r.name AS reg_name
      FROM compliance_tasks ct
      JOIN regulations r ON r.id = ct.regulation_id
      ORDER BY ct.id
    `);

    console.log(`\nFound ${tasks.length} compliance tasks to scan\n`);

    let updated = 0;
    let alreadyFlagged = 0;
    let noMatch = 0;

    for (const task of tasks) {
      if (task.is_confidential) {
        alreadyFlagged++;
        continue;
      }

      const types = detectConfidential(task.reg_name, task.title, task.description);
      if (!types) {
        noMatch++;
        continue;
      }

      console.log(`  [${task.id}] "${task.title.substring(0, 60)}..." → ${types.join(', ')}`);

      if (!dryRun) {
        await client.query(
          `UPDATE compliance_tasks
           SET is_confidential = true,
               confidential_data_types = $1,
               evidence_type = CASE WHEN evidence_type = 'document' THEN 'external_reference' ELSE evidence_type END,
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(types), task.id]
        );
      }
      updated++;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Results: ${updated} flagged, ${alreadyFlagged} already flagged, ${noMatch} no match`);
    if (dryRun) console.log('(DRY RUN — no changes made)');
    console.log('='.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
