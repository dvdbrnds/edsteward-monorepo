/**
 * MCP Engine: Import Topic Mappings from Compliance Matrix
 * 
 * Creates regulation-topic junction records to preserve the many-to-many
 * relationship between regulations and departments/topics.
 * 
 * Run with: node scripts/import-topic-mappings.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

async function importTopicMappings() {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE: Import Topic Mappings');
  console.log('═'.repeat(60));
  console.log('');
  
  // Load and parse the CSV
  const csvPath = path.join(process.cwd(), 'data', 'compmat.csv');
  console.log(`Reading CSV from: ${csvPath}`);
  
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  
  // Parse CSV - use to_line to stop before the malformed section
  // The CSV has ~295 valid records before encountering bad data
  let records;
  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      escape: '"',
      trim: true,
      bom: true
    });
  } catch (err) {
    // If parsing fails, try with to_line limit
    console.log(`Full parse failed at line ${err.lines}, trying partial parse...`);
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      escape: '"',
      trim: true,
      bom: true,
      to_line: err.lines - 1  // Parse up to the line before failure
    });
    console.log(`Partial parse succeeded with ${records.length} records\n`);
  }
  
  console.log(`Found ${records.length} rows in CSV\n`);
  
  // Get all regulations from database for matching
  const regulations = await pool.query(`
    SELECT id, item_id, name FROM regulations ORDER BY name
  `);
  
  console.log(`Found ${regulations.rows.length} regulations in database\n`);
  
  // Create lookup maps for efficient matching
  const regByName = new Map();
  const regByNameLower = new Map();
  
  for (const reg of regulations.rows) {
    regByName.set(reg.name, reg);
    regByNameLower.set(reg.name.toLowerCase(), reg);
  }
  
  let imported = 0;
  let duplicates = 0;
  let notFound = [];
  let noTopic = 0;
  const topicCounts = new Map();
  
  for (const row of records) {
    const statuteName = row['Statute Name']?.trim();
    const topic = row['Topic']?.trim();
    const topicId = row['Topic ID'] ? parseInt(row['Topic ID']) : null;
    const itemId = row['Item ID']?.trim();
    
    // Skip rows without topic or statute name
    if (!statuteName || !topic) {
      noTopic++;
      continue;
    }
    
    // Find matching regulation
    let regulation = regByName.get(statuteName);
    
    // Try case-insensitive match
    if (!regulation) {
      regulation = regByNameLower.get(statuteName.toLowerCase());
    }
    
    // Try partial match (first significant words)
    if (!regulation) {
      const searchTerms = statuteName.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).slice(0, 4);
      for (const reg of regulations.rows) {
        const regLower = reg.name.toLowerCase();
        if (searchTerms.every(term => regLower.includes(term))) {
          regulation = reg;
          break;
        }
      }
    }
    
    if (!regulation) {
      notFound.push({ statuteName, topic, itemId });
      continue;
    }
    
    try {
      // Insert topic mapping
      const result = await pool.query(`
        INSERT INTO regulation_topics (regulation_id, topic, topic_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (regulation_id, topic) DO NOTHING
        RETURNING id
      `, [regulation.id, topic, topicId]);
      
      if (result.rowCount > 0) {
        imported++;
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      } else {
        duplicates++;
      }
    } catch (err) {
      console.error(`Error inserting mapping for ${statuteName}: ${err.message}`);
    }
  }
  
  console.log('─'.repeat(60));
  console.log('IMPORT RESULTS');
  console.log('─'.repeat(60));
  console.log(`Topic mappings created: ${imported}`);
  console.log(`Duplicate mappings skipped: ${duplicates}`);
  console.log(`Rows without topic/name: ${noTopic}`);
  console.log(`Regulations not found: ${notFound.length}`);
  
  if (notFound.length > 0 && notFound.length <= 30) {
    console.log('\nRegulations not matched:');
    notFound.forEach(r => console.log(`  - "${r.statuteName}" (Topic: ${r.topic})`));
  } else if (notFound.length > 30) {
    console.log('\nFirst 30 unmatched regulations:');
    notFound.slice(0, 30).forEach(r => console.log(`  - "${r.statuteName}" (Topic: ${r.topic})`));
    console.log(`  ... and ${notFound.length - 30} more`);
  }
  
  // Show topic distribution
  console.log('\n─'.repeat(60));
  console.log('TOPIC DISTRIBUTION (Top 20)');
  console.log('─'.repeat(60));
  
  const sortedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  for (const [topic, count] of sortedTopics) {
    console.log(`  ${topic}: ${count} regulations`);
  }
  
  // Database summary
  const summary = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM regulation_topics) as total_mappings,
      (SELECT COUNT(DISTINCT regulation_id) FROM regulation_topics) as regulations_with_topics,
      (SELECT COUNT(DISTINCT topic) FROM regulation_topics) as unique_topics
  `);
  
  console.log('\n═'.repeat(60));
  console.log('DATABASE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total topic mappings: ${summary.rows[0].total_mappings}`);
  console.log(`Regulations with topics: ${summary.rows[0].regulations_with_topics}`);
  console.log(`Unique topics: ${summary.rows[0].unique_topics}`);
  
  // Show regulations with multiple topics
  const multiTopic = await pool.query(`
    SELECT r.name, COUNT(rt.id) as topic_count, 
           array_agg(rt.topic ORDER BY rt.topic) as topics
    FROM regulations r
    JOIN regulation_topics rt ON rt.regulation_id = r.id
    GROUP BY r.id, r.name
    HAVING COUNT(rt.id) > 1
    ORDER BY topic_count DESC
    LIMIT 10
  `);
  
  console.log('\nRegulations spanning multiple topics:');
  for (const row of multiTopic.rows) {
    console.log(`  ${row.name}:`);
    console.log(`    Topics (${row.topic_count}): ${row.topics.slice(0, 5).join(', ')}${row.topics.length > 5 ? '...' : ''}`);
  }
  
  await pool.end();
}

importTopicMappings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
