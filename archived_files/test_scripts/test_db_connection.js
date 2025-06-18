const { Pool } = require('@neondatabase/serverless');

console.log('=== Database Connection Test ===');

// Test with the known terraform password
const TERRAFORM_PASSWORD = 'FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=';
const DB_HOST = 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com';
const DB_NAME = 'edsteward';

// Test different connection strings
const testConnections = [
  {
    name: 'Terraform Password',
    url: `postgresql://postgres:${TERRAFORM_PASSWORD}@${DB_HOST}:5432/${DB_NAME}`
  },
  {
    name: 'Environment Variable',
    url: process.env.DATABASE_URL
  }
];

async function testConnection(name, url) {
  if (!url) {
    console.log(`❌ ${name}: URL not provided`);
    return false;
  }
  
  console.log(`\n🔍 Testing ${name}:`);
  console.log(`URL format: ${url.replace(/:[^:]*@/, ':***@')}`);
  
  try {
    const pool = new Pool({ connectionString: url });
    await pool.query('SELECT 1');
    console.log(`✅ ${name}: Connection successful`);
    await pool.end();
    return true;
  } catch (error) {
    console.log(`❌ ${name}: Connection failed`);
    console.log(`Error: ${error.message}`);
    console.log(`Error code: ${error.code}`);
    return false;
  }
}

async function main() {
  for (const test of testConnections) {
    await testConnection(test.name, test.url);
  }
}

main().catch(console.error); 