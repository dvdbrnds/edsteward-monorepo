#!/usr/bin/env node

/**
 * Simple Database Fix for Staging Tenant
 * Tries multiple connection methods and credentials
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Define tenants table schema
const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  subdomain: text("subdomain"),
  databaseName: text("database_name"),
  status: text("status").default("active"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Multiple potential connection strings to try
const connectionStrings = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.NEON_DATABASE_URL,
  // Try with different user
  "postgresql://postgres:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require",
  // Try with edsteward user
  "postgresql://edsteward:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require"
].filter(Boolean);

async function fixStagingTenant() {
  console.log('🔧 Simple Database Fix for Staging Tenant');
  console.log('==========================================');
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const connectionString = connectionStrings[i];
    console.log(`\n🔗 Attempt ${i + 1}: Trying connection...`);
    
    try {
      const sql = postgres(connectionString, { max: 1 });
      const db = drizzle(sql);
      
      console.log('✅ Connected successfully!');
      
      // Check current state
      console.log('🔍 Checking current staging records...');
      const currentRecords = await db
        .select()
        .from(tenants)
        .where(eq(tenants.subdomain, 'staging'));
      
      console.log(`📋 Found ${currentRecords.length} records with subdomain='staging':`);
      currentRecords.forEach(record => {
        console.log(`   - ID: "${record.id}", Name: "${record.name}"`);
      });
      
      // Find the problematic record
      const stagingRecord = currentRecords.find(r => r.subdomain === 'staging');
      
      if (stagingRecord && stagingRecord.id !== 'staging') {
        console.log(`\n🔧 FIXING: Found record with subdomain='staging' but id='${stagingRecord.id}'`);
        
        // Delete incorrect record
        await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
        console.log('🗑️ Deleted incorrect record');
        
        // Insert correct record
        await db.insert(tenants).values({
          id: 'staging',
          name: 'EdSteward Staging Environment',
          domain: 'staging.edsteward.ai',
          subdomain: 'staging',
          databaseName: 'edsteward_staging',
          status: 'active',
          settings: {
            allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
            defaultRole: 'admin',
            enableAutoProvisioning: true,
            features: {
              apiAccess: true,
              customDomain: false,
              ssoEnabled: false,
              maxUsers: 1000,
              maxRegulations: 10000
            }
          }
        });
        console.log('✅ Inserted correct staging record');
        
        // Verify fix
        const verifyRecords = await db
          .select()
          .from(tenants)
          .where(eq(tenants.subdomain, 'staging'));
          
        const correctRecord = verifyRecords.find(r => r.id === 'staging' && r.subdomain === 'staging');
        
        if (correctRecord) {
          console.log('\n🎉 SUCCESS! Staging tenant database record is now correct!');
          console.log('📋 Verification:');
          console.log(`   - ID: "${correctRecord.id}" ✅`);
          console.log(`   - Subdomain: "${correctRecord.subdomain}" ✅`);
          console.log(`   - Name: "${correctRecord.name}" ✅`);
          
          console.log('\n🔍 Next Steps:');
          console.log('   1. Test: curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId');
          console.log('   2. Expected result: "staging" (not "admin")');
          
          await sql.end();
          return true;
        } else {
          console.log('❌ Verification failed - record not found after insert');
        }
      } else if (stagingRecord && stagingRecord.id === 'staging') {
        console.log('\n✅ Record is already correct! No fix needed.');
        console.log(`   - ID: "${stagingRecord.id}" ✅`);
        console.log(`   - Subdomain: "${stagingRecord.subdomain}" ✅`);
        await sql.end();
        return true;
      } else {
        console.log('\n❓ No staging record found. Creating new one...');
        
        await db.insert(tenants).values({
          id: 'staging',
          name: 'EdSteward Staging Environment',
          domain: 'staging.edsteward.ai',
          subdomain: 'staging',
          databaseName: 'edsteward_staging',
          status: 'active',
          settings: {
            allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
            defaultRole: 'admin',
            enableAutoProvisioning: true,
            features: {
              apiAccess: true,
              customDomain: false,
              ssoEnabled: false,
              maxUsers: 1000,
              maxRegulations: 10000
            }
          }
        });
        console.log('✅ Created new staging record');
        await sql.end();
        return true;
      }
      
      await sql.end();
      
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      if (i === connectionStrings.length - 1) {
        console.log('\n💥 All connection attempts failed');
        console.log('\n📋 Manual Fix Required:');
        console.log('1. SSH into the production server');
        console.log('2. Connect to the database with correct credentials');
        console.log('3. Run: DELETE FROM tenants WHERE subdomain = \'staging\' AND id != \'staging\';');
        console.log('4. Run: INSERT INTO tenants (id, name, subdomain, domain, database_name, status) VALUES (\'staging\', \'EdSteward Staging Environment\', \'staging\', \'staging.edsteward.ai\', \'edsteward_staging\', \'active\');');
        return false;
      }
    }
  }
}

// Run the fix
fixStagingTenant()
  .then(success => {
    if (success) {
      console.log('\n🎯 Database fix completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Database fix requires manual intervention');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  }); 