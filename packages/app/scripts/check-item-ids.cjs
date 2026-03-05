const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' 
});

async function main() {
  const client = await pool.connect();
  
  // Check item_id values
  const result = await client.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(item_id) as with_item_id,
      COUNT(CASE WHEN item_id IS NULL OR item_id = '' THEN 1 END) as missing_item_id
    FROM regulations
  `);
  
  console.log('Item ID Status:');
  console.log(`  Total regulations: ${result.rows[0].total}`);
  console.log(`  With item_id: ${result.rows[0].with_item_id}`);
  console.log(`  Missing item_id: ${result.rows[0].missing_item_id}`);
  
  // Show sample item_ids
  const samples = await client.query(`
    SELECT id, item_id, name 
    FROM regulations 
    ORDER BY id 
    LIMIT 5
  `);
  
  console.log('\nSample regulations:');
  samples.rows.forEach(r => {
    console.log(`  ID: ${r.id} | item_id: ${r.item_id || '(empty)'} | ${r.name.substring(0, 40)}...`);
  });
  
  client.release();
  await pool.end();
}
main();
