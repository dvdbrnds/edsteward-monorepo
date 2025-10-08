#!/usr/bin/env node

/**
 * Restore Clery Act regulation from CSV export
 * This script extracts and imports the Clery Act regulation from regulations_export.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Database setup
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { regulations } = require('../shared/schema');

async function restoreCleryAct() {
  console.log('🔄 Starting Clery Act restoration...');
  
  try {
    // Read and parse CSV
    const csvPath = path.join(__dirname, '..', 'regulations_export.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📄 Parsed ${records.length} regulations from CSV`);
    
    // Find Clery Act regulation
    const cleryRecord = records.find(record => 
      record.name && record.name.toLowerCase().includes('clery')
    );
    
    if (!cleryRecord) {
      console.error('❌ Clery Act regulation not found in CSV export');
      process.exit(1);
    }
    
    console.log('✅ Found Clery Act regulation:', cleryRecord.name);
    
    // Setup database connection
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ DATABASE_URL environment variable not set');
      process.exit(1);
    }
    
    const sql = neon(connectionString);
    const db = drizzle(sql);
    
    // Parse deadlines if they exist
    let parsedDeadlines = [];
    if (cleryRecord.filing_deadlines) {
      try {
        parsedDeadlines = JSON.parse(cleryRecord.filing_deadlines);
      } catch (e) {
        console.warn('⚠️ Could not parse filing_deadlines, using empty array');
      }
    }
    
    // Parse actions if they exist
    let parsedActions = [];
    if (cleryRecord.actions) {
      try {
        parsedActions = JSON.parse(cleryRecord.actions);
      } catch (e) {
        console.warn('⚠️ Could not parse actions, using empty array');
      }
    }
    
    // Prepare regulation data
    const regulationData = {
      itemId: cleryRecord.item_id || 'REG1812',
      name: cleryRecord.name,
      topic: cleryRecord.topic || 'Campus Safety and Security',
      statute: cleryRecord.statute || '20 U.S.C. § 1092(f)',
      summary: cleryRecord.summary || '',
      requirements: cleryRecord.requirements || '',
      category: cleryRecord.category || 'Campus Safety',
      jurisdiction: cleryRecord.jurisdiction || 'federal',
      isApplicable: cleryRecord.is_applicable === 't' || cleryRecord.is_applicable === 'true',
      lastUpdated: new Date(cleryRecord.last_updated || Date.now()),
      filingDeadlines: parsedDeadlines,
      reportingFrequency: cleryRecord.reporting_frequency || '',
      agencyUrl: cleryRecord.agency_url || 'https://clerycenter.org',
      agencyName: cleryRecord.agency_name || 'Clery Center',
      agencyDepartment: cleryRecord.agency_department || 'Campus Safety',
      regulationUrl: cleryRecord.regulation_url || 'https://www.law.cornell.edu/uscode/text/20/1092',
      requirementsUrl: cleryRecord.requirements_url || 'https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46',
      submissionGuideUrl: cleryRecord.submission_guide_url || 'https://www.clerycenter.org/policy-resources',
      formsUrl: cleryRecord.forms_url || 'https://surveys.ope.ed.gov/campussafety',
      submissionGuidelines: cleryRecord.submission_guidelines || 'By October 1st of each year, institutions must publish and distribute their Annual Security Report to current students and employees. The report must include statistics of campus crime for the preceding 3 calendar years, plus details about efforts taken to improve campus safety.',
      versionNumber: parseInt(cleryRecord.version_number) || 1,
      isCurrent: cleryRecord.is_current === 't' || cleryRecord.is_current === 'true',
      changeSummary: cleryRecord.change_summary || 'Restored Clery Act regulation',
      actions: parsedActions
    };
    
    // Check if regulation already exists
    const existingReg = await db.select()
      .from(regulations)
      .where(eq(regulations.itemId, regulationData.itemId))
      .limit(1);
    
    if (existingReg.length > 0) {
      console.log('✅ Clery Act regulation already exists in database');
      console.log('   ID:', existingReg[0].id);
      console.log('   Name:', existingReg[0].name);
      return;
    }
    
    // Insert the regulation
    console.log('💾 Inserting Clery Act regulation into database...');
    const result = await db.insert(regulations).values(regulationData).returning();
    
    console.log('✅ Successfully restored Clery Act regulation!');
    console.log('   Database ID:', result[0].id);
    console.log('   Item ID:', result[0].itemId);
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
