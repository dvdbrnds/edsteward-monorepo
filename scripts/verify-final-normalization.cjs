const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function verify() {
  const client = await pool.connect();
  
  console.log('=== FINAL VERIFICATION ===\n');
  
  try {
    // Total counts
    const total = await client.query('SELECT COUNT(*) as count FROM regulations');
    const normalized = await client.query('SELECT COUNT(*) as count FROM regulations WHERE canonical_category_id IS NOT NULL');
    const withOriginal = await client.query('SELECT COUNT(*) as count FROM regulations WHERE original_category IS NOT NULL');
    
    console.log(`Total regulations:      ${total.rows[0].count}`);
    console.log(`With canonical_id:      ${normalized.rows[0].count}`);
    console.log(`With original_category: ${withOriginal.rows[0].count}`);
    
    // Mapping stats
    const mappings = await client.query('SELECT COUNT(*) as count FROM category_mappings');
    const verified = await client.query('SELECT COUNT(*) as count FROM category_mappings WHERE is_verified = true');
    
    console.log(`\nCategory mappings:      ${mappings.rows[0].count}`);
    console.log(`Verified mappings:      ${verified.rows[0].count}`);
    
    // Sample data
    console.log('\n📋 Sample regulations with category data:');
    const sample = await client.query(`
      SELECT r.name, r.category, r.original_category, cc.name as canonical
      FROM regulations r
      LEFT JOIN canonical_categories cc ON cc.id = r.canonical_category_id
      WHERE r.original_category IS NOT NULL
      LIMIT 5
    `);
    
    sample.rows.forEach((r, i) => {
      console.log(`\n  ${i+1}. ${r.name.substring(0, 50)}...`);
      console.log(`     Category: ${r.category}`);
      console.log(`     Original: ${r.original_category}`);
      console.log(`     Canonical: ${r.canonical}`);
    });
    
    console.log('\n✅ Verification complete!');
    
  } finally {
    client.release();
    await pool.end();
  }
}
verify();
