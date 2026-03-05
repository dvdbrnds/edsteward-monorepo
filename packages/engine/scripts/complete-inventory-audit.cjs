/**
 * MCP Engine - Complete Regulation Inventory Audit
 * 
 * Audits ALL regulations from ALL sources:
 * - Registry API (federal)
 * - Enhanced regulations folder (PA, NJ, etc.)
 * - Console pages
 * - CSV source
 */

const fs = require('fs');
const path = require('path');

async function runCompleteInventory() {
  console.log('═'.repeat(70));
  console.log('        MCP ENGINE COMPLETE REGULATION INVENTORY AUDIT');
  console.log('═'.repeat(70));
  console.log(`Audit Date: ${new Date().toISOString()}\n`);

  const inventory = {
    audit_date: new Date().toISOString(),
    sources: {},
    by_jurisdiction: {
      federal: [],
      state_pennsylvania: [],
      state_new_jersey: [],
      state_other: [],
      international: []
    },
    totals: {},
    missing_from_registry: [],
    pa_regulation_details: [],
    nj_regulation_details: []
  };

  // =========================================================================
  // SOURCE 1: Registry API
  // =========================================================================
  console.log('📋 SOURCE 1: Registry API');
  let registryRegs = [];
  try {
    const response = await fetch('http://localhost:3010/api/regulations');
    registryRegs = await response.json();
    inventory.sources.registry_api = registryRegs.length;
    console.log(`   ✅ Found ${registryRegs.length} regulations in Registry API`);
  } catch (error) {
    console.log(`   ❌ Registry API not available: ${error.message}`);
    inventory.sources.registry_api = 0;
  }

  // =========================================================================
  // SOURCE 2: Enhanced Regulations Folder
  // =========================================================================
  console.log('\n📋 SOURCE 2: Enhanced Regulations Folder');
  const enhancedDir = path.join(__dirname, '../enhanced-regulations');
  let enhancedRegs = [];
  
  if (fs.existsSync(enhancedDir)) {
    const files = fs.readdirSync(enhancedDir).filter(f => f.endsWith('.json'));
    enhancedRegs = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(enhancedDir, f), 'utf8'));
      return {
        filename: f,
        regulationId: data.regulationId || f.replace('.json', ''),
        ...data
      };
    });
    inventory.sources.enhanced_folder = enhancedRegs.length;
    console.log(`   ✅ Found ${enhancedRegs.length} enhanced regulations`);
  } else {
    inventory.sources.enhanced_folder = 0;
    console.log(`   ⚠️  Enhanced regulations folder not found`);
  }

  // =========================================================================
  // SOURCE 3: Console Pages
  // =========================================================================
  console.log('\n📋 SOURCE 3: Console Pages');
  const consoleDir = path.join(__dirname, '../src/client/public/regulations');
  let consolePages = [];
  
  if (fs.existsSync(consoleDir)) {
    consolePages = fs.readdirSync(consoleDir)
      .filter(f => f.endsWith('-console.html'))
      .map(f => f.replace('-console.html', ''));
    inventory.sources.console_pages = consolePages.length;
    console.log(`   ✅ Found ${consolePages.length} console pages`);
  } else {
    inventory.sources.console_pages = 0;
    console.log(`   ⚠️  Console pages folder not found`);
  }

  // =========================================================================
  // SOURCE 4: CSV Source (compmat.csv)
  // =========================================================================
  console.log('\n📋 SOURCE 4: CSV Source (compmat.csv)');
  const csvPath = path.join(__dirname, '../compmat.csv');
  let csvRegs = 0;
  
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    csvRegs = csvContent.split('\n').filter(line => line.trim()).length - 1; // -1 for header
    inventory.sources.csv_source = csvRegs;
    console.log(`   ✅ Found ${csvRegs} rows in CSV source`);
  } else {
    inventory.sources.csv_source = 0;
    console.log(`   ⚠️  CSV source not found`);
  }

  // =========================================================================
  // CATEGORIZE BY JURISDICTION
  // =========================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('📊 CATEGORIZING BY JURISDICTION');
  console.log('─'.repeat(70));

  // Build registry lookup set
  const registryIds = new Set(registryRegs.map(r => r.regulationId));

  // Categorize registry regulations
  for (const reg of registryRegs) {
    const name = (reg.name || '').toLowerCase();
    const id = (reg.regulationId || '').toLowerCase();
    
    if (name.includes('gdpr') || name.includes('european') || id.includes('gdpr')) {
      inventory.by_jurisdiction.international.push({
        regulationId: reg.regulationId,
        name: reg.name,
        source: 'registry',
        statute: reg.publicLaw || reg.statutes?.join('; ')
      });
    } else {
      inventory.by_jurisdiction.federal.push({
        regulationId: reg.regulationId,
        name: reg.name,
        source: 'registry',
        statute: reg.publicLaw || reg.statutes?.join('; ')
      });
    }
  }

  // Categorize enhanced regulations
  for (const reg of enhancedRegs) {
    const id = reg.regulationId.toLowerCase();
    const name = (reg.name || reg.regulationId).toLowerCase();
    
    const regEntry = {
      regulationId: reg.regulationId,
      name: reg.enhanced?.summary?.split('.')[0] || reg.regulationId,
      source: 'enhanced',
      inRegistry: registryIds.has(reg.regulationId),
      hasFullText: !!reg.enhanced?.fullText,
      hasRequirements: !!reg.enhanced?.requirements,
      auditScore: reg.audit?.score || 0
    };

    if (id.includes('pennsylvania') || id.includes('pa-') || name.includes('pennsylvania')) {
      inventory.by_jurisdiction.state_pennsylvania.push(regEntry);
      inventory.pa_regulation_details.push({
        ...regEntry,
        statute: extractPAStatute(reg),
        category: determinePACategory(reg),
        topic: determinePATopic(reg),
        summary: reg.enhanced?.summary || null,
        requirements: reg.enhanced?.requirements || null,
        completeness: calculateCompleteness(reg)
      });
    } else if (id.includes('new-jersey') || id.includes('nj-') || name.includes('new jersey')) {
      inventory.by_jurisdiction.state_new_jersey.push(regEntry);
      inventory.nj_regulation_details.push({
        ...regEntry,
        statute: extractNJStatute(reg),
        category: determineNJCategory(reg),
        topic: determineNJTopic(reg),
        summary: reg.enhanced?.summary || null,
        completeness: calculateCompleteness(reg)
      });
    } else if (!registryIds.has(reg.regulationId)) {
      // Not in registry and not state-specific - likely federal that was enhanced
      inventory.by_jurisdiction.federal.push(regEntry);
    }

    // Track if not in registry
    if (!registryIds.has(reg.regulationId)) {
      inventory.missing_from_registry.push({
        regulationId: reg.regulationId,
        source: 'enhanced_folder',
        hasConsole: consolePages.includes(reg.regulationId)
      });
    }
  }

  // Check console pages not in registry
  for (const pageId of consolePages) {
    if (!registryIds.has(pageId) && 
        !inventory.missing_from_registry.some(r => r.regulationId === pageId)) {
      
      const isPa = pageId.includes('pennsylvania') || pageId.startsWith('pa-');
      const isNj = pageId.includes('new-jersey') || pageId.startsWith('nj-');
      
      if (isPa) {
        if (!inventory.by_jurisdiction.state_pennsylvania.some(r => r.regulationId === pageId)) {
          inventory.by_jurisdiction.state_pennsylvania.push({
            regulationId: pageId,
            name: pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            source: 'console_only',
            inRegistry: false
          });
        }
      } else if (isNj) {
        if (!inventory.by_jurisdiction.state_new_jersey.some(r => r.regulationId === pageId)) {
          inventory.by_jurisdiction.state_new_jersey.push({
            regulationId: pageId,
            name: pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            source: 'console_only',
            inRegistry: false
          });
        }
      }
      
      inventory.missing_from_registry.push({
        regulationId: pageId,
        source: 'console_page',
        hasEnhanced: enhancedRegs.some(r => r.regulationId === pageId)
      });
    }
  }

  // =========================================================================
  // CALCULATE TOTALS
  // =========================================================================
  inventory.totals = {
    federal: inventory.by_jurisdiction.federal.length,
    state_pennsylvania: inventory.by_jurisdiction.state_pennsylvania.length,
    state_new_jersey: inventory.by_jurisdiction.state_new_jersey.length,
    state_other: inventory.by_jurisdiction.state_other.length,
    international: inventory.by_jurisdiction.international.length,
    total_unique: new Set([
      ...inventory.by_jurisdiction.federal.map(r => r.regulationId),
      ...inventory.by_jurisdiction.state_pennsylvania.map(r => r.regulationId),
      ...inventory.by_jurisdiction.state_new_jersey.map(r => r.regulationId),
      ...inventory.by_jurisdiction.state_other.map(r => r.regulationId),
      ...inventory.by_jurisdiction.international.map(r => r.regulationId)
    ]).size,
    in_registry: registryRegs.length,
    missing_from_registry: inventory.missing_from_registry.length
  };

  // =========================================================================
  // OUTPUT REPORT
  // =========================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('                    INVENTORY SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n📊 BY JURISDICTION:');
  console.log(`   🇺🇸 Federal:        ${inventory.totals.federal}`);
  console.log(`   🏛️  Pennsylvania:    ${inventory.totals.state_pennsylvania}`);
  console.log(`   🏛️  New Jersey:      ${inventory.totals.state_new_jersey}`);
  console.log(`   🏛️  Other States:    ${inventory.totals.state_other}`);
  console.log(`   🌍 International:   ${inventory.totals.international}`);
  console.log(`   ${'─'.repeat(30)}`);
  console.log(`   📈 TOTAL UNIQUE:    ${inventory.totals.total_unique}`);

  console.log('\n📊 REGISTRY STATUS:');
  console.log(`   ✅ In Registry API:      ${inventory.totals.in_registry}`);
  console.log(`   ❌ Missing from Registry: ${inventory.totals.missing_from_registry}`);

  // PA Details
  if (inventory.pa_regulation_details.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('🏛️  PENNSYLVANIA REGULATION DETAILS');
    console.log('─'.repeat(70));
    
    for (const reg of inventory.pa_regulation_details) {
      console.log(`\n   📋 ${reg.regulationId}`);
      console.log(`      Statute: ${reg.statute || '❌ MISSING'}`);
      console.log(`      Category: ${reg.category || '❌ MISSING'}`);
      console.log(`      Topic: ${reg.topic || '❌ MISSING'}`);
      console.log(`      Summary: ${reg.summary ? '✅' : '❌ MISSING'}`);
      console.log(`      Requirements: ${reg.requirements ? '✅' : '❌ MISSING'}`);
      console.log(`      In Registry: ${reg.inRegistry ? '✅' : '❌ NO'}`);
      console.log(`      Completeness: ${reg.completeness}%`);
    }
  }

  // NJ Details
  if (inventory.nj_regulation_details.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('🏛️  NEW JERSEY REGULATION DETAILS');
    console.log('─'.repeat(70));
    
    for (const reg of inventory.nj_regulation_details) {
      console.log(`\n   📋 ${reg.regulationId}`);
      console.log(`      Statute: ${reg.statute || '❌ MISSING'}`);
      console.log(`      Category: ${reg.category || '❌ MISSING'}`);
      console.log(`      In Registry: ${reg.inRegistry ? '✅' : '❌ NO'}`);
      console.log(`      Completeness: ${reg.completeness}%`);
    }
  }

  // Missing from Registry
  if (inventory.missing_from_registry.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('❌ MISSING FROM REGISTRY API');
    console.log('─'.repeat(70));
    
    const paRegs = inventory.missing_from_registry.filter(r => 
      r.regulationId.includes('pennsylvania') || r.regulationId.startsWith('pa-'));
    const njRegs = inventory.missing_from_registry.filter(r => 
      r.regulationId.includes('new-jersey') || r.regulationId.startsWith('nj-'));
    const otherRegs = inventory.missing_from_registry.filter(r => 
      !r.regulationId.includes('pennsylvania') && 
      !r.regulationId.startsWith('pa-') &&
      !r.regulationId.includes('new-jersey') &&
      !r.regulationId.startsWith('nj-'));

    if (paRegs.length > 0) {
      console.log(`\n   Pennsylvania (${paRegs.length}):`);
      paRegs.forEach(r => console.log(`      • ${r.regulationId}`));
    }
    if (njRegs.length > 0) {
      console.log(`\n   New Jersey (${njRegs.length}):`);
      njRegs.forEach(r => console.log(`      • ${r.regulationId}`));
    }
    if (otherRegs.length > 0) {
      console.log(`\n   Other (${otherRegs.length}):`);
      otherRegs.slice(0, 10).forEach(r => console.log(`      • ${r.regulationId}`));
      if (otherRegs.length > 10) console.log(`      ... and ${otherRegs.length - 10} more`);
    }
  }

  console.log('\n' + '═'.repeat(70));

  // Save report
  const reportPath = path.join(__dirname, '../complete-inventory-audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(inventory, null, 2));
  console.log(`\n✅ Full inventory saved to: complete-inventory-audit.json`);

  return inventory;
}

// Helper functions
function extractPAStatute(reg) {
  const text = reg.enhanced?.fullText || '';
  const match = text.match(/(\d+\s*Pa\.C\.S\.\s*§?\s*\d+[^,\.]*)/i) ||
                text.match(/(Act\s+\d+\s+of\s+\d{4})/i) ||
                text.match(/(\d+\s*Pa\.\s*Code\s*§?\s*[\d\-\.]+)/i);
  return match ? match[1] : null;
}

function extractNJStatute(reg) {
  const text = reg.enhanced?.fullText || '';
  const match = text.match(/(N\.J\.S\.A\.\s*[\d:]+[^,\.]*)/i) ||
                text.match(/(N\.J\.A\.C\.\s*[\d:]+[^,\.]*)/i);
  return match ? match[1] : null;
}

function determinePACategory(reg) {
  const id = reg.regulationId.toLowerCase();
  if (id.includes('crime') || id.includes('safety') || id.includes('violence')) return 'Campus Safety';
  if (id.includes('education') || id.includes('fluency') || id.includes('graduation')) return 'Academic Standards';
  if (id.includes('gift') || id.includes('disclosure')) return 'Ethics & Compliance';
  if (id.includes('accreditation')) return 'Accreditation';
  if (id.includes('consumer')) return 'Student Affairs';
  return 'State Compliance';
}

function determinePATopic(reg) {
  const category = determinePACategory(reg);
  const topicMap = {
    'Campus Safety': 'Safety & Security',
    'Academic Standards': 'Academic Affairs',
    'Ethics & Compliance': 'Institutional Governance',
    'Accreditation': 'Accreditation & Quality',
    'Student Affairs': 'Student Services'
  };
  return topicMap[category] || 'State Compliance';
}

function determineNJCategory(reg) {
  const id = reg.regulationId.toLowerCase();
  if (id.includes('crime') || id.includes('hazing') || id.includes('assault')) return 'Campus Safety';
  if (id.includes('tuition') || id.includes('aid')) return 'Financial Aid';
  if (id.includes('veteran')) return 'Veterans Services';
  if (id.includes('licensure') || id.includes('accreditation')) return 'Accreditation';
  return 'State Compliance';
}

function determineNJTopic(reg) {
  const category = determineNJCategory(reg);
  const topicMap = {
    'Campus Safety': 'Safety & Security',
    'Financial Aid': 'Student Financial Services',
    'Veterans Services': 'Veterans Services',
    'Accreditation': 'Accreditation & Quality'
  };
  return topicMap[category] || 'State Compliance';
}

function calculateCompleteness(reg) {
  let score = 0;
  if (reg.enhanced?.fullText) score += 25;
  if (reg.enhanced?.summary) score += 25;
  if (reg.enhanced?.requirements) score += 25;
  if (reg.audit?.score) score += 25;
  return score;
}

// Run the audit
runCompleteInventory().catch(console.error);
