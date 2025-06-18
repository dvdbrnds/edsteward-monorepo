#!/usr/bin/env node

/**
 * RDS Connection Test Script
 * Tests database connection to verify route loop fixes
 */

import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testConnection() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    log('❌ DATABASE_URL not found in environment', colors.red);
    process.exit(1);
  }

  log('🔍 Testing RDS Connection', colors.cyan);
  log(`📍 Database URL: ${dbUrl.replace(/:[^:]*@/, ':***@')}`, colors.blue);
  
  // Test SSL configuration detection
  const sslDisabled = dbUrl.includes('sslmode=disable');
  log(`🔐 SSL Mode: ${sslDisabled ? 'Disabled' : 'Enabled'}`, colors.yellow);

  const client = new Client({
    connectionString: dbUrl,
    ssl: sslDisabled ? false : {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    log('📡 Connecting to database...', colors.yellow);
    const startTime = Date.now();
    
    await client.connect();
    const connectTime = Date.now() - startTime;
    
    log(`✅ Connected successfully in ${connectTime}ms`, colors.green);

    // Test basic query
    log('🔍 Testing basic query...', colors.yellow);
    const queryStart = Date.now();
    const result = await client.query('SELECT version(), now() as current_time');
    const queryTime = Date.now() - queryStart;
    
    log(`✅ Query executed in ${queryTime}ms`, colors.green);
    log(`📊 PostgreSQL Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`, colors.blue);
    log(`⏰ Server Time: ${result.rows[0].current_time}`, colors.blue);

    // Test connection pool behavior
    log('🔍 Testing connection info...', colors.yellow);
    const connInfo = await client.query(`
      SELECT 
        current_database() as database_name,
        current_user as username,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        pg_backend_pid() as backend_pid
    `);
    
    const info = connInfo.rows[0];
    log(`📋 Database: ${info.database_name}`, colors.blue);
    log(`👤 User: ${info.username}`, colors.blue);
    log(`🌐 Server: ${info.server_ip}:${info.server_port}`, colors.blue);
    log(`🔢 Backend PID: ${info.backend_pid}`, colors.blue);

    // Test active connections
    log('🔍 Checking active connections...', colors.yellow);
    const activeConns = await client.query(`
      SELECT count(*) as active_connections
      FROM pg_stat_activity 
      WHERE state = 'active'
    `);
    
    log(`🔗 Active Connections: ${activeConns.rows[0].active_connections}`, colors.blue);

    // Test table existence (basic schema check)
    log('🔍 Testing schema availability...', colors.yellow);
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    log(`📊 Found ${tables.rows.length} tables in public schema`, colors.blue);
    if (tables.rows.length > 0) {
      log(`📋 Sample tables: ${tables.rows.slice(0, 5).map(r => r.table_name).join(', ')}`, colors.blue);
    }

    log('🎉 All tests passed! Connection is healthy.', colors.green);
    
  } catch (error) {
    log('❌ Connection test failed:', colors.red);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack?.substring(0, 500));
    
    // Provide troubleshooting hints
    log('\n🔧 Troubleshooting hints:', colors.yellow);
    
    if (error.code === 'ECONNREFUSED') {
      log('- Check if RDS instance is running', colors.yellow);
      log('- Verify security group allows connections from your IP/subnet', colors.yellow);
    } else if (error.code === 'ENOTFOUND') {
      log('- Check RDS endpoint hostname is correct', colors.yellow);
      log('- Verify DNS resolution', colors.yellow);
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      log('- Check database username and password', colors.yellow);
      log('- Verify user has proper permissions', colors.yellow);
    } else if (error.message.includes('SSL') || error.message.includes('ssl')) {
      log('- Check SSL configuration matches RDS settings', colors.yellow);
      log('- Try adding/removing sslmode parameter', colors.yellow);
    }
    
    process.exit(1);
    
  } finally {
    try {
      await client.end();
      log('🔌 Connection closed', colors.cyan);
    } catch (closeError) {
      log('⚠️ Error closing connection:', colors.yellow);
      console.error(closeError.message);
    }
  }
}

// Run the test
log('🚀 Starting RDS Connection Test', colors.cyan);
log('=' .repeat(50), colors.cyan);

testConnection()
  .then(() => {
    log('=' .repeat(50), colors.cyan);
    log('✅ Connection test completed successfully', colors.green);
  })
  .catch((error) => {
    log('=' .repeat(50), colors.cyan);
    log('❌ Connection test failed', colors.red);
    console.error('Final error:', error);
    process.exit(1);
  }); 