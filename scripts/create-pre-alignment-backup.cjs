const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function createBackup() {
  const client = await pool.connect();
  
  console.log('Creating pre-alignment backup tables...\n');
  
  try {
    // Check if backup tables already exist
    const existsCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'regulations_backup_pre_alignment'
    `);
    
    if (existsCheck.rows.length > 0) {
      console.log('⚠️  Backup tables already exist. Dropping and recreating...');
      await client.query('DROP TABLE IF EXISTS compliance_tasks_backup_pre_alignment');
      await client.query('DROP TABLE IF EXISTS regulations_backup_pre_alignment');
    }
    
    // Create backup of regulations
    console.log('Creating regulations backup...');
    await client.query(`
      CREATE TABLE regulations_backup_pre_alignment AS 
      SELECT * FROM regulations
    `);
    const regCount = await client.query('SELECT COUNT(*) FROM regulations_backup_pre_alignment');
    console.log(`  ✅ Backed up ${regCount.rows[0].count} regulations`);
    
    // Create backup of compliance_tasks
    console.log('Creating compliance_tasks backup...');
    await client.query(`
      CREATE TABLE compliance_tasks_backup_pre_alignment AS 
      SELECT * FROM compliance_tasks
    `);
    const taskCount = await client.query('SELECT COUNT(*) FROM compliance_tasks_backup_pre_alignment');
    console.log(`  ✅ Backed up ${taskCount.rows[0].count} tasks`);
    
    console.log('\n✅ Backup complete!');
    console.log('\nTo restore from backup if needed:');
    console.log('  DELETE FROM compliance_tasks;');
    console.log('  DELETE FROM regulations;');
    console.log('  INSERT INTO regulations SELECT * FROM regulations_backup_pre_alignment;');
    console.log('  INSERT INTO compliance_tasks SELECT * FROM compliance_tasks_backup_pre_alignment;');
    
  } finally {
    client.release();
    await pool.end();
  }
}

createBackup().catch(console.error);
