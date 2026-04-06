#!/usr/bin/env node
/**
 * Backfill assigned_role on engine regulation_tasks that are missing it,
 * then sync those tasks (+ the 3 regs already good) to the app DB.
 *
 * Usage: node scripts/backfill-task-roles.cjs [--dry-run]
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'app', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const ENGINE_DB = 'postgresql://localhost:5432/mcp_engine';
const APP_DB = process.env.DATABASE_URL;

if (!APP_DB) { console.error('Missing DATABASE_URL in app .env'); process.exit(1); }

// Map engine categories → canonical role from role_assignments
const CATEGORY_ROLE_MAP = {
  'Academic Programs':                      'Registrar',
  'Disabilities':                           'Disability Services Coordinator',
  'Discrimination,Human Resources':         'HR Director',
  'Diversity/Affirmative Action':           'HR Director',
  'Environmental Health and Safety':        'Environmental Compliance Officer',
  'Financial Aid':                          'Financial Aid Director',
  'Fundraising & Development':              'Government Relations',
  'Grants Management':                      'Research Compliance Officer',
  'Human Resources':                        'HR Director',
  'Intellectual Property and Technology Transfer': 'Technology Transfer Officer',
  'International Activities and Programs':  'International Programs Director',
  'Privacy & Information Security':         'Privacy Officer',
  'Program Integrity Rules':                'Compliance Officer',
  'Recruitment Hiring & Termination':       'HR Director',
  'Retirement':                             'HR Director',
  'Uncategorized':                          'Compliance Officer',
  'Discrimination':                         'Title VI Coordinator',
};

async function main() {
  const engine = new Client({ connectionString: ENGINE_DB });
  const app = new Client({ connectionString: APP_DB });
  await engine.connect();
  await app.connect();

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');

  // 1. Backfill assigned_role in engine DB for tasks that are missing it
  const regsRes = await engine.query(`
    SELECT r.id, r.reg_key, r.category
    FROM regulations r
    WHERE EXISTS (
      SELECT 1 FROM regulation_tasks rt
      WHERE rt.regulation_id = r.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM regulation_tasks rt
      WHERE rt.regulation_id = r.id AND rt.assigned_role IS NOT NULL AND rt.assigned_role != ''
    )
    ORDER BY r.reg_key
  `);

  console.log(`\nFound ${regsRes.rows.length} regulations with tasks missing assigned_role in engine:\n`);
  let engineUpdated = 0;

  for (const reg of regsRes.rows) {
    const role = CATEGORY_ROLE_MAP[reg.category];
    if (!role) {
      console.log(`  ⚠️  ${reg.reg_key} (${reg.category}): No role mapping — skipping`);
      continue;
    }
    console.log(`  ${reg.reg_key} (${reg.category}) → ${role}`);
    if (!DRY_RUN) {
      const upd = await engine.query(
        `UPDATE regulation_tasks SET assigned_role = $1 WHERE regulation_id = $2 AND (assigned_role IS NULL OR assigned_role = '')`,
        [role, reg.id]
      );
      engineUpdated += upd.rowCount;
    }
  }
  console.log(`\nEngine: updated ${engineUpdated} task rows with assigned_role`);

  // 2. Sync tasks from engine → app for ALL 30 affected regulations
  const targetKeys = regsRes.rows.map(r => r.reg_key);
  // Also include the 3 that already had roles in engine but were missing/empty in app
  for (const k of ['REG-022', 'REG-131', 'REG-239']) {
    if (!targetKeys.includes(k)) targetKeys.push(k);
  }

  console.log(`\nSyncing ${targetKeys.length} regulations to app DB...\n`);
  let appSynced = 0;
  let appSkipped = 0;

  for (const regKey of targetKeys) {
    // Get regulation ID in engine
    const eReg = await engine.query(`SELECT id FROM regulations WHERE reg_key = $1`, [regKey]);
    if (eReg.rows.length === 0) { console.log(`  ⚠️  ${regKey}: not found in engine`); continue; }
    const engineRegId = eReg.rows[0].id;

    // Get tasks from engine
    const eTasks = await engine.query(`
      SELECT task_id, title, description, instructions, category, priority,
             requirement_type, assigned_role, statutory_role, statutory_citation,
             evidence_required, evidence_type, evidence_instructions,
             sort_order, parent_task_id
      FROM regulation_tasks WHERE regulation_id = $1 ORDER BY sort_order, id
    `, [engineRegId]);

    if (eTasks.rows.length === 0) {
      console.log(`  ⚠️  ${regKey}: no tasks in engine`);
      appSkipped++;
      continue;
    }

    // Get regulation ID in app
    const aReg = await app.query(`SELECT id FROM regulations WHERE reg_key = $1`, [regKey]);
    if (aReg.rows.length === 0) { console.log(`  ⚠️  ${regKey}: not found in app DB`); appSkipped++; continue; }
    const appRegId = aReg.rows[0].id;

    if (!DRY_RUN) {
      // Delete existing stub tasks in app
      await app.query(`DELETE FROM compliance_tasks WHERE regulation_id = $1`, [appRegId]);

      // Build parent map for hierarchy
      const engineIdToAppId = new Map();
      const parentTasks = eTasks.rows.filter(t => !t.parent_task_id);
      const childTasks = eTasks.rows.filter(t => t.parent_task_id);

      // Insert parent tasks
      for (let i = 0; i < parentTasks.length; i++) {
        const t = parentTasks[i];
        const res = await app.query(`
          INSERT INTO compliance_tasks (
            regulation_id, task_id, title, description, instructions,
            category, assigned_role, statutory_role, statutory_citation,
            priority, requirement_type, evidence_required, evidence_type, evidence_instructions,
            sort_order, status, is_template, attestation_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',false,'not_required')
          RETURNING id
        `, [
          appRegId,
          t.task_id || `task-${regKey}-${i}`,
          t.title, t.description, t.instructions,
          t.category || 'General',
          t.assigned_role || '',
          t.statutory_role || '',
          t.statutory_citation || '',
          t.priority || 'medium',
          t.requirement_type || 'requirement',
          t.evidence_required || false,
          t.evidence_type || 'none',
          t.evidence_instructions || '',
          t.sort_order || i
        ]);
        engineIdToAppId.set(t.task_id, res.rows[0].id);
      }

      // Insert child tasks
      for (let i = 0; i < childTasks.length; i++) {
        const t = childTasks[i];
        // Find parent's engine task_id
        const parentEngineTask = parentTasks.find(p => {
          // parent_task_id in engine is the DB row id, not task_id
          // We need to match differently
          return true; // will use parent_task_id mapping below
        });
        
        // Get parent engine row to find its task_id
        const parentRow = await engine.query(`SELECT task_id FROM regulation_tasks WHERE id = $1`, [t.parent_task_id]);
        const parentAppId = parentRow.rows.length > 0 ? engineIdToAppId.get(parentRow.rows[0].task_id) : null;

        await app.query(`
          INSERT INTO compliance_tasks (
            regulation_id, parent_task_id, task_id, title, description, instructions,
            category, assigned_role, statutory_role, statutory_citation,
            priority, requirement_type, evidence_required, evidence_type, evidence_instructions,
            sort_order, status, is_template, attestation_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',false,'not_required')
        `, [
          appRegId,
          parentAppId,
          t.task_id || `task-${regKey}-sub-${i}`,
          t.title, t.description, t.instructions,
          t.category || 'General',
          t.assigned_role || '',
          t.statutory_role || '',
          t.statutory_citation || '',
          t.priority || 'medium',
          t.requirement_type || 'requirement',
          t.evidence_required || false,
          t.evidence_type || 'none',
          t.evidence_instructions || '',
          t.sort_order || i
        ]);
      }
    }

    const roleCount = eTasks.rows.filter(t => t.assigned_role).length;
    console.log(`  ✅ ${regKey}: synced ${eTasks.rows.length} tasks (${roleCount} with roles)`);
    appSynced++;
  }

  console.log(`\nDone! Synced ${appSynced} regulations, skipped ${appSkipped}`);

  await engine.end();
  await app.end();
}

main().catch(e => { console.error(e); process.exit(1); });
