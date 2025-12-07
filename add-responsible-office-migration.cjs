/**
 * Migration: Add responsible office columns and apply assignments
 * Run with: node add-responsible-office-migration.cjs
 */

const { Pool } = require('pg');
require('dotenv').config();

// Office assignments (same logic as analysis script)
const OFFICE_MAPPINGS = [
  {
    office: 'Financial Aid Office',
    email: 'financialaid@university.edu',
    keywords: ['financial aid', 'title iv', 'pell grant', 'student loan', 'fafsa', 'federal student aid', 'borrower', 'direct loan', 'work-study', 'institutional eligibility']
  },
  {
    office: 'Institutional Research',
    email: 'institutionalresearch@university.edu',
    keywords: ['institutional information', 'consumer information', 'gainful employment', 'college scorecard', 'ipeds', 'reporting requirement', 'disclosure', 'net price calculator', 'graduation rate', 'retention']
  },
  {
    office: 'Campus Safety / Police',
    email: 'campussafety@university.edu',
    keywords: ['clery', 'campus security', 'crime', 'safety', 'emergency', 'timely warning', 'security report', 'sexual assault', 'violence against women', 'vawa', 'drug-free', 'fire safety']
  },
  {
    office: 'Registrar',
    email: 'registrar@university.edu',
    keywords: ['ferpa', 'student records', 'privacy', 'transcript', 'educational records', 'directory information', 'academic records']
  },
  {
    office: 'Human Resources',
    email: 'humanresources@university.edu',
    keywords: ['employment', 'employee', 'flsa', 'fair labor', 'wage', 'overtime', 'workplace', 'employer', 'hiring', 'discrimination employment', 'eeo', 'equal employment', 'aca', 'affordable care', 'cobra', 'fmla', 'family medical leave', 'workers compensation', 'i-9', 'e-verify']
  },
  {
    office: 'Title IX Office',
    email: 'titleix@university.edu',
    keywords: ['title ix', 'sexual harassment', 'sexual misconduct', 'gender equity', 'sex discrimination', 'pregnant', 'pregnancy discrimination']
  },
  {
    office: 'Disability Services',
    email: 'disabilityservices@university.edu',
    keywords: ['ada', 'americans with disabilities', 'disability', 'accommodation', 'accessibility', 'section 504', 'rehabilitation act']
  },
  {
    office: 'Athletics',
    email: 'athletics@university.edu',
    keywords: ['ncaa', 'athletic', 'intercollegiate', 'student-athlete', 'equity in athletics']
  },
  {
    office: 'Business Office / Finance',
    email: 'businessoffice@university.edu',
    keywords: ['accounting', 'audit', 'financial statement', 'fiscal', 'tax', 'irs', '990', 'nonprofit', 'procurement', 'contract', 'grant accounting', 'cost accounting', 'uniform guidance', 'single audit', 'a-133']
  },
  {
    office: 'Research Compliance',
    email: 'researchcompliance@university.edu',
    keywords: ['research', 'irb', 'human subjects', 'animal research', 'iacuc', 'export control', 'conflict of interest research', 'misconduct research', 'responsible conduct', 'nih', 'nsf grant']
  },
  {
    office: 'Environmental Health & Safety',
    email: 'environmentalhealth@university.edu',
    keywords: ['osha', 'hazard', 'chemical', 'laboratory safety', 'radiation', 'biosafety', 'environmental', 'waste', 'hazmat', 'bloodborne']
  },
  {
    office: 'Information Technology',
    email: 'informationtechnology@university.edu',
    keywords: ['data security', 'cybersecurity', 'glba', 'gramm-leach', 'information security', 'breach notification', 'privacy data', 'pci', 'hipaa technology', 'encryption']
  },
  {
    office: 'Student Affairs',
    email: 'studentaffairs@university.edu',
    keywords: ['student conduct', 'student life', 'housing', 'residence', 'greek life', 'student organization', 'hazing', 'student rights']
  },
  {
    office: 'Admissions',
    email: 'admissions@university.edu',
    keywords: ['admission', 'enrollment', 'recruitment', 'veterans affairs', 'gi bill', 'principles of good practice']
  },
  {
    office: 'Academic Affairs',
    email: 'academicaffairs@university.edu',
    keywords: ['accreditation', 'curriculum', 'credit hour', 'teach act', 'copyright', 'intellectual property', 'distance education', 'program integrity', 'academic program']
  },
  {
    office: 'Legal / General Counsel',
    email: 'legal@university.edu',
    keywords: ['constitutional', 'first amendment', 'free speech', 'subpoena', 'litigation', 'civil rights']
  },
  {
    office: 'Health Services',
    email: 'healthservices@university.edu',
    keywords: ['hipaa', 'health insurance portability', 'medical records', 'student health', 'immunization', 'vaccination', 'mental health']
  },
  {
    office: 'International Programs',
    email: 'international@university.edu',
    keywords: ['sevis', 'international student', 'f-1', 'j-1', 'visa', 'foreign', 'export control']
  }
];

const DEFAULT_OFFICE = {
  office: 'Compliance Office',
  email: 'compliance@university.edu'
};

function determineOffice(regulation) {
  const searchText = `${regulation.name || ''} ${regulation.topic || ''} ${regulation.summary || ''} ${regulation.requirements || ''}`.toLowerCase();
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const mapping of OFFICE_MAPPINGS) {
    let score = 0;
    for (const keyword of mapping.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mapping;
    }
  }
  
  return bestMatch || DEFAULT_OFFICE;
}

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🚀 Starting migration...\n');
    
    // Step 1: Add columns if they don't exist
    console.log('1️⃣ Adding columns to regulations table...');
    await pool.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS responsible_office TEXT,
      ADD COLUMN IF NOT EXISTS responsible_office_email TEXT
    `);
    console.log('   ✅ Columns added\n');
    
    // Step 2: Get all regulations
    console.log('2️⃣ Fetching regulations...');
    const result = await pool.query(`
      SELECT id, name, topic, summary, requirements 
      FROM regulations
    `);
    console.log(`   Found ${result.rows.length} regulations\n`);
    
    // Step 3: Update each regulation with office assignment
    console.log('3️⃣ Assigning responsible offices...');
    let updated = 0;
    for (const reg of result.rows) {
      const office = determineOffice(reg);
      await pool.query(`
        UPDATE regulations 
        SET responsible_office = $1, responsible_office_email = $2 
        WHERE id = $3
      `, [office.office, office.email, reg.id]);
      updated++;
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${result.rows.length}...`);
      }
    }
    console.log(`   ✅ Updated all ${updated} regulations\n`);
    
    // Step 4: Verify
    console.log('4️⃣ Verifying assignments...');
    const verification = await pool.query(`
      SELECT responsible_office, COUNT(*) as count 
      FROM regulations 
      GROUP BY responsible_office 
      ORDER BY count DESC
    `);
    console.log('\n   📊 Office Distribution:');
    for (const row of verification.rows) {
      console.log(`   ${row.responsible_office}: ${row.count} regulations`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();

