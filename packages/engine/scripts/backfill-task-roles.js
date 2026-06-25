#!/usr/bin/env node
/**
 * Backfill Canonical Roles on Engine Tasks
 * 
 * Assigns an assigned_role to every task that is currently missing one.
 * 
 * Strategy (in priority order):
 *   1. Sibling match: use the most common role among other tasks on the same regulation
 *   2. Category map: map the regulation's category to a default canonical role
 *   3. Fallback: "Compliance Officer"
 * 
 * Usage:
 *   node scripts/backfill-task-roles.js              # Dry run (show what would change)
 *   node scripts/backfill-task-roles.js --apply      # Actually write to DB
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mcp_engine'
});

const dryRun = !process.argv.includes('--apply');

const CATEGORY_ROLE_MAP = {
  'Campus Safety': 'Clery Compliance Officer',
  'Civil Rights': 'Title IX Coordinator',
  'Environmental Health & Safety': 'Environmental Compliance Officer',
  'Ethics & Governance': 'Ethics Officer',
  'Finance': 'CFO',
  'Financial Aid': 'Financial Aid Director',
  'Human Resources': 'HR Director',
  'Information Technology': 'IT Security Officer',
  'Intellectual Property': 'Technology Transfer Officer',
  'Research': 'Research Compliance Officer',
  'Student Services': 'Dean of Students',
  'Academic Programs': 'VP Academic Affairs',
  'Fundraising & Development': 'Communications Director',
  'Contracts & Procurement': 'Procurement Director',
  'Athletics': 'Compliance Officer',
};

const FALLBACK_ROLE = 'Compliance Officer';

async function main() {
  console.log(`\n🔧 Backfill Task Roles ${dryRun ? '(DRY RUN)' : '(APPLYING)'}\n`);

  // Get all tasks missing assigned_role, along with regulation info
  const { rows: unassigned } = await pool.query(`
    SELECT t.id, t.title, t.regulation_id, r.category, r.reg_key, r.name as regulation_name
    FROM regulation_tasks t
    JOIN regulations r ON t.regulation_id = r.id
    WHERE t.assigned_role IS NULL OR t.assigned_role = ''
    ORDER BY r.reg_key, t.id
  `);

  console.log(`Found ${unassigned.length} tasks missing assigned_role\n`);

  if (unassigned.length === 0) {
    console.log('✅ Nothing to do — all tasks have roles assigned.');
    await pool.end();
    return;
  }

  // Build sibling role map: regulation_id -> most common role
  const { rows: siblingData } = await pool.query(`
    SELECT regulation_id, assigned_role, count(*) as cnt
    FROM regulation_tasks
    WHERE assigned_role IS NOT NULL AND assigned_role != ''
    GROUP BY regulation_id, assigned_role
    ORDER BY regulation_id, cnt DESC
  `);

  const siblingMap = new Map();
  for (const row of siblingData) {
    if (!siblingMap.has(row.regulation_id)) {
      siblingMap.set(row.regulation_id, row.assigned_role);
    }
  }

  // Assign roles
  const assignments = { sibling: 0, category: 0, fallback: 0 };
  const updates = [];

  for (const task of unassigned) {
    let role = null;
    let method = '';

    // Priority 1: sibling match
    if (siblingMap.has(task.regulation_id)) {
      role = siblingMap.get(task.regulation_id);
      method = 'sibling';
      assignments.sibling++;
    }
    // Priority 2: category map
    else if (task.category && CATEGORY_ROLE_MAP[task.category]) {
      role = CATEGORY_ROLE_MAP[task.category];
      method = 'category';
      assignments.category++;
    }
    // Priority 3: fallback
    else {
      role = FALLBACK_ROLE;
      method = 'fallback';
      assignments.fallback++;
    }

    updates.push({ id: task.id, role, method, regKey: task.reg_key, title: task.title });
  }

  // Show summary by method
  console.log('Assignment method breakdown:');
  console.log(`  Sibling match:  ${assignments.sibling}`);
  console.log(`  Category map:   ${assignments.category}`);
  console.log(`  Fallback:       ${assignments.fallback}`);
  console.log(`  Total:          ${updates.length}\n`);

  // Show sample assignments
  console.log('Sample assignments (first 15):');
  for (const u of updates.slice(0, 15)) {
    console.log(`  [${u.method}] ${u.regKey} "${u.title}" → ${u.role}`);
  }
  if (updates.length > 15) console.log(`  ... and ${updates.length - 15} more\n`);

  // Apply if not dry run
  if (dryRun) {
    console.log('\n⚠️  DRY RUN — no changes written. Run with --apply to update the database.');
  } else {
    console.log('\nApplying updates...');
    let applied = 0;
    const batchSize = 100;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const cases = batch.map(u => `WHEN ${u.id} THEN '${u.role.replace(/'/g, "''")}'`).join(' ');
      const ids = batch.map(u => u.id).join(',');

      await pool.query(`
        UPDATE regulation_tasks
        SET assigned_role = CASE id ${cases} END,
            updated_at = NOW()
        WHERE id IN (${ids})
      `);
      applied += batch.length;
      if (applied % 500 === 0 || applied === updates.length) {
        console.log(`  Updated ${applied}/${updates.length} tasks`);
      }
    }

    // Verify
    const { rows: [check] } = await pool.query(
      `SELECT count(*) as remaining FROM regulation_tasks WHERE assigned_role IS NULL OR assigned_role = ''`
    );
    console.log(`\n✅ Backfill complete. Remaining unassigned: ${check.remaining}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('❌ Backfill failed:', err);
  pool.end();
  process.exit(1);
});
