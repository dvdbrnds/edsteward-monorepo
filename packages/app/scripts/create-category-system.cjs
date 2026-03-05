const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function createCategorySystem() {
  const client = await pool.connect();
  
  console.log('Creating Category Normalization System...\n');
  
  try {
    // 1. Create canonical_categories table (the 15 master categories)
    console.log('1. Creating canonical_categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS canonical_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(7),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ canonical_categories created');
    
    // 2. Create category_mappings table (maps incoming → canonical)
    console.log('2. Creating category_mappings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_mappings (
        id SERIAL PRIMARY KEY,
        incoming_category VARCHAR(255) NOT NULL,
        canonical_category_id INTEGER REFERENCES canonical_categories(id),
        source VARCHAR(100),
        confidence DECIMAL(3,2) DEFAULT 1.00,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(incoming_category)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cat_map_incoming ON category_mappings(LOWER(incoming_category))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cat_map_canonical ON category_mappings(canonical_category_id)`);
    console.log('   ✅ category_mappings created');
    
    // 3. Add original_category to regulations if not exists
    console.log('3. Adding original_category to regulations...');
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS original_category VARCHAR(255),
      ADD COLUMN IF NOT EXISTS canonical_category_id INTEGER REFERENCES canonical_categories(id)
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reg_canonical_cat ON regulations(canonical_category_id)`);
    console.log('   ✅ original_category and canonical_category_id added to regulations');
    
    // 4. Insert the 15 canonical categories
    console.log('4. Inserting canonical categories...');
    const categories = [
      { name: 'Academic Programs', desc: 'Academic standards, accreditation, admissions, curriculum', icon: 'graduation-cap', color: '#4F46E5' },
      { name: 'Human Resources', desc: 'Employment, hiring, benefits, labor relations', icon: 'users', color: '#7C3AED' },
      { name: 'Finance & Accounting', desc: 'Financial management, accounting, tax compliance', icon: 'dollar-sign', color: '#059669' },
      { name: 'Campus Safety & Security', desc: 'Campus police, emergency management, Clery Act', icon: 'shield', color: '#DC2626' },
      { name: 'Information Technology', desc: 'IT systems, cybersecurity, data privacy', icon: 'server', color: '#2563EB' },
      { name: 'Research & Grants', desc: 'Research compliance, grant management, export controls', icon: 'flask', color: '#7C3AED' },
      { name: 'Environmental Health & Safety', desc: 'Environmental compliance, workplace safety, hazmat', icon: 'leaf', color: '#16A34A' },
      { name: 'Financial Aid', desc: 'Student financial aid, Title IV, program integrity', icon: 'hand-holding-dollar', color: '#CA8A04' },
      { name: 'Civil Rights & Compliance', desc: 'Title IX, ADA, anti-discrimination, diversity', icon: 'balance-scale', color: '#9333EA' },
      { name: 'Contracts & Procurement', desc: 'Purchasing, vendor management, contract compliance', icon: 'file-contract', color: '#0891B2' },
      { name: 'Intellectual Property', desc: 'Copyright, trademark, patents, tech transfer', icon: 'lightbulb', color: '#F59E0B' },
      { name: 'Ethics & Governance', desc: 'Ethics policies, board governance, lobbying', icon: 'landmark', color: '#6366F1' },
      { name: 'Fundraising & Development', desc: 'Charitable solicitation, donor relations', icon: 'gift', color: '#EC4899' },
      { name: 'Athletics', desc: 'NCAA compliance, athletic programs', icon: 'trophy', color: '#EF4444' },
      { name: 'Student Services', desc: 'Housing, student affairs, auxiliary services', icon: 'user-graduate', color: '#8B5CF6' },
    ];
    
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      await client.query(`
        INSERT INTO canonical_categories (name, description, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET 
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order
      `, [c.name, c.desc, c.icon, c.color, i + 1]);
    }
    console.log('   ✅ 15 canonical categories inserted');
    
    // 5. Create initial mappings from existing categories
    console.log('5. Creating initial category mappings...');
    const mappings = [
      // Academic Programs
      ['Academic Programs', 'Academic Programs'],
      ['Education', 'Academic Programs'],
      ['A-Priority Education', 'Academic Programs'],
      ['Admissions', 'Academic Programs'],
      ['Accreditation', 'Academic Programs'],
      
      // Human Resources
      ['Human Resources', 'Human Resources'],
      ['Recruitment Hiring & Termination', 'Human Resources'],
      ['Employee Benefits', 'Human Resources'],
      ['Wages', 'Human Resources'],
      ['Retirement', 'Human Resources'],
      ['Unions', 'Human Resources'],
      ['Immigration', 'Human Resources'],
      ['Immigration,Recruitment Hiring & Termination', 'Human Resources'],
      ['Discrimination,Human Resources', 'Human Resources'],
      
      // Finance & Accounting
      ['Finance', 'Finance & Accounting'],
      ['Accounting', 'Finance & Accounting'],
      ['Tax', 'Finance & Accounting'],
      
      // Campus Safety
      ['Campus Safety', 'Campus Safety & Security'],
      
      // Information Technology
      ['Information Technology', 'Information Technology'],
      ['Privacy & Information Security', 'Information Technology'],
      
      // Research & Grants
      ['Research', 'Research & Grants'],
      ['Grants Management', 'Research & Grants'],
      ['Export Controls', 'Research & Grants'],
      
      // Environmental Health & Safety
      ['Environmental Health and Safety', 'Environmental Health & Safety'],
      
      // Financial Aid
      ['Financial Aid', 'Financial Aid'],
      ['Program Integrity Rules', 'Financial Aid'],
      
      // Civil Rights & Compliance
      ['Diversity/Affirmative Action', 'Civil Rights & Compliance'],
      ['Discrimination', 'Civil Rights & Compliance'],
      ['Civil Rights', 'Civil Rights & Compliance'],
      ['Sexual Misconduct', 'Civil Rights & Compliance'],
      ['Disabilities', 'Civil Rights & Compliance'],
      
      // Contracts & Procurement
      ['Contracts & Procurement', 'Contracts & Procurement'],
      ['Contracts & Procurement,Recruitment Hiring & Termination', 'Contracts & Procurement'],
      
      // Intellectual Property
      ['Copyright & Trademark', 'Intellectual Property'],
      ['Intellectual Property and Technology Transfer', 'Intellectual Property'],
      
      // Ethics & Governance
      ['Ethics', 'Ethics & Governance'],
      ['Governance', 'Ethics & Governance'],
      ['Lobbying and Political Activities', 'Ethics & Governance'],
      
      // Fundraising
      ['Fundraising & Development', 'Fundraising & Development'],
      
      // Athletics
      ['Athletics', 'Athletics'],
      
      // Student Services
      ['Student Services', 'Student Services'],
      ['Housing', 'Student Services'],
      ['Auxiliary Services', 'Student Services'],
      ['International Activities and Programs', 'Student Services'],
      ['Health Care and Insurance', 'Student Services'],
      
      // Cleanup → map to closest
      ['Other', 'Civil Rights & Compliance'],
      ['Uncategorized', 'Academic Programs'],
      ['Example Category', 'Academic Programs'],
    ];
    
    for (const [incoming, canonical] of mappings) {
      await client.query(`
        INSERT INTO category_mappings (incoming_category, canonical_category_id, source, is_verified)
        SELECT $1, cc.id, 'initial_migration', true
        FROM canonical_categories cc WHERE cc.name = $2
        ON CONFLICT (incoming_category) DO NOTHING
      `, [incoming, canonical]);
    }
    console.log('   ✅ Category mappings created');
    
    // 6. Backfill existing regulations
    console.log('6. Backfilling existing regulations...');
    await client.query(`
      UPDATE regulations r
      SET 
        original_category = COALESCE(r.original_category, r.category),
        canonical_category_id = cm.canonical_category_id
      FROM category_mappings cm
      WHERE LOWER(r.category) = LOWER(cm.incoming_category)
        AND r.canonical_category_id IS NULL
    `);
    
    const backfilled = await client.query(`
      SELECT COUNT(*) as count FROM regulations WHERE canonical_category_id IS NOT NULL
    `);
    console.log(`   ✅ Backfilled ${backfilled.rows[0].count} regulations`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('CATEGORY NORMALIZATION SYSTEM READY');
    console.log('='.repeat(60));
    
    const summary = await client.query(`
      SELECT cc.name, COUNT(r.id) as reg_count
      FROM canonical_categories cc
      LEFT JOIN regulations r ON r.canonical_category_id = cc.id
      GROUP BY cc.id, cc.name
      ORDER BY cc.sort_order
    `);
    
    console.log('\nCanonical Category Distribution:');
    summary.rows.forEach(r => {
      console.log(`  ${r.name.padEnd(30)} ${r.reg_count} regulations`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

createCategorySystem().catch(console.error);
