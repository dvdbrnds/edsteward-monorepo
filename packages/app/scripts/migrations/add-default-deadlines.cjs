/**
 * Add default October 31 deadlines to all regulations without deadlines
 * Run with: node add-default-deadlines.cjs
 */

const { Pool } = require('pg');
require('dotenv').config();

function getNextOctober31() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const oct31ThisYear = new Date(currentYear, 9, 31); // Month is 0-indexed, so 9 = October
  
  // If October 31 this year has passed, use next year
  if (now > oct31ThisYear) {
    return new Date(currentYear + 1, 9, 31);
  }
  return oct31ThisYear;
}

async function addDefaultDeadlines() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🎃 Adding default October 31 deadlines...\n');
    
    // First, ensure the columns exist
    console.log('0️⃣ Ensuring required columns exist...');
    await pool.query(`
      ALTER TABLE deadlines 
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false
    `);
    await pool.query(`
      ALTER TABLE deadlines 
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    console.log('   ✅ Columns ready\n');
    
    // Find an admin user to assign deadlines to
    console.log('📋 Finding admin user for assignment...');
    const adminResult = await pool.query(`
      SELECT id, username FROM users WHERE role = 'admin' LIMIT 1
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }
    
    const adminId = adminResult.rows[0].id;
    console.log(`   Assigning to: ${adminResult.rows[0].username} (ID: ${adminId})\n`);
    
    const oct31 = getNextOctober31();
    console.log(`📅 Default deadline date: ${oct31.toDateString()}\n`);
    
    // Step 1: Find all regulations without deadlines
    console.log('1️⃣ Finding regulations without deadlines...');
    const regulationsWithoutDeadlines = await pool.query(`
      SELECT r.id, r.name, r.topic
      FROM regulations r
      LEFT JOIN deadlines d ON d.regulation_id = r.id
      WHERE d.id IS NULL
    `);
    
    console.log(`   Found ${regulationsWithoutDeadlines.rows.length} regulations without deadlines\n`);
    
    if (regulationsWithoutDeadlines.rows.length === 0) {
      console.log('✅ All regulations already have deadlines!');
      return;
    }
    
    // Step 2: Create default deadlines
    console.log('2️⃣ Creating default deadlines...');
    let created = 0;
    
    for (const reg of regulationsWithoutDeadlines.rows) {
      await pool.query(`
        INSERT INTO deadlines (regulation_id, due_date, status, assigned_to, description, is_default)
        VALUES ($1, $2, 'pending', $3, 'Default annual compliance review deadline (October 31)', true)
      `, [reg.id, oct31.toISOString(), adminId]);
      
      created++;
      if (created % 50 === 0) {
        console.log(`   Created ${created}/${regulationsWithoutDeadlines.rows.length}...`);
      }
    }
    
    console.log(`   ✅ Created ${created} default deadlines\n`);
    
    // Step 3: Verify
    console.log('3️⃣ Verifying...');
    const verification = await pool.query(`
      SELECT 
        COUNT(DISTINCT r.id) as total_regulations,
        COUNT(DISTINCT d.regulation_id) as regulations_with_deadlines
      FROM regulations r
      LEFT JOIN deadlines d ON d.regulation_id = r.id
    `);
    
    const stats = verification.rows[0];
    console.log(`   Total regulations: ${stats.total_regulations}`);
    console.log(`   Regulations with deadlines: ${stats.regulations_with_deadlines}`);
    
    // Count default vs non-default
    const defaultCount = await pool.query(`
      SELECT COUNT(*) as count FROM deadlines WHERE is_default = true
    `);
    console.log(`   Default deadlines (Oct 31): ${defaultCount.rows[0].count}`);
    
    console.log('\n🎃 Halloween deadlines added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addDefaultDeadlines();
