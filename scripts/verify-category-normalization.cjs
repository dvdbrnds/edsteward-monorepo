const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function verify() {
  const client = await pool.connect();
  try {
    console.log('=== Category Normalization Verification ===\n');
    
    // Check recent regulation
    const reg = await client.query(`
      SELECT r.id, r.item_id, r.category, r.original_category, cc.name as canonical_name
      FROM regulations r
      LEFT JOIN canonical_categories cc ON cc.id = r.canonical_category_id
      WHERE r.item_id = 'test-category-normalization-001'
    `);
    
    if (reg.rows.length > 0) {
      const r = reg.rows[0];
      console.log('Test Regulation:');
      console.log(`  Original category: "${r.original_category}"`);
      console.log(`  Normalized to:     "${r.category}"`);
      console.log(`  Canonical link:    "${r.canonical_name}"`);
    }
    
    // Check if mapping was created
    const mapping = await client.query(`
      SELECT cm.*, cc.name as canonical_name
      FROM category_mappings cm
      JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
      WHERE cm.incoming_category = 'Student Data Privacy Requirements'
    `);
    
    if (mapping.rows.length > 0) {
      const m = mapping.rows[0];
      console.log(`\n✅ Auto-mapping created:`);
      console.log(`   "${m.incoming_category}" → "${m.canonical_name}"`);
      console.log(`   Confidence: ${(parseFloat(m.confidence) * 100).toFixed(0)}%`);
      console.log(`   Verified: ${m.is_verified}`);
    }
    
    // Show all unverified mappings
    const unverified = await client.query(`
      SELECT cm.incoming_category, cc.name as canonical_name, cm.confidence
      FROM category_mappings cm
      JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
      WHERE cm.is_verified = false
      ORDER BY cm.confidence ASC
      LIMIT 10
    `);
    
    if (unverified.rows.length > 0) {
      console.log('\n📋 Unverified mappings (for review):');
      unverified.rows.forEach(m => {
        console.log(`   "${m.incoming_category}" → "${m.canonical_name}" (${(parseFloat(m.confidence) * 100).toFixed(0)}%)`);
      });
    }
    
    // Cleanup test
    await client.query("DELETE FROM regulations WHERE item_id = 'test-category-normalization-001'");
    console.log('\n✅ Test data cleaned up');
    
  } finally {
    client.release();
    await pool.end();
  }
}
verify();
