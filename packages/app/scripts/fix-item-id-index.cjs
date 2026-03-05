const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function fixIndex() {
  const client = await pool.connect();
  
  console.log('Checking item_id index...\n');
  
  try {
    // Check existing indexes
    const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'regulations'
      ORDER BY indexname
    `);
    
    console.log('Current indexes:');
    indexes.rows.forEach(r => console.log(`  ${r.indexname}`));
    
    // Check for item_id index specifically
    const itemIdIndex = indexes.rows.find(r => r.indexdef.includes('item_id'));
    
    if (!itemIdIndex) {
      console.log('\n❌ No index on item_id found. Creating unique index...');
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_regulations_item_id_unique 
        ON regulations(item_id)
      `);
      console.log('✅ Unique index created');
    } else {
      console.log(`\n✅ Index exists: ${itemIdIndex.indexname}`);
      console.log(`   Definition: ${itemIdIndex.indexdef}`);
    }
    
    // Verify the index now exists
    const verify = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'regulations' AND indexdef LIKE '%item_id%'
    `);
    
    if (verify.rows.length > 0) {
      console.log('\n✅ item_id index verified');
    } else {
      console.log('\n❌ Index creation failed');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

fixIndex().catch(console.error);
