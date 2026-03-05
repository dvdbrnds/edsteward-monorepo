const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function verify() {
  const client = await pool.connect();
  
  try {
    console.log('Verifying test regulation...\n');
    
    const result = await client.query(`
      SELECT id, item_id, name, lovv_level, last_validated, version_hash, 
             filing_deadlines, actions, jurisdiction_source
      FROM regulations 
      WHERE name = 'Pre-Alignment Test Regulation'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Test regulation not found');
      return;
    }
    
    const reg = result.rows[0];
    console.log('Found regulation:');
    console.log(`  ID: ${reg.id}`);
    console.log(`  item_id: ${reg.item_id}`);
    console.log(`  lovv_level: ${reg.lovv_level || 'NOT SET'}`);
    console.log(`  last_validated: ${reg.last_validated || 'NOT SET'}`);
    console.log(`  version_hash: ${reg.version_hash || 'NOT SET'}`);
    console.log(`  filing_deadlines: ${JSON.stringify(reg.filing_deadlines)}`);
    console.log(`  actions: ${reg.actions ? 'SET' : 'NOT SET'}`);
    
    // Check tasks
    const tasks = await client.query(`
      SELECT id, title, status, priority FROM compliance_tasks 
      WHERE regulation_id = $1
    `, [reg.id]);
    
    console.log(`\nTasks: ${tasks.rows.length}`);
    tasks.rows.forEach(t => {
      console.log(`  - ${t.title} (${t.status}, ${t.priority})`);
    });
    
    // Clean up test data
    console.log('\nCleaning up test data...');
    await client.query('DELETE FROM compliance_tasks WHERE regulation_id = $1', [reg.id]);
    await client.query('DELETE FROM regulations WHERE id = $1', [reg.id]);
    console.log('✅ Test data cleaned up');
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
