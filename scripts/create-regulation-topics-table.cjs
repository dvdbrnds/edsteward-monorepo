const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function createTable() {
  const client = await pool.connect();
  
  console.log('Creating regulation_topics junction table...\n');
  
  try {
    // Create the junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulation_topics (
          id SERIAL PRIMARY KEY,
          regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
          topic VARCHAR(100) NOT NULL,
          topic_id INTEGER,
          department VARCHAR(100),
          responsible_role VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(regulation_id, topic)
      )
    `);
    console.log('✅ Table created');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reg_topics_regulation ON regulation_topics(regulation_id)
    `);
    console.log('✅ Index idx_reg_topics_regulation created');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reg_topics_topic ON regulation_topics(topic)
    `);
    console.log('✅ Index idx_reg_topics_topic created');
    
    // Verify table was created
    const verify = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'regulation_topics'
    `);
    
    if (verify.rows.length > 0) {
      console.log('\n✅ Table verified: regulation_topics');
    }
    
    // Show table structure
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'regulation_topics'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTable structure:');
    console.log('Column                | Type           | Nullable | Default');
    console.log('-'.repeat(70));
    schema.rows.forEach(r => {
      const col = r.column_name.padEnd(21);
      const type = r.data_type.padEnd(14);
      const nullable = r.is_nullable.padEnd(8);
      const def = r.column_default || '';
      console.log(`${col} | ${type} | ${nullable} | ${def}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

createTable().catch(console.error);
