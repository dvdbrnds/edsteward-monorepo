/**
 * MCP Engine - EdSteward Alignment Audit
 * 
 * Audits all regulations for required EdSteward fields:
 * - statute (legal citation)
 * - category (classification)
 * - topic (subject area)
 */

const fs = require('fs');
const path = require('path');

// Category mapping based on topic names
const TOPIC_TO_CATEGORY = {
  'Academic Programs': 'Academic Standards',
  'Accounting': 'Financial Compliance',
  'Contracts & Procurement': 'Business Compliance',
  'Diversity/Affirmative Action': 'Civil Rights',
  'Health Care and Insurance': 'Health & Benefits',
  'Human Resources': 'Employment',
  'Privacy & Information Security': 'Information Technology',
  'Student Services': 'Student Affairs',
  'Research': 'Research Compliance',
  'Safety & Environmental': 'Environmental Health',
  'Tax Compliance': 'Financial Compliance',
  'Campus Safety': 'Campus Safety',
  'Financial Aid': 'Financial Aid',
  'Athletics': 'Athletics',
  'Disabilities': 'Accessibility'
};

// EdSteward topic suggestions based on category
const CATEGORY_TO_EDSTEWARD_TOPIC = {
  'Academic Standards': 'Academic Affairs',
  'Financial Compliance': 'Financial & Tax Compliance',
  'Business Compliance': 'Business & Legal',
  'Civil Rights': 'Civil Rights & Non-Discrimination',
  'Health & Benefits': 'Health & Benefits Administration',
  'Employment': 'Human Resources & Employment',
  'Information Technology': 'Information Technology & Privacy',
  'Student Affairs': 'Student Services',
  'Research Compliance': 'Research & Sponsored Programs',
  'Environmental Health': 'Environmental Health & Safety',
  'Campus Safety': 'Safety & Security',
  'Financial Aid': 'Student Financial Services',
  'Athletics': 'Athletics Compliance',
  'Accessibility': 'Accessibility & Disability Services'
};

// Name-based category detection
function detectCategoryFromName(name) {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('ferpa') || nameLower.includes('privacy')) return 'Student Privacy';
  if (nameLower.includes('clery') || nameLower.includes('security') || nameLower.includes('crime')) return 'Campus Safety';
  if (nameLower.includes('title ix') || nameLower.includes('sex discrimination')) return 'Civil Rights';
  if (nameLower.includes('title vi') || nameLower.includes('title vii')) return 'Civil Rights';
  if (nameLower.includes('ada') || nameLower.includes('disability') || nameLower.includes('504')) return 'Accessibility';
  if (nameLower.includes('financial aid') || nameLower.includes('title iv') || nameLower.includes('loan')) return 'Financial Aid';
  if (nameLower.includes('osha') || nameLower.includes('safety') || nameLower.includes('workplace')) return 'Employment';
  if (nameLower.includes('copyright') || nameLower.includes('dmca') || nameLower.includes('teach act')) return 'Information Technology';
  if (nameLower.includes('hipaa') || nameLower.includes('health')) return 'Health & Benefits';
  if (nameLower.includes('tax') || nameLower.includes('irs')) return 'Financial Compliance';
  if (nameLower.includes('research') || nameLower.includes('irb')) return 'Research Compliance';
  if (nameLower.includes('athletic') || nameLower.includes('sport')) return 'Athletics';
  if (nameLower.includes('environment') || nameLower.includes('epa') || nameLower.includes('waste')) return 'Environmental Health';
  if (nameLower.includes('employment') || nameLower.includes('labor') || nameLower.includes('wage')) return 'Employment';
  if (nameLower.includes('veteran') || nameLower.includes('military')) return 'Veterans Affairs';
  if (nameLower.includes('immigration')) return 'International Compliance';
  if (nameLower.includes('state') && (nameLower.includes('pennsylvania') || nameLower.includes('new jersey'))) return 'State Authorization';
  
  return 'General Compliance';
}

async function runAudit() {
  console.log('🔍 Starting EdSteward Alignment Audit...\n');
  
  let regulations = [];
  
  try {
    const response = await fetch('http://localhost:3010/api/regulations');
    regulations = await response.json();
    console.log(`✅ Fetched ${regulations.length} regulations from Registry API\n`);
  } catch (error) {
    console.error('❌ Failed to fetch from Registry API:', error.message);
    return;
  }
  
  // Audit results
  const results = {
    audit_date: new Date().toISOString(),
    total_regulations: regulations.length,
    complete: 0,
    field_analysis: {
      has_statute: 0,
      has_category: 0,
      has_edsteward_topic: 0
    },
    missing_statute: [],
    missing_category: [],
    missing_edsteward_topic: [],
    suggestions: [],
    ready_for_alignment: 0,
    needs_enrichment: 0,
    category_distribution: {},
    topic_distribution: {}
  };
  
  for (const reg of regulations) {
    const id = reg.regulationId;
    const name = reg.name || id;
    
    // === CHECK STATUTE ===
    // MCP Engine has: publicLaw, statutes[], regulations[]
    const hasPublicLaw = reg.publicLaw && reg.publicLaw.trim() !== '' && reg.publicLaw !== 'N/A';
    const hasStatutesArray = reg.statutes && reg.statutes.length > 0 && reg.statutes[0] !== '';
    const hasRegulationsArray = reg.regulations && reg.regulations.length > 0 && reg.regulations[0] !== '';
    
    const statuteCitation = hasPublicLaw ? reg.publicLaw : 
                           (hasStatutesArray ? reg.statutes.join('; ') : 
                           (hasRegulationsArray ? reg.regulations.join('; ') : null));
    
    const hasStatute = hasPublicLaw || hasStatutesArray || hasRegulationsArray;
    
    // === CHECK CATEGORY (MCP's "topic" field) ===
    const mcpTopic = reg.topic; // e.g., "Academic Programs", "Human Resources"
    const hasCategory = mcpTopic && mcpTopic.trim() !== '' && mcpTopic !== 'N/A';
    
    // Map MCP topic to EdSteward category
    const edstewardCategory = hasCategory ? (TOPIC_TO_CATEGORY[mcpTopic] || mcpTopic) : detectCategoryFromName(name);
    
    // === CHECK EDSTEWARD TOPIC (derived from category) ===
    const edstewardTopic = CATEGORY_TO_EDSTEWARD_TOPIC[edstewardCategory] || 'General Compliance';
    
    // Track distributions
    results.category_distribution[edstewardCategory] = (results.category_distribution[edstewardCategory] || 0) + 1;
    results.topic_distribution[edstewardTopic] = (results.topic_distribution[edstewardTopic] || 0) + 1;
    
    // Track field presence
    if (hasStatute) results.field_analysis.has_statute++;
    if (hasCategory) results.field_analysis.has_category++;
    // EdSteward topic is always derivable from category, so mark as present if category exists
    if (hasCategory) results.field_analysis.has_edsteward_topic++;
    
    // Build suggestion object
    const suggestion = {
      regulationId: id,
      name: name.substring(0, 80),
      current: {
        publicLaw: reg.publicLaw || null,
        statutes: reg.statutes || [],
        regulations: reg.regulations || [],
        mcpTopic: mcpTopic || null
      },
      edsteward_mapped: {
        statute: statuteCitation,
        category: edstewardCategory,
        topic: edstewardTopic
      },
      needs_fix: {}
    };
    
    let isComplete = true;
    
    if (!hasStatute) {
      results.missing_statute.push({
        regulationId: id,
        name: name.substring(0, 60),
        current_publicLaw: reg.publicLaw || null,
        current_statutes: reg.statutes || [],
        suggested: 'NEEDS_RESEARCH - No USC or CFR citation found'
      });
      isComplete = false;
      suggestion.needs_fix.statute = 'NEEDS_RESEARCH';
    }
    
    if (!hasCategory) {
      results.missing_category.push({
        regulationId: id,
        name: name.substring(0, 60),
        current_value: mcpTopic || null,
        suggested_category: edstewardCategory,
        suggested_topic: edstewardTopic
      });
      isComplete = false;
      suggestion.needs_fix.category = edstewardCategory;
    }
    
    if (isComplete) {
      results.complete++;
      results.ready_for_alignment++;
    } else {
      results.needs_enrichment++;
    }
    
    results.suggestions.push(suggestion);
  }
  
  // Generate report
  console.log('═'.repeat(70));
  console.log('         EDSTEWARD ALIGNMENT AUDIT REPORT');
  console.log('═'.repeat(70));
  console.log(`Audit Date: ${results.audit_date}`);
  console.log(`Total Regulations: ${results.total_regulations}`);
  console.log('─'.repeat(70));
  
  console.log('\n📊 FIELD PRESENCE ANALYSIS:');
  console.log(`   ✅ Has Statute (publicLaw/statutes/regulations): ${results.field_analysis.has_statute} (${((results.field_analysis.has_statute/results.total_regulations)*100).toFixed(1)}%)`);
  console.log(`   ✅ Has Category (MCP topic field): ${results.field_analysis.has_category} (${((results.field_analysis.has_category/results.total_regulations)*100).toFixed(1)}%)`);
  console.log(`   ✅ Has EdSteward Topic (derived): ${results.field_analysis.has_edsteward_topic} (${((results.field_analysis.has_edsteward_topic/results.total_regulations)*100).toFixed(1)}%)`);
  
  console.log('\n📈 ALIGNMENT STATUS:');
  console.log(`   ✅ Ready for Alignment: ${results.ready_for_alignment}`);
  console.log(`   ⚠️  Needs Enrichment: ${results.needs_enrichment}`);
  const readyPercent = ((results.ready_for_alignment / results.total_regulations) * 100).toFixed(1);
  console.log(`   📊 Alignment Readiness: ${readyPercent}%`);
  
  console.log('\n📋 CATEGORY DISTRIBUTION:');
  const sortedCategories = Object.entries(results.category_distribution)
    .sort((a, b) => b[1] - a[1]);
  sortedCategories.forEach(([cat, count]) => {
    const pct = ((count/results.total_regulations)*100).toFixed(1);
    console.log(`   • ${cat}: ${count} (${pct}%)`);
  });
  
  if (results.missing_statute.length > 0) {
    console.log(`\n❌ REGULATIONS MISSING STATUTE CITATION (${results.missing_statute.length} total):`);
    results.missing_statute.slice(0, 15).forEach(r => {
      console.log(`   • [${r.regulationId.substring(0,30)}] ${r.name}`);
    });
    if (results.missing_statute.length > 15) {
      console.log(`   ... and ${results.missing_statute.length - 15} more`);
    }
  }
  
  if (results.missing_category.length > 0) {
    console.log(`\n❌ REGULATIONS MISSING CATEGORY (${results.missing_category.length} total):`);
    results.missing_category.slice(0, 10).forEach(r => {
      console.log(`   • [${r.regulationId.substring(0,30)}] ${r.name}`);
      console.log(`     → Suggested: ${r.suggested_category} / ${r.suggested_topic}`);
    });
  }
  
  console.log('\n' + '═'.repeat(70));
  
  // Save reports
  const reportPath = path.join(__dirname, '../edsteward-alignment-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Full report saved to: edsteward-alignment-audit-report.json`);
  
  // Create enrichment file for regulations needing fixes
  const enrichmentNeeded = results.suggestions.filter(s => Object.keys(s.needs_fix).length > 0);
  const enrichmentPath = path.join(__dirname, '../edsteward-enrichment-needed.json');
  fs.writeFileSync(enrichmentPath, JSON.stringify({
    generated: new Date().toISOString(),
    total_needing_enrichment: enrichmentNeeded.length,
    regulations: enrichmentNeeded
  }, null, 2));
  console.log(`✅ Enrichment list saved to: edsteward-enrichment-needed.json`);
  
  // Create the final alignment-ready summary
  const alignmentReadyPath = path.join(__dirname, '../edsteward-alignment-ready.json');
  const alignmentReady = results.suggestions.filter(s => Object.keys(s.needs_fix).length === 0);
  fs.writeFileSync(alignmentReadyPath, JSON.stringify({
    generated: new Date().toISOString(),
    total_ready: alignmentReady.length,
    regulations: alignmentReady.map(r => ({
      regulationId: r.regulationId,
      name: r.name,
      statute: r.edsteward_mapped.statute,
      category: r.edsteward_mapped.category,
      topic: r.edsteward_mapped.topic
    }))
  }, null, 2));
  console.log(`✅ Alignment-ready list saved to: edsteward-alignment-ready.json`);
  
  return results;
}

// Run the audit
runAudit().catch(console.error);
