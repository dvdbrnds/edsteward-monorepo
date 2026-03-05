const { Pool } = require('pg');

async function initDatabase() {
  // Database connection parameters
  const dbPassword = process.env.DB_PASSWORD;
  const dbHost = process.env.DB_HOST;
  
  if (!dbPassword || !dbHost) {
    console.error('Missing DB_PASSWORD or DB_HOST environment variables');
    process.exit(1);
  }

  const connectionString = `postgresql://postgres:${dbPassword}@${dbHost}/edsteward`;
  console.log('Connecting to:', connectionString.replace(dbPassword, '***'));

  const pool = new Pool({ connectionString });

  try {
    // Test connection
    console.log('Testing database connection...');
    const result = await pool.query('SELECT version()');
    console.log('Connected successfully:', result.rows[0].version);

    // Check if tables exist
    console.log('Checking existing tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Existing tables:', tables.rows.map(r => r.table_name));
    
    if (tables.rows.length === 0) {
      console.log('No tables found. Database schema needs to be created.');
    } else {
      console.log(`Found ${tables.rows.length} tables. Database appears to be initialized.`);
    }

  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase().catch(console.error); 