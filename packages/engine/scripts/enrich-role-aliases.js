#!/usr/bin/env node
/**
 * Enrich Canonical Role Aliases
 * 
 * Scans all 242 enhanced regulation JSON files, extracts every role/title
 * variant mentioned, classifies them against canonical roles, and merges
 * new aliases into canonical-roles.json.
 * 
 * Usage:
 *   node scripts/enrich-role-aliases.js --dry-run   (preview only)
 *   node scripts/enrich-role-aliases.js --apply     (write to config)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(engineRoot, '.env') });

const _require = createRequire(import.meta.url);
const configPath = path.join(engineRoot, 'config', 'canonical-roles.json');
const config = _require('../config/canonical-roles.json');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';
const ENHANCED_DIR = path.join(engineRoot, 'enhanced-regulations');
const BATCH_SIZE = 5;

const applyMode = process.argv.includes('--apply');

// Build existing alias set for dedup
const existingAliases = new Set();
const canonicalNames = new Set();
for (const role of config.roles) {
  canonicalNames.add(role.canonical.toLowerCase());
  existingAliases.add(role.canonical.toLowerCase());
  for (const alias of role.aliases) {
    existingAliases.add(alias.toLowerCase().trim());
  }
}

const CANONICAL_LIST = config.roles.map(r => r.canonical).join(', ');

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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function extractAndClassifyBatch(regulations) {
  const regTexts = regulations.map((r, i) => {
    const text = (r.enhanced?.fullText || '').substring(0, 2000);
    const reqs = (r.enhanced?.requirements || '').substring(0, 1000);
    return `--- REGULATION ${i + 1}: ${r.regulationId} ---\n${text}\n${reqs}`;
  }).join('\n\n');

  const prompt = `You are analyzing higher education compliance regulations. Extract every distinct job title, role, or institutional position mentioned in the texts below.

Then classify each title: which of the 36 canonical roles does it map to?

CANONICAL ROLES:
${CANONICAL_LIST}

REGULATIONS:
${regTexts}

RULES:
- Extract ONLY job titles / institutional roles / positions (not departments, committees, or generic terms like "staff")
- Include the title exactly as it appears in the text
- Skip titles that are already one of the 36 canonical role names listed above
- For each title, pick the ONE canonical role it best maps to
- If a title doesn't clearly map to any canonical role, skip it

Return ONLY a JSON array. Each entry: {"title": "exact title from text", "canonical": "Canonical Role Name"}
No markdown fences, no explanation.`;

  const response = await callClaude(prompt);
  const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

async function main() {
  console.log(`Enrich Canonical Role Aliases\n`);
  console.log(`Mode: ${applyMode ? 'APPLY (will write to config)' : 'DRY RUN (preview only)'}`);
  console.log(`Enhanced regulations dir: ${ENHANCED_DIR}\n`);

  const files = fs.readdirSync(ENHANCED_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} regulation files\n`);

  // Load all regulation data
  const regulations = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(ENHANCED_DIR, f), 'utf8'));
    } catch { return null; }
  }).filter(Boolean);

  console.log(`Loaded ${regulations.length} regulations\n`);
  console.log(`Processing in batches of ${BATCH_SIZE}...\n`);

  const allNewAliases = new Map(); // title -> canonical

  for (let i = 0; i < regulations.length; i += BATCH_SIZE) {
    const batch = regulations.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(regulations.length / BATCH_SIZE);

    try {
      const results = await extractAndClassifyBatch(batch);

      let newInBatch = 0;
      for (const entry of results) {
        if (!entry.title || !entry.canonical) continue;
        const titleLower = entry.title.toLowerCase().trim();

        // Skip if already known or is a canonical name itself
        if (existingAliases.has(titleLower)) continue;
        if (canonicalNames.has(titleLower)) continue;
        if (titleLower.length < 4) continue;

        // Verify the canonical role is valid
        const matchedCanonical = config.roles.find(
          r => r.canonical.toLowerCase() === entry.canonical.toLowerCase()
        );
        if (!matchedCanonical) continue;

        if (!allNewAliases.has(titleLower)) {
          allNewAliases.set(titleLower, matchedCanonical.canonical);
          newInBatch++;
        }
      }

      if (batchNum % 5 === 0 || newInBatch > 0) {
        console.log(`  [${batchNum}/${totalBatches}] +${newInBatch} new aliases (${allNewAliases.size} total so far)`);
      }
    } catch (err) {
      console.log(`  [${batchNum}/${totalBatches}] ERROR: ${err.message.substring(0, 60)}`);
    }

    await sleep(500);
  }

  // Summary by role
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTS: ${allNewAliases.size} new aliases discovered\n`);

  const byCanonical = new Map();
  for (const [title, canonical] of allNewAliases) {
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
    byCanonical.get(canonical).push(title);
  }

  for (const [canonical, titles] of [...byCanonical.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const existing = config.roles.find(r => r.canonical === canonical)?.aliases.length || 0;
    console.log(`  ${canonical} (${existing} existing + ${titles.length} new):`);
    for (const t of titles.slice(0, 8)) {
      console.log(`    + "${t}"`);
    }
    if (titles.length > 8) console.log(`    ... and ${titles.length - 8} more`);
    console.log('');
  }

  if (applyMode) {
    // Merge into config
    for (const [title, canonical] of allNewAliases) {
      const role = config.roles.find(r => r.canonical === canonical);
      if (role && !role.aliases.includes(title)) {
        role.aliases.push(title);
      }
    }

    // Sort aliases alphabetically
    for (const role of config.roles) {
      role.aliases.sort((a, b) => a.localeCompare(b));
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`\nWritten to: ${configPath}`);

    const totalAliases = config.roles.reduce((n, r) => n + r.aliases.length, 0);
    console.log(`Total aliases now: ${totalAliases} (was 117)`);
  } else {
    console.log(`\nDry run complete. Run with --apply to write changes.`);
  }

  // Save raw results for review
  const logPath = path.join(__dirname, `role-alias-enrichment-${new Date().toISOString().split('T')[0]}.json`);
  const logData = Object.fromEntries(byCanonical);
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
  console.log(`Detailed results: ${logPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
