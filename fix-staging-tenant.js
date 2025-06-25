#!/usr/bin/env node

/**
 * Fix Staging Tenant Database Record
 * 
 * This script corrects the staging tenant record in the database
 * to ensure staging.edsteward.ai returns tenantId: "staging" instead of "admin"
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { eq, or, like } = require('drizzle-orm');
const postgres = require('postgres');

// Database connection
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL or POSTGRES_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

// Define tenants table schema (simplified)
const { pgTable, text, timestamp, jsonb } = require('drizzle-orm/pg-core');

const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  databaseName: text("database_name").notNull(),
  status: text("status").notNull().default("active"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

async function fixStagingTenant() {
  try {
    console.log('🔍 Investigating staging tenant database record...');
    
    // Check current state
    const currentRecords = await db
      .select()
      .from(tenants)
      .where(
        or(
          eq(tenants.subdomain, 'staging'),
          eq(tenants.id, 'staging'),
          like(tenants.name, '%Staging%')
        )
      );
    
    console.log('📋 Current staging-related records:');
    currentRecords.forEach(record => {
      console.log(`  - ID: ${record.id}, Subdomain: ${record.subdomain}, Name: ${record.name}`);
    });
    
    // Find the problematic record
    const stagingSubdomainRecord = currentRecords.find(r => r.subdomain === 'staging');
    
    if (stagingSubdomainRecord && stagingSubdomainRecord.id !== 'staging') {
      console.log(`🔧 Found problematic record: subdomain='staging' but id='${stagingSubdomainRecord.id}'`);
      console.log('⚠️  This explains why staging.edsteward.ai returns the wrong tenant ID');
      
      // Delete the incorrect record
      await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
      console.log('🗑️  Deleted incorrect staging record');
    }
    
    // Check if correct staging record exists
    const correctRecord = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, 'staging'))
      .limit(1);
    
    if (correctRecord.length === 0) {
      console.log('➕ Inserting correct staging tenant record...');
      
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
      
      console.log('✅ Inserted correct staging tenant record');
    } else {
      console.log('ℹ️  Correct staging record already exists');
    }
    
    // Verify the fix
    console.log('\n🔍 Verification - checking final state:');
    const finalRecords = await db
      .select()
      .from(tenants)
      .where(
        or(
          eq(tenants.subdomain, 'staging'),
          eq(tenants.id, 'staging')
        )
      );
    
    finalRecords.forEach(record => {
      console.log(`  ✓ ID: ${record.id}, Subdomain: ${record.subdomain}, Name: ${record.name}`);
    });
    
    const correctStagingRecord = finalRecords.find(r => r.id === 'staging' && r.subdomain === 'staging');
    if (correctStagingRecord) {
      console.log('\n🎉 SUCCESS: Staging tenant database record is now correct!');
      console.log('   staging.edsteward.ai should now return tenantId: "staging"');
    } else {
      console.log('\n❌ FAILED: Staging tenant record is still incorrect');
    }
    
  } catch (error) {
    console.error('❌ Error fixing staging tenant:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the fix
fixStagingTenant()
  .then(() => {
    console.log('\n🏁 Database fix completed');
    console.log('💡 Test with: curl -s https://staging.edsteward.ai/api/health | jq .tenant.tenantId');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Database fix failed:', error);
    process.exit(1);
  }); 