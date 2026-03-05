const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function audit() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('CATEGORY AUDIT');
    console.log('='.repeat(70));
    
    // Get all categories with counts
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM regulations
      GROUP BY category
      ORDER BY count DESC, category
    `);
    
    console.log(`\nTotal unique categories: ${categories.rows.length}\n`);
    console.log('Category                                              | Count');
    console.log('-'.repeat(70));
    
    categories.rows.forEach(r => {
      const cat = r.category.substring(0, 50).padEnd(52);
      console.log(`${cat} | ${r.count}`);
    });
    
    // Show potential duplicates (similar names)
    console.log('\n' + '='.repeat(70));
    console.log('POTENTIAL DUPLICATES / SIMILAR CATEGORIES');
    console.log('='.repeat(70));
    
    const catList = categories.rows.map(r => r.category);
    const similar = [];
    
    for (let i = 0; i < catList.length; i++) {
      for (let j = i + 1; j < catList.length; j++) {
        const a = catList[i].toLowerCase();
        const b = catList[j].toLowerCase();
        
        // Check if one contains the other or they share significant words
        if (a.includes(b) || b.includes(a) || 
            a.replace(/[^a-z]/g, '') === b.replace(/[^a-z]/g, '')) {
          similar.push([catList[i], catList[j]]);
        }
      }
    }
    
    if (similar.length > 0) {
      similar.forEach(([a, b]) => {
        console.log(`  "${a}"\n  "${b}"\n`);
      });
    } else {
      console.log('  No obvious duplicates found');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(console.error);
