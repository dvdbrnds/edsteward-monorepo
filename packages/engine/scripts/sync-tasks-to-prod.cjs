#!/usr/bin/env node
/**
 * Sync regulation tasks from engine DB to a target app DB.
 * Engine assigned_role was already backfilled — this just copies tasks over.
 *
 * Usage: TARGET_DB="postgresql://..." node scripts/sync-tasks-to-prod.cjs [--dry-run]
 */
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const ENGINE_DB = 'postgresql://localhost:5432/mcp_engine';
const TARGET_DB = process.env.TARGET_DB;

if (!TARGET_DB) { console.error('Set TARGET_DB env var'); process.exit(1); }

const TARGET_KEYS = [
  'REG-022','REG-072','REG-074','REG-075','REG-095','REG-096','REG-097',
  'REG-111','REG-112','REG-124','REG-127','REG-131','REG-132','REG-133',
  'REG-136','REG-138','REG-139','REG-142','REG-145','REG-147','REG-198',
  'REG-212','REG-215','REG-217','REG-232','REG-239','REG-246','REG-251','CA-001'
];

async function main() {
  const engine = new Client({ connectionString: ENGINE_DB });
  const app = new Client({ connectionString: TARGET_DB });
  await engine.connect();
  await app.connect();

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');
  console.log(`Syncing ${TARGET_KEYS.length} regulations to target DB...\n`);

  let synced = 0, skipped = 0;

  for (const regKey of TARGET_KEYS) {
    const eReg = await engine.query(`SELECT id FROM regulations WHERE reg_key = $1`, [regKey]);
    if (eReg.rows.length === 0) { console.log(`  ⚠️  ${regKey}: not in engine`); skipped++; continue; }

    const eTasks = await engine.query(`
      SELECT task_id, title, description, instructions, category, priority,
             requirement_type, assigned_role, statutory_role, statutory_citation,
             evidence_required, evidence_type, evidence_instructions,
             sort_order, parent_task_id, id as engine_id
      FROM regulation_tasks WHERE regulation_id = $1 ORDER BY sort_order, id
    `, [eReg.rows[0].id]);

    if (eTasks.rows.length === 0) { console.log(`  ⚠️  ${regKey}: no tasks in engine`); skipped++; continue; }

    const aReg = await app.query(`SELECT id FROM regulations WHERE reg_key = $1`, [regKey]);
    if (aReg.rows.length === 0) { console.log(`  ⚠️  ${regKey}: not in target DB`); skipped++; continue; }
    const appRegId = aReg.rows[0].id;

    if (!DRY_RUN) {
      await app.query(`DELETE FROM compliance_tasks WHERE regulation_id = $1`, [appRegId]);

      const engineIdToAppId = new Map();
      const parents = eTasks.rows.filter(t => !t.parent_task_id);
      const children = eTasks.rows.filter(t => t.parent_task_id);

      for (let i = 0; i < parents.length; i++) {
        const t = parents[i];
        const res = await app.query(`
          INSERT INTO compliance_tasks (
            regulation_id, task_id, title, description, instructions,
            category, assigned_role, statutory_role, statutory_citation,
            priority, requirement_type, evidence_required, evidence_type, evidence_instructions,
            sort_order, status, is_template, attestation_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',false,'not_required')
          RETURNING id
        `, [
          appRegId, t.task_id || `task-${regKey}-${i}`,
          t.title, t.description, t.instructions,
          t.category || 'General', t.assigned_role || '', t.statutory_role || '', t.statutory_citation || '',
          t.priority || 'medium', t.requirement_type || 'requirement',
          t.evidence_required || false, t.evidence_type || 'none', t.evidence_instructions || '',
          t.sort_order || i
        ]);
        engineIdToAppId.set(t.engine_id, res.rows[0].id);
      }

      for (let i = 0; i < children.length; i++) {
        const t = children[i];
        const parentAppId = engineIdToAppId.get(t.parent_task_id) || null;
        await app.query(`
          INSERT INTO compliance_tasks (
            regulation_id, parent_task_id, task_id, title, description, instructions,
            category, assigned_role, statutory_role, statutory_citation,
            priority, requirement_type, evidence_required, evidence_type, evidence_instructions,
            sort_order, status, is_template, attestation_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',false,'not_required')
        `, [
          appRegId, parentAppId, t.task_id || `task-${regKey}-sub-${i}`,
          t.title, t.description, t.instructions,
          t.category || 'General', t.assigned_role || '', t.statutory_role || '', t.statutory_citation || '',
          t.priority || 'medium', t.requirement_type || 'requirement',
          t.evidence_required || false, t.evidence_type || 'none', t.evidence_instructions || '',
          t.sort_order || i
        ]);
      }
    }

    const roleCount = eTasks.rows.filter(t => t.assigned_role).length;
    console.log(`  ✅ ${regKey}: ${DRY_RUN ? 'would sync' : 'synced'} ${eTasks.rows.length} tasks (${roleCount} with roles)`);
    synced++;
  }

  console.log(`\nDone! ${DRY_RUN ? 'Would sync' : 'Synced'} ${synced}, skipped ${skipped}`);
  await engine.end();
  await app.end();
}

main().catch(e => { console.error(e); process.exit(1); });
