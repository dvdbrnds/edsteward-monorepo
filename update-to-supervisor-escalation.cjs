/**
 * Update regulations with supervisor escalation targets
 * Run with: node update-to-supervisor-escalation.cjs
 */

const { Pool } = require('pg');
require('dotenv').config();

// Map each responsible office to its supervisor
// This is the VP or senior leader who oversees that office
const SUPERVISOR_MAPPINGS = {
  'Financial Aid Office': {
    supervisor: 'VP of Enrollment Management',
    supervisorEmail: 'vp-enrollment@university.edu'
  },
  'Institutional Research': {
    supervisor: 'VP of Institutional Effectiveness',
    supervisorEmail: 'vp-effectiveness@university.edu'
  },
  'Campus Safety / Police': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'Registrar': {
    supervisor: 'VP of Enrollment Management',
    supervisorEmail: 'vp-enrollment@university.edu'
  },
  'Human Resources': {
    supervisor: 'VP of Administration',
    supervisorEmail: 'vp-administration@university.edu'
  },
  'Title IX Office': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'Disability Services': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'Athletics': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'Business Office / Finance': {
    supervisor: 'VP of Finance',
    supervisorEmail: 'vp-finance@university.edu'
  },
  'Research Compliance': {
    supervisor: 'VP of Academic Affairs',
    supervisorEmail: 'vp-academic@university.edu'
  },
  'Environmental Health & Safety': {
    supervisor: 'VP of Administration',
    supervisorEmail: 'vp-administration@university.edu'
  },
  'Information Technology': {
    supervisor: 'VP of Administration',
    supervisorEmail: 'vp-administration@university.edu'
  },
  'Student Affairs': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'Admissions': {
    supervisor: 'VP of Enrollment Management',
    supervisorEmail: 'vp-enrollment@university.edu'
  },
  'Academic Affairs': {
    supervisor: 'VP of Academic Affairs',
    supervisorEmail: 'vp-academic@university.edu'
  },
  'Legal / General Counsel': {
    supervisor: 'President',
    supervisorEmail: 'president@university.edu'
  },
  'Health Services': {
    supervisor: 'VP of Student Affairs',
    supervisorEmail: 'vp-studentaffairs@university.edu'
  },
  'International Programs': {
    supervisor: 'VP of Academic Affairs',
    supervisorEmail: 'vp-academic@university.edu'
  },
  'Compliance Office': {
    supervisor: 'VP of Administration',
    supervisorEmail: 'vp-administration@university.edu'
  }
};

async function updateSupervisors() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🚀 Updating escalation targets to supervisors...\n');
    
    // Step 1: Add new columns if they don't exist
    console.log('1️⃣ Adding supervisor columns...');
    await pool.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS escalation_target TEXT,
      ADD COLUMN IF NOT EXISTS escalation_email TEXT
    `);
    console.log('   ✅ Columns added\n');
    
    // Step 2: Update each regulation based on its responsible office
    console.log('2️⃣ Mapping offices to supervisors...');
    
    for (const [office, supervisor] of Object.entries(SUPERVISOR_MAPPINGS)) {
      const result = await pool.query(`
        UPDATE regulations 
        SET escalation_target = $1, escalation_email = $2
        WHERE responsible_office = $3
        RETURNING id
      `, [supervisor.supervisor, supervisor.supervisorEmail, office]);
      
      console.log(`   ${office} → ${supervisor.supervisor}: ${result.rowCount} regulations`);
    }
    
    // Step 3: Verify
    console.log('\n3️⃣ Verifying supervisor assignments...');
    const verification = await pool.query(`
      SELECT escalation_target, COUNT(*) as count 
      FROM regulations 
      WHERE escalation_target IS NOT NULL
      GROUP BY escalation_target 
      ORDER BY count DESC
    `);
    
    console.log('\n   📊 Escalation Target Distribution:');
    for (const row of verification.rows) {
      console.log(`   ${row.escalation_target}: ${row.count} regulations`);
    }
    
    console.log('\n✅ Supervisor escalation targets updated!');
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateSupervisors();

