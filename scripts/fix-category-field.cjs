const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function fix() {
  const client = await pool.connect();
  try {
    console.log('Fixing category field to use canonical names...\n');
    
    // First, make sure original_category has the old value
    await client.query(`
      UPDATE regulations
      SET original_category = category
      WHERE original_category IS NULL OR original_category = ''
    `);
    console.log('✅ Preserved original categories');
    
    // Now update category to use canonical name
    const result = await client.query(`
      UPDATE regulations r
      SET category = cc.name
      FROM canonical_categories cc
      WHERE r.canonical_category_id = cc.id
        AND r.category != cc.name
    `);
    
    console.log(`✅ Updated ${result.rowCount} regulations to canonical categories`);
    
    // Verify
    const cats = await client.query(`
      SELECT category, COUNT(*) as count
      FROM regulations
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log(`\nNow have ${cats.rows.length} distinct categories:\n`);
    cats.rows.forEach(r => {
      console.log(`  ${r.count.toString().padStart(4)} - ${r.category}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}
fix();
