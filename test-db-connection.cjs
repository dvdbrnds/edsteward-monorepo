const { Pool } = require('pg');

// Test different connection string formats
const tests = [
  {
    name: "Clean Connection String (No SSL)",
    connectionString: 'postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable',
    ssl: false
  },
  {
    name: "Connection String with SSL Prefer",
    connectionString: 'postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=prefer',
    ssl: { rejectUnauthorized: false }
  },
  {
    name: "Manual Pool Configuration",
    host: 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'edsteward',
    user: 'postgres',
    password: 'FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=',
    ssl: false
  }
];

async function testConnection(config, index) {
  console.log(`\n${index + 1}. Testing: ${config.name}`);
  console.log('='.repeat(50));
  
  try {
    let pool;
    
    if (config.connectionString) {
      console.log('Connection string format:', config.connectionString.replace(/:[^:]*@/, ':***@'));
      pool = new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl,
        connectionTimeoutMillis: 5000
      });
    } else {
      console.log('Manual configuration with host:', config.host);
      pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        connectionTimeoutMillis: 5000
      });
    }
    
    console.log('Attempting connection...');
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('✅ Query successful!');
    console.log('PostgreSQL version:', result.rows[0].version.substring(0, 50) + '...');
    
    // Test a simple table query
    try {
      const tableResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        LIMIT 5
      `);
      console.log('✅ Tables found:', tableResult.rows.length);
      if (tableResult.rows.length > 0) {
        console.log('Sample tables:', tableResult.rows.map(r => r.table_name).join(', '));
      }
    } catch (tableError) {
      console.log('⚠️  Table query failed:', tableError.message);
    }
    
    client.release();
    await pool.end();
    console.log('✅ Connection test PASSED');
    return true;
    
  } catch (error) {
    console.error('❌ Connection failed');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes('ENOENT')) {
      console.error('🚨 SSL Certificate file error detected!');
      console.error('This suggests pg-connection-string is trying to read a file');
    }
    
    if (error.message.includes('no pg_hba.conf entry')) {
      console.error('🚨 Authentication error - check RDS security settings');
    }
    
    return false;
  }
}

async function runAllTests() {
  console.log('🔍 DATABASE CONNECTION INVESTIGATION');
  console.log('=====================================');
  console.log('Testing different connection methods to RDS...\n');
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const success = await testConnection(tests[i], i);
    results.push({ test: tests[i].name, success });
  }
  
  console.log('\n🎯 SUMMARY');
  console.log('='.repeat(50));
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.test}: ${status}`);
  });
  
  const passedTests = results.filter(r => r.success).length;
  console.log(`\nTotal: ${passedTests}/${results.length} tests passed`);
  
  if (passedTests === 0) {
    console.log('\n🚨 ALL TESTS FAILED');
    console.log('This suggests a fundamental RDS connectivity or authentication issue.');
    console.log('\n🔍 NEXT STEPS:');
    console.log('1. Check RDS security groups allow connections from your IP/ECS');
    console.log('2. Verify RDS instance is publicly accessible (if needed)');
    console.log('3. Check username/password are correct');
    console.log('4. Verify database name exists');
  } else {
    console.log(`\n✅ ${passedTests} connection method(s) working`);
    console.log('Use the working method in your application.');
  }
}

runAllTests().catch(console.error); 