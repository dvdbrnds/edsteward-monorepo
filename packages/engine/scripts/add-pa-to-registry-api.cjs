#!/usr/bin/env node

/**
 * Add Pennsylvania Regulations to Registry API Database
 * WITH MULTI-STATE ARCHITECTURE SUPPORT
 * 
 * This establishes the pattern for ALL state regulations going forward
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_API_DB = 'src/server/registry-api/data/regulations.json';

// Pennsylvania Higher Education Regulations
// EdSteward IDs: 296-303 (8 regulations)
const PA_REGULATIONS = [
  {
    id: 296,
    edstewardId: 296,
    slug: 'pennsylvania-uniform-crime-reporting-act',
    name: 'Pennsylvania Uniform Crime Reporting Act',
    shortName: 'PA UCR Act',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Campus Safety & Security',
    citation: '18 Pa.C.S. § 9101 et seq.',
    agency: 'Pennsylvania State Police / PA Department of Education',
    effectiveDate: '1980-01-01',
    status: 'active',
    applicability: 'All higher education institutions in Pennsylvania',
    description: 'Requires Pennsylvania institutions to report crime statistics to state authorities',
    sourceUrl: 'https://www.legis.state.pa.us/cfdocs/legis/LI/consCheck.cfm?txtType=HTM&ttl=18',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania Consolidated Statutes'
    }
  },
  {
    id: 297,
    edstewardId: 297,
    slug: 'pennsylvania-sexual-violence-education-act-article-',
    name: 'Pennsylvania Sexual Violence Education Act',
    shortName: 'PA Sexual Violence Ed Act',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Student Safety & Wellness',
    citation: '24 P.S. § 5104',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '2018-08-28',
    status: 'active',
    applicability: 'All Pennsylvania postsecondary institutions',
    description: 'Requires comprehensive sexual violence education and prevention programs',
    sourceUrl: 'https://www.education.pa.gov/',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania School Code'
    }
  },
  {
    id: 298,
    edstewardId: 298,
    slug: 'pennsylvania-higher-education-gift-disclosure-act',
    name: 'Pennsylvania Higher Education Gift Disclosure Act',
    shortName: 'PA Gift Disclosure',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Financial Transparency',
    citation: '24 P.S. § 2510-A et seq.',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '2007-07-01',
    status: 'active',
    applicability: 'Pennsylvania state-funded institutions',
    description: 'Requires disclosure of significant gifts and donations',
    sourceUrl: 'https://www.education.pa.gov/',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania School Code'
    }
  },
  {
    id: 299,
    edstewardId: 299,
    slug: 'pennsylvania-english-fluency-in-higher-education-a',
    name: 'Pennsylvania English Fluency in Higher Education Act',
    shortName: 'PA English Fluency Act',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Academic Standards',
    citation: '24 P.S. § 2510.1 et seq.',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '1990-07-01',
    status: 'active',
    applicability: 'All Pennsylvania higher education institutions',
    description: 'Establishes English language proficiency requirements for instructors',
    sourceUrl: 'https://www.education.pa.gov/',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania School Code'
    }
  },
  {
    id: 300,
    edstewardId: 300,
    slug: 'pennsylvania-graduation-rates-reporting-act-88-of-',
    name: 'Pennsylvania Graduation Rates Reporting Act (Act 88 of 1986)',
    shortName: 'PA Graduation Reporting',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Institutional Reporting',
    citation: '24 P.S. § 2502.5',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '1986-07-02',
    status: 'active',
    applicability: 'All Pennsylvania postsecondary institutions',
    description: 'Requires annual reporting of graduation and retention rates',
    sourceUrl: 'https://www.education.pa.gov/',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania School Code'
    }
  },
  {
    id: 301,
    edstewardId: 301,
    slug: 'pa-paeducation-1741813075070',
    name: 'Pennsylvania Higher Education Standards and Guidelines',
    shortName: 'PA Higher Ed Standards',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Academic Standards',
    citation: '22 Pa. Code Ch. 31',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '2010-01-01',
    status: 'active',
    applicability: 'All Pennsylvania higher education institutions',
    description: 'Comprehensive standards for academic programs and institutional operations',
    sourceUrl: 'https://www.pacodeandbulletin.gov/Display/pacode?titleNumber=22',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania Code'
    }
  },
  {
    id: 302,
    edstewardId: 302,
    slug: 'pa-padeptEd-1741813075521',
    name: 'Pennsylvania Institutional Accreditation Requirements',
    shortName: 'PA Accreditation Req',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Accreditation',
    citation: '22 Pa. Code Ch. 36',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '2015-01-01',
    status: 'active',
    applicability: 'All degree-granting institutions in Pennsylvania',
    description: 'State requirements for institutional accreditation and authorization',
    sourceUrl: 'https://www.pacodeandbulletin.gov/Display/pacode?titleNumber=22',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania Code'
    }
  },
  {
    id: 303,
    edstewardId: 303,
    slug: 'pa-padeptEd-1741813212673',
    name: 'Pennsylvania Student Consumer Protection Standards',
    shortName: 'PA Student Protection',
    jurisdiction: 'state',
    state: 'PA',
    stateFullName: 'Pennsylvania',
    category: 'Student Rights',
    citation: '22 Pa. Code Ch. 40',
    agency: 'Pennsylvania Department of Education',
    effectiveDate: '2017-01-01',
    status: 'active',
    applicability: 'All Pennsylvania postsecondary institutions',
    description: 'Consumer protection standards for students including transparency requirements',
    sourceUrl: 'https://www.pacodeandbulletin.gov/Display/pacode?titleNumber=22',
    metadata: {
      addedDate: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      source: 'Pennsylvania Code'
    }
  }
];

async function addPARegulationsToRegistry() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('ADDING PENNSYLVANIA REGULATIONS TO REGISTRY API');
  console.log('Multi-State Architecture - First Implementation');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Read current regulations
  console.log('📖 Reading current Registry API database...');
  const currentRegs = JSON.parse(fs.readFileSync(REGISTRY_API_DB, 'utf8'));
  console.log(`   Current regulations: ${currentRegs.length}`);
  console.log('');

  // Backup
  const backupFile = `${REGISTRY_API_DB}.backup-${Date.now()}`;
  console.log(`💾 Creating backup: ${backupFile}`);
  fs.writeFileSync(backupFile, JSON.stringify(currentRegs, null, 2));
  console.log('');

  // Check for existing PA regs
  const existingPA = currentRegs.filter(r => r.state === 'PA' || r.slug?.startsWith('pennsylvania') || r.slug?.startsWith('pa-'));
  console.log(`📊 Existing PA regulations in database: ${existingPA.length}`);
  
  if (existingPA.length > 0) {
    console.log('   Existing PA regulations will be replaced');
    existingPA.forEach(r => console.log(`   - ${r.slug || r.name}`));
    console.log('');
  }

  // Remove existing PA regs
  const federalRegs = currentRegs.filter(r => 
    r.state !== 'PA' && 
    !r.slug?.startsWith('pennsylvania') && 
    !r.slug?.startsWith('pa-')
  );

  // Add PA regulations
  console.log('➕ Adding Pennsylvania regulations...');
  const updatedRegs = [...federalRegs, ...PA_REGULATIONS];

  // Sort by ID
  updatedRegs.sort((a, b) => a.id - b.id);

  // Write to database
  console.log('💾 Writing updated database...');
  fs.writeFileSync(REGISTRY_API_DB, JSON.stringify(updatedRegs, null, 2));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('✅ PENNSYLVANIA REGULATIONS ADDED');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 Database Statistics:`);
  console.log(`   Total regulations: ${updatedRegs.length}`);
  console.log(`   Federal regulations: ${federalRegs.length}`);
  console.log(`   Pennsylvania regulations: ${PA_REGULATIONS.length}`);
  console.log('');
  console.log(`🏛️  Pennsylvania Regulations (EdSteward IDs 296-303):`);
  PA_REGULATIONS.forEach(reg => {
    console.log(`   ${reg.edstewardId}. ${reg.name}`);
  });
  console.log('');
  console.log('📋 Multi-State Architecture:');
  console.log('   ✅ Jurisdiction field added (federal/state)');
  console.log('   ✅ State field added (PA, CA, TX, etc.)');
  console.log('   ✅ EdSteward ID range: 296-303 (PA)');
  console.log('   📝 Ready for CA, TX, NY, FL, etc.');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   1. Restart Registry API to load new regulations');
  console.log('   2. Enhance PA regulations with AI');
  console.log('   3. Transmit to EdSteward (IDs 296-303)');
  console.log('   4. Configure customer state assignments');
  console.log('');
}

addPARegulationsToRegistry()
  .then(() => {
    console.log('✅ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });


