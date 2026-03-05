#!/usr/bin/env node

/**
 * EMERGENCY: Create Registry API database from enhanced regulations
 * For presentation in 5 hours!
 */

const fs = require('fs');
const path = require('path');

const ENHANCED_DIR = 'enhanced-regulations';
const PA_REGS_FILE = 'src/server/registry-api/data/regulations.json';
const OUTPUT_FILE = 'regulations-for-registry-api.json';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('EMERGENCY REGISTRY DATABASE CREATOR');
console.log('Presentation in 5 hours - Loading ALL regulations!');
console.log('═══════════════════════════════════════════════════════════════════\n');

const regulations = [];

// Load all enhanced federal regulations
console.log(`📖 Loading enhanced federal regulations from ${ENHANCED_DIR}...`);
if (fs.existsSync(ENHANCED_DIR)) {
  const files = fs.readdirSync(ENHANCED_DIR).filter(f => f.endsWith('.json'));
  console.log(`   Found ${files.length} enhanced regulation files`);
  
  files.forEach((file, index) => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(ENHANCED_DIR, file), 'utf8'));
      regulations.push({
        'Item ID': String(content.edstewardId || (index + 1)),
        'Topic': content.category || 'Compliance',
        'Statute Name': content.name || content.regulationName,
        'Statute 1': content.primaryCitation || content.citation || '',
        'Statute IDs': content.slug,
        'Statutory Summary': content.description || '',
        'Reporting Requirements': content.requirements || '',
        'Deadlines': content.reportingTimeline || '',
        'Last Updated': content.lastEnhanced || content.timestamp || '2025-12-04',
        '_edstewardId': content.edstewardId || (index + 1),
        '_jurisdiction': 'federal',
        '_state': null,
        '_slug': content.slug,
        '_enhancementScore': content.qualityScore || 85
      });
    } catch (error) {
      console.warn(`   ⚠️  Failed to load ${file}:`, error.message);
    }
  });
  
  console.log(`   ✅ Loaded ${regulations.length} federal regulations\n`);
}

// Load PA regulations
console.log(`📖 Loading PA state regulations from ${PA_REGS_FILE}...`);
if (fs.existsSync(PA_REGS_FILE)) {
  const paData = JSON.parse(fs.readFileSync(PA_REGS_FILE, 'utf8'));
  const paRegs = paData.filter(r => r.jurisdiction === 'state' && r.state === 'PA');
  
  console.log(`   Found ${paRegs.length} PA regulations`);
  
  paRegs.forEach(reg => {
    regulations.push({
      'Item ID': String(reg.edstewardId || reg.id),
      'Topic': reg.category || 'State Regulation',
      'Statute Name': reg.name,
      'Statute 1': reg.citation || '',
      'Statute IDs': reg.slug,
      'Statutory Summary': reg.description || '',
      'Reporting Requirements': reg.reportingRequirements || '',
      'Deadlines': 'See regulation details',
      'Last Updated': reg.metadata?.lastReviewed || '2025-12-05',
      '_edstewardId': reg.edstewardId || reg.id,
      '_jurisdiction': 'state',
      '_state': 'PA',
      '_slug': reg.slug,
      '_enhancementScore': 0 // Not yet enhanced
    });
  });
  
  console.log(`   ✅ Loaded ${paRegs.length} PA regulations\n`);
}

// Sort by EdSteward ID
regulations.sort((a, b) => parseInt(a._edstewardId) - parseInt(b._edstewardId));

// Save
console.log(`💾 Saving to ${OUTPUT_FILE}...`);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(regulations, null, 2));

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('✅ EMERGENCY DATABASE CREATED!');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log(`📊 Statistics:`);
console.log(`   Total regulations: ${regulations.length}`);
console.log(`   Federal: ${regulations.filter(r => r._jurisdiction === 'federal').length}`);
console.log(`   State (PA): ${regulations.filter(r => r._state === 'PA').length}`);
console.log(`   EdSteward IDs: ${regulations[0]._edstewardId} - ${regulations[regulations.length-1]._edstewardId}`);
console.log('');
console.log('🚀 Next Steps:');
console.log('   1. Update Registry API to load from this file');
console.log('   2. Enhance PA regulations with AI');
console.log('   3. Transmit all to EdSteward');
console.log('   4. ROCK THE PRESENTATION! 🎤');
console.log('');

