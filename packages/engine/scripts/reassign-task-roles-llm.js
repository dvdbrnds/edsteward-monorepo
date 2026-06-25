#!/usr/bin/env node
/**
 * Canonical Role Re-Assignment (Category-Based + LLM)
 * 
 * Reassigns the `assigned_role` on tasks that have the generic "Compliance Officer"
 * fallback. Uses category-based defaults immediately, and LLM when available.
 * 
 * NONDESTRUCTIVE: Only updates the `assigned_role` column. Does not touch
 * task titles, descriptions, citations, or any other field.
 * 
 * Usage:
 *   node scripts/reassign-task-roles-llm.js                    # Dry run (category defaults)
 *   node scripts/reassign-task-roles-llm.js --apply            # Write to DB
 *   node scripts/reassign-task-roles-llm.js --apply --llm      # Use LLM for nuanced assignment
 *   node scripts/reassign-task-roles-llm.js --start-from REG-050  # Resume from reg
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _require = createRequire(import.meta.url);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mcp_engine'
});

const canonicalRoles = _require('../config/canonical-roles.json');
const ROLE_LIST = canonicalRoles.roles.map(r => `${r.canonical} (${r.group})`).join(', ');
const VALID_ROLES = new Set(canonicalRoles.roles.map(r => r.canonical));

const CATEGORY_DEFAULTS = {
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

const API_KEY = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.LLM_DEFAULT_MODEL || 'claude-sonnet-4-20250514';

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const useLLM = args.includes('--llm');
const startFromIdx = args.indexOf('--start-from');
const startFrom = startFromIdx >= 0 ? args[startFromIdx + 1] : null;

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err.substring(0, 100)}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLLMAccess() {
  if (!API_KEY) return false;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    return response.status === 200;
  } catch { return false; }
}

async function main() {
  console.log(`\n═══ Canonical Role Re-Assignment ${dryRun ? '(DRY RUN)' : '(APPLYING)'} ═══\n`);

  let llmAvailable = false;
  if (useLLM) {
    llmAvailable = await testLLMAccess();
    if (llmAvailable) {
      console.log(`LLM mode: ENABLED (model: ${MODEL})\n`);
    } else {
      console.log(`LLM mode: REQUESTED but API unavailable — falling back to category defaults\n`);
    }
  } else {
    console.log(`Mode: Category-based defaults (use --llm for AI-powered assignment)\n`);
  }

  // Get all regulations that have tasks with "Compliance Officer" as a generic default
  const { rows: regulations } = await pool.query(`
    SELECT DISTINCT r.id, r.reg_key, r.name, r.category, r.statute
    FROM regulations r
    JOIN regulation_tasks t ON t.regulation_id = r.id
    WHERE t.assigned_role = 'Compliance Officer'
      AND r.category NOT IN ('Athletics', 'Uncategorized')
      AND r.is_current = true
    ORDER BY r.reg_key
  `);

  console.log(`Found ${regulations.length} regulations with generic "Compliance Officer" assignments\n`);

  let started = !startFrom;
  let totalReassigned = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const auditLog = [];

  for (const reg of regulations) {
    if (!started) {
      if (reg.reg_key === startFrom) started = true;
      else continue;
    }

    // Get tasks that need reassignment for this regulation
    const { rows: tasks } = await pool.query(`
      SELECT id, title, description, category
      FROM regulation_tasks
      WHERE regulation_id = $1 AND assigned_role = 'Compliance Officer'
      ORDER BY sort_order, id
    `, [reg.id]);

    if (tasks.length === 0) continue;

    const categoryDefault = CATEGORY_DEFAULTS[reg.category] || 'Compliance Officer';

    // Skip if category default IS Compliance Officer (no improvement possible without LLM)
    if (categoryDefault === 'Compliance Officer' && !llmAvailable) {
      totalSkipped += tasks.length;
      continue;
    }

    let assignments;

    if (llmAvailable) {
      // LLM-powered assignment
      const taskList = tasks.map((t, i) => `  ${i + 1}. "${t.title}"${t.description ? ` — ${t.description.substring(0, 80)}` : ''}`).join('\n');

      const prompt = `You are assigning compliance responsibilities at a university. For each task below, choose the ONE canonical role most responsible for attesting completion.

REGULATION: ${reg.name}
CATEGORY: ${reg.category}
STATUTE: ${reg.statute || 'N/A'}
CATEGORY DEFAULT ROLE: ${categoryDefault}

AVAILABLE CANONICAL ROLES:
${ROLE_LIST}

TASKS TO ASSIGN:
${taskList}

RULES:
- The category default "${categoryDefault}" is correct for MOST tasks in this regulation. Use it unless the task clearly belongs to a different domain.
- Choose the person who would SIGN OFF that the task is complete — the attestor.
- "Compliance Officer" is a LAST RESORT. Only use it if no other role fits.
- Every task MUST get exactly one role from the list above.

Return ONLY a JSON array of objects, one per task, in order:
[{"taskId": ${tasks[0].id}, "role": "..."}, ...]

No explanation, no markdown fences, just the JSON array.`;

      try {
        const response = await callClaude(prompt);
        const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        assignments = JSON.parse(cleaned);
      } catch (err) {
        console.log(`  ⚠ ${reg.reg_key} — LLM failed (${err.message.substring(0, 50)}), using category default`);
        assignments = tasks.map(t => ({ taskId: t.id, role: categoryDefault }));
        totalErrors++;
      }

      await sleep(350);
    } else {
      // Category-based assignment
      assignments = tasks.map(t => ({ taskId: t.id, role: categoryDefault }));
    }

    // Validate and apply
    let regReassigned = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const assignment = assignments[i];
      let newRole = assignment?.role;

      // Validate the role is canonical
      if (!newRole || !VALID_ROLES.has(newRole)) {
        newRole = categoryDefault;
      }

      // Skip if still "Compliance Officer"
      if (newRole === 'Compliance Officer') {
        totalSkipped++;
        continue;
      }

      auditLog.push({
        regKey: reg.reg_key,
        taskId: task.id,
        taskTitle: task.title,
        oldRole: 'Compliance Officer',
        newRole,
      });

      if (!dryRun) {
        await pool.query(
          `UPDATE regulation_tasks SET assigned_role = $1, updated_at = NOW() WHERE id = $2`,
          [newRole, task.id]
        );
      }

      regReassigned++;
      totalReassigned++;
    }

    if (regReassigned > 0) {
      const roleUsed = assignments[0]?.role || categoryDefault;
      console.log(`  ${reg.reg_key} "${reg.name.substring(0, 50)}" — ${regReassigned}/${tasks.length} → ${roleUsed}`);
    }
  }

  // Summary
  console.log(`\n═══ Summary ═══`);
  console.log(`  Reassigned: ${totalReassigned}`);
  console.log(`  Kept as Compliance Officer: ${totalSkipped}`);
  console.log(`  LLM errors (used fallback): ${totalErrors}`);

  // Write audit log
  const logPath = path.join(__dirname, `role-reassignment-log-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(logPath, JSON.stringify(auditLog, null, 2));
  console.log(`  Audit log: ${logPath}`);

  if (dryRun) {
    console.log(`\n⚠  DRY RUN — no changes written. Run with --apply to update the database.`);
    console.log(`\nSample assignments (first 20):`);
    for (const entry of auditLog.slice(0, 20)) {
      console.log(`  ${entry.regKey} "${entry.taskTitle}" → ${entry.newRole}`);
    }
    if (auditLog.length > 20) console.log(`  ... and ${auditLog.length - 20} more`);
  } else {
    // Verify
    const { rows: [check] } = await pool.query(
      `SELECT count(*) as remaining FROM regulation_tasks WHERE assigned_role = 'Compliance Officer'`
    );
    console.log(`\n  Remaining "Compliance Officer" tasks: ${check.remaining}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
