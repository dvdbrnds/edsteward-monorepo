/**
 * Analyze regulations and propose responsible office assignments
 * Run with: node analyze-regulation-offices.cjs
 */

const { Pool } = require('pg');
require('dotenv').config();

// Office email mappings based on regulation keywords
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

// Default office if no match found
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
        // Longer keywords get more weight
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

async function analyzeRegulations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    const result = await pool.query(`
      SELECT id, name, topic, category, summary, requirements 
      FROM regulations 
      ORDER BY name, topic
    `);
    
    console.log(`\nAnalyzing ${result.rows.length} regulations...\n`);
    console.log('='.repeat(120));
    
    // Group by office
    const byOffice = {};
    const assignments = [];
    
    for (const reg of result.rows) {
      const office = determineOffice(reg);
      const regName = reg.name || reg.topic || `Regulation ID ${reg.id}`;
      
      if (!byOffice[office.office]) {
        byOffice[office.office] = {
          email: office.email,
          regulations: []
        };
      }
      byOffice[office.office].regulations.push({
        id: reg.id,
        name: regName,
        category: reg.category
      });
      
      assignments.push({
        id: reg.id,
        name: regName,
        office: office.office,
        email: office.email
      });
    }
    
    // Print summary by office
    console.log('\n📊 PROPOSED OFFICE ASSIGNMENTS SUMMARY\n');
    console.log('='.repeat(120));
    
    const sortedOffices = Object.entries(byOffice).sort((a, b) => b[1].regulations.length - a[1].regulations.length);
    
    for (const [officeName, data] of sortedOffices) {
      console.log(`\n📁 ${officeName} (${data.email})`);
      console.log(`   ${data.regulations.length} regulations assigned:`);
      for (const reg of data.regulations.slice(0, 10)) {
        console.log(`   - [${reg.id}] ${reg.name.substring(0, 80)}${reg.name.length > 80 ? '...' : ''}`);
      }
      if (data.regulations.length > 10) {
        console.log(`   ... and ${data.regulations.length - 10} more`);
      }
    }
    
    // Print total stats
    console.log('\n' + '='.repeat(120));
    console.log('\n📈 STATISTICS:\n');
    for (const [officeName, data] of sortedOffices) {
      const pct = ((data.regulations.length / result.rows.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(data.regulations.length / 5));
      console.log(`${officeName.padEnd(35)} ${String(data.regulations.length).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    }
    
    console.log(`\nTotal: ${result.rows.length} regulations`);
    
    // Save full assignments to JSON for review
    const fs = require('fs');
    fs.writeFileSync(
      'proposed-office-assignments.json',
      JSON.stringify(assignments, null, 2)
    );
    console.log('\n✅ Full assignments saved to: proposed-office-assignments.json');
    
    // Also create SQL update statements
    const sqlStatements = assignments.map(a => 
      `UPDATE regulations SET responsible_office = '${a.office}', responsible_office_email = '${a.email}' WHERE id = ${a.id};`
    ).join('\n');
    fs.writeFileSync('update-office-assignments.sql', sqlStatements);
    console.log('✅ SQL update statements saved to: update-office-assignments.sql');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

analyzeRegulations();

