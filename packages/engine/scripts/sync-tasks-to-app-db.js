#!/usr/bin/env node
/**
 * Direct DB Task Sync Script
 * 
 * Syncs all regulation tasks from engine DB directly to app tenant databases.
 * Handles reg_key matching, parent/child relationships, and schema differences.
 * 
 * Usage:
 *   node scripts/sync-tasks-to-app-db.js --target=production
 *   node scripts/sync-tasks-to-app-db.js --target=staging
 *   node scripts/sync-tasks-to-app-db.js --target=template
 *   node scripts/sync-tasks-to-app-db.js --target=all
 *   node scripts/sync-tasks-to-app-db.js --target=production --dry-run
 */

import pg from 'pg';
import { normalizeRole } from '../src/utils/role-normalizer.js';

const { Pool } = pg;

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const TARGETS = {
  production: {
    name: 'Production (Moravian)',
    url: 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
    hasRegKey: true,
  },
  staging: {
    name: 'Staging',
    url: 'postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-fancy-scene-a56u8gwz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
    hasRegKey: false,
  },
  template: {
    name: 'Template',
    url: 'postgresql://neondb_owner:npg_rziaUB74TlfL@ep-divine-cherry-aejfhxea.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
    hasRegKey: false,
  },
};

function normalizePriority(priority) {
  if (!priority) return 'medium';
  const p = priority.toLowerCase();
  if (p === 'critical' || p === 'urgent') return 'high';
  if (['high', 'medium', 'low'].includes(p)) return p;
  return 'medium';
}

async function ensureSchema(appPool, targetName) {
  const cols = await appPool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'compliance_tasks'
  `);
  const existing = new Set(cols.rows.map(r => r.column_name));

  const needed = {
    statutory_citation: 'text',
    statutory_role: 'text',
    statutory_language: 'text',
    category: 'text',
    requirement_type: 'text',
    estimated_effort: 'text',
    deliverable: 'text',
    deliverable_template_url: 'text',
    attestation_status: 'text',
    attestation_notes: 'text',
    attestation_signature: 'text',
    attested_at: 'timestamp',
    attested_by: 'integer',
  };

  let added = 0;
  for (const [col, type] of Object.entries(needed)) {
    if (!existing.has(col)) {
      await appPool.query(`ALTER TABLE compliance_tasks ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      added++;
    }
  }

  const regCols = await appPool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'regulations'
  `);
  const regExisting = new Set(regCols.rows.map(r => r.column_name));

  if (!regExisting.has('reg_key')) {
    await appPool.query(`ALTER TABLE regulations ADD COLUMN IF NOT EXISTS reg_key varchar(20)`);
    console.log(`  Added reg_key column to regulations`);
  }

  if (added > 0) console.log(`  Added ${added} missing columns to compliance_tasks`);
  return !regExisting.has('reg_key');
}

async function populateRegKeys(enginePool, appPool) {
  const engineRegs = await enginePool.query(`
    SELECT reg_key, name FROM regulations WHERE is_current = true AND reg_key IS NOT NULL
  `);

  let matched = 0;
  for (const er of engineRegs.rows) {
    const res = await appPool.query(
      `UPDATE regulations SET reg_key = $1 WHERE LOWER(name) = LOWER($2) AND (reg_key IS NULL OR reg_key = '')`,
      [er.reg_key, er.name]
    );
    matched += res.rowCount;
  }
  console.log(`  Populated reg_key for ${matched} regulations`);
}

async function syncRegulationText(enginePool, appPool) {
  const engineRegs = await enginePool.query(`
    SELECT reg_key, regulation_text FROM regulations
    WHERE is_current = true AND regulation_text IS NOT NULL AND LENGTH(regulation_text) > 500
    AND regulation_text NOT LIKE '%═══%'
  `);

  let updated = 0;
  for (const r of engineRegs.rows) {
    const res = await appPool.query(
      `UPDATE regulations SET regulation_text = $1
       WHERE reg_key = $2 AND (regulation_text IS NULL OR LENGTH(regulation_text) <= 500)`,
      [r.regulation_text, r.reg_key]
    );
    updated += res.rowCount;
  }
  return updated;
}

async function syncTasks(enginePool, appPool, dryRun) {
  const engineRegs = await enginePool.query(`
    SELECT id, reg_key, name FROM regulations WHERE is_current = true AND reg_key IS NOT NULL
    ORDER BY reg_key
  `);

  const appRegs = await appPool.query(`SELECT id, reg_key, name FROM regulations WHERE reg_key IS NOT NULL`);
  const appRegMap = new Map();
  for (const r of appRegs.rows) {
    if (r.reg_key) appRegMap.set(r.reg_key, r.id);
  }

  let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, regsProcessed = 0, regsMissing = 0;

  for (const engineReg of engineRegs.rows) {
    const appRegId = appRegMap.get(engineReg.reg_key);
    if (!appRegId) {
      regsMissing++;
      continue;
    }

    const engineTasks = await enginePool.query(`
      SELECT id, task_id, parent_task_id, title, description, instructions,
        category, priority, assigned_role, estimated_effort,
        evidence_required, evidence_type, evidence_instructions,
        deliverable, deliverable_template_url, sort_order,
        requirement_type, statutory_role, statutory_citation
      FROM regulation_tasks WHERE regulation_id = $1
      ORDER BY parent_task_id NULLS FIRST, sort_order, id
    `, [engineReg.id]);

    if (engineTasks.rows.length === 0) continue;

    const existingTasks = await appPool.query(
      `SELECT id, task_id FROM compliance_tasks WHERE regulation_id = $1`,
      [appRegId]
    );
    const existingByTaskId = new Map();
    for (const t of existingTasks.rows) {
      if (t.task_id) existingByTaskId.set(t.task_id, t.id);
    }

    const engineIdToAppId = new Map();
    const parents = engineTasks.rows.filter(t => !t.parent_task_id);
    const children = engineTasks.rows.filter(t => t.parent_task_id);

    for (const task of parents) {
      const taskId = task.task_id || `engine-${task.id}`;

      if (existingByTaskId.has(taskId)) {
        engineIdToAppId.set(task.id, existingByTaskId.get(taskId));
        if (!dryRun) {
          await appPool.query(`
            UPDATE compliance_tasks SET
              statutory_citation = COALESCE($1, statutory_citation),
              assigned_role = COALESCE($2, assigned_role)
            WHERE id = $3`,
            [task.statutory_citation, normalizeRole(task.assigned_role), existingByTaskId.get(taskId)]
          );
        }
        totalUpdated++;
        continue;
      }

      if (dryRun) {
        totalInserted++;
        continue;
      }

      const res = await appPool.query(`
        INSERT INTO compliance_tasks (
          regulation_id, task_id, title, description, instructions,
          category, priority, assigned_role, estimated_effort,
          evidence_required, evidence_type, evidence_instructions,
          deliverable, deliverable_template_url, sort_order,
          requirement_type, statutory_role, statutory_citation, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending')
        RETURNING id`,
        [
          appRegId, taskId, task.title, task.description || '', task.instructions || '',
          task.category || '', normalizePriority(task.priority),
          normalizeRole(task.assigned_role) || '', task.estimated_effort || '',
          task.evidence_required || false, task.evidence_type || 'document',
          task.evidence_instructions || '', task.deliverable || '',
          task.deliverable_template_url || '', task.sort_order || 0,
          task.requirement_type || 'requirement', task.statutory_role || '',
          task.statutory_citation || ''
        ]
      );
      engineIdToAppId.set(task.id, res.rows[0].id);
      totalInserted++;
    }

    for (const task of children) {
      const taskId = task.task_id || `engine-${task.id}`;

      if (existingByTaskId.has(taskId)) {
        engineIdToAppId.set(task.id, existingByTaskId.get(taskId));
        if (!dryRun) {
          await appPool.query(`
            UPDATE compliance_tasks SET
              statutory_citation = COALESCE($1, statutory_citation),
              assigned_role = COALESCE($2, assigned_role)
            WHERE id = $3`,
            [task.statutory_citation, normalizeRole(task.assigned_role), existingByTaskId.get(taskId)]
          );
        }
        totalUpdated++;
        continue;
      }

      const appParentId = engineIdToAppId.get(task.parent_task_id) || null;

      if (dryRun) {
        totalInserted++;
        continue;
      }

      const res = await appPool.query(`
        INSERT INTO compliance_tasks (
          regulation_id, parent_task_id, task_id, title, description, instructions,
          category, priority, assigned_role, estimated_effort,
          evidence_required, evidence_type, evidence_instructions,
          deliverable, deliverable_template_url, sort_order,
          requirement_type, statutory_role, statutory_citation, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending')
        RETURNING id`,
        [
          appRegId, appParentId, taskId, task.title, task.description || '',
          task.instructions || '', task.category || '',
          normalizePriority(task.priority), normalizeRole(task.assigned_role) || '',
          task.estimated_effort || '', task.evidence_required || false,
          task.evidence_type || 'document', task.evidence_instructions || '',
          task.deliverable || '', task.deliverable_template_url || '',
          task.sort_order || 0, task.requirement_type || 'requirement',
          task.statutory_role || '', task.statutory_citation || ''
        ]
      );
      engineIdToAppId.set(task.id, res.rows[0].id);
      totalInserted++;
    }

    regsProcessed++;
    if (regsProcessed % 50 === 0) {
      console.log(`  ... processed ${regsProcessed} regulations (${totalInserted} inserted, ${totalUpdated} updated)`);
    }
  }

  return { totalInserted, totalUpdated, totalSkipped, regsProcessed, regsMissing };
}

async function syncTarget(targetKey, dryRun) {
  const target = TARGETS[targetKey];
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${target.name}${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}`);

  const enginePool = new Pool({ connectionString: 'postgresql://localhost:5432/mcp_engine' });
  const appPool = new Pool({ connectionString: target.url });

  try {
    console.log('  Ensuring schema...');
    const needsRegKey = await ensureSchema(appPool, targetKey);

    if (needsRegKey || !target.hasRegKey) {
      console.log('  Populating reg_key...');
      await populateRegKeys(enginePool, appPool);
    }

    console.log('  Syncing regulation text...');
    const textUpdated = await syncRegulationText(enginePool, appPool);
    console.log(`  Updated ${textUpdated} regulation texts`);

    console.log('  Syncing tasks...');
    const result = await syncTasks(enginePool, appPool, dryRun);
    console.log(`\n  Results:`);
    console.log(`    Regulations processed: ${result.regsProcessed}`);
    console.log(`    Regulations not matched: ${result.regsMissing}`);
    console.log(`    Tasks inserted: ${result.totalInserted}`);
    console.log(`    Tasks updated: ${result.totalUpdated}`);

    const finalStats = await appPool.query(`
      SELECT count(*) as total,
        count(*) FILTER (WHERE statutory_citation IS NOT NULL AND statutory_citation != '') as has_citation,
        count(DISTINCT assigned_role) FILTER (WHERE assigned_role IS NOT NULL AND assigned_role != '') as distinct_roles
      FROM compliance_tasks
    `);
    const textStats = await appPool.query(`
      SELECT count(*) as total,
        count(*) FILTER (WHERE regulation_text IS NOT NULL AND LENGTH(regulation_text) > 500) as good_text
      FROM regulations
    `);
    console.log(`\n  Final state:`);
    console.log(`    Tasks: ${finalStats.rows[0].total} (${finalStats.rows[0].has_citation} with citations, ${finalStats.rows[0].distinct_roles} roles)`);
    console.log(`    Regulation text: ${textStats.rows[0].good_text}/${textStats.rows[0].total} with good text`);

  } finally {
    await enginePool.end();
    await appPool.end();
  }
}

async function main() {
  const target = args.target;
  const dryRun = args['dry-run'] || false;

  if (!target || args.help) {
    console.log('Usage: node scripts/sync-tasks-to-app-db.js --target=<production|staging|template|all> [--dry-run]');
    process.exit(0);
  }

  console.log('MCP ENGINE - DIRECT DB TASK SYNC');
  console.log(`Target: ${target}  Dry run: ${dryRun}`);

  if (target === 'all') {
    for (const key of Object.keys(TARGETS)) {
      await syncTarget(key, dryRun);
    }
  } else if (TARGETS[target]) {
    await syncTarget(target, dryRun);
  } else {
    console.error(`Unknown target: ${target}. Use: production, staging, template, or all`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
