const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

async function runAudit() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('EDSTEWARD PRE-ALIGNMENT AUDIT');
  console.log('='.repeat(60));
  
  try {
    // 1.1 Count Current Regulations
    console.log('\n### 1.1 REGULATION COUNTS ###\n');
    
    const totalRegs = await client.query('SELECT COUNT(*) as total FROM regulations');
    console.log(`Total regulations: ${totalRegs.rows[0].total}`);
    
    const byJurisdiction = await client.query(`
      SELECT jurisdiction_source, COUNT(*) as count
      FROM regulations
      GROUP BY jurisdiction_source
      ORDER BY count DESC
    `);
    console.log('\nBy jurisdiction:');
    byJurisdiction.rows.forEach(r => console.log(`  ${r.jurisdiction_source || 'NULL'}: ${r.count}`));
    
    const completeness = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN statute IS NOT NULL AND statute != '' THEN 1 END) as has_statute,
        COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END) as has_category,
        COUNT(CASE WHEN topic IS NOT NULL AND topic != '' THEN 1 END) as has_topic,
        COUNT(CASE WHEN summary IS NOT NULL AND LENGTH(summary) > 50 THEN 1 END) as has_summary,
        COUNT(CASE WHEN item_id IS NOT NULL AND item_id != '' THEN 1 END) as has_item_id
      FROM regulations
    `);
    console.log('\nCompleteness:');
    const c = completeness.rows[0];
    console.log(`  Has statute: ${c.has_statute}/${c.total}`);
    console.log(`  Has category: ${c.has_category}/${c.total}`);
    console.log(`  Has topic: ${c.has_topic}/${c.total}`);
    console.log(`  Has summary (>50 chars): ${c.has_summary}/${c.total}`);
    console.log(`  Has item_id: ${c.has_item_id}/${c.total}`);
    
    // 1.2 Related Tables
    console.log('\n### 1.2 RELATED TABLES ###\n');
    
    const taskCount = await client.query('SELECT COUNT(*) as total FROM compliance_tasks');
    console.log(`Total compliance tasks: ${taskCount.rows[0].total}`);
    
    const tasksPerReg = await client.query(`
      SELECT r.name, COUNT(ct.id) as task_count
      FROM regulations r
      LEFT JOIN compliance_tasks ct ON ct.regulation_id = r.id
      GROUP BY r.id, r.name
      ORDER BY task_count DESC
      LIMIT 5
    `);
    console.log('\nTop 5 regulations by task count:');
    tasksPerReg.rows.forEach(r => console.log(`  ${r.task_count} tasks: ${r.name.substring(0,50)}...`));
    
    const regsWithDeadlines = await client.query(`
      SELECT COUNT(*) as count
      FROM regulations
      WHERE filing_deadlines IS NOT NULL 
        AND filing_deadlines::text != '[]'
        AND filing_deadlines::text != 'null'
    `);
    console.log(`\nRegulations with filing_deadlines: ${regsWithDeadlines.rows[0].count}`);
    
    const regsWithActions = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN actions IS NOT NULL AND actions::text != '[]' AND actions::text != 'null' THEN 1 END) as has_actions
      FROM regulations
    `);
    console.log(`Regulations with actions: ${regsWithActions.rows[0].has_actions}/${regsWithActions.rows[0].total}`);
    
    // 1.3 Orphaned Data
    console.log('\n### 1.3 ORPHANED DATA ###\n');
    
    const orphanedTasks = await client.query(`
      SELECT COUNT(*) as count
      FROM compliance_tasks ct
      WHERE NOT EXISTS (SELECT 1 FROM regulations r WHERE r.id = ct.regulation_id)
    `);
    console.log(`Orphaned tasks (no regulation): ${orphanedTasks.rows[0].count}`);
    
    const dupItemIds = await client.query(`
      SELECT item_id, COUNT(*) as count
      FROM regulations
      WHERE item_id IS NOT NULL
      GROUP BY item_id
      HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate item_ids: ${dupItemIds.rows.length}`);
    if (dupItemIds.rows.length > 0) {
      dupItemIds.rows.forEach(r => console.log(`  ${r.item_id}: ${r.count} duplicates`));
    }
    
    const dupNames = await client.query(`
      SELECT name, COUNT(*) as count
      FROM regulations
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate names: ${dupNames.rows.length}`);
    if (dupNames.rows.length > 0) {
      dupNames.rows.slice(0,5).forEach(r => console.log(`  "${r.name.substring(0,40)}...": ${r.count} duplicates`));
    }
    
    // 2.1 Schema Check
    console.log('\n### 2.1 REGULATIONS SCHEMA ###\n');
    
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'regulations'
      ORDER BY ordinal_position
    `);
    console.log('Column Name                    | Type           | Nullable');
    console.log('-'.repeat(60));
    schema.rows.forEach(r => {
      const name = r.column_name.padEnd(30) ;
      const type = r.data_type.padEnd(14);
      console.log(`${name} | ${type} | ${r.is_nullable}`);
    });
    
    // Check for specific MCP Engine fields
    console.log('\n### 2.2 MCP ENGINE FIELD MAPPING ###\n');
    
    const requiredFields = [
      'item_id', 'name', 'statute', 'category', 'topic',
      'jurisdiction_source', 'summary', 'requirements', 'regulation_text',
      'effective_date', 'agency_name', 'agency_url', 'filing_deadlines', 'actions'
    ];
    
    const mcpFields = [
      { mcp: 'lovvLevel', es: 'lovv_level', needed: true },
      { mcp: 'lastValidated', es: 'last_validated', needed: true },
      { mcp: 'version', es: 'version_number', needed: false },
      { mcp: 'versionHash', es: 'version_hash', needed: true },
      { mcp: 'stateCode', es: 'state_code', needed: true },
      { mcp: 'sourceUrl', es: 'source_url', needed: true }
    ];
    
    const existingCols = schema.rows.map(r => r.column_name);
    
    console.log('Required Fields Check:');
    requiredFields.forEach(f => {
      const exists = existingCols.includes(f);
      console.log(`  ${exists ? '✅' : '❌'} ${f}`);
    });
    
    console.log('\nMCP Engine Specific Fields:');
    mcpFields.forEach(f => {
      const exists = existingCols.includes(f.es);
      console.log(`  ${exists ? '✅' : '❌'} ${f.mcp} → ${f.es} ${f.needed && !exists ? '(NEEDS MIGRATION)' : ''}`);
    });
    
    // Sample data
    console.log('\n### SAMPLE REGULATION DATA ###\n');
    const sample = await client.query(`
      SELECT id, item_id, name, jurisdiction_source, category
      FROM regulations
      LIMIT 3
    `);
    sample.rows.forEach(r => {
      console.log(`ID ${r.id}: ${r.name.substring(0,40)}...`);
      console.log(`   item_id: ${r.item_id || 'NULL'}`);
      console.log(`   jurisdiction: ${r.jurisdiction_source}`);
      console.log(`   category: ${r.category}`);
    });
    
    // Check compliance_tasks schema
    console.log('\n### 2.3 COMPLIANCE_TASKS SCHEMA ###\n');
    const taskSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'compliance_tasks'
      ORDER BY ordinal_position
    `);
    console.log('Column Name                    | Type           | Nullable');
    console.log('-'.repeat(60));
    taskSchema.rows.forEach(r => {
      const name = r.column_name.padEnd(30);
      const type = r.data_type.padEnd(14);
      console.log(`${name} | ${type} | ${r.is_nullable}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT COMPLETE');
    console.log('='.repeat(60));
    
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit().catch(console.error);
