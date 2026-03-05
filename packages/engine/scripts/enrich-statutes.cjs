/**
 * MCP Engine: Statute Citation Enrichment Script
 * 
 * Adds missing legal citations to 44 regulations.
 * Run with: node scripts/enrich-statutes.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

// Direct mappings for the 44 missing regulations
const statuteMappings = {
  // Contracts & Procurement
  'anti-discrimination-laws-for-federal-contractors': 'Executive Order 11246; 41 CFR Part 60',
  'e-verify-executive-order-13465-amending-executive-': 'Executive Order 13465; 8 U.S.C. § 1324a',
  
  // Employee Benefits
  'cafeteria-plan-regulations': '26 U.S.C. § 125; 26 CFR § 1.125',
  'cafeteria-plans-26-u-s-c-125': '26 U.S.C. § 125; 26 CFR § 1.125',
  
  // Privacy/Data Protection
  'california-consumer-privacy-act': 'Cal. Civ. Code § 1798.100 et seq. (CCPA)',
  'general-data-protection-regulation': 'GDPR (EU) 2016/679',
  
  // Union/Labor
  'civil-service-reform-act-of-1978': '5 U.S.C. § 7101 et seq.',
  'national-labor-relations-act': '29 U.S.C. § 151 et seq.',
  
  // Research
  'clinical-trials-financial-disclosures-by-investiga': '42 CFR Part 50, Subpart F',
  'export-administration-regulations': '15 CFR Parts 730-774 (EAR)',
  'protection-of-human-subjects-regulations-common-ru': '45 CFR Part 46 (Common Rule)',
  'responsibility-of-applicants-for-promoting-objecti': '42 CFR Part 50, Subpart F',
  'small-unmanned-aircraft-systems': '14 CFR Part 107 (FAA UAS)',
  
  // Tax
  'deferred-compensation': '26 U.S.C. § 409A; 26 CFR § 1.409A',
  'independent-contractors': '26 U.S.C. § 3121; IRS Rev. Rul. 87-41',
  'small-business-job-protection-act': 'Pub. L. 104-188; 26 U.S.C. § 401 et seq.',
  'tax-cuts-and-jobs-act-of-2017-endowment-excise-tax': '26 U.S.C. § 4968',
  
  // Grants Management
  'department-of-education-general-administrative-reg': '2 CFR Part 200; 34 CFR Parts 75-79',
  
  // Environmental Health and Safety
  'guarding-and-use-of-hand-portable-powered-tools': '29 CFR § 1910.241-244',
  'mandatory-reporting-of-greenhouse-gases': '40 CFR Part 98',
  'motor-carrier-act-of-1980': '49 U.S.C. § 13101 et seq.',
  'national-emission-standards-for-hazardous-air-poll': '40 CFR Part 61 (NESHAP)',
  'osha-asbestos-in-construction-standard': '29 CFR § 1926.1101',
  'osha-asbestos-in-general-industry-standard': '29 CFR § 1910.1001',
  'osha-enforcement-guidance-for-personal-protective-': '29 CFR § 1910.132-138 (PPE)',
  'osha-lead-in-construction-standard': '29 CFR § 1926.62',
  'osha-lead-in-general-industry-standard': '29 CFR § 1910.1025',
  'osha-welding-cutting-and-brazing': '29 CFR § 1910.251-255',
  'osha-bloodborne-pathogens-standard': '29 CFR § 1910.1030',
  'osha-s-emergency-action-plan-standard': '29 CFR § 1910.38',
  'osha-s-occupational-exposure-to-hazardous-chemical': '29 CFR § 1910.1450',
  'standards-for-the-management-of-used-oil': '40 CFR Part 279',
  
  // Financial Aid / Higher Education
  'higher-education-act-audits': '20 U.S.C. § 1094(c); 34 CFR § 668.23',
  'higher-education-act-recognition-of-accrediting-ag': '20 U.S.C. § 1099b; 34 CFR Part 602',
  'higher-education-act-record-retention': '34 CFR § 668.24',
  
  // Lobbying / Political
  'honest-leadership-and-open-government-act-of-2007': 'Pub. L. 110-81; 2 U.S.C. § 1601 et seq.',
  'house-and-senate-gift-ban-and-ethics-rules': 'House Rule XXV; Senate Rule XXXV',
  
  // Governance
  'internal-revenue-service-governance-information-re': '26 U.S.C. § 6033; IRS Form 990 Instructions',
  
  // Human Resources
  'health-insurance-portability-and-accountability-ac': '42 U.S.C. § 1320d et seq.; 45 CFR Parts 160, 164 (HIPAA)',
  'health-insurance-portability-and-accountability-act': '42 U.S.C. § 1320d et seq.; 45 CFR Parts 160, 164 (HIPAA)',
  'nsf-grant-term-and-condition-september-21-2018': 'NSF Proposal & Award Policies and Procedures Guide',
  
  // Immigration
  'student-exchange-and-visitor-information-system-se': '8 U.S.C. § 1372; 8 CFR Part 214',
  
  // Campus Safety
  'title-vi-of-the-civil-rights-act-of-1964-42-u-s-c-': '42 U.S.C. § 2000d et seq.; 34 CFR Part 100',
  
  // Recruitment/Termination
  'worker-adjustment-and-retraining-notification-act-': '29 U.S.C. § 2101 et seq. (WARN Act)'
};

async function enrichStatutes() {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE: Statute Citation Enrichment');
  console.log('═'.repeat(60));
  console.log('');
  
  // Get regulations without statutes
  const missing = await pool.query(`
    SELECT id, item_id, name, category 
    FROM regulations 
    WHERE statute IS NULL OR statute = ''
    ORDER BY name
  `);
  
  console.log(`Found ${missing.rows.length} regulations without statutes\n`);
  
  let updated = 0;
  let notFound = [];
  
  for (const reg of missing.rows) {
    const statute = statuteMappings[reg.item_id];
    
    if (statute) {
      await pool.query(`
        UPDATE regulations 
        SET statute = $1, 
            updated_by = 'statute_enrichment', 
            updated_at = NOW()
        WHERE id = $2
      `, [statute, reg.id]);
      
      console.log(`✅ ${reg.name.substring(0, 50)}...`);
      console.log(`   → ${statute}`);
      updated++;
    } else {
      notFound.push(reg);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Updated: ${updated}`);
  console.log(`Not mapped: ${notFound.length}`);
  
  if (notFound.length > 0) {
    console.log('\n⚠️  Regulations still needing statutes:');
    notFound.forEach(r => console.log(`   - ${r.item_id}: ${r.name.substring(0, 50)}`));
  }
  
  // Verify
  const verify = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN statute IS NOT NULL AND statute != '' THEN 1 END) as with_statute
    FROM regulations
  `);
  
  console.log(`\n📊 Final Status:`);
  console.log(`   Total regulations: ${verify.rows[0].total}`);
  console.log(`   With statutes: ${verify.rows[0].with_statute}`);
  console.log(`   Missing statutes: ${verify.rows[0].total - verify.rows[0].with_statute}`);
  
  await pool.end();
}

enrichStatutes().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
