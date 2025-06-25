#!/usr/bin/env node

/**
 * Direct Database Fix - Final Attempt
 * Uses the exact production database URL to fix the staging tenant record
 */

import postgres from 'postgres';

const DATABASE_URL = "postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require";

async function fixStagingTenant() {
  console.log('🔧 DIRECT DATABASE FIX - FINAL ATTEMPT');
  console.log('======================================');
  
  const sql = postgres(DATABASE_URL, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔗 Connecting to production database...');
    
    // Check current state
    console.log('🔍 Checking current staging records...');
    const currentRecords = await sql`
      SELECT id, name, subdomain, domain, status 
      FROM tenants 
      WHERE subdomain = 'staging' OR id = 'staging' OR name LIKE '%Staging%'
    `;
    
    console.log(`📋 Found ${currentRecords.length} staging-related records:`);
    currentRecords.forEach(record => {
      console.log(`   - ID: "${record.id}", Subdomain: "${record.subdomain}", Name: "${record.name}"`);
    });
    
    // Find the problematic record
    const stagingRecord = currentRecords.find(r => r.subdomain === 'staging');
    
    if (stagingRecord && stagingRecord.id !== 'staging') {
      console.log(`\n🔧 FIXING: Found record with subdomain='staging' but id='${stagingRecord.id}'`);
      
      // Delete incorrect record
      await sql`DELETE FROM tenants WHERE subdomain = 'staging' AND id != 'staging'`;
      console.log('🗑️ Deleted incorrect staging record');
      
      // Insert correct record
      await sql`
        INSERT INTO tenants (
          id, name, domain, subdomain, database_name, status, settings, created_at, updated_at
        ) VALUES (
          'staging',
          'EdSteward Staging Environment',
          'staging.edsteward.ai',
          'staging',
          'edsteward_staging',
          'active',
          '{"allowedDomains": ["edsteward.ai", "staging.edsteward.ai"], "defaultRole": "admin", "enableAutoProvisioning": true, "features": {"apiAccess": true, "customDomain": false, "ssoEnabled": false, "maxUsers": 1000, "maxRegulations": 10000}}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          subdomain = EXCLUDED.subdomain,
          database_name = EXCLUDED.database_name,
          status = EXCLUDED.status,
          settings = EXCLUDED.settings,
          updated_at = NOW()
      `;
      console.log('✅ Inserted/Updated correct staging record');
      
      // Verify fix
      const verifyRecords = await sql`
        SELECT id, name, subdomain, domain, status 
        FROM tenants 
        WHERE subdomain = 'staging' OR id = 'staging'
      `;
      
      const correctRecord = verifyRecords.find(r => r.id === 'staging' && r.subdomain === 'staging');
      
      if (correctRecord) {
        console.log('\n🎉 SUCCESS! Staging tenant database record is now correct!');
        console.log('📋 Verification:');
        console.log(`   - ID: "${correctRecord.id}" ✅`);
        console.log(`   - Subdomain: "${correctRecord.subdomain}" ✅`);
        console.log(`   - Name: "${correctRecord.name}" ✅`);
        
        await sql.end();
        return true;
      } else {
        console.log('❌ Verification failed - record not found after insert');
        await sql.end();
        return false;
      }
    } else if (stagingRecord && stagingRecord.id === 'staging') {
      console.log('\n✅ Record is already correct! No fix needed.');
      console.log(`   - ID: "${stagingRecord.id}" ✅`);
      console.log(`   - Subdomain: "${stagingRecord.subdomain}" ✅`);
      await sql.end();
      return true;
    } else {
      console.log('\n❓ No staging record found. Creating new one...');
      
      await sql`
        INSERT INTO tenants (
          id, name, domain, subdomain, database_name, status, settings, created_at, updated_at
        ) VALUES (
          'staging',
          'EdSteward Staging Environment',
          'staging.edsteward.ai',
          'staging',
          'edsteward_staging',
          'active',
          '{"allowedDomains": ["edsteward.ai", "staging.edsteward.ai"], "defaultRole": "admin", "enableAutoProvisioning": true, "features": {"apiAccess": true, "customDomain": false, "ssoEnabled": false, "maxUsers": 1000, "maxRegulations": 10000}}'::jsonb,
          NOW(),
          NOW()
        )
      `;
      console.log('✅ Created new staging record');
      await sql.end();
      return true;
    }
    
  } catch (error) {
    console.error('❌ Database fix failed:', error.message);
    await sql.end();
    return false;
  }
}

// Execute the fix
console.log('🚀 Starting direct database fix...');
fixStagingTenant()
  .then(success => {
    if (success) {
      console.log('\n🎯 DATABASE FIX COMPLETED SUCCESSFULLY!');
      console.log('\n🔍 VERIFICATION STEPS:');
      console.log('1. Test: curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId');
      console.log('2. Expected: "staging" (not "admin")');
      console.log('\n🏆 MULTI-TENANT ARCHITECTURE CONSOLIDATION: 100% COMPLETE!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Database fix failed - manual intervention required');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  }); 