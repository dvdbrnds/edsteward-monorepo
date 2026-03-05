/**
 * EdSteward Integration Test - Top 10 Demo Regulations
 * 
 * Tests that all 10 Friday demo regulations can be delivered to EdSteward
 * with complete data (summary, requirements, deadlines, full text)
 */

import fetch from 'node-fetch';

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const LLM_GATEWAY_URL = 'http://localhost:3002';

// Top 10 Demo Regulations with EdSteward ID Mapping
const TOP_10_REGULATIONS = [
  {
    slug: 'clery-act',
    name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
    edstewardId: 55
  },
  {
    slug: 'family-educational-rights-and-privacy-act-ferpa',
    name: 'Family Educational Rights and Privacy Act (FERPA)',
    edstewardId: 51
  },
  {
    slug: 'title-ix-of-the-education-amendment-of-1972',
    name: 'Title IX of the Education Amendments of 1972',
    edstewardId: 61
  },
  {
    slug: 'higher-education-act-title-iv-student-financial-a',
    name: 'Higher Education Act - Title IV (Student Financial Aid)',
    edstewardId: 26
  },
  {
    slug: 'violence-against-women-reauthorization-act',
    name: 'Violence Against Women Reauthorization Act (VAWA)',
    edstewardId: 55
  },
  {
    slug: 'americans-with-disabilities-act-of-1990',
    name: 'Americans with Disabilities Act of 1990 (ADA)',
    edstewardId: 2
  },
  {
    slug: 'section-504-of-the-rehabilitation-act-of-1973',
    name: 'Section 504 of the Rehabilitation Act of 1973',
    edstewardId: 2
  },
  {
    slug: 'title-vi-of-the-civil-rights-act-of-1964',
    name: 'Title VI of the Civil Rights Act of 1964',
    edstewardId: 62
  },
  {
    slug: 'technology-education-and-copyright-harmonization-a',
    name: 'Technology, Education and Copyright Harmonization Act (TEACH Act)',
    edstewardId: 25
  },
  {
    slug: 'drug-free-schools-and-communities-act',
    name: 'Drug-Free Schools and Communities Act',
    edstewardId: 60
  }
];

async function checkEdStewardHealth() {
  console.log('🏥 Checking EdSteward health...');
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('✅ EdSteward is running\n');
      return true;
    } else {
      console.log(`⚠️  EdSteward returned ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ EdSteward not reachable: ${error.message}`);
    console.log(`   Make sure EdSteward is running at ${EDSTEWARD_URL}\n`);
    return false;
  }
}

async function fetchRegulationData(slug) {
  try {
    const response = await fetch(`${LLM_GATEWAY_URL}/api/llm/cfr/${slug}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error(`   ❌ Failed to fetch ${slug}: ${error.message}`);
    return null;
  }
}

async function sendToEdSteward(regulation, regulationData) {
  const payload = {
    regulationId: regulation.edstewardId,
    name: regulation.name,
    originalContent: regulationData.fullText || regulationData.content || '',
    updatedContent: regulationData.fullText || regulationData.content || '',
    status: 'pending',
    
    // Structured fields
    summary: regulationData.summary || 'Summary not available',
    requirements: regulationData.requirements || null,
    filingDeadlines: regulationData.deadlines || null,
    
    // Legacy deadline fields
    deadline: regulationData.deadline || null,
    deadlineMonth: regulationData.deadlineMonth || null,
    deadlineLabel: regulationData.deadlineLabel || null,
    reportingRequirements: regulationData.reportingRequirements || null,
    effectiveDate: regulationData.effectiveDate || null,
    enactedDate: regulationData.enactedDate || null,
    
    metadata: {
      mcpEngineId: regulation.slug,
      timestamp: new Date().toISOString(),
      enhanced: true,
      structuredFieldsIncluded: !!(regulationData.summary && regulationData.deadlines),
      source: 'MCP_ENGINE_TEST',
      regulationSource: regulationData.source || regulationData.publicLaw || 'CFR'
    }
  };
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });
    
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testRegulation(regulation) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Testing: ${regulation.name}`);
  console.log(`   Slug: ${regulation.slug}`);
  console.log(`   EdSteward ID: ${regulation.edstewardId}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Step 1: Fetch from LLM Gateway
  console.log('📥 Step 1: Fetching regulation data from LLM Gateway...');
  const regulationData = await fetchRegulationData(regulation.slug);
  
  if (!regulationData) {
    console.log('❌ FAILED: Could not fetch regulation data\n');
    return {
      regulation: regulation.name,
      success: false,
      reason: 'Failed to fetch data from LLM Gateway'
    };
  }
  
  console.log('✅ Data fetched successfully');
  
  // Step 2: Validate data quality
  console.log('\n📊 Step 2: Validating data quality...');
  const fullTextLength = (regulationData.fullText || regulationData.content || '').length;
  const summaryLength = (regulationData.summary || '').length;
  const hasDeadlines = !!(regulationData.deadlines && regulationData.deadlines.length > 0);
  const hasRequirements = !!(regulationData.requirements);
  
  console.log(`   Full Text: ${fullTextLength} chars ${fullTextLength > 1000 ? '✅' : '⚠️'}`);
  console.log(`   Summary: ${summaryLength} chars ${summaryLength > 100 ? '✅' : '⚠️'}`);
  console.log(`   Deadlines: ${hasDeadlines ? '✅' : '❌'} (${regulationData.deadlines?.length || 0} found)`);
  console.log(`   Requirements: ${hasRequirements ? '✅' : '⚠️'}`);
  
  const dataQualityScore = [
    fullTextLength > 1000,
    summaryLength > 100,
    hasDeadlines,
    hasRequirements
  ].filter(Boolean).length * 25;
  
  console.log(`   Overall Score: ${dataQualityScore}%`);
  
  // Step 3: Send to EdSteward
  console.log('\n📤 Step 3: Sending to EdSteward...');
  const result = await sendToEdSteward(regulation, regulationData);
  
  if (result.success) {
    console.log('✅ EdSteward accepted update');
    console.log(`   Update ID: ${result.data.update?.id || 'N/A'}`);
    console.log(`   Status: ${result.data.update?.status || 'N/A'}`);
    return {
      regulation: regulation.name,
      success: true,
      dataQuality: dataQualityScore,
      updateId: result.data.update?.id
    };
  } else {
    console.log(`❌ EdSteward rejected update (HTTP ${result.status})`);
    console.log(`   Error: ${result.data?.error?.message || result.error || 'Unknown error'}`);
    return {
      regulation: regulation.name,
      success: false,
      reason: result.data?.error?.message || result.error || 'Unknown error',
      dataQuality: dataQualityScore
    };
  }
}

async function runFullTest() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    🧪 EDSTEWARD INTEGRATION TEST - TOP 10 DEMO REGULATIONS                ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 EdSteward URL: ${EDSTEWARD_URL}`);
  console.log(`📍 LLM Gateway URL: ${LLM_GATEWAY_URL}`);
  console.log(`📍 Total Regulations to Test: ${TOP_10_REGULATIONS.length}\n`);
  
  // Health check
  const isHealthy = await checkEdStewardHealth();
  if (!isHealthy) {
    console.log('⚠️  WARNING: EdSteward health check failed');
    console.log('   Tests will likely fail, but continuing anyway...\n');
  }
  
  // Test each regulation
  const results = [];
  for (let i = 0; i < TOP_10_REGULATIONS.length; i++) {
    const regulation = TOP_10_REGULATIONS[i];
    console.log(`\n[${i + 1}/${TOP_10_REGULATIONS.length}]`);
    const result = await testRegulation(regulation);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary Report
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    📊 TEST RESULTS SUMMARY                                                 ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDataQuality = Math.round(
    results.reduce((sum, r) => sum + (r.dataQuality || 0), 0) / results.length
  );
  
  console.log(`Total Regulations Tested: ${results.length}`);
  console.log(`✅ Successful: ${successful} (${Math.round(successful / results.length * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed / results.length * 100)}%)`);
  console.log(`📊 Average Data Quality: ${avgDataQuality}%\n`);
  
  // Detailed results
  console.log('Detailed Results:\n');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const quality = result.dataQuality ? `(${result.dataQuality}%)` : '';
    console.log(`${status} ${index + 1}. ${result.regulation} ${quality}`);
    if (!result.success && result.reason) {
      console.log(`   └─ Reason: ${result.reason}`);
    }
  });
  
  // Friday Demo Readiness
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    🎯 FRIDAY DEMO READINESS                                                ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  if (successful === TOP_10_REGULATIONS.length) {
    console.log('🎉 PERFECT! All 10 regulations delivered successfully!');
    console.log('✅ Integration is READY for Friday demo\n');
  } else if (successful >= 8) {
    console.log('🟡 MOSTLY READY: Most regulations delivered successfully');
    console.log(`⚠️  ${failed} regulation(s) need attention before Friday\n`);
  } else {
    console.log('🔴 NOT READY: Multiple regulations failed');
    console.log(`❌ ${failed} regulation(s) failed - needs immediate attention\n`);
  }
  
  // Recommendations
  console.log('📋 Recommendations:\n');
  if (!isHealthy) {
    console.log('1. ⚠️  Verify EdSteward is running at', EDSTEWARD_URL);
    console.log('2. ⚠️  Check that POST /api/regulation-updates endpoint exists');
  }
  if (failed > 0) {
    console.log('3. ⚠️  Review failed regulations and check EdSteward database');
    console.log('4. ⚠️  Ensure all EdSteward IDs exist (51, 55, 61, 26, 2, 62, 25, 60)');
  }
  if (avgDataQuality < 80) {
    console.log('5. ⚠️  Data quality below 80% - consider enhancing regulation data');
  }
  if (successful === TOP_10_REGULATIONS.length && avgDataQuality >= 90) {
    console.log('✅ No issues found - system is demo-ready!');
  }
  
  console.log('\n');
}

// Run the test
runFullTest().catch(console.error);

