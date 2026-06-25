#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(engineRoot, '.env') });

const _require = createRequire(import.meta.url);
const canonicalRoles = _require('../config/canonical-roles.json');
const VALID_ROLES = new Set(canonicalRoles.roles.map(r => r.canonical));
const ROLE_LIST = canonicalRoles.roles.map(r => r.canonical).join(', ');

const pool = new pg.Pool({ connectionString: 'postgresql://localhost:5432/mcp_engine' });
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).substring(0, 100)}`);
  const data = await res.json();
  return data.content[0].text;
}

async function main() {
  // --- STEP 1: Extract tasks for REG-012 ---
  console.log('=== STEP 1: Populate REG-012 with tasks ===\n');

  const enhancedPath = path.join(engineRoot, 'enhanced-regulations', 'higher-education-act-recognition-of-accrediting-ag.json');
  const enhanced = JSON.parse(fs.readFileSync(enhancedPath, 'utf8'));

  const { rows: [reg] } = await pool.query("SELECT * FROM regulations WHERE reg_key = 'REG-012'");
  console.log(`Regulation: ${reg.name}`);
  console.log(`Enhanced text: ${enhanced.enhanced.fullText.length} chars\n`);

  const prompt = `You are a compliance expert for higher education institutions. Extract specific, actionable compliance tasks from this regulation.

REGULATION: ${reg.name}
REG KEY: REG-012
CATEGORY: Academic Programs
STATUTE: 20 U.S.C. § 1099b(a)(4)(A); 34 CFR § 602.16

FULL TEXT:
${enhanced.enhanced.fullText}

REQUIREMENTS:
${enhanced.enhanced.requirements}

REPORTING:
${enhanced.enhanced.reportingRequirements || 'None specified'}

CANONICAL ROLES (choose one per task):
${ROLE_LIST}

Extract 8-15 compliance tasks. For each task provide:
- title: Short imperative action (e.g. "Submit annual accreditation report")
- description: 2-3 sentences explaining what must be done and why
- assignedRole: The canonical role responsible (from the list above). This is an Academic Programs regulation — default to "VP Academic Affairs" unless the task clearly belongs to another domain.
- priority: high, medium, or low

Return ONLY a JSON array of task objects. No markdown fences, no explanation.`;

  console.log('Calling LLM for task extraction...');
  const response = await callClaude(prompt);
  const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const tasks = JSON.parse(cleaned);

  console.log(`Extracted ${tasks.length} tasks:\n`);

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!VALID_ROLES.has(t.assignedRole)) t.assignedRole = 'VP Academic Affairs';

    await pool.query(
      `INSERT INTO regulation_tasks (regulation_id, title, description, assigned_role, priority, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [reg.id, t.title, t.description, t.assignedRole, t.priority || 'medium', i + 1]
    );

    console.log(`  ${i + 1}. [${t.assignedRole}] ${t.title}`);
  }

  await pool.query(
    `UPDATE regulations SET summary = $1, category = 'Academic Programs', statute = '20 U.S.C. § 1099b(a)(4)(A)', updated_at = NOW() WHERE id = $2`,
    [enhanced.enhanced.summary, reg.id]
  );

  console.log(`\n✅ REG-012 populated with ${tasks.length} tasks\n`);

  // --- STEP 2: Delete REG-253 ---
  console.log('=== STEP 2: Delete REG-253 ===\n');

  const { rows: [reg253] } = await pool.query("SELECT id, name FROM regulations WHERE reg_key = 'REG-253'");
  if (reg253) {
    const { rowCount: tasksDeleted } = await pool.query('DELETE FROM regulation_tasks WHERE regulation_id = $1', [reg253.id]);
    await pool.query('DELETE FROM regulations WHERE id = $1', [reg253.id]);
    console.log(`Deleted: "${reg253.name}" (id ${reg253.id}, ${tasksDeleted} tasks removed)`);
  } else {
    console.log('REG-253 not found in engine DB');
  }

  console.log('\n✅ Done');
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
