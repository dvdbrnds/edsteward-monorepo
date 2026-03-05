#!/usr/bin/env node
/**
 * Embed Legal Citations Script
 * 
 * This script embeds USC/CFR legal citations directly into the regulation_text
 * field for all regulations, making them visible to the AI Quality Auditor.
 * 
 * Usage: node scripts/embed-legal-citations.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.USER,
  password: ''
});

// CFR mapping for common regulations (34 CFR for Education, 45 CFR for HHS, etc.)
const CFR_MAPPINGS = {
  'family-educational-rights-and-privacy-act-ferpa': '34 CFR Part 99',
  'jeanne-clery-disclosure-of-campus-security-policy-': '34 CFR Part 668, Subpart D',
  'title-ix-of-the-education-amendments-of-1972': '34 CFR Part 106',
  'americans-with-disabilities-act-ada': '28 CFR Part 35',
  'section-504-of-the-rehabilitation-act-of-1973': '34 CFR Part 104',
  'health-insurance-portability-and-accountability-act-hipaa': '45 CFR Parts 160, 164',
  'drug-free-schools-and-communities-act': '34 CFR Part 86',
  'gramm-leach-bliley-act-glba': '16 CFR Part 314',
  'occupational-safety-and-health-act-osha': '29 CFR Part 1910',
  'fair-labor-standards-act-flsa': '29 CFR Part 516',
  'family-and-medical-leave-act-fmla': '29 CFR Part 825',
  'age-discrimination-in-employment-act-adea': '29 CFR Part 1625',
  'title-vi-of-the-civil-rights-act-of-1964': '34 CFR Part 100',
  'title-vii-of-the-civil-rights-act-of-1964': '29 CFR Part 1604',
  'equal-pay-act-of-1963': '29 CFR Part 1620',
  'genetic-information-nondiscrimination-act-gina': '29 CFR Part 1635',
  'worker-adjustment-and-retraining-notification-act-warn': '20 CFR Part 639',
  'veterans-employment-and-training-service-vets': '41 CFR Part 61',
  'uniformed-services-employment-and-reemployment-rights-act-userra': '20 CFR Part 1002',
  'electronic-communications-privacy-act-ecpa': '18 U.S.C. §§ 2510-2522',
  'computer-fraud-and-abuse-act-cfaa': '18 U.S.C. § 1030',
  'childrens-online-privacy-protection-act-coppa': '16 CFR Part 312',
  'controlling-the-assault-of-non-solicited-pornography-and-marketing-act-can-spam': '16 CFR Part 316',
  'telephone-consumer-protection-act-tcpa': '47 CFR Part 64',
  'fair-credit-reporting-act-fcra': '12 CFR Part 1022',
  'export-administration-regulations-ear': '15 CFR Parts 730-774',
  'international-traffic-in-arms-regulations-itar': '22 CFR Parts 120-130',
  'higher-education-act-hea-title-iv': '34 CFR Parts 600-699',
  'solomon-amendment': '32 CFR Part 216',
  'federal-educational-rights-and-privacy-act': '34 CFR Part 99'
};

async function embedLegalCitations() {
  console.log('═'.repeat(60));
  console.log('     LEGAL CITATION EMBEDDING SCRIPT');
  console.log('═'.repeat(60));
  console.log();

  try {
    // Get all regulations with statutes
    const result = await pool.query(`
      SELECT id, item_id, name, statute, regulation_text
      FROM regulations
      WHERE statute IS NOT NULL AND statute != ''
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} regulations with statute citations\n`);

    let updated = 0;
    let skipped = 0;

    for (const reg of result.rows) {
      const { id, item_id, name, statute, regulation_text } = reg;
      
      // Check if citation is already embedded
      if (regulation_text && regulation_text.includes('LEGAL CITATION:')) {
        console.log(`⏭️  [${id}] ${name.substring(0, 50)}... - Already has citation`);
        skipped++;
        continue;
      }

      // Build the citation block
      let citationBlock = `\n═══════════════════════════════════════════════════════════\n`;
      citationBlock += `LEGAL CITATION: ${statute}`;
      
      // Add CFR citation if we have a mapping
      const cfrRef = CFR_MAPPINGS[item_id];
      if (cfrRef) {
        citationBlock += `; ${cfrRef}`;
      }
      
      citationBlock += `\n═══════════════════════════════════════════════════════════\n\n`;

      // Prepend citation to regulation text
      const newText = citationBlock + (regulation_text || `Compliance requirements for ${name}`);

      // Update the database
      await pool.query(`
        UPDATE regulations
        SET regulation_text = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [newText, id]);

      console.log(`✅ [${id}] ${name.substring(0, 50)}... - Added: ${statute}${cfrRef ? ` + ${cfrRef}` : ''}`);
      updated++;
    }

    console.log();
    console.log('─'.repeat(60));
    console.log(`SUMMARY: ${updated} updated, ${skipped} skipped (already had citations)`);
    console.log('─'.repeat(60));

    // Verify Clery Act specifically
    const cleryCheck = await pool.query(`
      SELECT LEFT(regulation_text, 300) as preview
      FROM regulations WHERE id = 67
    `);
    
    console.log('\n📋 CLERY ACT VERIFICATION:');
    console.log(cleryCheck.rows[0]?.preview || 'Not found');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

embedLegalCitations().then(() => {
  console.log('\n✅ Legal citation embedding complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
