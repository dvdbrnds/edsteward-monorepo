#!/usr/bin/env node

/**
 * TEST INQUISITOR ON DEMO 10 REGULATIONS
 * 
 * Tests the Inquisitor MCP Server by auditing all 10 demo regulations
 */

import fetch from 'node-fetch';

const INQUISITOR_URL = 'http://localhost:3060';

const DEMO_REGULATIONS = [
  { id: 223, slug: 'ferpa', name: 'FERPA' },
  { id: 7, slug: 'title-ix', name: 'Title IX' },
  { id: 2, slug: 'ada', name: 'ADA' },
  { id: 78, slug: 'title-iv', name: 'Title IV' },
  { id: 6, slug: 'section-504', name: 'Section 504' },
  { id: 8, slug: 'title-vi', name: 'Title VI' },
  { id: 87, slug: 'heoa', name: 'HEOA' },
  { id: 67, slug: 'drug-free-schools', name: 'Drug-Free Schools' },
  { id: 55, slug: 'teach-act', name: 'TEACH Act' },
  { id: 355, slug: 'clery-act', name: 'Clery Act' }
];

async function testInquisitor() {
  console.log('\n' + '━'.repeat(80));
  console.log('🔍 INQUISITOR TEST - DEMO 10 REGULATIONS');
  console.log('━'.repeat(80));
  console.log('');

  // Check if Inquisitor is running
  try {
    const healthCheck = await fetch(`${INQUISITOR_URL}/health`);
    if (!healthCheck.ok) {
      throw new Error('Inquisitor server not responding');
    }
    console.log('✅ Inquisitor server is running\n');
  } catch (error) {
    console.error('❌ Inquisitor server is not running!');
    console.error('   Start it with: node src/inquisitor-mcp/inquisitor-server.js');
    process.exit(1);
  }

  // Run batch audit
  console.log('📋 Running batch audit on 10 regulations...\n');
  
  const batchRequest = {
    regulations: DEMO_REGULATIONS.map(reg => ({
      slug: reg.slug,
      id: reg.id
    }))
  };

  const response = await fetch(`${INQUISITOR_URL}/api/inquisitor/audit-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchRequest)
  });

  const result = await response.json();

  if (!result.success) {
    console.error('❌ Batch audit failed:', result.error);
    process.exit(1);
  }

  // Display aggregate stats
  console.log('━'.repeat(80));
  console.log('📊 AGGREGATE STATISTICS');
  console.log('━'.repeat(80));
  console.log('');
  console.log(`Total Audited:    ${result.stats.totalAudited}`);
  console.log(`Passed:           ${result.stats.passed} (${result.stats.passRate}%)`);
  console.log(`Failed:           ${result.stats.failed}`);
  console.log(`Average Score:    ${result.stats.averageScore}/100`);
  console.log(`Score Range:      ${result.stats.minScore} - ${result.stats.maxScore}`);
  console.log('');
  console.log('Certainty Levels:');
  console.log(`  A (Highest):    ${result.stats.certaintyLevels.A}`);
  console.log(`  B (High):       ${result.stats.certaintyLevels.B}`);
  console.log(`  C (Medium):     ${result.stats.certaintyLevels.C}`);
  console.log(`  D (Low):        ${result.stats.certaintyLevels.D}`);
  console.log('');

  // Display individual results
  console.log('━'.repeat(80));
  console.log('📋 INDIVIDUAL AUDIT RESULTS');
  console.log('━'.repeat(80));
  console.log('');

  for (const item of result.results) {
    if (item.error) {
      console.log(`❌ ${item.regulation}: ERROR - ${item.error}`);
      continue;
    }

    const audit = item.audit;
    const statusIcon = audit.passed ? '✅' : '❌';
    const certIcon = audit.certaintyLevel === 'A' ? '⭐' : 
                     audit.certaintyLevel === 'B' ? '🟢' :
                     audit.certaintyLevel === 'C' ? '🟡' : '🔴';

    console.log(`${statusIcon} ${item.regulation}`);
    console.log(`   Overall Score: ${audit.overallScore}/100 ${certIcon} Certainty ${audit.certaintyLevel}`);
    console.log(`   Component Scores:`);
    console.log(`     Content:      ${audit.scores.content}/100`);
    console.log(`     Summary:      ${audit.scores.summary}/100`);
    console.log(`     Requirements: ${audit.scores.requirements}/100`);
    console.log(`     Deadlines:    ${audit.scores.deadlines}/100`);
    
    if (audit.issues.length > 0) {
      console.log(`   Issues (${audit.issues.length}):`);
      audit.issues.forEach(issue => {
        const severityIcon = issue.severity === 'critical' ? '🚨' :
                            issue.severity === 'high' ? '⚠️' : '⚡';
        console.log(`     ${severityIcon} ${issue.message}`);
      });
    }

    if (audit.warnings.length > 0) {
      console.log(`   Warnings (${audit.warnings.length}):`);
      audit.warnings.slice(0, 3).forEach(warning => {
        console.log(`     ⚠️  ${warning.message}`);
      });
      if (audit.warnings.length > 3) {
        console.log(`     ... and ${audit.warnings.length - 3} more warnings`);
      }
    }

    if (audit.recommendations.length > 0 && audit.passed) {
      console.log(`   Recommendations:`);
      audit.recommendations.slice(0, 2).forEach(rec => {
        console.log(`     💡 ${rec.message}`);
      });
    }

    console.log('');
  }

  // Summary
  console.log('━'.repeat(80));
  console.log('🎯 AUDIT SUMMARY');
  console.log('━'.repeat(80));
  console.log('');

  if (result.stats.passRate === 100) {
    console.log('🎉 PERFECT! All 10 regulations passed audit!');
    console.log('✅ Demo is ready for Friday!');
  } else if (result.stats.passRate >= 90) {
    console.log('✅ EXCELLENT! 90%+ pass rate - demo ready with minor polish needed');
  } else if (result.stats.passRate >= 70) {
    console.log('⚠️  GOOD: 70%+ pass rate - some regulations need attention');
  } else {
    console.log('❌ NEEDS WORK: <70% pass rate - significant fixes required');
  }

  console.log('');
  console.log(`Average Quality Score: ${result.stats.averageScore}/100`);
  console.log('');

  // Identify regulations that need work
  const failed = result.results.filter(r => r.audit && !r.audit.passed);
  if (failed.length > 0) {
    console.log('━'.repeat(80));
    console.log('🔧 REGULATIONS NEEDING ATTENTION:');
    console.log('━'.repeat(80));
    console.log('');
    
    failed.forEach(item => {
      console.log(`❌ ${item.regulation} (Score: ${item.audit.overallScore}/100)`);
      console.log(`   Top Issues:`);
      item.audit.issues.slice(0, 3).forEach(issue => {
        console.log(`     • ${issue.message}`);
      });
      console.log('');
    });
  }

  console.log('━'.repeat(80));
  console.log('✅ Audit complete!');
  console.log('━'.repeat(80));
  console.log('');
}

// Run the test
testInquisitor().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});



