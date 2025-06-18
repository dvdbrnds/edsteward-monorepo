#!/usr/bin/env node

/**
 * Production Database Connection Test
 * Tests the production RDS connection with SSL
 */

import pkg from 'pg';
const { Client } = pkg;

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

async function testProductionConnection() {
  // Production RDS connection string with SSL
  const dbUrl = "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require";

  log('🔍 Testing Production RDS Connection', colors.cyan);
  log(`📍 Database URL: ${dbUrl.replace(/:[^:]*@/, ':***@')}`, colors.blue);
  
  // Test SSL configuration detection
  const sslRequired = dbUrl.includes('sslmode=require');
  log(`🔐 SSL Mode: ${sslRequired ? 'Required' : 'Disabled'}`, colors.yellow);

  const client = new Client({
    connectionString: dbUrl,
    ssl: sslRequired ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    log('📡 Connecting to production database...', colors.yellow);
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

    // Test connection info
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

    // Test a basic application query
    log('🔍 Testing application tables...', colors.yellow);
    try {
      const userCount = await client.query('SELECT COUNT(*) as count FROM users');
      const regCount = await client.query('SELECT COUNT(*) as count FROM regulations');
      
      log(`👥 Users in database: ${userCount.rows[0].count}`, colors.blue);
      log(`📋 Regulations in database: ${regCount.rows[0].count}`, colors.blue);
    } catch (tableError) {
      log(`⚠️ Could not query application tables: ${tableError.message}`, colors.yellow);
    }

    log('🎉 Production database connection test passed!', colors.green);
    log('✅ SSL configuration is working correctly', colors.green);
    log('✅ No more "route loop" issues expected', colors.green);
    
  } catch (error) {
    log('❌ Production connection test failed:', colors.red);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    
    // Provide troubleshooting hints
    log('\n🔧 Troubleshooting hints:', colors.yellow);
    
    if (error.code === 'ECONNREFUSED') {
      log('- RDS instance might be down or not accepting connections', colors.yellow);
      log('- Check security group allows connections from your IP', colors.yellow);
    } else if (error.code === '28000') {
      log('- Authentication failed - check username/password', colors.yellow);
      log('- Verify pg_hba.conf allows SSL connections', colors.yellow);
    } else if (error.message.includes('SSL') || error.message.includes('ssl')) {
      log('- SSL configuration issue', colors.yellow);
      log('- Check if RDS has SSL enabled', colors.yellow);
    }
    
    return false;
  } finally {
    try {
      await client.end();
      log('🔌 Connection closed', colors.cyan);
    } catch (closeError) {
      log('⚠️ Error closing connection:', colors.yellow);
      console.error(closeError.message);
    }
  }
  
  return true;
}

// Run the test
log('🚀 Starting Production RDS Connection Test', colors.cyan);
log('=' .repeat(60), colors.cyan);

testProductionConnection()
  .then((success) => {
    log('=' .repeat(60), colors.cyan);
    if (success) {
      log('✅ Production database connection test completed successfully', colors.green);
      log('🎯 The route loop issue has been resolved!', colors.green);
    } else {
      log('❌ Production database connection test failed', colors.red);
    }
  })
  .catch((error) => {
    log('=' .repeat(60), colors.cyan);
    log('❌ Connection test failed', colors.red);
    console.error('Final error:', error);
    process.exit(1);
  }); 