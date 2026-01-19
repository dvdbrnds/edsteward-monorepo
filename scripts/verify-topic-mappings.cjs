const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function verify() {
  const client = await pool.connect();
  
  try {
    console.log('Verifying topic mappings...\n');
    
    // Find the test regulation
    const reg = await client.query(`
      SELECT id, name FROM regulations 
      WHERE name = 'Multi-Topic Test Regulation'
    `);
    
    if (reg.rows.length === 0) {
      console.log('❌ Test regulation not found');
      return;
    }
    
    const regId = reg.rows[0].id;
    console.log(`Found regulation ID: ${regId}`);
    
    // Get topic mappings
    const topics = await client.query(`
      SELECT * FROM regulation_topics 
      WHERE regulation_id = $1
      ORDER BY id
    `, [regId]);
    
    console.log(`\nTopic mappings (${topics.rows.length}):`);
    topics.rows.forEach(t => {
      console.log(`  ✅ ${t.topic}`);
      console.log(`     Topic ID: ${t.topic_id}`);
      console.log(`     Department: ${t.department}`);
      console.log(`     Role: ${t.responsible_role}`);
    });
    
    // Cleanup
    console.log('\nCleaning up test data...');
    await client.query('DELETE FROM regulation_topics WHERE regulation_id = $1', [regId]);
    await client.query('DELETE FROM regulations WHERE id = $1', [regId]);
    console.log('✅ Test data cleaned up');
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
