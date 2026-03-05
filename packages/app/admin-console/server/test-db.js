// Quick database connection test
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check users table
    try {
      const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users count: ${usersResult.rows[0].count}`);
    } catch (error) {
      console.log('❌ Users table error:', error.message);
    }
    
    // Check regulations table
    try {
      const regulationsResult = await client.query('SELECT COUNT(*) as count FROM regulations');
      console.log(`📜 Regulations count: ${regulationsResult.rows[0].count}`);
    } catch (error) {
      console.log('❌ Regulations table error:', error.message);
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase(); 