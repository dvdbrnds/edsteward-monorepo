#!/usr/bin/env node

/**
 * Add 59 PA Regulations to Comprehensive Audit Report
 * This adds Pennsylvania state regulations so they can be enhanced
 */

const fs = require('fs');
const path = require('path');

// All 59 Pennsylvania regulations from test file
const PA_REGULATIONS = [
  'pennsylvania-uniform-crime-reporting-act',
  'pennsylvania-sexual-violence-education-act-article-',
  'pennsylvania-higher-education-gift-disclosure-act',
  'pennsylvania-english-fluency-in-higher-education-a',
  'pennsylvania-graduation-rates-reporting-act-88-of-',
  'programs-majors',
  'state-board-of-higher-education',
  'academic-standards',
  'accreditation-requirements',
  'faculty-qualifications',
  'student-services',
  'financial-aid-administration',
  'institutional-research',
  'assessment-and-evaluation',
  'quality-assurance',
  'compliance-monitoring',
  'reporting-requirements',
  'record-keeping',
  'privacy-protection',
  'information-security',
  'data-management',
  'technology-standards',
  'infrastructure-requirements',
  'safety-and-security',
  'emergency-preparedness',
  'risk-management',
  'insurance-requirements',
  'liability-coverage',
  'property-protection',
  'family-educational-rights-and-privacy-act-ferpa-20',
  'student-right-to-know-act',
  'campus-security-act',
  'americans-with-disabilities-act-compliance',
  'section-504-compliance',
  'title-ix-compliance',
  'civil-rights-compliance',
  'equal-opportunity-employment',
  'affirmative-action',
  'diversity-and-inclusion',
  'non-discrimination-policies',
  'harassment-prevention',
  'workplace-safety',
  'environmental-health',
  'occupational-health',
  'public-health',
  'community-health',
  'global-health',
  'health-promotion',
  'pa-paeducation-1741813075070',
  'pa-padeptEd-1741813075521',
  'student-complaints-html',
  'pa-padeptEd-1741813212673'
];

async function addPARegulationsToAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('ADDING PA REGULATIONS TO AUDIT SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  
  const auditFile = 'comprehensive-audit-report.json';
  
  // Read current audit report
  console.log('📖 Reading current audit report...');
  const auditData = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  
  const currentCount = auditData.details.length;
  console.log(`   Current regulations: ${currentCount}`);
  console.log('');
  
  // Check which PA regs are already in audit
  const existingSlugs = new Set(auditData.details.map(d => d.slug));
  const newPARegs = PA_REGULATIONS.filter(slug => !existingSlugs.has(slug));
  
  console.log(`📊 PA Regulations Status:`);
  console.log(`   Total PA regs: ${PA_REGULATIONS.length}`);
  console.log(`   Already in audit: ${PA_REGULATIONS.length - newPARegs.length}`);
  console.log(`   Need to add: ${newPARegs.length}`);
  console.log('');
  
  if (newPARegs.length === 0) {
    console.log('✅ All PA regulations already in audit system!');
    return;
  }
  
  // Add new PA regulations to audit
  console.log('➕ Adding new PA regulations...');
  let added = 0;
  
  for (const slug of newPARegs) {
    // Create audit entry with low initial score so it will be enhanced
    const auditEntry = {
      slug: slug,
      score: 45, // Low score to trigger enhancement
      issues: [
        'Minimal content',
        'Missing comprehensive description',
        'Missing detailed requirements',
        'Missing reporting requirements'
      ],
      strengths: [
        'Regulation identified'
      ],
      jurisdiction: 'pennsylvania',
      needsEnhancement: true
    };
    
    auditData.details.push(auditEntry);
    added++;
    
    if (added % 10 === 0) {
      console.log(`   Added ${added}/${newPARegs.length}...`);
    }
  }
  
  console.log(`✅ Added ${added} PA regulations`);
  console.log('');
  
  // Backup original audit file
  const backupFile = `comprehensive-audit-report-backup-${Date.now()}.json`;
  console.log(`💾 Backing up original to ${backupFile}...`);
  fs.copyFileSync(auditFile, backupFile);
  
  // Write updated audit file
  console.log('💾 Writing updated audit file...');
  fs.writeFileSync(auditFile, JSON.stringify(auditData, null, 2));
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('✅ PA REGULATIONS ADDED TO AUDIT SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 Final Stats:`);
  console.log(`   Total regulations in audit: ${auditData.details.length}`);
  console.log(`   Federal regulations: ${currentCount}`);
  console.log(`   PA regulations: ${added}`);
  console.log(`   Grand total: ${auditData.details.length}`);
  console.log('');
  console.log('🚀 Ready to enhance PA regulations!');
  console.log('   Run: ./control-enhancement.sh restart');
}

addPARegulationsToAudit()
  .then(() => {
    console.log('✅ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });


