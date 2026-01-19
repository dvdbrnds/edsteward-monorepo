const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function cleanup() {
  const client = await pool.connect();
  try {
    const reg = await client.query("SELECT id FROM regulations WHERE item_id = 'test-sync-regulation-001'");
    if (reg.rows.length > 0) {
      await client.query('DELETE FROM regulation_topics WHERE regulation_id = $1', [reg.rows[0].id]);
      await client.query('DELETE FROM compliance_tasks WHERE regulation_id = $1', [reg.rows[0].id]);
      await client.query('DELETE FROM regulations WHERE id = $1', [reg.rows[0].id]);
      console.log('✅ Test data cleaned up');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
cleanup();
