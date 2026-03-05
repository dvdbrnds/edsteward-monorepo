const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' 
});

async function main() {
  const client = await pool.connect();
  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'regulations' 
    ORDER BY ordinal_position
  `);
  console.log('Regulations table columns:');
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
  client.release();
  await pool.end();
}
main();
