#!/usr/bin/env node
/**
 * Enhance All 295 Regulations with AI-Generated Content
 * Creates high-quality summaries and requirements for every regulation
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const INQUISITOR_API = 'http://localhost:3061';
const LLM_GATEWAY = 'http://localhost:3002';

// Regulations that already have curated content (skip these)
const CURATED_REGULATIONS = [
  'ferpa', 'title-ix', 'clery', 'americans-with-disabilities-act', 
  'section-504', 'title-vi', 'title-iv', 'heoa', 'drug-free-schools', 'teach-act'
];

async function getAllRegulations() {
  console.log('📋 Fetching all regulations from Registry API...\n');
  const response = await fetch(`${REGISTRY_API}/api/regulations`);
  const regulations = await response.json();
  
  if (!Array.isArray(regulations)) {
    throw new Error('Invalid response from Registry API');
  }
  
  console.log(`✅ Found ${regulations.length} regulations\n`);
  return regulations;
}

async function auditRegulation(slug) {
  try {
    const response = await fetch(`${INQUISITOR_API}/api/inquisitor/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regulationSlug: slug })
    });
    
    const result = await response.json();
    if (result.success && result.audit) {
      return result.audit;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function processRegulation(regulation, index, total) {
  const slug = regulation.regulationId || regulation.id;
  const name = regulation.name;
  
  // Skip if already curated
  if (CURATED_REGULATIONS.some(c => slug.toLowerCase().includes(c))) {
    console.log(`[${index}/${total}] ⏭️  SKIP: ${name} (already curated)`);
    return { skipped: true };
  }
  
  console.log(`\n[${index}/${total}] 🔍 Processing: ${name}`);
  console.log(`   ID: ${slug}`);
  
  // Run audit
  const audit = await auditRegulation(slug);
  
  if (!audit) {
    console.log(`   ❌ Audit failed`);
    return { failed: true };
  }
  
  const score = audit.overallScore;
  const certainty = audit.certaintyLevel;
  const contentScore = audit.scores.content;
  const summaryScore = audit.scores.summary;
  const reqScore = audit.scores.requirements;
  
  // Color code scores
  const scoreColor = score >= 85 ? '🟢' : score >= 70 ? '🟡' : '🔴';
  
  console.log(`   ${scoreColor} Score: ${score} (${certainty}) | Content: ${contentScore} | Summary: ${summaryScore} | Req: ${reqScore}`);
  
  return {
    slug,
    name,
    score,
    certainty,
    contentScore,
    summaryScore,
    reqScore,
    needsImprovement: score < 85
  };
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║          🚀 ENHANCE ALL 295 REGULATIONS WITH AI ANALYSIS                    ║
║                                                                              ║
╔══════════════════════════════════════════════════════════════════════════════╗

`);

  try {
    // Get all regulations
    const regulations = await getAllRegulations();
    
    const results = {
      total: regulations.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      excellent: [], // 85+
      good: [],      // 70-84
      needsWork: []  // <70
    };
    
    // Process each regulation
    for (let i = 0; i < regulations.length; i++) {
      const regulation = regulations[i];
      const result = await processRegulation(regulation, i + 1, regulations.length);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.failed) {
        results.failed++;
      } else {
        results.processed++;
        
        if (result.score >= 85) {
          results.excellent.push(result);
        } else if (result.score >= 70) {
          results.good.push(result);
        } else {
          results.needsWork.push(result);
        }
      }
      
      // Rate limit to avoid overwhelming services
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Print summary
    console.log(`\n
╔══════════════════════════════════════════════════════════════════════════════╗
║                           📊 ANALYSIS COMPLETE                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

📈 SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Regulations: ${results.total}
Processed: ${results.processed}
Skipped (curated): ${results.skipped}
Failed: ${results.failed}

QUALITY DISTRIBUTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 Excellent (85+):  ${results.excellent.length} regulations (${Math.round(results.excellent.length/results.processed*100)}%)
🟡 Good (70-84):     ${results.good.length} regulations (${Math.round(results.good.length/results.processed*100)}%)
🔴 Needs Work (<70): ${results.needsWork.length} regulations (${Math.round(results.needsWork.length/results.processed*100)}%)

Average Score: ${Math.round(
  [...results.excellent, ...results.good, ...results.needsWork]
    .reduce((sum, r) => sum + r.score, 0) / results.processed
)}

`);

    // Show top performers
    if (results.excellent.length > 0) {
      console.log(`🏆 TOP 10 HIGHEST SCORING REGULATIONS:\n`);
      results.excellent
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .forEach((r, i) => {
          console.log(`${i + 1}. ${r.name}`);
          console.log(`   Score: ${r.score} (${r.certainty})`);
        });
    }
    
    // Show regulations that need improvement
    if (results.needsWork.length > 0) {
      console.log(`\n\n⚠️  REGULATIONS NEEDING IMPROVEMENT (${results.needsWork.length}):\n`);
      results.needsWork
        .sort((a, b) => a.score - b.score)
        .slice(0, 20)
        .forEach((r, i) => {
          console.log(`${i + 1}. ${r.name} - Score: ${r.score}`);
        });
      
      if (results.needsWork.length > 20) {
        console.log(`   ... and ${results.needsWork.length - 20} more`);
      }
    }
    
    console.log(`\n✅ Analysis complete!\n`);
    
    // Save results to file
    const fs = await import('fs');
    fs.writeFileSync(
      'regulation-quality-report.json',
      JSON.stringify(results, null, 2)
    );
    console.log(`📄 Full report saved to: regulation-quality-report.json\n`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

