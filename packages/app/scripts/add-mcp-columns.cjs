const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function addMissingColumns() {
  const client = await pool.connect();
  
  console.log('Adding missing MCP Engine columns to regulations table...\n');
  
  try {
    // Add lovv_level for L.O.V.V. validation levels
    console.log('Adding lovv_level...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS lovv_level CHAR(1) CHECK (lovv_level IN ('A', 'B', 'C', 'D'))
    `);
    console.log('  ✅ lovv_level added');
    
    // Add last_validated timestamp
    console.log('Adding last_validated...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS last_validated TIMESTAMP WITH TIME ZONE
    `);
    console.log('  ✅ last_validated added');
    
    // Add version_hash for change detection
    console.log('Adding version_hash...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS version_hash VARCHAR(64)
    `);
    console.log('  ✅ version_hash added');
    
    // Add state_code for state-level regulations
    console.log('Adding state_code...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS state_code VARCHAR(2)
    `);
    console.log('  ✅ state_code added');
    
    // Add source_url for original regulation source
    console.log('Adding source_url...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS source_url TEXT
    `);
    console.log('  ✅ source_url added');
    
    // Create indexes for new columns
    console.log('\nCreating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_regulations_lovv_level ON regulations(lovv_level)
    `);
    console.log('  ✅ idx_regulations_lovv_level');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_regulations_state_code ON regulations(state_code)
    `);
    console.log('  ✅ idx_regulations_state_code');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_regulations_last_validated ON regulations(last_validated)
    `);
    console.log('  ✅ idx_regulations_last_validated');
    
    // Verify columns exist
    console.log('\nVerifying new columns...');
    const verify = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'regulations' 
      AND column_name IN ('lovv_level', 'last_validated', 'version_hash', 'state_code', 'source_url')
      ORDER BY column_name
    `);
    
    verify.rows.forEach(r => {
      console.log(`  ✅ ${r.column_name} (${r.data_type})`);
    });
    
    console.log('\n✅ All columns added successfully!');
    
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingColumns().catch(console.error);
