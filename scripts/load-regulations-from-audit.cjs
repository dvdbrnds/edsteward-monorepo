#!/usr/bin/env node

/**
 * EMERGENCY: Convert comprehensive-audit-report.json to Registry API format
 * For presentation in 5 hours - bypass broken CSV parser
 */

const fs = require('fs');
const path = require('path');

const AUDIT_REPORT = 'comprehensive-audit-report.json';
const OUTPUT_FILE = 'regulations-for-registry.json';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('EMERGENCY REGULATION LOADER');
console.log('Converting audit report to Registry API format');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Load audit report
console.log('📖 Reading comprehensive-audit-report.json...');
const auditData = JSON.parse(fs.readFileSync(AUDIT_REPORT, 'utf8'));
console.log(`   Found ${auditData.regulations.length} regulations\n`);

// Convert to Registry API format
console.log('🔄 Converting to Registry API format...');
const regulations = auditData.regulations.map((reg, index) => {
  const itemId = reg.enhancedData?.edstewardId || (index + 1);
  
  return {
    'Item ID': String(itemId),
    'Topic': reg.category || 'Compliance',
    'Statute Name': reg.name,
    'Statute 1': reg.enhancedData?.primaryCitation || reg.citation || '',
    'Statute IDs': reg.slug,
    'Statutory Summary': reg.enhancedData?.description || reg.description || '',
    'Reporting Requirements': reg.enhancedData?.requirements || reg.requirements || '',
    'Deadlines': reg.enhancedData?.reportingTimeline || '',
    'Last Updated': reg.lastEnhanced || new Date().toISOString().split('T')[0],
    '_edstewardId': itemId,
    '_jurisdiction': reg.jurisdiction || 'federal',
    '_state': reg.state || null,
    '_slug': reg.slug,
    '_enhancementScore': reg.finalScore || reg.currentScore
  };
});

console.log(`   Converted ${regulations.length} regulations\n`);

// Save
console.log(`💾 Saving to ${OUTPUT_FILE}...`);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(regulations, null, 2));

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ COMPLETE!');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log(`📊 Statistics:`);
console.log(`   Total regulations: ${regulations.length}`);
console.log(`   Federal: ${regulations.filter(r => r._jurisdiction === 'federal').length}`);
console.log(`   State (PA): ${regulations.filter(r => r._state === 'PA').length}`);
console.log('');
console.log('📝 Next: Update Registry API to load from this file');
console.log('');

