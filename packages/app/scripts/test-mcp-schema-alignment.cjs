#!/usr/bin/env node
/**
 * Integration Test: MCP Engine Schema Alignment (Feb 2026)
 * 
 * Verifies that the expanded 48-field regulation, 21-field task, and 22-field
 * Executive Order payloads land correctly through all three MCP integration endpoints:
 *   1. POST /api/mcp/regulations/create  (Create endpoint)
 *   2. POST /api/mcp/regulations/sync    (Sync/upsert endpoint)
 *   3. POST /api/regulation-updates      (Updates endpoint)
 * 
 * Usage:
 *   node scripts/test-mcp-schema-alignment.cjs
 *   EDSTEWARD_URL=http://localhost:3000 node scripts/test-mcp-schema-alignment.cjs
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const AUTH = 'Basic ' + Buffer.from(
  (process.env.MCP_ENGINE_USERNAME || 'dvdbrnds') + ':' +
  (process.env.MCP_ENGINE_PASSWORD || 'changeme')
).toString('base64');

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ──────────────────────────────────────────
// Test data: Full 48-field regulation
// ──────────────────────────────────────────
const TEST_STAMP = Date.now();

function buildFullRegulation(suffix) {
  return {
    name: `Schema Test: Full Payload Regulation ${suffix} (${TEST_STAMP})`,
    statute: `99 U.S.C. § ${TEST_STAMP}`,
    statuteIds: [`statute-${TEST_STAMP}-a`, `statute-${TEST_STAMP}-b`],
    publicLaw: `Public Law 999-${TEST_STAMP}`,
    category: 'Test Category',
    topic: 'Schema Alignment Testing',
    regKey: `test-schema-${TEST_STAMP}-${suffix}`,
    jurisdictionSource: 'federal',
    effectiveDate: '2026-01-01',
    originationDate: '2025-06-15',
    nextReviewDate: '2027-01-01',
    summary: `Full schema alignment test regulation ${suffix}.`,
    purpose: `To verify that all 48 regulation fields are correctly stored.`,
    scope: `Applies to all schema alignment testing for EdSteward ${suffix}.`,
    requirements: '• Full field coverage\n• All 21 task fields\n• All 22 EO fields',
    submissionGuidelines: 'Submit via MCP Engine API',
    complianceNotes: 'Test compliance notes for schema alignment',
    verificationMethod: 'automated-test',
    reportingFrequency: 'annual',
    reportingRequirements: {
      frequency: 'annual',
      deadline: 'June 30',
      format: 'electronic',
      recipient: 'Test Agency'
    },
    riskScore: 75,
    riskLevel: 'HIGH',
    riskAssessment: {
      score: 75,
      level: 'HIGH',
      factors: ['complexity', 'institutional-size'],
      lastAssessed: '2026-02-12'
    },
    agencyName: 'Test Federal Agency',
    agencyUrl: 'https://example.gov/test-agency',
    agencyContact: 'test@example.gov',
    agencyDepartment: 'Department of Testing',
    regulationUrl: 'https://example.gov/regulations/test',
    requirementsUrl: 'https://example.gov/regulations/test/requirements',
    submissionGuideUrl: 'https://example.gov/regulations/test/guide',
    formsUrl: 'https://example.gov/regulations/test/forms',
    sourceUrl: 'https://example.gov/source/test',
    lovvLevel: 'A',
    lastValidated: new Date().toISOString(),
    version: 1,
    versionHash: `hash-${TEST_STAMP}-${suffix}`,
    sources: [{ name: 'Federal Register', url: 'https://federalregister.gov/test' }],
    sections: [{ id: '1', title: 'General', content: 'Test section content' }],
    relatedRegulations: [{ regKey: 'ferpa', relationship: 'related' }],
    applicableInstitutions: ['4-year', '2-year', 'graduate'],
    applicableForms: ['Form-T1', 'Form-T2'],
    filingDeadlines: [
      { type: 'Annual Report', date: '2026-06-30', frequency: 'annual', description: 'Test deadline' }
    ],
  };
}

// ──────────────────────────────────────────
// Test data: Full 21-field compliance tasks
// ──────────────────────────────────────────
function buildFullTasks() {
  return [
    {
      tempId: 'root-1',
      taskId: `task-${TEST_STAMP}-1`,
      title: 'Schema Test: Parent Task',
      description: 'Full 21-field parent task for schema alignment testing',
      instructions: 'Step 1: Verify fields. Step 2: Check database.',
      category: 'Testing',
      assignedRole: 'Compliance Officer',
      statutoryRole: 'Chief Compliance Officer',
      statutoryCitation: '99 U.S.C. § 100',
      requirementType: 'requirement',
      priority: 'critical',
      dueDate: '2026-12-31',
      recurringSchedule: 'annual',
      reminderDays: 30,
      evidenceRequired: true,
      evidenceType: 'document',
      evidenceInstructions: 'Upload the completed compliance checklist',
      estimatedEffort: '4-8 hours',
      deliverable: 'Completed compliance assessment report',
      deliverableTemplateUrl: 'https://example.gov/templates/compliance-report.docx',
      sortOrder: 1,
    },
    {
      tempId: 'child-1a',
      parentTempId: 'root-1',
      taskId: `task-${TEST_STAMP}-1a`,
      title: 'Schema Test: Child Task A',
      description: 'Child task A with full 21-field schema',
      instructions: 'Review current policies and identify gaps.',
      category: 'Testing',
      assignedRole: 'Staff',
      statutoryRole: 'Records Officer',
      statutoryCitation: '99 U.S.C. § 101',
      requirementType: 'best_practice',
      priority: 'high',
      dueDate: '2026-11-30',
      recurringSchedule: 'quarterly',
      reminderDays: 14,
      evidenceRequired: true,
      evidenceType: 'spreadsheet',
      evidenceInstructions: 'Upload gap analysis spreadsheet',
      estimatedEffort: '2-4 hours',
      deliverable: 'Gap analysis spreadsheet',
      deliverableTemplateUrl: 'https://example.gov/templates/gap-analysis.xlsx',
      sortOrder: 2,
    },
  ];
}

// ──────────────────────────────────────────
// Test data: Full 22-field Executive Orders
// ──────────────────────────────────────────
function buildFullEOs() {
  return [
    {
      eoNumber: `EO-TEST-${TEST_STAMP}`,
      title: `Schema Alignment Test Executive Order (${TEST_STAMP})`,
      signedDate: '2026-01-15',
      publishedDate: '2026-01-16',
      status: 'active',
      president: 'Test President',
      term: '2025-2029',
      summary: 'This is a test Executive Order for schema alignment verification.',
      fullTextUrl: 'https://example.gov/eo/test',
      pdfUrl: 'https://example.gov/eo/test.pdf',
      federalRegisterCitation: '91 FR 99999',
      topics: ['higher-education', 'compliance', 'testing'],
      // Impact fields
      impactType: 'modifies',
      impactSeverity: 'high',
      impactSummary: 'This test EO has significant impact on compliance testing.',
      confidenceScore: 0.95,
      affectedSections: ['Section 1', 'Section 3'],
      assessmentDate: '2026-02-12',
    },
  ];
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`   ✅ ${label}`);
    passed++;
  } else {
    console.log(`   ❌ ${label}`);
    failed++;
  }
}

async function cleanup(client) {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Get test regulation IDs first
    const testRegs = await client.query(
      `SELECT id FROM regulations WHERE name LIKE $1`,
      [`Schema Test:%${TEST_STAMP}%`]
    );
    const regIds = testRegs.rows.map(r => r.id);
    
    if (regIds.length > 0) {
      // Delete dependent records first (no CASCADE on FK)
      await client.query(
        `DELETE FROM eo_regulation_impacts WHERE regulation_id = ANY($1)`,
        [regIds]
      );
      await client.query(
        `DELETE FROM compliance_tasks WHERE regulation_id = ANY($1)`,
        [regIds]
      );
      await client.query(
        `DELETE FROM regulation_updates WHERE regulation_id = ANY($1)`,
        [regIds]
      );
      await client.query(
        `DELETE FROM regulation_versions WHERE regulation_id = ANY($1)`,
        [regIds]
      );
      
      // Now delete the regulations
      const result = await client.query(
        `DELETE FROM regulations WHERE id = ANY($1) RETURNING id`,
        [regIds]
      );
      console.log(`   Deleted ${result.rows.length} test regulations (+ dependent records)`);
    } else {
      console.log('   No test regulations to clean up');
    }
    
    // Delete test EOs
    const eoResult = await client.query(
      `DELETE FROM executive_orders WHERE eo_number LIKE $1 RETURNING id`,
      [`EO-TEST%${TEST_STAMP}%`]
    );
    console.log(`   Deleted ${eoResult.rows.length} test Executive Orders`);
    
  } catch (err) {
    console.log(`   ⚠️ Cleanup warning: ${err.message}`);
  }
}

// ──────────────────────────────────────────
// TEST 1: /api/mcp/regulations/create
// ──────────────────────────────────────────
async function testCreateEndpoint(client) {
  console.log('\n' + '='.repeat(60));
  console.log('[TEST 1] POST /api/mcp/regulations/create — Full 48-field payload');
  console.log('='.repeat(60));
  
  const reg = buildFullRegulation('create');
  reg.complianceTasks = buildFullTasks();
  reg.executiveOrders = buildFullEOs();
  
  const res = await fetch(`${EDSTEWARD_URL}/api/mcp/regulations/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': AUTH },
    body: JSON.stringify(reg),
  });
  
  const body = await res.json();
  
  assert(res.status === 201 || res.status === 200, `Status: ${res.status} (expected 200/201)`);
  
  if (res.status >= 400) {
    console.log('   Response:', JSON.stringify(body, null, 2).slice(0, 500));
    return null;
  }
  
  const regId = body.regulation?.id || body.id;
  assert(!!regId, `Regulation ID returned: ${regId}`);
  
  if (!regId) return null;
  
  // Verify regulation fields in DB
  console.log('\n   Verifying regulation fields in database...');
  const dbReg = await client.query(
    'SELECT * FROM regulations WHERE id = $1',
    [regId]
  );
  
  assert(dbReg.rows.length === 1, 'Regulation found in database');
  const r = dbReg.rows[0];
  
  // Core fields
  assert(r.statute === reg.statute, `statute: "${r.statute}"`);
  assert(r.public_law === reg.publicLaw, `public_law: "${r.public_law}"`);
  assert(r.purpose === reg.purpose, `purpose present: ${!!r.purpose}`);
  assert(r.scope === reg.scope, `scope present: ${!!r.scope}`);
  assert(r.reporting_requirements !== null, `reporting_requirements (JSONB): ${!!r.reporting_requirements}`);
  assert(r.risk_assessment !== null, `risk_assessment (JSONB): ${!!r.risk_assessment}`);
  assert(r.risk_score === 75, `risk_score: ${r.risk_score}`);
  assert(r.risk_level === 'HIGH', `risk_level: "${r.risk_level}"`);
  assert(r.agency_name === reg.agencyName, `agency_name: "${r.agency_name}"`);
  assert(r.source_url === reg.sourceUrl, `source_url: "${r.source_url}"`);
  assert(r.lovv_level === 'A', `lovv_level: "${r.lovv_level}"`);
  
  // Verify compliance tasks
  console.log('\n   Verifying compliance tasks...');
  const dbTasks = await client.query(
    'SELECT * FROM compliance_tasks WHERE regulation_id = $1 ORDER BY sort_order',
    [regId]
  );
  
  assert(dbTasks.rows.length >= 2, `Task count: ${dbTasks.rows.length} (expected >= 2)`);
  
  const parentTask = dbTasks.rows.find(t => t.parent_task_id === null);
  if (parentTask) {
    assert(parentTask.estimated_effort === '4-8 hours', `estimated_effort: "${parentTask.estimated_effort}"`);
    assert(parentTask.deliverable === 'Completed compliance assessment report', `deliverable present: ${!!parentTask.deliverable}`);
    assert(parentTask.deliverable_template_url !== null, `deliverable_template_url present: ${!!parentTask.deliverable_template_url}`);
    assert(parentTask.evidence_instructions !== null, `evidence_instructions present: ${!!parentTask.evidence_instructions}`);
    assert(parentTask.recurring_schedule === 'annual', `recurring_schedule: "${parentTask.recurring_schedule}"`);
    assert(parentTask.statutory_role === 'Chief Compliance Officer', `statutory_role: "${parentTask.statutory_role}"`);
    assert(parentTask.statutory_citation === '99 U.S.C. § 100', `statutory_citation: "${parentTask.statutory_citation}"`);
  } else {
    assert(false, 'Parent task not found');
  }
  
  const childTask = dbTasks.rows.find(t => t.parent_task_id !== null);
  if (childTask) {
    assert(childTask.parent_task_id === parentTask?.id, `Child linked to parent (parent_task_id: ${childTask.parent_task_id})`);
    assert(childTask.estimated_effort === '2-4 hours', `Child estimated_effort: "${childTask.estimated_effort}"`);
  } else {
    assert(false, 'Child task not found');
  }
  
  // Verify Executive Orders
  console.log('\n   Verifying Executive Orders...');
  const dbEO = await client.query(
    'SELECT * FROM executive_orders WHERE eo_number = $1',
    [`EO-TEST-${TEST_STAMP}`]
  );
  
  if (dbEO.rows.length > 0) {
    const eo = dbEO.rows[0];
    assert(eo.title.includes('Schema Alignment Test'), `EO title: "${eo.title.slice(0, 50)}..."`);
    assert(eo.president === 'Test President', `EO president: "${eo.president}"`);
    assert(eo.status === 'active', `EO status: "${eo.status}"`);
    assert(eo.summary !== null, `EO summary present: ${!!eo.summary}`);
    assert(eo.pdf_url !== null, `EO pdf_url present: ${!!eo.pdf_url}`);
    assert(eo.federal_register_citation === '91 FR 99999', `EO citation: "${eo.federal_register_citation}"`);
    
    // Check impact record
    const dbImpact = await client.query(
      'SELECT * FROM eo_regulation_impacts WHERE eo_id = $1 AND regulation_id = $2',
      [eo.id, regId]
    );
    
    if (dbImpact.rows.length > 0) {
      const impact = dbImpact.rows[0];
      assert(impact.impact_type === 'modifies', `Impact type: "${impact.impact_type}"`);
      assert(impact.impact_severity === 'high', `Impact severity: "${impact.impact_severity}"`);
      assert(impact.affected_sections !== null, `affected_sections (JSONB): ${!!impact.affected_sections}`);
    } else {
      assert(false, 'EO impact record not found');
    }
  } else {
    assert(false, 'Executive Order not found in database');
  }
  
  return regId;
}

// ──────────────────────────────────────────
// TEST 2: /api/mcp/regulations/sync
// ──────────────────────────────────────────
async function testSyncEndpoint(client) {
  console.log('\n' + '='.repeat(60));
  console.log('[TEST 2] POST /api/mcp/regulations/sync — Full upsert payload');
  console.log('='.repeat(60));
  
  const reg = buildFullRegulation('sync');
  reg.complianceTasks = buildFullTasks();
  // Change some fields for the "sync" variant
  reg.riskScore = 85;
  reg.riskLevel = 'CRITICAL';
  reg.purpose = 'Sync endpoint test: verify upsert with full 48 fields.';
  
  const res = await fetch(`${EDSTEWARD_URL}/api/mcp/regulations/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': AUTH },
    body: JSON.stringify(reg),
  });
  
  const body = await res.json();
  
  assert(res.status === 200 || res.status === 201, `Status: ${res.status} (expected 200/201)`);
  
  if (res.status >= 400) {
    console.log('   Response:', JSON.stringify(body, null, 2).slice(0, 500));
    return null;
  }
  
  const regId = body.regulation?.id || body.id;
  assert(!!regId, `Regulation ID returned: ${regId}`);
  
  if (!regId) return null;
  
  // Verify key fields
  const dbReg = await client.query('SELECT * FROM regulations WHERE id = $1', [regId]);
  const r = dbReg.rows[0];
  
  assert(r.risk_score === 85, `Sync risk_score: ${r.risk_score}`);
  assert(r.risk_level === 'CRITICAL', `Sync risk_level: "${r.risk_level}"`);
  assert(r.purpose?.includes('Sync endpoint test'), `Sync purpose applied: ${!!r.purpose}`);
  assert(r.public_law === reg.publicLaw, `Sync public_law: "${r.public_law}"`);
  assert(r.reporting_requirements !== null, `Sync reporting_requirements: ${!!r.reporting_requirements}`);
  
  // Now sync again with updated fields (upsert test)
  console.log('\n   Testing upsert (second sync with same regKey)...');
  reg.purpose = 'Updated purpose via upsert.';
  reg.riskScore = 90;
  
  const res2 = await fetch(`${EDSTEWARD_URL}/api/mcp/regulations/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': AUTH },
    body: JSON.stringify(reg),
  });
  
  assert(res2.status === 200 || res2.status === 201, `Upsert status: ${res2.status}`);
  
  const dbReg2 = await client.query('SELECT * FROM regulations WHERE id = $1', [regId]);
  const r2 = dbReg2.rows[0];
  assert(r2.purpose === 'Updated purpose via upsert.', `Upsert purpose applied: "${r2.purpose?.slice(0, 40)}"`);
  assert(r2.risk_score === 90, `Upsert risk_score: ${r2.risk_score}`);
  
  return regId;
}

// ──────────────────────────────────────────
// TEST 3: /api/regulation-updates
// ──────────────────────────────────────────
async function testUpdatesEndpoint(client) {
  console.log('\n' + '='.repeat(60));
  console.log('[TEST 3] POST /api/regulation-updates — Full update payload');
  console.log('='.repeat(60));
  
  const reg = buildFullRegulation('updates');
  reg.complianceTasks = buildFullTasks();
  reg.executiveOrders = buildFullEOs();
  // Change EO number to avoid collision with Test 1
  reg.executiveOrders[0].eoNumber = `EO-TEST-UPD-${TEST_STAMP}`;
  
  // The updates endpoint expects originalContent and updatedContent
  reg.regulationText = 'Full regulation text for the updates endpoint test.';
  // status must be a valid regulation_updates status
  reg.status = 'pending';
  
  const res = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': AUTH },
    body: JSON.stringify(reg),
  });
  
  const body = await res.json();
  
  assert(res.status === 201 || res.status === 200, `Status: ${res.status} (expected 200/201)`);
  
  if (res.status >= 400) {
    console.log('   Response:', JSON.stringify(body, null, 2).slice(0, 500));
    return null;
  }
  
  assert(body.success === true || body.id, `Success/ID in response: ${body.success || body.id}`);
  
  // Check that regulation_updates record was created with metadata
  const updateId = body.update?.id || body.id;
  if (updateId) {
    console.log('\n   Verifying regulation_updates record...');
    const dbUpdate = await client.query(
      'SELECT * FROM regulation_updates WHERE id = $1',
      [updateId]
    );
    
    if (dbUpdate.rows.length > 0) {
      const u = dbUpdate.rows[0];
      assert(u.name?.includes('Schema Test'), `Update name: "${u.name?.slice(0, 50)}"`);
      
      // Check metadata.regulationFields
      const meta = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
      if (meta?.regulationFields) {
        const rf = meta.regulationFields;
        assert(rf.publicLaw === reg.publicLaw, `metadata.regulationFields.publicLaw: "${rf.publicLaw}"`);
        assert(rf.purpose === reg.purpose, `metadata.regulationFields.purpose present: ${!!rf.purpose}`);
        assert(rf.scope === reg.scope, `metadata.regulationFields.scope present: ${!!rf.scope}`);
        assert(rf.agencyName === reg.agencyName, `metadata.regulationFields.agencyName: "${rf.agencyName}"`);
      } else {
        assert(false, 'metadata.regulationFields not found in update record');
      }
      
      // Check pending tasks
      assert(u.pending_tasks !== null, `pending_tasks stored: ${!!u.pending_tasks}`);
      
      // Check executive orders in metadata
      if (meta?.executiveOrders) {
        assert(meta.executiveOrders.length > 0, `EOs in metadata: ${meta.executiveOrders.length}`);
      }
    }
  }
  
  // Cleanup test EOs from this test  
  await client.query(
    `DELETE FROM executive_orders WHERE eo_number = $1`,
    [`EO-TEST-UPD-${TEST_STAMP}`]
  );
  
  return updateId;
}

// ──────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('MCP ENGINE SCHEMA ALIGNMENT — INTEGRATION TEST');
  console.log(`Timestamp: ${TEST_STAMP}`);
  console.log(`Target: ${EDSTEWARD_URL}`);
  console.log('='.repeat(60));
  
  // Health check
  try {
    const healthRes = await fetch(`${EDSTEWARD_URL}/api/health`);
    const health = await healthRes.json();
    if (health.status !== 'healthy' && health.status !== 'degraded') {
      console.error('❌ Server not ready:', health);
      process.exit(1);
    }
    if (!health.database?.connected) {
      console.error('❌ Database not connected. Wait for server to fully start.');
      process.exit(1);
    }
    console.log('✅ Server healthy\n');
  } catch (err) {
    console.error(`❌ Cannot reach ${EDSTEWARD_URL}: ${err.message}`);
    console.error('   Make sure the EdSteward server is running (npm run dev)');
    process.exit(1);
  }
  
  const client = await pool.connect();
  
  try {
    // Run tests
    await testCreateEndpoint(client);
    await testSyncEndpoint(client);
    await testUpdatesEndpoint(client);
    
    // Cleanup
    await cleanup(client);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('='.repeat(60));
    
    if (failed > 0) {
      console.log('\n⚠️  Some tests failed — review output above');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
