const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function report() {
  const client = await pool.connect();
  try {
    console.log('');
    console.log('## DATABASE SCHEMA FOR MCP');
    
    // Check MCP-related columns in regulations
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'regulations' 
      AND column_name IN ('lovv_level', 'last_validated', 'version_hash', 'state_code', 'source_url', 'original_category', 'canonical_category_id', 'item_id')
      ORDER BY column_name
    `);
    console.log('\nMCP fields in regulations table:');
    cols.rows.forEach(r => console.log('  ✅', r.column_name));
    
    // Check category tables
    const catTables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename IN ('canonical_categories', 'category_mappings', 'regulation_topics', 'regulation_updates', 'version_conflicts')
      ORDER BY tablename
    `);
    console.log('\nMCP support tables:');
    catTables.rows.forEach(r => console.log('  ✅', r.tablename));
    
    // Stats
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM regulations) as total_regs,
        (SELECT COUNT(*) FROM regulations WHERE canonical_category_id IS NOT NULL) as normalized,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL) as with_lovv,
        (SELECT COUNT(*) FROM regulations WHERE item_id IS NOT NULL) as with_item_id,
        (SELECT COUNT(*) FROM canonical_categories) as categories,
        (SELECT COUNT(*) FROM category_mappings) as mappings
    `);
    const s = stats.rows[0];
    console.log('\n## DATA READINESS');
    console.log('  Total regulations:', s.total_regs);
    console.log('  With item_id (sync key):', s.with_item_id);
    console.log('  Normalized categories:', s.normalized);
    console.log('  With L.O.V.V. level:', s.with_lovv);
    console.log('  Canonical categories:', s.categories);
    console.log('  Category mappings:', s.mappings);
    
    // Check indexes
    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'regulations' 
      AND indexname LIKE '%item_id%' OR indexname LIKE '%lovv%' OR indexname LIKE '%canonical%'
    `);
    console.log('\n## INDEXES');
    indexes.rows.forEach(r => console.log('  ✅', r.indexname));
    
  } finally {
    client.release();
    await pool.end();
  }
}
report();
