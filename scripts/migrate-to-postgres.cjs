/**
 * MCP Engine: CSV to PostgreSQL Migration Script
 * 
 * Migrates all regulation data from the Registry API to PostgreSQL database.
 * 
 * Run with: node scripts/migrate-to-postgres.cjs
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER, // Use current macOS user
  password: process.env.MCP_DB_PASSWORD || '', // No password for local dev
});

// Generate SHA-256 hash for version tracking
function generateVersionHash(reg) {
  const content = [
    reg.name || '',
    reg.statute || reg.publicLaw || '',
    reg.summary || reg.description || '',
    reg.requirements || '',
    reg.regulationText || ''
  ].join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Generate item_id from regulationId or name
function generateItemId(reg) {
  if (reg.regulationId && typeof reg.regulationId === 'string' && reg.regulationId.length > 0) {
    return reg.regulationId;
  }
  return (reg.name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function fetchFromRegistryAPI() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('Fetching regulations from Registry API (http://localhost:3010/api/regulations)...');
  
  const response = await fetch('http://localhost:3010/api/regulations');
  if (!response.ok) {
    throw new Error(`Registry API returned ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`Fetched ${data.length} regulations from Registry API`);
  return data;
}

async function migrateRegulations() {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE: PostgreSQL Migration');
  console.log('═'.repeat(60));
  console.log('');
  
  // Test database connection
  console.log('Testing database connection...');
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log(`✅ Connected to database: ${result.rows[0].db}`);
    console.log(`   Time: ${result.rows[0].time}`);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Please ensure PostgreSQL is running.');
    process.exit(1);
  }
  
  // Fetch regulations from Registry API
  let regulations;
  try {
    regulations = await fetchFromRegistryAPI();
  } catch (err) {
    console.error('❌ Failed to fetch from Registry API:', err.message);
    console.error('Please ensure Registry API is running on port 3010');
    process.exit(1);
  }
  
  console.log(`\n📋 Starting migration of ${regulations.length} regulations...`);
  
  const client = await pool.connect();
  
  let inserted = 0;
  let updated = 0;
  let errors = [];
  
  // Helper to truncate strings safely
  const truncate = (str, maxLen) => {
    if (!str) return null;
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  };

  try {
    // Process each regulation in its own mini-transaction (SAVEPOINT)
    for (let i = 0; i < regulations.length; i++) {
      const reg = regulations[i];
      
      try {
        const itemId = generateItemId(reg);
        const versionHash = generateVersionHash(reg);
        
        // Determine jurisdiction
        const jurisdictionSource = reg.jurisdictionSource || 'federal';
        const stateCode = reg.stateCode || null;
        
        // Truncate fields to fit schema constraints
        const name = truncate(reg.name || 'Unknown Regulation', 500);
        const category = truncate(reg.topic || 'Uncategorized', 100);
        const topic = truncate(reg.topic || 'General', 100);
        const statute = reg.statutes && reg.statutes.length > 0 
          ? truncate(reg.statutes.join('; '), 500) 
          : null;
        const publicLaw = truncate(reg.publicLaw, 100);
        const deadline = truncate(reg.deadline, 200);
        const deadlineLabel = truncate(reg.deadlineLabel, 50);
        
        // Upsert regulation
        const result = await client.query(`
          INSERT INTO regulations (
            item_id, name, statute, public_law, category, topic,
            jurisdiction_source, state_code,
            summary, requirements, reporting_requirements,
            deadline, deadline_month, deadline_label,
            version_hash,
            created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8,
            $9, $10, $11,
            $12, $13, $14,
            $15,
            'migration', 'migration'
          )
          ON CONFLICT (item_id) DO UPDATE SET
            name = EXCLUDED.name,
            statute = EXCLUDED.statute,
            public_law = EXCLUDED.public_law,
            category = EXCLUDED.category,
            topic = EXCLUDED.topic,
            jurisdiction_source = EXCLUDED.jurisdiction_source,
            state_code = EXCLUDED.state_code,
            summary = EXCLUDED.summary,
            requirements = EXCLUDED.requirements,
            reporting_requirements = EXCLUDED.reporting_requirements,
            deadline = EXCLUDED.deadline,
            deadline_month = EXCLUDED.deadline_month,
            deadline_label = EXCLUDED.deadline_label,
            version_hash = EXCLUDED.version_hash,
            updated_at = NOW(),
            updated_by = 'migration'
          RETURNING id, (xmax = 0) as was_inserted
        `, [
          itemId,
          name,
          statute,
          publicLaw,
          category,
          topic,
          jurisdictionSource,
          stateCode,
          reg.description || null,
          null, // requirements - not in current API response
          reg.reportingRequirements || null,
          deadline,
          reg.deadlineMonth || null,
          deadlineLabel,
          versionHash
        ]);
        
        if (result.rows[0].was_inserted) {
          inserted++;
        } else {
          updated++;
        }
        
        // Progress indicator
        if ((i + 1) % 50 === 0 || i === regulations.length - 1) {
          console.log(`   Progress: ${i + 1}/${regulations.length} (${inserted} new, ${updated} updated)`);
        }
        
      } catch (err) {
        errors.push({ name: reg.name, error: err.message });
        // Don't log every error - they cascade
        if (!err.message.includes('current transaction is aborted')) {
          console.error(`   ⚠️  Error with "${reg.name}": ${err.message}`);
        }
      }
    }
    
    console.log('\n✅ Migration batch completed');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('                    MIGRATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   🔄 Updated:  ${updated}`);
  console.log(`   ❌ Errors:   ${errors.length}`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log('\n   Errors:');
    errors.forEach(e => console.log(`      - ${e.name}: ${e.error}`));
  }
  
  // Verify migration
  console.log('\n' + '─'.repeat(60));
  console.log('                  VERIFICATION');
  console.log('─'.repeat(60));
  
  const counts = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM regulations) as total,
      (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal') as federal,
      (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'state') as state,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA') as pa,
      (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ') as nj,
      (SELECT COUNT(*) FROM regulation_audit_log) as audit_entries
  `);
  
  const c = counts.rows[0];
  console.log(`\n   📊 Database Contents:`);
  console.log(`      Total Regulations:  ${c.total}`);
  console.log(`      ├── Federal:        ${c.federal}`);
  console.log(`      ├── State:          ${c.state}`);
  console.log(`      │   ├── PA:         ${c.pa}`);
  console.log(`      │   └── NJ:         ${c.nj}`);
  console.log(`      └── Audit Entries:  ${c.audit_entries}`);
  
  // Sample data
  console.log('\n   📋 Sample Regulations:');
  const samples = await pool.query(`
    SELECT item_id, name, jurisdiction_source, state_code 
    FROM regulations 
    ORDER BY RANDOM() 
    LIMIT 5
  `);
  samples.rows.forEach(r => {
    const jurisdiction = r.state_code ? `${r.jurisdiction_source}/${r.state_code}` : r.jurisdiction_source;
    console.log(`      - [${jurisdiction}] ${r.name.substring(0, 50)}${r.name.length > 50 ? '...' : ''}`);
  });
  
  await pool.end();
  
  console.log('\n' + '═'.repeat(60));
  console.log('    ✅ MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('═'.repeat(60));
  console.log('\n   Next steps:');
  console.log('   1. Update Registry API to use PostgreSQL');
  console.log('   2. Test: curl http://localhost:3010/api/regulations');
  console.log('   3. Verify audit log is recording changes\n');
}

// Run migration
migrateRegulations().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
