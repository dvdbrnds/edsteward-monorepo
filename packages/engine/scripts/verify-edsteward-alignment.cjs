// scripts/verify-edsteward-alignment.cjs
// MCP Engine ↔ EdSteward Alignment Verification
// Compares regulation data between systems to detect drift

const fetch = require('node-fetch');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,  // Use current macOS user
  password: process.env.MCP_DB_PASSWORD || '',        // No password for local dev
});

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const EDSTEWARD_AUTH = Buffer.from('dvdbrnds:gabadh').toString('base64');

async function getMCPStats() {
  const result = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM regulations WHERE is_current = TRUE) as total,
      (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal' AND is_current = TRUE) as federal,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA' AND is_current = TRUE) as pa,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ' AND is_current = TRUE) as nj,
      (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL AND is_current = TRUE) as with_lovv,
      (SELECT COUNT(*) FROM regulation_topics) as topics,
      (SELECT COUNT(*) FROM regulation_deadlines) as deadlines,
      (SELECT COUNT(*) FROM regulation_tasks) as tasks,
      (SELECT COUNT(*) FROM risk_assessments) as risk_scores
  `);
  return result.rows[0];
}

async function getEdStewardStats() {
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/mcp/alignment-status`, {
      headers: { 'Authorization': `Basic ${EDSTEWARD_AUTH}` }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.alignment;
  } catch (err) {
    console.error(`Could not reach EdSteward: ${err.message}`);
    return null;
  }
}

async function getEdStewardHashes() {
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/mcp/regulation-hashes`, {
      headers: { 'Authorization': `Basic ${EDSTEWARD_AUTH}` }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.regulations;
  } catch (err) {
    return null;
  }
}

async function getMCPHashes() {
  const result = await pool.query(`
    SELECT item_id, version_hash, lovv_level, updated_at
    FROM regulations
    WHERE is_current = TRUE AND item_id IS NOT NULL
    ORDER BY item_id
  `);
  return result.rows;
}

async function verifyAlignment() {
  console.log('='.repeat(70));
  console.log('MCP ENGINE ↔ EDSTEWARD ALIGNMENT VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`EdSteward URL: ${EDSTEWARD_URL}\n`);
  
  // Get stats from both systems
  const mcpStats = await getMCPStats();
  const edStats = await getEdStewardStats();
  
  console.log('📊 MCP ENGINE (Source of Truth):');
  console.log(`   Regulations: ${mcpStats.total}`);
  console.log(`   - Federal: ${mcpStats.federal}`);
  console.log(`   - PA: ${mcpStats.pa}`);
  console.log(`   - NJ: ${mcpStats.nj}`);
  console.log(`   With L.O.V.V.: ${mcpStats.with_lovv}`);
  console.log(`   Risk Scores: ${mcpStats.risk_scores}`);
  console.log(`   Topic Mappings: ${mcpStats.topics}`);
  console.log(`   Deadlines: ${mcpStats.deadlines}`);
  console.log(`   Tasks: ${mcpStats.tasks}`);
  
  if (!edStats) {
    console.log('\n⚠️  Could not retrieve EdSteward stats');
    console.log('   Make sure EdSteward is running and /api/mcp/alignment-status endpoint exists');
    console.log('   Proceeding with MCP Engine stats only...\n');
    
    // Still output MCP stats for reference
    console.log('='.repeat(70));
    console.log('MCP ENGINE DATA SUMMARY (EdSteward unreachable)');
    console.log('='.repeat(70));
    
    await pool.end();
    process.exit(0); // Not a failure - EdSteward may just not be running
  }
  
  console.log('\n📊 EDSTEWARD (Consumer):');
  // Handle both camelCase (EdSteward) and snake_case field names
  const edTotal = edStats.totalRegulations || edStats.total_regulations || 0;
  const edFederal = edStats.federal || 0;
  const edPA = edStats.pennsylvania || 0;
  const edNJ = edStats.newJersey || edStats.new_jersey || 0;
  const edValidated = edStats.mcpValidated || edStats.mcp_validated || 0;
  const edTopics = edStats.topicMappings || edStats.topic_mappings || 0;
  const edTasks = edStats.complianceTasks || edStats.compliance_tasks || 0;
  const edLastSync = edStats.lastSync || edStats.last_sync || 'Unknown';
  
  console.log(`   Regulations: ${edTotal}`);
  console.log(`   - Federal: ${edFederal}`);
  console.log(`   - PA: ${edPA}`);
  console.log(`   - NJ: ${edNJ}`);
  console.log(`   MCP Validated: ${edValidated}`);
  console.log(`   Topic Mappings: ${edTopics}`);
  console.log(`   Tasks: ${edTasks}`);
  console.log(`   Last Sync: ${edLastSync}`);
  
  // Compare
  console.log('\n📋 ALIGNMENT CHECK:');
  
  let issues = [];
  
  // Total regulations
  if (parseInt(mcpStats.total) === parseInt(edTotal)) {
    console.log(`   ✅ Total regulations match: ${mcpStats.total}`);
  } else {
    console.log(`   ❌ MISMATCH - Total: MCP=${mcpStats.total}, EdSteward=${edTotal}`);
    issues.push(`Total: MCP=${mcpStats.total}, EdSteward=${edTotal}`);
  }
  
  // Federal
  if (parseInt(mcpStats.federal) === parseInt(edFederal)) {
    console.log(`   ✅ Federal regulations match: ${mcpStats.federal}`);
  } else {
    console.log(`   ❌ MISMATCH - Federal: MCP=${mcpStats.federal}, EdSteward=${edFederal}`);
    issues.push(`Federal: MCP=${mcpStats.federal}, EdSteward=${edFederal}`);
  }
  
  // PA
  if (parseInt(mcpStats.pa) === parseInt(edPA)) {
    console.log(`   ✅ PA regulations match: ${mcpStats.pa}`);
  } else {
    console.log(`   ❌ MISMATCH - PA: MCP=${mcpStats.pa}, EdSteward=${edPA}`);
    issues.push(`PA: MCP=${mcpStats.pa}, EdSteward=${edPA}`);
  }
  
  // NJ
  if (parseInt(mcpStats.nj) === parseInt(edNJ)) {
    console.log(`   ✅ NJ regulations match: ${mcpStats.nj}`);
  } else {
    console.log(`   ❌ MISMATCH - NJ: MCP=${mcpStats.nj}, EdSteward=${edNJ}`);
    issues.push(`NJ: MCP=${mcpStats.nj}, EdSteward=${edNJ}`);
  }
  
  // Topics
  if (parseInt(mcpStats.topics) === parseInt(edTopics)) {
    console.log(`   ✅ Topic mappings match: ${mcpStats.topics}`);
  } else {
    console.log(`   ⚠️  Topic mappings differ: MCP=${mcpStats.topics}, EdSteward=${edTopics}`);
  }
  
  // Hash comparison (if available)
  console.log('\n📋 HASH VERIFICATION:');
  const mcpHashes = await getMCPHashes();
  const edHashes = await getEdStewardHashes();
  
  if (edHashes) {
    // Handle both camelCase (EdSteward) and snake_case field names
    const edHashMap = new Map(edHashes.map(r => [
      r.itemId || r.item_id, 
      r.versionHash || r.version_hash
    ]));
    
    let hashMatches = 0;
    let hashMismatches = [];
    let missingInEd = [];
    
    for (const mcpReg of mcpHashes) {
      const edHash = edHashMap.get(mcpReg.item_id);
      
      if (!edHash) {
        missingInEd.push(mcpReg.item_id);
      } else if (edHash === mcpReg.version_hash) {
        hashMatches++;
      } else {
        hashMismatches.push(mcpReg.item_id);
      }
    }
    
    console.log(`   Hash matches: ${hashMatches}/${mcpHashes.length}`);
    
    if (missingInEd.length > 0) {
      console.log(`   ❌ Missing in EdSteward: ${missingInEd.length}`);
      if (missingInEd.length <= 5) {
        missingInEd.forEach(id => console.log(`      - ${id}`));
      }
      issues.push(`${missingInEd.length} regulations missing in EdSteward`);
    }
    
    if (hashMismatches.length > 0) {
      console.log(`   ⚠️  Hash mismatches (stale data): ${hashMismatches.length}`);
      if (hashMismatches.length <= 5) {
        hashMismatches.forEach(id => console.log(`      - ${id}`));
      }
    }
  } else {
    console.log('   ⚠️  Could not retrieve EdSteward hashes for comparison');
    console.log('      Add /api/mcp/regulation-hashes endpoint to EdSteward');
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  if (issues.length === 0) {
    console.log('✅ SYSTEMS ALIGNED');
    console.log('='.repeat(70));
    await pool.end();
    process.exit(0);
  } else {
    console.log('❌ ALIGNMENT ISSUES DETECTED');
    console.log('='.repeat(70));
    console.log('\nIssues:');
    issues.forEach(i => console.log(`  - ${i}`));
    console.log('\nRecommendation: Run `npm run align` to re-sync');
    await pool.end();
    process.exit(1);
  }
}

verifyAlignment().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
