#!/usr/bin/env node

/**
 * Restore Clery Act regulation using direct database insertion
 * This script restores the missing Clery Act regulation to the database
 */

const { neon } = require('@neondatabase/serverless');

async function restoreCleryAct() {
  console.log('🔄 Starting Clery Act restoration...');
  
  try {
    // Setup database connection
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ DATABASE_URL environment variable not set');
      process.exit(1);
    }
    
    const sql = neon(connectionString);
    
    // Check if Clery Act already exists
    const existing = await sql`
      SELECT id, name FROM regulations 
      WHERE LOWER(name) LIKE '%clery%' 
         OR LOWER(topic) LIKE '%clery%'
         OR item_id = 'REG1812'
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      console.log('✅ Clery Act regulation already exists in database');
      console.log('   ID:', existing[0].id);
      console.log('   Name:', existing[0].name);
      return;
    }
    
    console.log('💾 Inserting Clery Act regulation...');
    
    // Insert the Clery Act regulation with all required fields
    const result = await sql`
      INSERT INTO regulations (
        item_id,
        name,
        topic,
        statute,
        summary,
        requirements,
        category,
        jurisdiction,
        is_applicable,
        last_updated,
        agency_url,
        agency_name,
        agency_department,
        regulation_url,
        requirements_url,
        submission_guide_url,
        forms_url,
        submission_guidelines,
        version_number,
        is_current,
        change_summary,
        filing_deadlines,
        actions
      ) VALUES (
        'REG1812',
        'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
        'Campus Safety and Security',
        '20 U.S.C. § 1092(f)',
        'The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (Clery Act) is a federal law that requires colleges and universities to disclose certain timely and annual information about campus crime and security policies. The law, originally enacted by Congress in 1990 as the Campus Security Act, was championed by Howard and Connie Clery after their daughter Jeanne was murdered at Lehigh University in 1986.',
        'Institutions must collect and report crime statistics, maintain a daily crime log, provide timely warnings of crimes that pose a serious threat to students and employees, publish an annual security report, and maintain crime statistics for crimes committed on campus, in unobstructed public areas immediately adjacent to or running through the campus, and at certain non-campus facilities.',
        'Campus Safety',
        'federal',
        true,
        NOW(),
        'https://clerycenter.org',
        'Clery Center',
        'Campus Safety',
        'https://www.law.cornell.edu/uscode/text/20/1092',
        'https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46',
        'https://www.clerycenter.org/policy-resources',
        'https://surveys.ope.ed.gov/campussafety',
        'By October 1st of each year, institutions must publish and distribute their Annual Security Report to current students and employees. The report must include statistics of campus crime for the preceding 3 calendar years, plus details about efforts taken to improve campus safety.',
        1,
        true,
        'Restored missing Clery Act regulation',
        '[{"date": "October 1", "type": "submission", "frequency": "Annually", "description": "Annual Security Report submission deadline"}]',
        '[{"type": "attestation", "status": "pending", "enabled": true, "required": false}, {"type": "website_publish", "status": "pending", "enabled": true, "required": false}, {"type": "community_communication", "status": "pending", "enabled": true, "required": false}, {"type": "agency_submission", "status": "pending", "enabled": true, "required": false}]'
      )
      RETURNING id, item_id, name
    `;
    
    console.log('✅ Successfully restored Clery Act regulation!');
    console.log('   Database ID:', result[0].id);
    console.log('   Item ID:', result[0].item_id);
    console.log('   Name:', result[0].name);
    
  } catch (error) {
    console.error('❌ Error restoring Clery Act regulation:', error);
    process.exit(1);
  }
}

// Run the restoration
restoreCleryAct().then(() => {
  console.log('🎉 Clery Act restoration complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
