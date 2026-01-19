const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function verify() {
  const client = await pool.connect();
  
  try {
    console.log('=== FULL MCP INTEGRATION TEST VERIFICATION ===\n');
    
    const result = await client.query(`
      SELECT id, item_id, name, jurisdiction_source, state_code,
             lovv_level, last_validated, version_hash, version_number,
             source_url, agency_name, agency_url,
             filing_deadlines, actions
      FROM regulations 
      WHERE name = 'Full MCP Integration Test'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Test regulation not found');
      return;
    }
    
    const reg = result.rows[0];
    console.log('Regulation found:');
    console.log(`  ID: ${reg.id}`);
    console.log(`  item_id: ${reg.item_id}`);
    console.log(`  jurisdiction_source: ${reg.jurisdiction_source}`);
    
    console.log('\n--- MCP Engine Fields ---');
    console.log(`  lovv_level: ${reg.lovv_level ? '✅ ' + reg.lovv_level : '❌ NOT SET'}`);
    console.log(`  last_validated: ${reg.last_validated ? '✅ ' + reg.last_validated.toISOString() : '❌ NOT SET'}`);
    console.log(`  version_hash: ${reg.version_hash ? '✅ ' + reg.version_hash : '❌ NOT SET'}`);
    console.log(`  state_code: ${reg.state_code ? '✅ ' + reg.state_code : '❌ NOT SET'}`);
    console.log(`  source_url: ${reg.source_url ? '✅ ' + reg.source_url : '❌ NOT SET'}`);
    console.log(`  version_number: ${reg.version_number}`);
    
    console.log('\n--- Agency Info ---');
    console.log(`  agency_name: ${reg.agency_name || 'NOT SET'}`);
    console.log(`  agency_url: ${reg.agency_url || 'NOT SET'}`);
    
    console.log('\n--- Filing Deadlines ---');
    console.log(`  ${JSON.stringify(reg.filing_deadlines, null, 2)}`);
    
    console.log('\n--- Actions (Compliance Workflow) ---');
    if (reg.actions) {
      reg.actions.forEach(a => {
        console.log(`  ${a.type}: enabled=${a.enabled}, required=${a.required}, status=${a.status}`);
      });
    } else {
      console.log('  ❌ NO ACTIONS SET');
    }
    
    // Check tasks
    const tasks = await client.query(`
      SELECT id, title, parent_task_id, status, priority, evidence_required, evidence_type
      FROM compliance_tasks 
      WHERE regulation_id = $1
      ORDER BY parent_task_id NULLS FIRST
    `, [reg.id]);
    
    console.log(`\n--- Compliance Tasks (${tasks.rows.length}) ---`);
    tasks.rows.forEach(t => {
      const indent = t.parent_task_id ? '    └─' : '  ';
      console.log(`${indent}[${t.id}] ${t.title} (${t.status}, ${t.priority})`);
      if (t.evidence_required) {
        console.log(`${indent}    Evidence: ${t.evidence_type}`);
      }
    });
    
    // Clean up test data
    console.log('\n--- Cleanup ---');
    await client.query('DELETE FROM compliance_tasks WHERE regulation_id = $1', [reg.id]);
    await client.query('DELETE FROM regulations WHERE id = $1', [reg.id]);
    console.log('✅ Test data cleaned up');
    
    console.log('\n=== VERIFICATION COMPLETE ===');
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
