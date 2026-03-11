#!/usr/bin/env node
/**
 * Backfill Statutory Citations on Engine Tasks
 * 
 * Pass 1 (always): Set regulation-level statute as baseline citation via SQL
 * Pass 2 (--refine): Use LLM to map each task to a specific subsection
 * 
 * Usage:
 *   node scripts/backfill-citations.js                          # Pass 1 only
 *   node scripts/backfill-citations.js --refine                 # Pass 1 + LLM refine
 *   node scripts/backfill-citations.js --refine --start-from REG-050  # Resume
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mcp_engine'
});

const args = process.argv.slice(2);
const doRefine = args.includes('--refine');
const startFromIdx = args.indexOf('--start-from');
const startFromKey = startFromIdx >= 0 ? args[startFromIdx + 1] : null;

const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'citation-backfill-progress.json');

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { completed: [], lastKey: null, timestamp: null };
}

function saveProgress(progress) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = process.env.LLM_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ═══════════════════════════════════════════════════
// PASS 1: SQL baseline — set statute on all tasks
// ═══════════════════════════════════════════════════
async function pass1() {
  console.log('═══ PASS 1: SQL Baseline Citations ═══');

  const result = await pool.query(`
    UPDATE regulation_tasks rt
    SET statutory_citation = r.statute
    FROM regulations r
    WHERE rt.regulation_id = r.id
      AND (rt.statutory_citation IS NULL OR rt.statutory_citation = '')
      AND r.statute IS NOT NULL AND r.statute != '' AND r.statute != 'See CFR'
  `);
  console.log(`  Updated ${result.rowCount} tasks with regulation-level statute`);

  const coverage = await pool.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE statutory_citation IS NOT NULL AND statutory_citation != '') as has_citation
    FROM regulation_tasks
  `);
  const { total, has_citation } = coverage.rows[0];
  console.log(`  Coverage: ${has_citation}/${total} (${(100 * has_citation / total).toFixed(1)}%)`);
}

// ═══════════════════════════════════════════════════
// PASS 2: LLM refine — specific subsection citations
// ═══════════════════════════════════════════════════
async function pass2() {
  console.log('\n═══ PASS 2: LLM Citation Refinement ═══');

  const progress = loadProgress();
  const completedSet = new Set(progress.completed);

  const regs = await pool.query(`
    SELECT r.id, r.reg_key, r.name, r.statute, r.summary,
      LEFT(r.regulation_text, 4000) as reg_text
    FROM regulations r
    WHERE r.is_current = true
      AND r.statute IS NOT NULL AND r.statute != '' AND r.statute != 'See CFR'
    ORDER BY r.reg_key
  `);
  console.log(`  ${regs.rows.length} regulations to process`);

  let skippedPre = 0;
  let skippedDone = 0;
  let processed = 0;
  let errors = 0;
  let startReached = !startFromKey;

  for (const reg of regs.rows) {
    if (!startReached) {
      if (reg.reg_key === startFromKey) {
        startReached = true;
      } else {
        skippedPre++;
        continue;
      }
    }

    if (completedSet.has(reg.reg_key)) {
      skippedDone++;
      continue;
    }

    const tasks = await pool.query(`
      SELECT id, task_id, title, statutory_citation
      FROM regulation_tasks
      WHERE regulation_id = $1
      ORDER BY sort_order, id
    `, [reg.id]);

    if (tasks.rows.length === 0) continue;

    const taskList = tasks.rows.map((t, i) =>
      `${i + 1}. "${t.title}" (task_id: ${t.task_id || t.id})`
    ).join('\n');

    const regContext = reg.reg_text || reg.summary || '';

    const prompt = `You are a legal citation specialist for higher education compliance.

REGULATION: ${reg.name}
STATUTE: ${reg.statute}
${regContext ? `\nREGULATION TEXT (excerpt):\n${regContext.substring(0, 3000)}` : ''}

Below are compliance tasks for this regulation. For each task, provide the most specific statutory citation you can determine. Use standard legal citation format (e.g., "20 U.S.C. § 1092(f)(1)(F)", "34 CFR § 668.22(a)(2)", "42 U.S.C. § 2000e-2(a)").

If the regulation has a single statute reference and you cannot determine the specific subsection, return the base statute "${reg.statute}" for that task.

TASKS:
${taskList}

Return ONLY a JSON array, no markdown, no explanation:
[{"taskId": ${tasks.rows[0].task_id ? '"task_id_value"' : 'numeric_id'}, "citation": "specific citation"}]`;

    try {
      const raw = await callClaude(prompt);
      let citations;
      try {
        const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        citations = JSON.parse(cleaned);
      } catch (parseErr) {
        console.log(`  ⚠️ [${reg.reg_key}] JSON parse error — skipping`);
        errors++;
        continue;
      }

      if (!Array.isArray(citations)) {
        console.log(`  ⚠️ [${reg.reg_key}] Not an array — skipping`);
        errors++;
        continue;
      }

      let updated = 0;
      for (const c of citations) {
        if (!c.citation || c.citation === reg.statute) continue;

        const taskRow = tasks.rows.find(t =>
          (t.task_id && String(t.task_id) === String(c.taskId)) ||
          String(t.id) === String(c.taskId)
        );
        if (!taskRow) continue;

        await pool.query(
          'UPDATE regulation_tasks SET statutory_citation = $1 WHERE id = $2',
          [c.citation, taskRow.id]
        );
        updated++;
      }

      processed++;
      progress.completed.push(reg.reg_key);
      progress.lastKey = reg.reg_key;
      progress.timestamp = new Date().toISOString();
      saveProgress(progress);

      console.log(`  ✅ [${processed}] ${reg.reg_key} ${reg.name.substring(0, 50)}: ${updated}/${tasks.rows.length} refined`);

      // Rate limiting: 50ms between requests
      await new Promise(r => setTimeout(r, 50));

    } catch (err) {
      console.log(`  ❌ [${reg.reg_key}] Error: ${err.message.substring(0, 100)}`);
      errors++;
      // Save progress on error so we can resume
      progress.lastKey = reg.reg_key;
      progress.timestamp = new Date().toISOString();
      saveProgress(progress);
      // Continue to next regulation
    }
  }

  console.log(`\n  Summary: ${processed} processed, ${skippedDone} already done, ${skippedPre} skipped (before start), ${errors} errors`);

  const coverage = await pool.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE statutory_citation IS NOT NULL AND statutory_citation != '') as has_citation,
      count(DISTINCT statutory_citation) as distinct_citations
    FROM regulation_tasks
  `);
  const { total, has_citation, distinct_citations } = coverage.rows[0];
  console.log(`  Final coverage: ${has_citation}/${total} (${(100 * has_citation / total).toFixed(1)}%) with ${distinct_citations} distinct citations`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('Statutory Citation Backfill');
  console.log(`Mode: ${doRefine ? 'Pass 1 + LLM Refine' : 'Pass 1 only'}`);
  if (startFromKey) console.log(`Starting from: ${startFromKey}`);
  console.log('');

  await pass1();

  if (doRefine) {
    await pass2();
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
