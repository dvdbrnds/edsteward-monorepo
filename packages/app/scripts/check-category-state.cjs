const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function check() {
  const client = await pool.connect();
  try {
    console.log('=== CURRENT CATEGORY STATE ===\n');
    
    // Show distinct categories in the category field
    const cats = await client.query(`
      SELECT category, COUNT(*) as count
      FROM regulations
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log('Distinct values in "category" column:');
    console.log(`Total unique values: ${cats.rows.length}\n`);
    cats.rows.forEach(r => {
      console.log(`  ${r.count.toString().padStart(4)} - ${r.category}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}
check();
