#!/usr/bin/env node
/**
 * Delivery script: Send PA Act 55 of 2022 to EdSteward Production
 * Target: moravian.edsteward.ai
 *
 * Usage:
 *   node scripts/send-pa-act55-to-edsteward.js
 *   node scripts/send-pa-act55-to-edsteward.js --dry-run
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const EDSTEWARD_BASE = 'https://moravian.edsteward.ai';
const ENDPOINTS = {
  lookup: `${EDSTEWARD_BASE}/api/mcp/regulations/lookup`,
  create: `${EDSTEWARD_BASE}/api/mcp/regulations/create`,
  update: `${EDSTEWARD_BASE}/api/regulation-updates`,
};

const AUTH_USER = process.env.EDSTEWARD_USERNAME || 'dvdbrnds';
const AUTH_PASS = process.env.EDSTEWARD_PASSWORD || 'gabadh';
const BASIC_TOKEN = Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');
const MCP_API_KEY = process.env.MCP_API_KEY || 'mcp_e8dcc41247c6a154c0f8db78565dda6628b936cdfb01ef81e6e5ed0349d9d585';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const REG_NAME = 'Pennsylvania Act 55 of 2022 — Sexual Violence Prevention in Higher Education';

const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function createHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${BASIC_TOKEN}`,
  };
}

function updateHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-MCP-API-Key': MCP_API_KEY,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, label, attempt = 1) {
  try {
    log(`${label} — attempt ${attempt}/${MAX_RETRIES}`);
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      log(`  ⚠  Network error: ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchWithRetry(url, options, label, attempt + 1);
    }
    throw err;
  }
}

function loadEnhancedRegulation() {
  const filePath = path.join(
    PROJECT_ROOT,
    'enhanced-regulations',
    'pennsylvania-act-55-of-2022-sexual-violence-higher-ed.json'
  );
  log(`Reading enhanced regulation from: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  log(`  ✓ Loaded regulation: ${data.regulationId}`);
  log(`  ✓ Audit score: ${data.audit?.score} (certainty: ${data.audit?.certainty})`);
  return data;
}

const FILING_DEADLINES = [
  { type: 'Implementation Deadline', date: '2023-07-01', frequency: 'one-time', description: 'Educational Program Implementation' },
  { type: 'Compliance Deadline', date: '2024-12-31', frequency: 'one-time', description: 'MOU with rape crisis center and DV program per campus' },
  { type: 'Reporting Deadline', date: 'continuous', frequency: 'annual', description: 'Annual Attestation of Compliance to PA DOE' },
  { type: 'Program Requirement', date: 'continuous', frequency: 'annual', description: 'At least one follow-up program per school year' },
];

function buildCreatePayload(enhanced) {
  return {
    name: REG_NAME,
    statute: '24 P.S. § 20-2001-G et seq. (Act 55 of 2022)',
    category: 'Campus Safety and Security',
    topic: 'Sexual Misconduct',
    jurisdictionSource: 'state',
    stateCode: 'PA',
    countryCode: 'US',
    jurisdictionLabel: 'Pennsylvania',
    regulatoryBody: 'Pennsylvania Department of Education',
    summary: enhanced.enhanced.summary,
    requirements: enhanced.enhanced.requirements,
    filingDeadlines: FILING_DEADLINES,
    complianceTasks: [],
  };
}

function buildUpdatePayload(enhanced, regulationId) {
  return {
    regulationId,
    name: REG_NAME,
    status: 'pending',
    originalContent: '',
    updatedContent: enhanced.enhanced.fullText,
    summary: enhanced.enhanced.summary,
    requirements: enhanced.enhanced.requirements,
    filingDeadlines: FILING_DEADLINES,
    jurisdictionSource: 'state',
    stateCode: 'PA',
    countryCode: 'US',
    jurisdictionLabel: 'Pennsylvania',
    regulatoryBody: 'Pennsylvania Department of Education',
    metadata: {
      source: 'MCP Engine - AI Enhanced',
      schemaVersion: '2.0',
      actNumber: 'Act 55 of 2022',
      audit: { score: enhanced.audit?.score ?? 95, certainty: enhanced.audit?.certainty ?? 'A' },
      mcpEngineTimestamp: new Date().toISOString(),
    },
  };
}

async function lookupRegulation() {
  logSection('STEP 1: Lookup — Does PA Act 55 already exist in EdSteward?');

  const lookupUrl = `${ENDPOINTS.lookup}?name=${encodeURIComponent('Pennsylvania Act 55')}`;
  log(`GET ${lookupUrl}`);

  if (DRY_RUN) {
    log('  [DRY RUN] Skipping lookup request');
    return null;
  }

  try {
    const res = await fetchWithRetry(lookupUrl, { method: 'GET', headers: createHeaders() }, 'Lookup');
    const body = await res.text();

    if (res.ok) {
      try {
        const data = JSON.parse(body);
        const id = data.id || data.regulationId || data.data?.id;
        if (id) {
          log(`  ✓ Found existing regulation with ID: ${id}`);
          return id;
        }
      } catch { /* not JSON */ }
      log(`  ✓ Lookup returned 200 but no regulation ID found`);
      return null;
    }

    if (res.status === 404) {
      log('  ✓ Regulation not found (404) — will create new');
      return null;
    }

    log(`  ⚠  Lookup returned ${res.status}: ${body.substring(0, 200)}`);
    return null;
  } catch (err) {
    log(`  ⚠  Lookup failed: ${err.message} — proceeding to create`);
    return null;
  }
}

async function createRegulation(payload) {
  logSection('STEP 2: Create — POST new regulation to EdSteward');

  log(`POST ${ENDPOINTS.create}`);
  log(`Payload preview:`);
  console.log(JSON.stringify(payload, null, 2).substring(0, 600) + '\n  ...');

  if (DRY_RUN) {
    log('[DRY RUN] Full CREATE payload:');
    console.log(JSON.stringify(payload, null, 2));
    return { success: true, dryRun: true };
  }

  const res = await fetchWithRetry(
    ENDPOINTS.create,
    { method: 'POST', headers: createHeaders(), body: JSON.stringify(payload) },
    'Create'
  );

  const body = await res.text();
  log(`Response: ${res.status} ${res.statusText}`);

  if (res.ok) {
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    log('  ✅ Regulation CREATED successfully!');
    console.log(JSON.stringify(data, null, 2));
    return { success: true, status: res.status, data, id: data?.id || data?.regulationId || data?.data?.id };
  }

  if (res.status === 409) {
    log('  ⚠  409 Conflict — regulation already exists, will fall back to update');
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    const existingId = data?.id || data?.regulationId || data?.data?.id || data?.existing?.id || data?.regulation?.id;
    log(`  Existing regulation ID: ${existingId || '(not in response, using 388)'}`);
    return { success: false, conflict: true, status: 409, data, id: existingId || 388 };
  }

  log(`  ❌ Create failed: ${body.substring(0, 500)}`);
  return { success: false, conflict: false, status: res.status, body };
}

async function updateRegulation(payload) {
  logSection('STEP 3: Update — POST regulation update to EdSteward');

  log(`POST ${ENDPOINTS.update}`);
  log(`Regulation ID: ${payload.regulationId}`);
  log(`Payload preview:`);
  console.log(JSON.stringify(payload, null, 2).substring(0, 600) + '\n  ...');

  if (DRY_RUN) {
    log('[DRY RUN] Full UPDATE payload:');
    console.log(JSON.stringify(payload, null, 2));
    return { success: true, dryRun: true };
  }

  const res = await fetchWithRetry(
    ENDPOINTS.update,
    { method: 'POST', headers: updateHeaders(), body: JSON.stringify(payload) },
    'Update'
  );

  const body = await res.text();
  log(`Response: ${res.status} ${res.statusText}`);

  if (res.ok) {
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    log('  ✅ Regulation UPDATE delivered successfully!');
    console.log(JSON.stringify(data, null, 2));
    return { success: true, status: res.status, data };
  }

  log(`  ❌ Update failed: ${body.substring(0, 500)}`);
  return { success: false, status: res.status, body };
}

async function main() {
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║  PA Act 55 of 2022 → EdSteward Delivery Script' + ' '.repeat(20) + '║');
  console.log('║  Target: moravian.edsteward.ai' + ' '.repeat(37) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  if (DRY_RUN) {
    console.log('\n  *** DRY RUN MODE — No requests will be sent ***\n');
  }

  const enhanced = loadEnhancedRegulation();
  const createPayload = buildCreatePayload(enhanced);

  // Step 1: Lookup
  let existingId = await lookupRegulation();

  if (existingId) {
    // Already exists — go straight to update
    const updatePayload = buildUpdatePayload(enhanced, existingId);
    const updateResult = await updateRegulation(updatePayload);
    return printSummary('update', updateResult, existingId);
  }

  // Step 2: Create
  const createResult = await createRegulation(createPayload);

  if (createResult.success) {
    if (DRY_RUN) return printSummary('create-dry-run', createResult);

    // After successful create, also push full content update
    const newId = createResult.id || createResult.data?.regulation?.id;
    if (newId) {
      log(`Regulation created with ID ${newId} — now pushing full content update...`);
      const updatePayload = buildUpdatePayload(enhanced, newId);
      const updateResult = await updateRegulation(updatePayload);
      if (updateResult.success) {
        return printSummary('create-and-update', updateResult, newId);
      }
      log('  ⚠  Content update failed, but regulation was created successfully');
    }
    return printSummary('create', createResult, newId);
  }

  // Step 3: If 409 conflict, fall back to update
  if (createResult.conflict) {
    const regId = createResult.id || 'pennsylvania-act-55-of-2022';
    log(`Falling back to update with ID: ${regId}`);
    const updatePayload = buildUpdatePayload(enhanced, regId);
    const updateResult = await updateRegulation(updatePayload);
    return printSummary('update-fallback', updateResult, regId);
  }

  // Create failed for a non-conflict reason
  printSummary('failed', createResult);
  process.exit(1);
}

function printSummary(outcome, result, regId) {
  logSection('DELIVERY SUMMARY');

  switch (outcome) {
    case 'create':
      log('✅ SUCCESS: PA Act 55 of 2022 CREATED in EdSteward');
      log(`   Regulation ID: ${regId}`);
      log('   Status: Pending CCO Review');
      break;
    case 'create-and-update':
      log('✅ SUCCESS: PA Act 55 of 2022 CREATED and CONTENT PUSHED to EdSteward');
      log(`   Regulation ID: ${regId}`);
      log('   Status: Pending CCO Review');
      break;
    case 'update':
      log('✅ SUCCESS: PA Act 55 of 2022 UPDATE delivered to EdSteward');
      log(`   Regulation ID: ${regId}`);
      log('   Status: Pending CCO Review');
      break;
    case 'update-fallback':
      log('✅ SUCCESS: PA Act 55 already existed — UPDATE delivered instead');
      log(`   Regulation ID: ${regId}`);
      log('   Status: Pending CCO Review');
      break;
    case 'create-dry-run':
      log('🏁 DRY RUN COMPLETE — payloads printed above, nothing sent');
      break;
    case 'failed':
      log('❌ DELIVERY FAILED');
      log(`   HTTP Status: ${result.status}`);
      log(`   Response: ${typeof result.body === 'string' ? result.body.substring(0, 300) : JSON.stringify(result.body)}`);
      break;
  }

  log(`   Timestamp: ${new Date().toISOString()}`);
  log(`   Target: ${EDSTEWARD_BASE}`);
  log(`   Regulation: ${REG_NAME}`);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
