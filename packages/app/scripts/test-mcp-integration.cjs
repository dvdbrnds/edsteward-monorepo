const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const EDSTEWARD_URL = 'http://localhost:3000';
const AUTH = 'Basic ' + Buffer.from((process.env.MCP_ENGINE_USERNAME || 'dvdbrnds') + ':' + (process.env.MCP_ENGINE_PASSWORD || 'changeme')).toString('base64');

const pool = new Pool({ connectionString: DATABASE_URL });

async function testIntegration() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('EDSTEWARD MCP ENGINE INTEGRATION TEST');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Health check
    console.log('\n[TEST 1] Health Check...');
    const healthRes = await fetch(`${EDSTEWARD_URL}/api/health`);
    const health = await healthRes.json();
    if (health.status === 'healthy') {
      console.log('  ✅ Server healthy');
    } else {
      console.log('  ❌ Server unhealthy:', health);
      return;
    }
    
    // Test 2: Create regulation with full MCP payload
    console.log('\n[TEST 2] Create Regulation with Tasks...');
    const testRegulation = {
      name: 'E2E Test: Pennsylvania Test Compliance Act',
      statute: '99 Pa.C.S. § 9999',
      category: 'Test Category',
      topic: 'End-to-End Testing',
      jurisdictionSource: 'state',
      stateCode: 'PA',
      summary: 'This is an end-to-end test regulation for MCP Engine integration.',
      requirements: '• Verify integration endpoint\n• Test all fields\n• Confirm task creation',
      lovvLevel: 'A',
      lastValidated: new Date().toISOString(),
      version: 1,
      versionHash: 'e2e-test-hash-' + Date.now(),
      sourceUrl: 'https://example.com/test-e2e',
      agency_name: 'PA Test Department',
      agency_url: 'https://example.com/pa-dept',
      filingDeadlines: [
        {
          type: 'Annual Compliance Report',
          date: '2026-06-30',
          frequency: 'annual',
          description: 'Submit annual compliance report'
        },
        {
          type: 'Quarterly Update',
          date: '2026-03-31',
          frequency: 'quarterly',
          description: 'Submit quarterly status update'
        }
      ],
      complianceTasks: [
        {
          tempId: 'root-1',
          title: 'Establish Compliance Framework',
          description: 'Set up the compliance framework for this regulation',
          assignedRole: 'Compliance Officer',
          priority: 'critical',
          evidenceRequired: true,
          evidenceType: 'document'
        },
        {
          tempId: 'sub-1a',
          parentTempId: 'root-1',
          title: 'Document Current Processes',
          description: 'Document all current processes',
          assignedRole: 'Staff',
          priority: 'high'
        },
        {
          tempId: 'sub-1b',
          parentTempId: 'root-1',
          title: 'Identify Gaps',
          description: 'Identify compliance gaps',
          assignedRole: 'Compliance Officer',
          priority: 'high'
        },
        {
          tempId: 'root-2',
          title: 'Submit Reports',
          description: 'Submit required compliance reports',
          assignedRole: 'Compliance Officer',
          priority: 'medium',
          dueDate: '2026-06-30',
          evidenceRequired: true,
          evidenceType: 'document'
        }
      ],
      metadata: {
        source: 'MCP Engine E2E Test',
        mcpVersion: '1.0.0'
      }
    };
    
    const createRes = await fetch(`${EDSTEWARD_URL}/api/mcp/regulations/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH
      },
      body: JSON.stringify(testRegulation)
    });
    
    const createResult = await createRes.json();
    
    if (!createResult.success) {
      console.log('  ❌ Failed to create regulation:', createResult.error);
      console.log('  Details:', createResult.details);
      return;
    }
    
    console.log(`  ✅ Regulation created: ID ${createResult.regulation.id}`);
    console.log(`     Item ID: ${createResult.regulation.itemId}`);
    console.log(`     Tasks created: ${createResult.tasks?.length || 0}`);
    
    const regId = createResult.regulation.id;
    
    // Test 3: Verify database storage
    console.log('\n[TEST 3] Verify Database Storage...');
    const dbReg = await client.query(`
      SELECT id, item_id, name, jurisdiction_source, state_code,
             lovv_level, last_validated, version_hash, source_url,
             agency_name, filing_deadlines, actions
      FROM regulations WHERE id = $1
    `, [regId]);
    
    const reg = dbReg.rows[0];
    const checks = [
      ['name', reg.name === testRegulation.name],
      ['jurisdiction_source', reg.jurisdiction_source === 'state'],
      ['state_code', reg.state_code === 'PA'],
      ['lovv_level', reg.lovv_level === 'A'],
      ['last_validated', reg.last_validated !== null],
      ['version_hash', reg.version_hash !== null && reg.version_hash.startsWith('e2e-test-hash-')],
      ['source_url', reg.source_url === 'https://example.com/test-e2e'],
      ['agency_name', reg.agency_name === 'PA Test Department'],
      ['filing_deadlines', Array.isArray(reg.filing_deadlines) && reg.filing_deadlines.length === 2],
      ['actions', Array.isArray(reg.actions) && reg.actions.length === 4]
    ];
    
    let allPassed = true;
    for (const [field, passed] of checks) {
      console.log(`  ${passed ? '✅' : '❌'} ${field}`);
      if (!passed) allPassed = false;
    }
    
    // Test 4: Verify tasks
    console.log('\n[TEST 4] Verify Task Hierarchy...');
    const tasks = await client.query(`
      SELECT id, title, parent_task_id, priority, evidence_required
      FROM compliance_tasks WHERE regulation_id = $1
      ORDER BY parent_task_id NULLS FIRST, id
    `, [regId]);
    
    console.log(`  Found ${tasks.rows.length} tasks`);
    const rootTasks = tasks.rows.filter(t => !t.parent_task_id);
    const childTasks = tasks.rows.filter(t => t.parent_task_id);
    console.log(`  Root tasks: ${rootTasks.length}`);
    console.log(`  Child tasks: ${childTasks.length}`);
    
    if (rootTasks.length === 2 && childTasks.length === 2) {
      console.log('  ✅ Task hierarchy correct');
    } else {
      console.log('  ❌ Task hierarchy incorrect');
      allPassed = false;
    }
    
    // Test 5: Verify actions workflow
    console.log('\n[TEST 5] Verify Actions Workflow...');
    const attestation = reg.actions.find(a => a.type === 'attestation');
    const agencySubmission = reg.actions.find(a => a.type === 'agency_submission');
    
    if (attestation && attestation.enabled && attestation.required && attestation.status === 'pending') {
      console.log('  ✅ Attestation action configured correctly');
    } else {
      console.log('  ❌ Attestation action misconfigured');
      allPassed = false;
    }
    
    if (agencySubmission && agencySubmission.enabled && agencySubmission.required) {
      console.log('  ✅ Agency submission action enabled (has deadlines)');
    } else {
      console.log('  ❌ Agency submission should be enabled (has deadlines)');
      allPassed = false;
    }
    
    // Cleanup
    console.log('\n[CLEANUP] Removing test data...');
    await client.query('DELETE FROM compliance_tasks WHERE regulation_id = $1', [regId]);
    await client.query('DELETE FROM regulations WHERE id = $1', [regId]);
    console.log('  ✅ Test data removed');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED - EdSteward ready for MCP Engine alignment!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review above for details');
    }
    console.log('='.repeat(60));
    
  } finally {
    client.release();
    await pool.end();
  }
}

testIntegration().catch(console.error);
