#!/usr/bin/env node

/**
 * User Roles Migration Script
 * Adds roles column to users table for Okta group-to-role mapping
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neondb') ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  console.log('🚀 Starting User Roles Migration for Okta Integration');
  console.log('====================================================');
  
  const client = await pool.connect();
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Database connection successful');
    
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
      
      console.log('✅ Migration verification complete');
      return;
    }
    
    // Read migration SQL
    console.log('\\n📄 Reading migration SQL...');
    const migrationPath = path.join(__dirname, 'migrations', 'add-user-roles-column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('🔧 Executing user roles migration...');
    await client.query('BEGIN');
    
    try {
      // Execute each statement individually
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
      
      console.log('   Adding column comments...');
      await client.query("COMMENT ON COLUMN users.roles IS 'JSON array of role names for multi-role support from Okta groups';");
      await client.query("COMMENT ON COLUMN users.role IS 'Primary role for backwards compatibility, should match highest priority role in roles array';");
      
      await client.query('COMMIT');
      console.log('✅ Migration executed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify migration
    console.log('\\n🔍 Verifying migration results...');
    const updatedSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Updated table structure:');
    updatedSchema.rows.forEach(row => {
      const isNew = row.column_name === 'roles';
      const prefix = isNew ? '🆕' : '  ';
      console.log(`${prefix} ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check indexes
    console.log('\\n🔍 Checking created indexes...');
    const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND (indexname LIKE '%roles%' OR indexname LIKE '%role%');
    `);
    
    console.log('📋 Role-related indexes:');
    indexes.rows.forEach(row => {
      console.log(`   ${row.indexname}: ${row.indexdef}`);
    });
    
    // Test role functionality
    console.log('\\n🧪 Testing role functionality...');
    
    // Check user role distribution
    const roleStats = await client.query(`
      SELECT role, COUNT(*) as count
      FROM users 
      GROUP BY role 
      ORDER BY count DESC;
    `);
    
    console.log('📊 User role distribution after migration:');
    roleStats.rows.forEach(row => {
      console.log(`   ${row.role}: ${row.count} users`);
    });
    
    // Test roles array functionality
    const rolesTest = await client.query(`
      SELECT username, role, roles
      FROM users 
      WHERE roles IS NOT NULL
      LIMIT 5;
    `);
    
    console.log('\\n📋 Sample users with roles arrays:');
    rolesTest.rows.forEach(row => {
      console.log(`   ${row.username}: role="${row.role}", roles=${row.roles}`);
    });
    
    console.log('\\n🎉 User Roles Migration Complete!');
    console.log('==================================');
    console.log('✅ Roles column added successfully');
    console.log('✅ Existing users updated with roles arrays');
    console.log('✅ Indexes created for efficient querying');
    console.log('✅ EdSteward ready for Okta group-to-role mapping');
    
    console.log('\\n📋 Next Steps:');
    console.log('1. Configure Okta to send group claims in SAML assertions');
    console.log('2. Test SAML authentication with different Okta groups');
    console.log('3. Run: node test-okta-role-mapping.cjs');
    console.log('4. Verify role-based access control on API endpoints');
    
  } catch (error) {
    console.error('\\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    console.log('\\n🔧 Troubleshooting:');
    console.log('1. Check database connection');
    console.log('2. Verify migration SQL syntax');
    console.log('3. Ensure proper permissions');
    console.log('4. Check for existing roles column');
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };
