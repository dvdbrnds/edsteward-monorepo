const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function normalizeAll() {
  const client = await pool.connect();
  
  console.log('='.repeat(70));
  console.log('NORMALIZING ALL EXISTING REGULATIONS');
  console.log('='.repeat(70));
  
  try {
    // Get all regulations that need normalization
    const regs = await client.query(`
      SELECT r.id, r.category, r.original_category, r.canonical_category_id
      FROM regulations r
      WHERE r.canonical_category_id IS NULL 
         OR r.original_category IS NULL
      ORDER BY r.id
    `);
    
    console.log(`\nFound ${regs.rows.length} regulations to normalize\n`);
    
    let normalized = 0;
    let created = 0;
    let failed = 0;
    
    for (const reg of regs.rows) {
      // Look up or create mapping
      let mapping = await client.query(`
        SELECT cm.canonical_category_id, cc.name as canonical_name
        FROM category_mappings cm
        JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
        WHERE LOWER(cm.incoming_category) = LOWER($1)
      `, [reg.category]);
      
      if (mapping.rows.length === 0) {
        // Try fuzzy match and create mapping
        const fuzzyResult = fuzzyMatch(reg.category);
        
        if (fuzzyResult) {
          // Get canonical ID
          const canonical = await client.query(
            'SELECT id FROM canonical_categories WHERE name = $1',
            [fuzzyResult.canonicalName]
          );
          
          if (canonical.rows.length > 0) {
            // Create mapping
            await client.query(`
              INSERT INTO category_mappings (incoming_category, canonical_category_id, source, confidence, is_verified)
              VALUES ($1, $2, 'bulk_normalization', $3, false)
              ON CONFLICT (incoming_category) DO NOTHING
            `, [reg.category, canonical.rows[0].id, fuzzyResult.confidence.toFixed(2)]);
            
            mapping = await client.query(`
              SELECT cm.canonical_category_id, cc.name as canonical_name
              FROM category_mappings cm
              JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
              WHERE LOWER(cm.incoming_category) = LOWER($1)
            `, [reg.category]);
            
            created++;
            console.log(`  🆕 Created mapping: "${reg.category}" → "${fuzzyResult.canonicalName}" (${(fuzzyResult.confidence * 100).toFixed(0)}%)`);
          }
        }
      }
      
      if (mapping.rows.length > 0) {
        // Update regulation
        await client.query(`
          UPDATE regulations
          SET original_category = COALESCE(original_category, category),
              category = $1,
              canonical_category_id = $2
          WHERE id = $3
        `, [mapping.rows[0].canonical_name, mapping.rows[0].canonical_category_id, reg.id]);
        
        normalized++;
      } else {
        failed++;
        console.log(`  ⚠️  No mapping for: "${reg.category}"`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('NORMALIZATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n  ✅ Normalized: ${normalized}`);
    console.log(`  🆕 New mappings: ${created}`);
    console.log(`  ⚠️  Failed: ${failed}`);
    
    // Show final distribution
    const dist = await client.query(`
      SELECT cc.name, COUNT(r.id) as count
      FROM canonical_categories cc
      LEFT JOIN regulations r ON r.canonical_category_id = cc.id
      GROUP BY cc.id, cc.name
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Final Category Distribution:');
    dist.rows.forEach(r => {
      const bar = '█'.repeat(Math.ceil(r.count / 10));
      console.log(`  ${r.name.padEnd(30)} ${String(r.count).padStart(4)} ${bar}`);
    });
    
    // Show unmapped
    const unmapped = await client.query(`
      SELECT category, COUNT(*) as count
      FROM regulations
      WHERE canonical_category_id IS NULL
      GROUP BY category
      ORDER BY count DESC
    `);
    
    if (unmapped.rows.length > 0) {
      console.log('\n⚠️  Still unmapped:');
      unmapped.rows.forEach(r => {
        console.log(`  "${r.category}" (${r.count} regulations)`);
      });
    } else {
      console.log('\n✅ All regulations normalized!');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Fuzzy matching logic
function fuzzyMatch(incoming) {
  const normalized = incoming.toLowerCase().trim();
  
  const keywordMap = {
    'Academic Programs': ['academic', 'education', 'curriculum', 'accreditation', 'admissions', 'degree', 'program'],
    'Human Resources': ['hr', 'human resources', 'employment', 'hiring', 'termination', 'benefits', 'wages', 'salary', 'labor', 'union', 'immigration', 'employee', 'recruitment'],
    'Finance & Accounting': ['finance', 'financial', 'accounting', 'tax', 'budget', 'fiscal', 'treasury'],
    'Campus Safety & Security': ['safety', 'security', 'police', 'clery', 'emergency', 'crime'],
    'Information Technology': ['it', 'information technology', 'technology', 'cyber', 'data', 'privacy', 'computer', 'network', 'ferpa'],
    'Research & Grants': ['research', 'grant', 'sponsored', 'export', 'irb', 'iacuc', 'scientific'],
    'Environmental Health & Safety': ['environmental', 'ehs', 'hazard', 'osha', 'chemical', 'radiation', 'biosafety'],
    'Financial Aid': ['financial aid', 'title iv', 'student aid', 'pell', 'loan', 'scholarship', 'fafsa'],
    'Civil Rights & Compliance': ['civil rights', 'title ix', 'discrimination', 'ada', 'disability', 'diversity', 'affirmative', 'sexual', 'harassment', 'equal opportunity'],
    'Contracts & Procurement': ['contract', 'procurement', 'purchasing', 'vendor', 'bid', 'rfp'],
    'Intellectual Property': ['intellectual property', 'ip', 'copyright', 'trademark', 'patent', 'technology transfer', 'licensing'],
    'Ethics & Governance': ['ethics', 'governance', 'board', 'lobbying', 'political', 'conflict of interest'],
    'Fundraising & Development': ['fundraising', 'development', 'donor', 'gift', 'advancement', 'charitable'],
    'Athletics': ['athletic', 'ncaa', 'sports', 'varsity', 'intercollegiate'],
    'Student Services': ['student service', 'student affairs', 'housing', 'residence', 'auxiliary', 'dining', 'international student'],
  };
  
  let bestMatch = null;
  
  for (const [canonical, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        const score = keyword.length / normalized.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { canonicalName: canonical, score: Math.min(score * 1.5, 0.95), confidence: Math.min(score * 1.5, 0.95) };
        }
      }
    }
  }
  
  return bestMatch;
}

normalizeAll().catch(console.error);
