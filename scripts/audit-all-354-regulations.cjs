#!/usr/bin/env node

/**
 * COMPREHENSIVE AUDIT - ALL 354 REGULATIONS
 * 
 * Audits all 295 federal + 59 PA regulations to establish baseline
 * and identify priority regulations for enhancement
 * 
 * Output: comprehensive-audit-report.json
 */

const http = require('http');
const fs = require('fs');

const REGISTRY_API = 'http://localhost:3010';
const INQUISITOR_API = 'http://localhost:3061';

// Helper: HTTP GET
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

// Helper: HTTP POST
function httpPost(url, postData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(postData);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE AUDIT - ALL 354 REGULATIONS                     ║');
  console.log('║     295 Federal + 59 Pennsylvania State Regulations               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  const report = {
    timestamp: new Date().toISOString(),
    total: 0,
    federal: { count: 0, audited: 0, failed: 0, scores: [] },
    pennsylvania: { count: 0, audited: 0, failed: 0, scores: [] },
    tiers: {
      tier1: { target: 60, regulations: [] },  // 90+ target
      tier2: { target: 130, regulations: [] }, // 85+ target
      tier3: { target: 154, regulations: [] }  // 80+ target
    },
    recommendations: [],
    details: []
  };

  try {
    // Fetch all regulations
    console.log('📥 Fetching all regulations from Registry API...\n');
    const response = await httpGet(`${REGISTRY_API}/api/regulations`);
    
    if (!Array.isArray(response.data)) {
      console.error('❌ Failed to fetch regulations from Registry API');
      process.exit(1);
    }

    const regulations = response.data;
    report.total = regulations.length;
    
    console.log(`✅ Found ${regulations.length} total regulations\n`);
    
    // Categorize regulations
    const federalRegs = regulations.filter((r, idx) => idx < 295);
    const paRegs = regulations.filter((r, idx) => idx >= 295);
    
    report.federal.count = federalRegs.length;
    report.pennsylvania.count = paRegs.length;
    
    console.log(`   Federal: ${federalRegs.length}`);
    console.log(`   Pennsylvania: ${paRegs.length}\n`);
    
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('🔍 Starting comprehensive audit...\n');
    console.log('   (This will take approximately 30-45 minutes)\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Audit all regulations
    let processed = 0;
    const startTime = Date.now();

    for (const reg of regulations) {
      processed++;
      const isFederal = regulations.indexOf(reg) < 295;
      const category = isFederal ? 'federal' : 'pennsylvania';
      
      process.stdout.write(`[${processed}/${regulations.length}] Auditing ${reg.name || reg.regulationId}... `);
      
      try {
        const auditResponse = await httpPost(`${INQUISITOR_API}/api/inquisitor/audit`, {
          regulationSlug: reg.slug || reg.regulationId,
          regulationId: reg.id || reg.regulationId
        });

        if (auditResponse.data && auditResponse.data.success) {
          const audit = auditResponse.data.audit;
          const score = audit.overallScore || 0;
          
          report[category].audited++;
          report[category].scores.push(score);
          
          console.log(`Score: ${score} (${audit.certaintyLevel || 'D'})`);
          
          const detail = {
            id: reg.id || reg.regulationId,
            name: reg.name || reg.regulationId,
            slug: reg.slug || reg.regulationId,
            category: category,
            score: score,
            certainty: audit.certaintyLevel || 'D',
            contentScore: audit.scores?.content || 0,
            summaryScore: audit.scores?.summary || 0,
            requirementsScore: audit.scores?.requirements || 0,
            issues: audit.issues?.length || 0,
            warnings: audit.warnings?.length || 0
          };
          
          report.details.push(detail);
          
          // Assign to tier (preliminary - will be refined based on priority)
          if (score >= 90) {
            // Already excellent
          } else if (score >= 70) {
            report.tiers.tier2.regulations.push(detail);
          } else if (score >= 50) {
            report.tiers.tier1.regulations.push(detail); // Needs most work
          } else {
            report.tiers.tier1.regulations.push(detail); // Critical - needs most work
          }
          
        } else {
          console.log(`❌ FAILED: ${auditResponse.data?.error || 'Unknown error'}`);
          report[category].failed++;
        }
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        report[category].failed++;
      }
      
      // Rate limiting
      await sleep(100);
      
      // Progress update every 50
      if (processed % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = processed / elapsed;
        const remaining = (regulations.length - processed) / rate;
        console.log(`\n   Progress: ${((processed/regulations.length)*100).toFixed(1)}% | Elapsed: ${elapsed}m | Est. remaining: ${remaining.toFixed(1)}m\n`);
      }
    }

    // Calculate statistics
    const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════════════════\n');
    console.log('📊 AUDIT COMPLETE\n');
    console.log(`   Total time: ${totalElapsed} minutes`);
    console.log(`   Regulations audited: ${processed}`);
    console.log(`   Federal: ${report.federal.audited} audited, ${report.federal.failed} failed`);
    console.log(`   Pennsylvania: ${report.pennsylvania.audited} audited, ${report.pennsylvania.failed} failed\n`);
    
    // Calculate averages
    const federalAvg = report.federal.scores.length > 0 
      ? (report.federal.scores.reduce((a, b) => a + b, 0) / report.federal.scores.length).toFixed(1)
      : 0;
    const paAvg = report.pennsylvania.scores.length > 0
      ? (report.pennsylvania.scores.reduce((a, b) => a + b, 0) / report.pennsylvania.scores.length).toFixed(1)
      : 0;
    const overallAvg = report.details.length > 0
      ? (report.details.reduce((sum, d) => sum + d.score, 0) / report.details.length).toFixed(1)
      : 0;
    
    report.statistics = {
      federalAverage: parseFloat(federalAvg),
      pennsylvaniaAverage: parseFloat(paAvg),
      overallAverage: parseFloat(overallAvg),
      timeElapsed: parseFloat(totalElapsed)
    };
    
    console.log('📈 SCORE AVERAGES\n');
    console.log(`   Federal regulations: ${federalAvg}`);
    console.log(`   Pennsylvania regulations: ${paAvg}`);
    console.log(`   Overall average: ${overallAvg}\n`);
    
    // Quality distribution
    const excellent = report.details.filter(d => d.score >= 85).length;
    const good = report.details.filter(d => d.score >= 70 && d.score < 85).length;
    const fair = report.details.filter(d => d.score >= 50 && d.score < 70).length;
    const poor = report.details.filter(d => d.score < 50).length;
    
    console.log('📊 QUALITY DISTRIBUTION\n');
    console.log(`   Excellent (85+): ${excellent} (${((excellent/processed)*100).toFixed(1)}%)`);
    console.log(`   Good (70-84): ${good} (${((good/processed)*100).toFixed(1)}%)`);
    console.log(`   Fair (50-69): ${fair} (${((fair/processed)*100).toFixed(1)}%)`);
    console.log(`   Poor (<50): ${poor} (${((poor/processed)*100).toFixed(1)}%)\n`);
    
    report.distribution = { excellent, good, fair, poor };
    
    // Generate recommendations
    console.log('💡 RECOMMENDATIONS\n');
    
    if (poor > 0) {
      const rec = `${poor} regulations scored below 50 - CRITICAL priority for Tier 1 enhancement`;
      console.log(`   🔴 ${rec}`);
      report.recommendations.push({ priority: 'CRITICAL', message: rec });
    }
    
    if (fair > 0) {
      const rec = `${fair} regulations scored 50-69 - HIGH priority for Tier 1/2 enhancement`;
      console.log(`   🟡 ${rec}`);
      report.recommendations.push({ priority: 'HIGH', message: rec });
    }
    
    if (good > 0) {
      const rec = `${good} regulations scored 70-84 - MEDIUM priority for Tier 2/3 enhancement`;
      console.log(`   🟢 ${rec}`);
      report.recommendations.push({ priority: 'MEDIUM', message: rec });
    }
    
    if (excellent > 0) {
      const rec = `${excellent} regulations already production-ready (85+) - maintain quality`;
      console.log(`   ✅ ${rec}`);
      report.recommendations.push({ priority: 'MAINTAIN', message: rec });
    }
    
    console.log('\n');
    
    // Top 10 lowest scoring (need most help)
    const lowest = [...report.details]
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);
    
    console.log('🔴 TOP 10 LOWEST SCORING (Need Immediate Attention)\n');
    lowest.forEach((reg, i) => {
      console.log(`   ${i+1}. ${reg.name} - Score: ${reg.score} (${reg.category})`);
    });
    report.lowestScoring = lowest;
    
    console.log('\n');
    
    // Top 10 highest scoring (examples to learn from)
    const highest = [...report.details]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    console.log('✅ TOP 10 HIGHEST SCORING (Quality Examples)\n');
    highest.forEach((reg, i) => {
      console.log(`   ${i+1}. ${reg.name} - Score: ${reg.score} (${reg.category})`);
    });
    report.highestScoring = highest;
    
    // Save comprehensive report
    const reportPath = 'comprehensive-audit-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n═══════════════════════════════════════════════════════════════════\n');
    console.log(`✅ Full report saved to: ${reportPath}\n`);
    console.log('📋 NEXT STEPS:\n');
    console.log('   1. Review comprehensive-audit-report.json');
    console.log('   2. Prioritize regulations based on scores and business needs');
    console.log('   3. Run: node enhance-tier1-regulations.cjs');
    console.log('   4. Monitor progress with quality dashboard\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

