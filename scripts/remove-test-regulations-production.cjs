#!/usr/bin/env node

/**
 * Remove Test Regulations from Production Database
 * 
 * This script identifies and removes test regulations from all tenant databases
 * in the EdSteward multi-tenant architecture.
 * 
 * Safety Features:
 * - Creates backups before deletion
 * - Uses transaction rollback on errors
 * - Provides detailed logging
 * - Dry-run mode for testing
 * - Clear identification patterns
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'test-regulations-removal');

// Test regulation identification patterns
const TEST_PATTERNS = {
  // Clear test patterns (high confidence)
  itemIdPatterns: [
    /^DAVE-.*$/i,           // All DAVE-* regulations (Davegulation test data)
    /^TEST-REG-.*$/i,       // TEST-REG-* patterns
    /^REG-DEV-.*$/i,        // Development test regulations
  ],
  
  namePatterns: [
    /^Davegulation.*$/i,    // All Davegulation test regulations
    /^Test Regulation.*$/i, // Explicit test regulations
    /.*TEST-123.*$/i,       // Specific test regulation
  ],
  
  // Specific test item IDs we know are test data
  specificTestIds: [
    'DAVE-1-001', 'DAVE-2-002', 'DAVE-3-003', 'DAVE-4-004', 'DAVE-5-005',
    'DAVE-6-006', 'DAVE-7-007', 'DAVE-8-008', 'DAVE-9-009', 'DAVE-10-010',
    'TEST-REG-001',
    'REG-1741205639642', // "Regulation ID TEST-123"
    'REG-DEV-001',
    'REG-DEV-002'
  ],
  
  // Additional patterns for regulations with test content
  summaryPatterns: [
    /This regulation defines.*for educational institutions.*## Requirements/i, // DAVE pattern
    /This is a detailed summary of the hypothetical regulation/i,
  ]
};

// Tenant database configurations (Neon Database)
const TENANT_DATABASES = [
  {
    name: 'admin',
    database: 'neondb_admin'
  },
  {
    name: 'moravian', 
    database: 'neondb'  // Main database
  },
  {
    name: 'test',
    database: 'neondb_test'
  }
];

/**
 * Create a database connection for a specific tenant
 */
function createTenantConnection(database) {
  // Use the correct Neon database connection string for each tenant database
  const baseUrl = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech:5432";
  const dbUrl = `${baseUrl}/${database}?sslmode=require`;
  
  return new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false  // Neon managed certificates
    },
    max: 5,
    min: 1,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Check if a regulation matches test patterns
 */
function isTestRegulation(regulation) {
  const { item_id, name, summary, requirements } = regulation;
  
  // Check item_id patterns
  for (const pattern of TEST_PATTERNS.itemIdPatterns) {
    if (pattern.test(item_id)) {
      return { match: true, reason: `item_id matches pattern: ${pattern}` };
    }
  }
  
  // Check specific test IDs
  if (TEST_PATTERNS.specificTestIds.includes(item_id)) {
    return { match: true, reason: `item_id in known test list: ${item_id}` };
  }
  
  // Check name patterns
  if (name) {
    for (const pattern of TEST_PATTERNS.namePatterns) {
      if (pattern.test(name)) {
        return { match: true, reason: `name matches pattern: ${pattern}` };
      }
    }
  }
  
  // Check summary patterns
  if (summary) {
    for (const pattern of TEST_PATTERNS.summaryPatterns) {
      if (pattern.test(summary)) {
        return { match: true, reason: `summary matches test pattern` };
      }
    }
  }
  
  return { match: false, reason: null };
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create backup of regulations that will be deleted
 */
async function createBackup(tenantName, testRegulations) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `${tenantName}-test-regulations-${timestamp}.json`);
  
  const backupData = {
    tenant: tenantName,
    timestamp: new Date().toISOString(),
    count: testRegulations.length,
    regulations: testRegulations.map(reg => ({
      id: reg.id,
      item_id: reg.item_id,
      name: reg.name,
      topic: reg.topic,
      statute: reg.statute,
      summary: reg.summary,
      requirements: reg.requirements,
      category: reg.category,
      jurisdiction_source: reg.jurisdiction_source,
      last_updated: reg.last_updated,
      last_verified: reg.last_verified
    }))
  };
  
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`💾 Backup created: ${backupFile}`);
  return backupFile;
}

/**
 * Process a single tenant database
 */
async function processTenantDatabase(tenantConfig) {
  const { name, database } = tenantConfig;
  console.log(`\n🔍 Processing tenant: ${name} (${database})`);
  
  const pool = createTenantConnection(database);
  const client = await pool.connect();
  
  try {
    // Check if regulations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'regulations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log(`⚠️  No regulations table found in ${name}`);
      return { processed: false, reason: 'No regulations table' };
    }
    
    // Get all regulations
    const result = await client.query(`
      SELECT id, item_id, name, topic, statute, summary, requirements, 
             category, jurisdiction_source, last_updated, last_verified
      FROM regulations 
      ORDER BY id
    `);
    
    const allRegulations = result.rows;
    console.log(`📊 Found ${allRegulations.length} total regulations in ${name}`);
    
    // Identify test regulations
    const testRegulations = [];
    const testReasons = [];
    
    for (const regulation of allRegulations) {
      const testCheck = isTestRegulation(regulation);
      if (testCheck.match) {
        testRegulations.push(regulation);
        testReasons.push({
          id: regulation.id,
          item_id: regulation.item_id,
          name: regulation.name,
          reason: testCheck.reason
        });
      }
    }
    
    console.log(`🎯 Identified ${testRegulations.length} test regulations:`);
    
    // Display test regulations
    testReasons.forEach(({ id, item_id, name, reason }) => {
      console.log(`   - ID ${id}: ${item_id} "${name}" (${reason})`);
    });
    
    if (testRegulations.length === 0) {
      console.log(`✅ No test regulations found in ${name}`);
      return { 
        processed: true, 
        found: 0, 
        removed: 0, 
        backup: null 
      };
    }
    
    // Create backup
    const backupFile = await createBackup(name, testRegulations);
    
    if (DRY_RUN) {
      console.log(`🔥 DRY RUN: Would remove ${testRegulations.length} test regulations from ${name}`);
      return { 
        processed: true, 
        found: testRegulations.length, 
        removed: 0, 
        backup: backupFile,
        dryRun: true
      };
    }
    
    if (!FORCE) {
      console.log(`\n⚠️  About to remove ${testRegulations.length} test regulations from ${name}`);
      console.log(`⚠️  Run with --force to proceed with deletion`);
      return { 
        processed: true, 
        found: testRegulations.length, 
        removed: 0, 
        backup: backupFile,
        needsForce: true
      };
    }
    
    // Begin transaction for safe deletion
    await client.query('BEGIN');
    
    try {
      const testIds = testRegulations.map(r => r.id);
      
      // Delete related records first (to avoid foreign key constraints)
      console.log(`🗑️  Removing related records...`);
      
      // Delete evidence files
      const evidenceResult = await client.query(`
        DELETE FROM evidence_files WHERE regulation_id = ANY($1)
      `, [testIds]);
      console.log(`   - Removed ${evidenceResult.rowCount} evidence files`);
      
      // Delete notes
      const notesResult = await client.query(`
        DELETE FROM notes WHERE regulation_id = ANY($1)
      `, [testIds]);
      console.log(`   - Removed ${notesResult.rowCount} notes`);
      
      // Delete notifications
      const notificationsResult = await client.query(`
        DELETE FROM notifications WHERE regulation_id = ANY($1)
      `, [testIds]);
      console.log(`   - Removed ${notificationsResult.rowCount} notifications`);
      
      // Delete deadlines
      const deadlinesResult = await client.query(`
        DELETE FROM deadlines WHERE regulation_id = ANY($1)
      `, [testIds]);
      console.log(`   - Removed ${deadlinesResult.rowCount} deadlines`);
      
      // Note: regulation_updates table doesn't exist in current schema
      
      // Finally, delete the regulations themselves
      const regulationsResult = await client.query(`
        DELETE FROM regulations WHERE id = ANY($1)
      `, [testIds]);
      
      console.log(`🗑️  Removed ${regulationsResult.rowCount} test regulations from ${name}`);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`✅ Successfully cleaned ${name} database`);
      
      return { 
        processed: true, 
        found: testRegulations.length, 
        removed: regulationsResult.rowCount, 
        backup: backupFile 
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${name}:`, error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Test Regulations Removal for EdSteward');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN' : FORCE ? 'LIVE DELETION' : 'PREVIEW'}`);
  console.log('🏗️  Using Neon multi-tenant database architecture');
  
  ensureBackupDirectory();
  
  const results = [];
  let totalFound = 0;
  let totalRemoved = 0;
  
  // Process each tenant database
  for (const tenantConfig of TENANT_DATABASES) {
    try {
      const result = await processTenantDatabase(tenantConfig);
      results.push({ tenant: tenantConfig.name, ...result });
      totalFound += result.found || 0;
      totalRemoved += result.removed || 0;
    } catch (error) {
      console.error(`❌ Failed to process ${tenantConfig.name}: ${error.message}`);
      results.push({ 
        tenant: tenantConfig.name, 
        processed: false, 
        error: error.message 
      });
    }
  }
  
  // Summary
  console.log('\n📊 SUMMARY');
  console.log('=' .repeat(50));
  
  results.forEach(result => {
    const { tenant, processed, found = 0, removed = 0, error, dryRun, needsForce } = result;
    
    if (!processed) {
      console.log(`❌ ${tenant}: Failed - ${error || 'Unknown error'}`);
    } else if (dryRun) {
      console.log(`🔍 ${tenant}: Found ${found} test regulations (DRY RUN)`);
    } else if (needsForce) {
      console.log(`⏸️  ${tenant}: Found ${found} test regulations (needs --force)`);
    } else {
      console.log(`✅ ${tenant}: Removed ${removed}/${found} test regulations`);
    }
  });
  
  console.log('\n📈 TOTALS:');
  console.log(`   Found: ${totalFound} test regulations`);
  if (!DRY_RUN && FORCE) {
    console.log(`   Removed: ${totalRemoved} test regulations`);
  }
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run and with --force to perform actual deletion');
  } else if (!FORCE && totalFound > 0) {
    console.log('\n💡 Run with --force to perform actual deletion');
  }
  
  if (totalRemoved > 0) {
    console.log(`\n💾 Backups saved in: ${BACKUP_DIR}`);
    console.log('💡 Use backups to restore if needed');
  }
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  isTestRegulation,
  TEST_PATTERNS,
  TENANT_DATABASES
}; 