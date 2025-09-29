#!/usr/bin/env node

/**
 * Production Roles Migration Script
 * Runs the roles column migration on the production database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Production database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neondb') ? { rejectUnauthorized: false } : false,
});

async function runProductionMigration() {
  console.log('🚀 Starting Production Roles Migration for Okta Integration');
  console.log('=======================================================');
  
  const client = await pool.connect();
  
  try {
    // Test connection
    console.log('📡 Testing production database connection...');
    await client.query('SELECT 1');
    console.log('✅ Production database connection successful');
    
    // Check current users table structure
    console.log('\\n🔍 Checking current users table structure...');
    const currentSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current columns:');
    currentSchema.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if roles column already exists
    const hasRoles = currentSchema.rows.some(row => row.column_name === 'roles');
    
    if (hasRoles) {
      console.log('\\n⚠️ Roles column already exists! Checking data...');
      
      // Check current role distribution
      const roleStats = await client.query(`
        SELECT role, COUNT(*) as count, 
               COUNT(CASE WHEN roles IS NOT NULL THEN 1 END) as has_roles_array
        FROM users 
        GROUP BY role 
        ORDER BY count DESC;
      `);
      
      console.log('📊 Current user role distribution:');
      roleStats.rows.forEach(row => {
        console.log(`   ${row.role}: ${row.count} users (${row.has_roles_array} have roles array)`);
      });
      
      // Update users without roles array
      const usersWithoutRoles = await client.query(`
        SELECT COUNT(*) as count FROM users WHERE roles IS NULL;
      `);
      
      if (usersWithoutRoles.rows[0].count > 0) {
        console.log(`\\n🔧 Updating ${usersWithoutRoles.rows[0].count} users without roles array...`);
        
        await client.query(`
          UPDATE users 
          SET roles = CASE 
            WHEN role = 'admin' THEN '["admin"]'
            WHEN role = 'compliance_officer' THEN '["compliance_officer"]'
            WHEN role = 'user' THEN '["viewer"]'
            ELSE '["viewer"]'
          END
          WHERE roles IS NULL;
        `);
        
        console.log('✅ Users updated with roles arrays');
      }
      
      // Check for brandesd@moravian.edu specifically
      console.log('\\n🔍 Checking brandesd@moravian.edu user...');
      const brandesdUser = await client.query(`
        SELECT id, username, email, role, roles, identity_provider, last_login
        FROM users 
        WHERE email = 'brandesd@moravian.edu' OR username = 'brandesd@moravian.edu';
      `);
      
      if (brandesdUser.rows.length > 0) {
        const user = brandesdUser.rows[0];
        console.log('👤 Found brandesd@moravian.edu:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current Role: ${user.role}`);
        console.log(`   Roles Array: ${user.roles || 'NULL'}`);
        console.log(`   Identity Provider: ${user.identity_provider || 'local'}`);
        console.log(`   Last Login: ${user.last_login || 'Never'}`);
        
        // Update brandesd to admin if not already
        if (user.role !== 'admin') {
          console.log('\\n🔧 Updating brandesd@moravian.edu to admin role...');
          await client.query(`
            UPDATE users 
            SET role = 'admin', roles = '["admin"]'
            WHERE email = 'brandesd@moravian.edu' OR username = 'brandesd@moravian.edu';
          `);
          console.log('✅ brandesd@moravian.edu updated to admin role');
        }
      } else {
        console.log('❌ brandesd@moravian.edu not found in database');
        console.log('   This user needs to log in via SAML first to be created');
      }
      
      console.log('\\n✅ Migration verification complete');
      return;
    }
    
    // Execute migration if roles column doesn't exist
    console.log('\\n🔧 Executing roles column migration...');
    await client.query('BEGIN');
    
    try {
      console.log('   Adding roles column...');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT;');
      
      console.log('   Updating existing users with roles arrays...');
      await client.query(`
        UPDATE users 
        SET roles = CASE 
          WHEN role = 'admin' THEN '["admin"]'
          WHEN role = 'compliance_officer' THEN '["compliance_officer"]'
          WHEN role = 'user' THEN '["viewer"]'
          ELSE '["viewer"]'
        END
        WHERE roles IS NULL;
      `);
      
      console.log('   Updating default role...');
      await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'viewer';");
      
      console.log('   Creating indexes...');
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);');
      
      // Try to create GIN index, but don't fail if it doesn't work
      try {
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN ((roles::jsonb));');
      } catch (indexError) {
        console.log('   ⚠️ Could not create GIN index on roles (this is optional)');
      }
      
      await client.query('COMMIT');
      console.log('✅ Migration executed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    console.log('\\n🎉 Production Roles Migration Complete!');
    console.log('=====================================');
    console.log('✅ Production database updated for Okta role mapping');
    console.log('✅ Users can now receive roles from Okta groups');
    
    console.log('\\n📋 Next Steps:');
    console.log('1. Have brandesd@moravian.edu log out and log back in via SAML');
    console.log('2. Check server logs for group extraction during SAML login');
    console.log('3. Verify Okta is sending group claims in SAML assertions');
    
  } catch (error) {
    console.error('\\n❌ Production migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    console.log('\\n🔧 Troubleshooting:');
    console.log('1. Check production database connection');
    console.log('2. Verify DATABASE_URL environment variable');
    console.log('3. Ensure proper database permissions');
    console.log('4. Check if user exists in production database');
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runProductionMigration().catch(console.error);
}

module.exports = { runProductionMigration };
