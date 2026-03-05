const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' 
});

async function main() {
  const client = await pool.connect();
  
  // Check FK constraints on compliance_tasks
  const fks = await client.query(`
    SELECT
      tc.table_name as referencing_table,
      kcu.column_name as referencing_column,
      ccu.table_name as referenced_table,
      ccu.column_name as referenced_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name IN ('compliance_tasks', 'regulations')
    ORDER BY tc.table_name
  `);
  
  console.log('Foreign Keys referencing compliance_tasks or regulations:');
  fks.rows.forEach(row => {
    console.log(`  ${row.referencing_table}.${row.referencing_column} -> ${row.referenced_table}.${row.referenced_column}`);
  });
  
  // Check regulations columns for timestamp
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'regulations' 
    AND column_name LIKE '%date%' OR column_name LIKE '%time%' OR column_name LIKE '%at'
    ORDER BY column_name
  `);
  console.log('\nRegulations timestamp columns:');
  cols.rows.forEach(r => console.log('  ', r.column_name));
  
  client.release();
  await pool.end();
}
main();
