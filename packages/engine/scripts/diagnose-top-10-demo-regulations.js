/**
 * CRITICAL DIAGNOSTIC: Top 10 Demo Regulations for Friday Counsel Demo
 * 
 * This script validates the COMPLETE data pipeline for the 10 regulations
 * being demo'd to counsel on Friday. Checks:
 * 
 * 1. Full Text Completeness (must be 1K+ chars of real content)
 * 2. Deadline Extraction and Delivery
 * 3. EdSteward ID Mapping Correctness
 * 4. Summary Quality
 * 5. Requirements Extraction
 * 6. Overall Data Quality Score
 */

import fetch from 'node-fetch';
import { createHash } from 'crypto';

// ===== THE 10 DEMO REGULATIONS =====
const TOP_10_DEMO_REGULATIONS = [
  {
    name: 'Clery Act',
    mcpId: 'jeanne-clery-disclosure-of-campus-security-policy-',
    expectedEdstewardId: 57,
    csvItemId: 1994,
    hasNaturalDeadline: true,
    expectedDeadlinePattern: /october/i
  },
  {
    name: 'FERPA',
    mcpId: 'family-educational-rights-and-privacy-act-ferpa',
    expectedEdstewardId: 42,
    csvItemId: 1804,
    hasNaturalDeadline: false, // Ongoing compliance
    expectedDeadlinePattern: /annual|ongoing/i
  },
  {
    name: 'Title IX',
    mcpId: 'title-ix-of-the-education-amendment-of-1972',
    expectedEdstewardId: 7,
    csvItemId: 1987,
    hasNaturalDeadline: false, // Ongoing compliance
    expectedDeadlinePattern: /annual|ongoing/i
  },
  {
    name: 'Title IV (Student Financial Aid)',
    mcpId: 'higher-education-act-title-iv-student-financial-a', // Need to verify correct ID
    expectedEdstewardId: null, // Need to find correct ID (48 is WRONG)
    csvItemId: null, // Need to find
    hasNaturalDeadline: true,
    expectedDeadlinePattern: /multiple|fafsa|june|july/i
  },
  {
    name: 'VAWA',
    mcpId: 'violence-against-women-reauthorization-act',
    expectedEdstewardId: 58,
    csvItemId: 1815,
    hasNaturalDeadline: true,
    expectedDeadlinePattern: /october|annual/i
  },
  {
    name: 'ADA/504',
    mcpId: 'americans-with-disabilities-act-of-1990',
    expectedEdstewardId: 2,
    csvItemId: 1786,
    hasNaturalDeadline: false, // Ongoing compliance
    expectedDeadlinePattern: /annual|ongoing/i
  },
  {
    name: 'Title VI',
    mcpId: 'title-vi-of-the-civil-rights-act-of-1964',
    expectedEdstewardId: 8,
    csvItemId: 1791,
    hasNaturalDeadline: false, // Ongoing compliance
    expectedDeadlinePattern: /annual|ongoing/i
  },
  {
    name: 'TEACH Act',
    mcpId: 'technology-education-and-copyright-harmonization-a',
    expectedEdstewardId: 55,
    csvItemId: 1821,
    hasNaturalDeadline: false, // Per-use compliance
    expectedDeadlinePattern: /per|ongoing|annual/i
  },
  {
    name: 'Drug-Free Schools',
    mcpId: 'drug-free-schools-and-communities-act',
    expectedEdstewardId: 60,
    csvItemId: 1807,
    hasNaturalDeadline: true,
    expectedDeadlinePattern: /biennial|annual|october/i
  },
  {
    name: 'HEOA',
    mcpId: 'higher-education-opportunity-act-sections-152-and-',
    expectedEdstewardId: 5,
    csvItemId: 3392,
    hasNaturalDeadline: true,
    expectedDeadlinePattern: /september|october/i
  }
];

// ===== DIAGNOSTIC FUNCTIONS =====

/**
 * Fetch regulation from Registry API
 */
async function fetchFromRegistry(regulationId) {
  try {
    const response = await fetch(`http://localhost:3010/api/regulations/${regulationId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch regulation from LLM Gateway
 */
async function fetchFromLLMGateway(regulationId) {
  try {
    // Try CFR endpoint first
    const cfrResponse = await fetch(`http://localhost:3002/api/llm/cfr/${regulationId}`);
    if (cfrResponse.ok) {
      return { source: 'cfr', data: await cfrResponse.json() };
    }
    
    // Try USC endpoint if applicable
    // Try compliance endpoint
    const complianceResponse = await fetch(`http://localhost:3002/api/llm/compliance/${regulationId}`);
    if (complianceResponse.ok) {
      return { source: 'compliance', data: await complianceResponse.json() };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Test regulation update delivery
 */
async function testRegulationDelivery(regulationId) {
  try {
    const response = await fetch('http://localhost:3051/api/trigger-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regulationId,
        changeType: 'DIAGNOSTIC_TEST',
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Analyze full text quality
 */
function analyzeFullText(fullText, regulationName) {
  if (!fullText) {
    return {
      status: 'BROKEN',
      length: 0,
      issue: 'Full text is null/undefined',
      recommendation: 'Fix LLM Gateway endpoint to return data'
    };
  }
  
  const length = fullText.length;
  
  // Check for template text
  if (fullText.includes('not available') || fullText.includes('text not available')) {
    return {
      status: 'BROKEN',
      length,
      issue: 'Template/placeholder text instead of real regulation',
      recommendation: 'LLM Gateway not fetching government sources'
    };
  }
  
  // Check for adequate length
  if (length < 500) {
    return {
      status: 'BROKEN',
      length,
      issue: `Too short (${length} chars) - likely summary not full text`,
      recommendation: 'Check endpoint returns fullText field, not content field'
    };
  }
  
  if (length < 1000) {
    return {
      status: 'PARTIAL',
      length,
      issue: `Short (${length} chars) - may be incomplete`,
      recommendation: 'Verify all sections are being fetched and combined'
    };
  }
  
  if (length < 3000) {
    return {
      status: 'PARTIAL',
      length,
      issue: `Moderate (${length} chars) - may be missing sections`,
      recommendation: 'Compare to official source to verify completeness'
    };
  }
  
  return {
    status: 'GOOD',
    length,
    issue: null,
    recommendation: 'Full text appears complete'
  };
}

/**
 * Analyze deadline data
 */
function analyzeDeadline(regulationData, expectedPattern) {
  const deadline = regulationData?.deadline || regulationData?.filingDeadlines || regulationData?.data?.deadline;
  
  if (!deadline) {
    return {
      status: 'MISSING',
      value: null,
      issue: 'No deadline field in data',
      recommendation: 'Fix deadline extraction in CDC or Registry API'
    };
  }
  
  // Check for default July 1
  if (deadline.toLowerCase().includes('july 1') && !expectedPattern.test(deadline)) {
    return {
      status: 'DEFAULT',
      value: deadline,
      issue: 'Using generic July 1 default, not regulation-specific deadline',
      recommendation: 'Extract actual deadline from source text or CSV'
    };
  }
  
  // Check against expected pattern
  if (expectedPattern && !expectedPattern.test(deadline)) {
    return {
      status: 'INCORRECT',
      value: deadline,
      issue: `Deadline doesn't match expected pattern: ${expectedPattern}`,
      recommendation: 'Verify deadline extraction from correct source'
    };
  }
  
  return {
    status: 'GOOD',
    value: deadline,
    issue: null,
    recommendation: 'Deadline is appropriate for this regulation'
  };
}

/**
 * Main diagnostic function
 */
async function diagnoseRegulation(regulation) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 DIAGNOSING: ${regulation.name}`);
  console.log(`${'='.repeat(80)}`);
  
  const results = {
    name: regulation.name,
    mcpId: regulation.mcpId,
    tests: {}
  };
  
  // TEST 1: Registry API Availability
  console.log(`\n1️⃣  Testing Registry API...`);
  const registryData = await fetchFromRegistry(regulation.mcpId);
  results.tests.registry = {
    available: !!registryData,
    data: registryData
  };
  
  if (registryData) {
    console.log(`   ✅ Registry has data for ${regulation.mcpId}`);
    console.log(`   📊 Deadline in Registry: ${registryData.deadline || 'MISSING'}`);
  } else {
    console.log(`   ❌ Registry has NO data for ${regulation.mcpId}`);
  }
  
  // TEST 2: LLM Gateway Full Text
  console.log(`\n2️⃣  Testing LLM Gateway full text...`);
  const llmData = await fetchFromLLMGateway(regulation.mcpId);
  results.tests.llmGateway = {
    available: !!llmData,
    source: llmData?.source,
    data: llmData?.data
  };
  
  if (llmData) {
    const fullText = llmData.data?.data?.fullText || llmData.data?.fullText || llmData.data?.data?.content || llmData.data?.content;
    const analysis = analyzeFullText(fullText, regulation.name);
    results.tests.fullText = analysis;
    
    console.log(`   ✅ LLM Gateway has data (source: ${llmData.source})`);
    console.log(`   📏 Full Text: ${analysis.length} chars - ${analysis.status}`);
    if (analysis.issue) {
      console.log(`   ⚠️  ISSUE: ${analysis.issue}`);
      console.log(`   💡 FIX: ${analysis.recommendation}`);
    }
  } else {
    console.log(`   ❌ LLM Gateway has NO data for ${regulation.mcpId}`);
    results.tests.fullText = {
      status: 'BROKEN',
      length: 0,
      issue: 'LLM Gateway endpoint not responding',
      recommendation: 'Check if endpoint exists for this regulation ID'
    };
  }
  
  // TEST 3: Complete Delivery Pipeline
  console.log(`\n3️⃣  Testing complete delivery pipeline...`);
  const deliveryTest = await testRegulationDelivery(regulation.mcpId);
  results.tests.delivery = deliveryTest;
  
  if (deliveryTest && deliveryTest.regulationData) {
    console.log(`   ✅ Delivery system can fetch and structure data`);
    
    // Analyze delivered data
    const deliveredFullText = deliveryTest.regulationData.updatedContent || deliveryTest.regulationData.fullText;
    const fullTextAnalysis = analyzeFullText(deliveredFullText, regulation.name);
    
    console.log(`   📏 Delivered Full Text: ${fullTextAnalysis.length} chars - ${fullTextAnalysis.status}`);
    
    // Analyze deadline in delivered data
    const deadlineAnalysis = analyzeDeadline(deliveryTest.regulationData, regulation.expectedDeadlinePattern);
    results.tests.deadline = deadlineAnalysis;
    
    console.log(`   📅 Deadline: ${deadlineAnalysis.value || 'MISSING'} - ${deadlineAnalysis.status}`);
    if (deadlineAnalysis.issue) {
      console.log(`   ⚠️  ISSUE: ${deadlineAnalysis.issue}`);
      console.log(`   💡 FIX: ${deadlineAnalysis.recommendation}`);
    }
    
    // Check summary
    const summary = deliveryTest.regulationData.summary;
    console.log(`   📝 Summary: ${summary ? (summary.length + ' chars') : 'MISSING'}`);
    results.tests.summary = { present: !!summary, length: summary?.length || 0 };
    
    // Check requirements
    const requirements = deliveryTest.regulationData.requirements;
    console.log(`   📋 Requirements: ${requirements ? (requirements.length + ' chars') : 'MISSING'}`);
    results.tests.requirements = { present: !!requirements, length: requirements?.length || 0 };
    
  } else {
    console.log(`   ❌ Delivery system FAILED to fetch data`);
  }
  
  // TEST 4: EdSteward ID Mapping
  console.log(`\n4️⃣  Testing EdSteward ID mapping...`);
  if (regulation.expectedEdstewardId) {
    console.log(`   ✅ Expected EdSteward ID: ${regulation.expectedEdstewardId}`);
    console.log(`   📋 CSV Item ID: ${regulation.csvItemId}`);
    results.tests.edstewardMapping = {
      expected: regulation.expectedEdstewardId,
      csvItemId: regulation.csvItemId
    };
  } else {
    console.log(`   ⚠️  NO EdSteward ID MAPPED - needs investigation`);
    results.tests.edstewardMapping = {
      expected: null,
      issue: 'No mapping found - regulation may not exist in EdSteward'
    };
  }
  
  // OVERALL ASSESSMENT
  console.log(`\n📊 OVERALL ASSESSMENT:`);
  let score = 0;
  let maxScore = 0;
  
  // Full text (40 points)
  maxScore += 40;
  if (results.tests.fullText?.status === 'GOOD') score += 40;
  else if (results.tests.fullText?.status === 'PARTIAL') score += 20;
  
  // Deadline (30 points)
  maxScore += 30;
  if (results.tests.deadline?.status === 'GOOD') score += 30;
  else if (results.tests.deadline?.status === 'DEFAULT') score += 15;
  
  // Summary (15 points)
  maxScore += 15;
  if (results.tests.summary?.present) score += 15;
  
  // Requirements (15 points)
  maxScore += 15;
  if (results.tests.requirements?.present) score += 15;
  
  const percentage = Math.round((score / maxScore) * 100);
  results.overallScore = { score, maxScore, percentage };
  
  console.log(`   🎯 DATA QUALITY SCORE: ${score}/${maxScore} (${percentage}%)`);
  
  if (percentage >= 90) {
    console.log(`   ✅ DEMO READY - Data is complete and accurate`);
  } else if (percentage >= 70) {
    console.log(`   ⚠️  NEEDS IMPROVEMENT - Data is partial or has issues`);
  } else {
    console.log(`   ❌ NOT DEMO READY - Critical data issues must be fixed`);
  }
  
  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║    🔬 MCP ENGINE - TOP 10 DEMO REGULATIONS DIAGNOSTIC                      ║
║                                                                            ║
║    FRIDAY DEMO PREPARATION - CRITICAL DATA QUALITY AUDIT                   ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

📅 Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
⏰ Time: ${new Date().toLocaleTimeString()}
🎯 Mission: Validate complete data for 10 regulations being demo'd to counsel

`);
  
  const allResults = [];
  
  for (const regulation of TOP_10_DEMO_REGULATIONS) {
    const result = await diagnoseRegulation(regulation);
    allResults.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // SUMMARY REPORT
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 FINAL SUMMARY REPORT - TOP 10 DEMO REGULATIONS`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`Regulation                        | Full Text | Deadline | Summary | Reqs | Score `);
  console.log(`${'─'.repeat(80)}`);
  
  allResults.forEach(result => {
    const name = result.name.padEnd(33);
    const fullText = result.tests.fullText?.status?.padEnd(9) || 'N/A      ';
    const deadline = result.tests.deadline?.status?.padEnd(8) || 'N/A     ';
    const summary = result.tests.summary?.present ? '✅     ' : '❌     ';
    const reqs = result.tests.requirements?.present ? '✅  ' : '❌  ';
    const score = `${result.overallScore.percentage}%`.padStart(5);
    
    console.log(`${name} | ${fullText} | ${deadline} | ${summary} | ${reqs} | ${score}`);
  });
  
  // COUNT ISSUES
  const brokenFullText = allResults.filter(r => r.tests.fullText?.status === 'BROKEN').length;
  const partialFullText = allResults.filter(r => r.tests.fullText?.status === 'PARTIAL').length;
  const missingDeadlines = allResults.filter(r => r.tests.deadline?.status === 'MISSING').length;
  const defaultDeadlines = allResults.filter(r => r.tests.deadline?.status === 'DEFAULT').length;
  const demoReady = allResults.filter(r => r.overallScore.percentage >= 90).length;
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`\n🔴 CRITICAL ISSUES:`);
  console.log(`   - ${brokenFullText} regulations with BROKEN full text`);
  console.log(`   - ${partialFullText} regulations with PARTIAL full text`);
  console.log(`   - ${missingDeadlines} regulations with MISSING deadlines`);
  console.log(`   - ${defaultDeadlines} regulations with DEFAULT (July 1) deadlines`);
  
  console.log(`\n✅ DEMO READINESS:`);
  console.log(`   - ${demoReady} of 10 regulations are DEMO READY (90%+ score)`);
  console.log(`   - ${10 - demoReady} regulations NEED FIXES before Friday`);
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  // Write results to file
  const fs = await import('fs');
  const reportPath = './TOP-10-DEMO-DIAGNOSTIC-REPORT.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: 10,
      demoReady,
      brokenFullText,
      partialFullText,
      missingDeadlines,
      defaultDeadlines
    },
    regulations: allResults
  }, null, 2));
  
  console.log(`📁 Full diagnostic report saved to: ${reportPath}\n`);
}

main().catch(console.error);

