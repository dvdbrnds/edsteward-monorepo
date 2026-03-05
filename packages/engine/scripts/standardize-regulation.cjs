#!/usr/bin/env node
/**
 * Regulation Standardization Script
 * 
 * Automates Phase 1 of the Standardization Protocol:
 * 1. Creates console HTML from template
 * 2. Adds source validator signature
 * 3. Verifies/adds CFR mapping
 * 
 * Usage: node scripts/standardize-regulation.cjs <reg-key>
 * Example: node scripts/standardize-regulation.cjs REG-002
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TEMPLATE_CONSOLE = path.join(__dirname, '../src/client/public/regulations/jeanne-clery-disclosure-of-campus-security-policy--console.html');
const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');
const VALIDATOR_PATH = path.join(__dirname, '../src/services/source-data-validator.js');

// Known regulation metadata for common regulations
const REGULATION_METADATA = {
  'REG-002': {
    slug: 'title-ix',
    fullSlug: 'title-ix-of-the-education-amendment-of-1972',
    name: 'Title IX',
    fullName: 'Title IX of the Education Amendments of 1972',
    statute: '20 U.S.C. §§ 1681-1688',
    cfr: { title: '34', part: '106' },
    requiredKeywords: ['sex discrimination', 'sexual harassment', 'title ix coordinator', 'grievance procedure'],
    forbiddenKeywords: [],
    expectedCitations: ['20 U.S.C. § 1681', '34 CFR Part 106'],
    topics: ['gender equity', 'sexual harassment', 'athletics', 'education']
  },
  'REG-004': {
    slug: 'ferpa',
    fullSlug: 'family-educational-rights-and-privacy-act-ferpa',
    name: 'FERPA',
    fullName: 'Family Educational Rights and Privacy Act',
    statute: '20 U.S.C. § 1232g',
    cfr: { title: '34', part: '99' },
    requiredKeywords: ['educational records', 'student privacy', 'directory information', 'consent'],
    forbiddenKeywords: [],
    expectedCitations: ['20 U.S.C. § 1232g', '34 CFR Part 99'],
    topics: ['student records', 'privacy', 'parental rights']
  },
  'REG-015': {
    slug: 'ada',
    fullSlug: 'americans-with-disabilities-act-of-1990',
    name: 'ADA',
    fullName: 'Americans with Disabilities Act of 1990',
    statute: '42 U.S.C. § 12101 et seq.',
    cfr: { title: '28', part: '35' },
    requiredKeywords: ['disability', 'reasonable accommodation', 'accessibility', 'discrimination'],
    forbiddenKeywords: [],
    expectedCitations: ['42 U.S.C. § 12101', '28 CFR Part 35'],
    topics: ['disability rights', 'accommodation', 'accessibility']
  },
  'REG-020': {
    slug: 'hipaa',
    fullSlug: 'hipaa',
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    statute: 'Pub. L. 104-191',
    cfr: { title: '45', part: '164' },
    requiredKeywords: ['protected health information', 'privacy', 'security', 'covered entity'],
    forbiddenKeywords: [],
    expectedCitations: ['45 CFR Part 164', '45 CFR Part 160'],
    topics: ['health privacy', 'medical records', 'patient rights']
  }
};

async function main() {
  const regKey = process.argv[2];
  
  if (!regKey) {
    console.log('Usage: node scripts/standardize-regulation.cjs <reg-key>');
    console.log('Example: node scripts/standardize-regulation.cjs REG-002');
    console.log('\nAvailable regulations with metadata:');
    Object.entries(REGULATION_METADATA).forEach(([key, data]) => {
      console.log(`  ${key}: ${data.name} (${data.fullName})`);
    });
    process.exit(1);
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  REGULATION STANDARDIZATION: ${regKey}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  // Get regulation data from database
  const client = new Client({
    host: 'localhost',
    database: 'mcp_engine',
    port: 5432
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT r.*, ra.risk_score, ra.risk_level
      FROM regulations r
      LEFT JOIN risk_assessments ra ON r.id = ra.regulation_id
      WHERE r.reg_key = $1
    `, [regKey]);
    
    if (result.rows.length === 0) {
      console.error(`❌ Regulation ${regKey} not found in database`);
      process.exit(1);
    }
    
    const regulation = result.rows[0];
    const metadata = REGULATION_METADATA[regKey];
    
    console.log(`📋 Found: ${regulation.name}`);
    console.log(`   Risk: ${regulation.risk_score || 'N/A'} (${regulation.risk_level || 'N/A'})`);
    console.log(`   Statute: ${regulation.statute || 'N/A'}`);
    console.log(`   Current text length: ${regulation.regulation_text?.length || 0} chars`);
    console.log(`   Data locked: ${regulation.data_locked ? 'YES' : 'NO'}`);
    
    if (!metadata) {
      console.log(`\n⚠️  No predefined metadata for ${regKey}.`);
      console.log(`   Add metadata to REGULATION_METADATA in this script for full automation.`);
      console.log(`   For now, manually complete Phase 1 infrastructure setup.`);
    } else {
      console.log(`\n✅ Found predefined metadata for ${metadata.name}`);
    }
    
    // Phase 1.1: Create Console HTML
    console.log(`\n─── Phase 1.1: Console HTML ───`);
    const slug = metadata?.fullSlug || regulation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const consolePath = path.join(CONSOLE_DIR, `${slug}-console.html`);
    
    if (fs.existsSync(consolePath)) {
      console.log(`   ⚠️  Console already exists: ${path.basename(consolePath)}`);
    } else if (fs.existsSync(TEMPLATE_CONSOLE)) {
      // Read template and replace placeholders
      let template = fs.readFileSync(TEMPLATE_CONSOLE, 'utf8');
      
      // Replace Clery-specific values
      template = template.replace(/jeanne-clery-disclosure-of-campus-security-policy-/g, slug);
      template = template.replace(/Jeanne Clery Disclosure of Campus Security Policy/g, regulation.name);
      template = template.replace(/Clery Act/g, metadata?.name || regulation.name);
      template = template.replace(/REG-001/g, regKey);
      
      fs.writeFileSync(consolePath, template);
      console.log(`   ✅ Created: ${path.basename(consolePath)}`);
    } else {
      console.log(`   ❌ Template not found: ${TEMPLATE_CONSOLE}`);
    }
    
    // Phase 1.2: Source Validator Signature
    console.log(`\n─── Phase 1.2: Source Validator ───`);
    if (metadata) {
      const validatorContent = fs.readFileSync(VALIDATOR_PATH, 'utf8');
      
      if (validatorContent.includes(`'${slug}':`)) {
        console.log(`   ⚠️  Validator signature already exists for '${slug}'`);
      } else {
        console.log(`   📝 Add this signature to source-data-validator.js:`);
        console.log(`
  '${slug}': {
    name: '${metadata.name}',
    requiredKeywords: ${JSON.stringify(metadata.requiredKeywords)},
    forbiddenKeywords: ${JSON.stringify(metadata.forbiddenKeywords)},
    expectedCitations: ${JSON.stringify(metadata.expectedCitations)},
    minContentLength: 500,
    topics: ${JSON.stringify(metadata.topics)}
  },`);
      }
    } else {
      console.log(`   ⚠️  Add metadata to script for validator signature generation`);
    }
    
    // Phase 1.3: CFR Mapping
    console.log(`\n─── Phase 1.3: CFR Mapping ───`);
    if (metadata?.cfr) {
      console.log(`   📝 Verify/add this CFR mapping in comprehensive-workflow-engine.js:`);
      console.log(`
  '${slug}': { 
    title: '${metadata.cfr.title}', 
    part: '${metadata.cfr.part}',
    searchTerms: ${JSON.stringify(metadata.requiredKeywords.slice(0, 3))},
    name: '${metadata.name}'
  },`);
    } else {
      console.log(`   ⚠️  Add CFR info to metadata for mapping generation`);
    }
    
    // Summary
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`  PHASE 1 CHECKLIST for ${regKey}`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`  [ ] Console HTML created/updated`);
    console.log(`  [ ] Source validator signature added`);
    console.log(`  [ ] CFR mapping verified in workflow engine`);
    console.log(`\n  Next: Run Inquisitor audit to assess current quality`);
    console.log(`  curl http://localhost:3004/api/inquisitor/audit/${slug}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
