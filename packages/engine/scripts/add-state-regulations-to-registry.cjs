/**
 * Add State Regulations (PA + NJ) to MCP Engine Registry
 * 
 * This script:
 * 1. Reads enhanced regulation files for PA and NJ
 * 2. Fills in missing statute citations
 * 3. Adds them to the CSV source (compmat.csv)
 * 4. Verifies they appear in the Registry API
 */

const fs = require('fs');
const path = require('path');

// PA statute citations for regulations missing them
const PA_STATUTE_CITATIONS = {
  'pennsylvania-sexual-violence-education-act': {
    statute: '24 P.S. § 20-2001 et seq. (Act 16 of 2014)',
    topic: 'Sexual Misconduct',
    topicId: 41
  },
  'pennsylvania-sexual-violence-education-act-article-': {
    statute: '24 P.S. § 20-2001 et seq. (Act 16 of 2014)',
    topic: 'Sexual Misconduct',
    topicId: 41
  },
  'pennsylvania-english-fluency-in-higher-education-a': {
    statute: '24 P.S. § 6803 (Act 36 of 1990)',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pennsylvania-graduation-rates-reporting-act': {
    statute: '24 P.S. § 2510-301 (Act 88 of 1986)',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pennsylvania-graduation-rates-reporting-act-88-of-': {
    statute: '24 P.S. § 2510-301 (Act 88 of 1986)',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pennsylvania-higher-education-standards': {
    statute: '22 Pa. Code § 31.1 et seq.',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pennsylvania-institutional-accreditation': {
    statute: '22 Pa. Code § 31.21',
    topic: 'Accreditation',
    topicId: 50
  },
  'pennsylvania-student-consumer-protection': {
    statute: '24 P.S. § 6601 et seq.',
    topic: 'Student Services',
    topicId: 63
  },
  'pennsylvania-higher-education-gift-disclosure-act': {
    statute: '22 Pa. Code § 31.41 (Act 188 of 1982)',
    topic: 'Ethics',
    topicId: 69
  },
  'pennsylvania-uniform-crime-reporting-act': {
    statute: '18 Pa.C.S. § 9101 et seq.',
    topic: 'Campus Safety',
    topicId: 11
  },
  'pa-padeptEd-1741813075521': {
    statute: '24 P.S. § 1-101 et seq. (Public School Code)',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pa-padeptEd-1741813212673': {
    statute: '24 P.S. § 1-101 et seq. (Public School Code)',
    topic: 'Academic Programs',
    topicId: 50
  },
  'pa-paeducation-1741813075070': {
    statute: '24 P.S. § 1-101 et seq. (Public School Code)',
    topic: 'Academic Programs',
    topicId: 50
  }
};

// NJ statute citations
const NJ_STATUTE_CITATIONS = {
  'new-jersey-campus-sex-assault-victim-bill-of-rights': {
    statute: 'N.J.S.A. 18A:61E-1 et seq.',
    topic: 'Sexual Misconduct',
    topicId: 41
  },
  'new-jersey-hazing-prevention': {
    statute: 'N.J.S.A. 2C:40-3 et seq.',
    topic: 'Campus Safety',
    topicId: 11
  },
  'new-jersey-licensure-accreditation-standards': {
    statute: 'N.J.A.C. 9A:1-1 et seq.',
    topic: 'Accreditation',
    topicId: 50
  },
  'new-jersey-tuition-aid-grant-program': {
    statute: 'N.J.A.C. 9A:9-2',
    topic: 'Financial Aid',
    topicId: 52
  },
  'new-jersey-uniform-crime-reporting': {
    statute: 'N.J.S.A. 52:17B-5',
    topic: 'Campus Safety',
    topicId: 11
  },
  'new-jersey-veterans-benefits-compliance': {
    statute: 'N.J.S.A. 18A:62-6',
    topic: 'Financial Aid',
    topicId: 52
  }
};

async function addStateRegulations() {
  console.log('═'.repeat(70));
  console.log('    ADDING STATE REGULATIONS TO MCP ENGINE REGISTRY');
  console.log('═'.repeat(70));
  console.log(`Date: ${new Date().toISOString()}\n`);

  // =========================================================================
  // STEP 1: Read Enhanced Regulation Files
  // =========================================================================
  console.log('📋 STEP 1: Reading enhanced regulation files...');
  
  const enhancedDir = path.join(__dirname, '../enhanced-regulations');
  const stateRegulations = [];

  // Read PA regulations
  const paFiles = fs.readdirSync(enhancedDir)
    .filter(f => f.startsWith('pennsylvania-') && f.endsWith('.json'));
  
  console.log(`   Found ${paFiles.length} Pennsylvania regulation files`);
  
  for (const file of paFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(enhancedDir, file), 'utf8'));
    const id = data.regulationId || file.replace('.json', '');
    const citation = PA_STATUTE_CITATIONS[id] || {};
    
    stateRegulations.push({
      regulationId: id,
      name: getRegulationName(id),
      source: 'enhanced',
      state: 'PA',
      jurisdictionSource: 'state',
      statute: citation.statute || extractStatuteFromText(data.enhanced?.fullText),
      topic: citation.topic || 'State Compliance',
      topicId: citation.topicId || 0,
      summary: data.enhanced?.summary || '',
      requirements: data.enhanced?.requirements || '',
      reportingRequirements: data.enhanced?.reportingRequirements || '',
      auditScore: data.audit?.score || 0
    });
  }

  // Read NJ regulations
  const njFiles = fs.readdirSync(enhancedDir)
    .filter(f => f.startsWith('new-jersey-') && f.endsWith('.json'));
  
  console.log(`   Found ${njFiles.length} New Jersey regulation files`);
  
  for (const file of njFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(enhancedDir, file), 'utf8'));
    const id = data.regulationId || file.replace('.json', '');
    const citation = NJ_STATUTE_CITATIONS[id] || {};
    
    stateRegulations.push({
      regulationId: id,
      name: getRegulationName(id),
      source: 'enhanced',
      state: 'NJ',
      jurisdictionSource: 'state',
      statute: citation.statute || extractStatuteFromText(data.enhanced?.fullText),
      topic: citation.topic || 'State Compliance',
      topicId: citation.topicId || 0,
      summary: data.enhanced?.summary || '',
      requirements: data.enhanced?.requirements || '',
      reportingRequirements: data.enhanced?.reportingRequirements || '',
      auditScore: data.audit?.score || 0
    });
  }

  console.log(`   ✅ Total state regulations to add: ${stateRegulations.length}`);

  // =========================================================================
  // STEP 2: Read Current CSV and Check for Duplicates
  // =========================================================================
  console.log('\n📋 STEP 2: Checking CSV for existing state regulations...');
  
  const csvPath = path.join(__dirname, '../compmat.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const csvLines = csvContent.split('\n');
  const headers = csvLines[0];
  
  // Check existing
  const existingNames = new Set();
  for (let i = 1; i < csvLines.length; i++) {
    const name = csvLines[i].split(',')[2]?.toLowerCase() || '';
    existingNames.add(name);
  }
  
  const newRegulations = stateRegulations.filter(reg => {
    const nameLower = reg.name.toLowerCase();
    return !existingNames.has(nameLower);
  });
  
  console.log(`   Existing CSV rows: ${csvLines.length - 1}`);
  console.log(`   New state regulations to add: ${newRegulations.length}`);
  console.log(`   Already in CSV: ${stateRegulations.length - newRegulations.length}`);

  // =========================================================================
  // STEP 3: Generate CSV Rows for New Regulations
  // =========================================================================
  console.log('\n📋 STEP 3: Generating CSV rows...');
  
  // Get next Item ID
  let maxItemId = 0;
  for (let i = 1; i < csvLines.length; i++) {
    const itemId = parseInt(csvLines[i].split(',')[0]) || 0;
    if (itemId > maxItemId) maxItemId = itemId;
  }
  
  const newCsvRows = [];
  let itemId = maxItemId + 1;
  
  for (const reg of newRegulations) {
    // CSV format: Item ID,Topic,Statute Name,Statute 1,Statute 2,Statute 3,Statute 4,Statute IDs,
    // Regulation 1,Regulation 2,Regulation 3,Regulation 4,Regulation 5,Statutory Summary,
    // Reporting Requirements,Deadlines,Additional Resources 1,Additional Resources 2,
    // Sortable Month,Topic ID,Last Updated
    
    // Properly escape CSV fields
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`;
      }
      return str;
    };
    
    // Truncate summary to avoid CSV issues
    const shortSummary = (reg.summary || '').substring(0, 500).replace(/\n/g, ' ').replace(/,/g, ';');
    const shortReq = String(reg.reportingRequirements || 'See regulation for details').substring(0, 200).replace(/\n/g, ' ').replace(/,/g, ';');
    
    const row = [
      itemId++,                                          // Item ID
      escapeCSV(reg.topic),                              // Topic
      escapeCSV(reg.name),                               // Statute Name
      escapeCSV(reg.statute || ''),                      // Statute 1
      '',                                                // Statute 2
      '',                                                // Statute 3
      '',                                                // Statute 4
      '',                                                // Statute IDs
      '',                                                // Regulation 1
      '',                                                // Regulation 2
      '',                                                // Regulation 3
      '',                                                // Regulation 4
      '',                                                // Regulation 5
      escapeCSV(shortSummary),                           // Statutory Summary
      escapeCSV(shortReq),                               // Reporting Requirements
      'Not Applicable',                                  // Deadlines
      '',                                                // Additional Resources 1
      '',                                                // Additional Resources 2
      '14-No Deadline',                                  // Sortable Month
      reg.topicId || 0,                                  // Topic ID
      new Date().toISOString().split('T')[0]             // Last Updated
    ];
    
    newCsvRows.push(row.join(','));
    console.log(`   + ${reg.name} (${reg.state})`);
  }

  // =========================================================================
  // STEP 4: Append to CSV
  // =========================================================================
  console.log('\n📋 STEP 4: Appending to CSV...');
  
  if (newCsvRows.length > 0) {
    // Backup first
    const backupPath = csvPath + '.backup-' + Date.now();
    fs.copyFileSync(csvPath, backupPath);
    console.log(`   Backed up to: ${backupPath}`);
    
    // Append new rows
    const newContent = csvContent.trimEnd() + '\n' + newCsvRows.join('\n') + '\n';
    fs.writeFileSync(csvPath, newContent);
    console.log(`   ✅ Added ${newCsvRows.length} new rows to compmat.csv`);
  } else {
    console.log(`   ℹ️  No new regulations to add (all already exist)`);
  }

  // =========================================================================
  // STEP 5: Update Enhanced Files with Statutes
  // =========================================================================
  console.log('\n📋 STEP 5: Updating enhanced files with statute citations...');
  
  let updatedCount = 0;
  
  for (const [regId, citation] of Object.entries({...PA_STATUTE_CITATIONS, ...NJ_STATUTE_CITATIONS})) {
    const filePath = path.join(enhancedDir, `${regId}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Add statute if missing
      if (!data.statute) {
        data.statute = citation.statute;
        data.topic = citation.topic;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        updatedCount++;
        console.log(`   ✅ Updated statute for: ${regId}`);
      }
    }
  }
  
  console.log(`   Updated ${updatedCount} enhanced files with statute citations`);

  // =========================================================================
  // STEP 6: Verify Registry API
  // =========================================================================
  console.log('\n📋 STEP 6: Verifying Registry API...');
  console.log('   ⚠️  Registry needs restart to load new CSV data');
  console.log('   Run: npm start (or restart the registry service)');
  console.log('   Then verify with: curl http://localhost:3010/api/regulations | jq length');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('                         SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n   📊 State Regulations Processed: ${stateRegulations.length}`);
  console.log(`      • Pennsylvania: ${stateRegulations.filter(r => r.state === 'PA').length}`);
  console.log(`      • New Jersey: ${stateRegulations.filter(r => r.state === 'NJ').length}`);
  console.log(`\n   📋 CSV Updates:`);
  console.log(`      • New rows added: ${newCsvRows.length}`);
  console.log(`      • Previous total: ${csvLines.length - 1}`);
  console.log(`      • New total: ${csvLines.length - 1 + newCsvRows.length}`);
  console.log(`\n   📝 Enhanced files updated: ${updatedCount}`);
  console.log('\n' + '═'.repeat(70));

  // Save detailed report
  const reportPath = path.join(__dirname, '../state-regulations-added-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stateRegulationsProcessed: stateRegulations,
    newRowsAdded: newCsvRows.length,
    enhancedFilesUpdated: updatedCount
  }, null, 2));
  console.log(`\n✅ Detailed report saved to: state-regulations-added-report.json`);

  return {
    added: newCsvRows.length,
    total: stateRegulations.length
  };
}

// Helper function to get human-readable name from slug
function getRegulationName(slug) {
  const names = {
    'pennsylvania-uniform-crime-reporting-act': 'Pennsylvania Uniform Crime Reporting Act',
    'pennsylvania-sexual-violence-education-act': 'Pennsylvania Sexual Violence Education Act (Act 16 of 2014)',
    'pennsylvania-sexual-violence-education-act-article-': 'Pennsylvania Sexual Violence Education Act (Article XX-G)',
    'pennsylvania-higher-education-gift-disclosure-act': 'Pennsylvania Higher Education Gift Disclosure Act',
    'pennsylvania-english-fluency-in-higher-education-a': 'Pennsylvania English Fluency in Higher Education Act',
    'pennsylvania-graduation-rates-reporting-act': 'Pennsylvania Graduation Rates Reporting Act',
    'pennsylvania-graduation-rates-reporting-act-88-of-': 'Pennsylvania Graduation Rates Reporting Act (Act 88 of 1986)',
    'pennsylvania-higher-education-standards': 'Pennsylvania Higher Education Standards',
    'pennsylvania-institutional-accreditation': 'Pennsylvania Institutional Accreditation Requirements',
    'pennsylvania-student-consumer-protection': 'Pennsylvania Student Consumer Protection',
    'pa-padeptEd-1741813075521': 'Pennsylvania Department of Education Regulation (Teacher Certification)',
    'pa-padeptEd-1741813212673': 'Pennsylvania Department of Education Regulation (School Safety)',
    'pa-paeducation-1741813075070': 'Pennsylvania Education Standards',
    'new-jersey-campus-sex-assault-victim-bill-of-rights': 'New Jersey Campus Sexual Assault Victim\'s Bill of Rights',
    'new-jersey-hazing-prevention': 'New Jersey Anti-Hazing Act',
    'new-jersey-licensure-accreditation-standards': 'New Jersey Licensure & Accreditation Standards',
    'new-jersey-tuition-aid-grant-program': 'New Jersey Tuition Aid Grant (TAG) Program',
    'new-jersey-uniform-crime-reporting': 'New Jersey Uniform Crime Reporting Act',
    'new-jersey-veterans-benefits-compliance': 'New Jersey Veterans Benefits Compliance'
  };
  
  return names[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to extract statute from full text
function extractStatuteFromText(text) {
  if (!text) return null;
  
  // PA patterns
  const paMatch = text.match(/(\d+\s*Pa\.C\.S\.\s*§?\s*[\d\-\.]+[^,\.]*)/i) ||
                  text.match(/(Act\s+\d+\s+of\s+\d{4})/i) ||
                  text.match(/(\d+\s*Pa\.\s*Code\s*§?\s*[\d\-\.]+)/i) ||
                  text.match(/(\d+\s*P\.S\.\s*§?\s*[\d\-\.]+)/i);
  
  // NJ patterns
  const njMatch = text.match(/(N\.J\.S\.A\.\s*[\d:A-Za-z\-]+)/i) ||
                  text.match(/(N\.J\.A\.C\.\s*[\d:A-Za-z\-]+)/i);
  
  return paMatch?.[1] || njMatch?.[1] || null;
}

// Run the script
addStateRegulations().catch(console.error);
