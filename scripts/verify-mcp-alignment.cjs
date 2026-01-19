/**
 * EDSTEWARD: MCP Alignment Verification Script
 * 
 * Run this script to verify that EdSteward is properly aligned with MCP Engine.
 * 
 * Usage:
 *   npm run verify:alignment
 *   - or -
 *   node scripts/verify-mcp-alignment.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function verifyAlignment() {
  console.log('='.repeat(60));
  console.log('EDSTEWARD ALIGNMENT VERIFICATION');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM regulations) as total,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL) as mcp_validated,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NULL) as unvalidated,
        (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal') as federal,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA') as pa,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ') as nj,
        (SELECT COUNT(*) FROM regulation_topics) as topics,
        (SELECT COUNT(*) FROM compliance_tasks) as tasks
    `);
    
    const stats = result.rows[0];
    
    console.log('📊 Current State:');
    console.log(`   Total Regulations: ${stats.total}`);
    console.log(`   MCP Validated: ${stats.mcp_validated}`);
    console.log(`   Unvalidated: ${stats.unvalidated}`);
    console.log(`   Federal: ${stats.federal}`);
    console.log(`   PA: ${stats.pa}`);
    console.log(`   NJ: ${stats.nj}`);
    console.log(`   Topic Mappings: ${stats.topics}`);
    console.log(`   Compliance Tasks: ${stats.tasks}`);
    
    // Expected values from MCP Engine
    const expected = {
      total: 251,
      federal: 237,
      pa: 8,
      nj: 6
    };
    
    console.log('\n📋 Alignment Check:');
    
    let aligned = true;
    
    if (parseInt(stats.total) === expected.total) {
      console.log(`   ✅ Total count matches (${expected.total})`);
    } else {
      console.log(`   ❌ Total mismatch: Expected ${expected.total}, Got ${stats.total}`);
      aligned = false;
    }
    
    if (parseInt(stats.federal) === expected.federal) {
      console.log(`   ✅ Federal count matches (${expected.federal})`);
    } else {
      console.log(`   ❌ Federal mismatch: Expected ${expected.federal}, Got ${stats.federal}`);
      aligned = false;
    }
    
    if (parseInt(stats.pa) === expected.pa) {
      console.log(`   ✅ PA count matches (${expected.pa})`);
    } else {
      console.log(`   ❌ PA mismatch: Expected ${expected.pa}, Got ${stats.pa}`);
      aligned = false;
    }
    
    if (parseInt(stats.nj) === expected.nj) {
      console.log(`   ✅ NJ count matches (${expected.nj})`);
    } else {
      console.log(`   ❌ NJ mismatch: Expected ${expected.nj}, Got ${stats.nj}`);
      aligned = false;
    }
    
    if (parseInt(stats.unvalidated) === 0) {
      console.log(`   ✅ No unvalidated regulations`);
    } else {
      console.log(`   ⚠️  ${stats.unvalidated} regulations without L.O.V.V. validation`);
    }
    
    // Check L.O.V.V. distribution
    const lovv = await client.query(`
      SELECT lovv_level, COUNT(*) as count
      FROM regulations 
      WHERE lovv_level IS NOT NULL
      GROUP BY lovv_level 
      ORDER BY lovv_level
    `);
    
    console.log('\n📈 L.O.V.V. Distribution:');
    lovv.rows.forEach(row => {
      console.log(`   Level ${row.lovv_level}: ${row.count}`);
    });
    
    // Check for orphaned tasks
    const orphanedTasks = await client.query(`
      SELECT COUNT(*) as count 
      FROM compliance_tasks 
      WHERE regulation_id NOT IN (SELECT id FROM regulations)
    `);
    
    if (parseInt(orphanedTasks.rows[0].count) === 0) {
      console.log('\n   ✅ No orphaned tasks');
    } else {
      console.log(`\n   ❌ ${orphanedTasks.rows[0].count} orphaned tasks found`);
      aligned = false;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(aligned ? '✅ ALIGNMENT VERIFIED' : '❌ ALIGNMENT ISSUES DETECTED');
    console.log('='.repeat(60));
    
    return aligned ? 0 : 1;
    
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAlignment()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
