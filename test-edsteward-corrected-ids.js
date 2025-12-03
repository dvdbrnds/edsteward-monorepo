/**
 * EdSteward Integration Test - With Corrected IDs
 * Tests all 10 demo regulations with VERIFIED CORRECT IDs from EdSteward team
 * 
 * Date: December 1, 2025
 * Status: READY TO TEST
 */

import fetch from 'node-fetch';
import { getEdStewardId } from './src/delivery-system/edsteward-regulation-id-map.js';

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const LLM_GATEWAY_URL = 'http://localhost:3002';

// Top 10 Demo Regulations with CORRECTED EdSteward IDs
const TOP_10_REGULATIONS = [
  {
    slug: 'family-educational-rights-and-privacy-act-ferpa',
    name: 'Family Educational Rights and Privacy Act (FERPA)',
    edstewardId: 223  // ✅ CORRECTED from 51
  },
  {
    slug: 'clery-act',
    name: 'Jeanne Clery Disclosure of Campus Security Policy',
    edstewardId: 355  // ✅ CORRECTED from 55
  },
  {
    slug: 'title-ix-of-the-education-amendment-of-1972',
    name: 'Title IX of the Education Amendments of 1972',
    edstewardId: 7    // ✅ CORRECTED from 61
  },
  {
    slug: 'higher-education-act-title-iv-student-financial-a',
    name: 'Higher Education Act - Title IV (Student Financial Aid)',
    edstewardId: 3    // ✅ CORRECTED from 26 (was 48 with wrong regulation)
  },
  {
    slug: 'violence-against-women-reauthorization-act',
    name: 'Violence Against Women Reauthorization Act (VAWA)',
    edstewardId: 355  // ✅ Shares ID with Clery (Campus SAVE Act)
  },
  {
    slug: 'americans-with-disabilities-act-of-1990',
    name: 'Americans with Disabilities Act of 1990 (ADA)',
    edstewardId: 2    // ✅ CORRECT (no change)
  },
  {
    slug: 'section-504-of-the-rehabilitation-act-of-1973',
    name: 'Section 504 of the Rehabilitation Act of 1973',
    edstewardId: 6    // ✅ CORRECTED (separate from ADA)
  },
  {
    slug: 'title-vi-of-the-civil-rights-act-of-1964',
    name: 'Title VI of the Civil Rights Act of 1964',
    edstewardId: 8    // ✅ CORRECTED from 62
  },
  {
    slug: 'technology-education-and-copyright-harmonization-a',
    name: 'Technology, Education and Copyright Harmonization Act (TEACH Act)',
    edstewardId: 55   // ✅ CORRECTED from 25
  },
  {
    slug: 'drug-free-schools-and-communities-act',
    name: 'Drug-Free Schools and Communities Act',
    edstewardId: 157  // ✅ CORRECTED from 60
  }
];

async function testHealthCheck() {
  console.log('🏥 Testing EdSteward health check...');
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates/bulk-import/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ EdSteward health check PASSED');
      console.log(`   Response: ${data}`);
      return true;
    } else {
      console.log(`⚠️  EdSteward returned ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ EdSteward health check FAILED: ${error.message}`);
    return false;
  }
}

async function verifyMappingFile() {
  console.log('\n📋 Verifying regulation ID mapping file...\n');
  
  let allCorrect = true;
  
  TOP_10_REGULATIONS.forEach(reg => {
    const mappedId = getEdStewardId(reg.slug);
    const expected = reg.edstewardId;
    const match = mappedId === expected;
    
    const status = match ? '✅' : '❌';
    console.log(`${status} ${reg.name}`);
    console.log(`   Slug: ${reg.slug}`);
    console.log(`   Expected ID: ${expected} | Mapped ID: ${mappedId} ${match ? '(MATCH)' : '(MISMATCH!)'}`);
    
    if (!match) {
      allCorrect = false;
      console.log(`   🔴 CRITICAL: ID mapping is incorrect!`);
    }
  });
  
  return allCorrect;
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
    originalContent: '',
    updatedContent: regulationData.fullText || regulationData.content || '',
    status: 'pending',
    
    summary: regulationData.summary || 'Summary not available',
    requirements: regulationData.requirements || null,
    filingDeadlines: regulationData.deadlines || null,
    
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
      source: 'MCP_ENGINE_CORRECTED_IDS',
      regulationSource: regulationData.source || regulationData.publicLaw || 'CFR',
      testRun: true,
      correctedIds: true
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
  console.log(`   EdSteward ID: ${regulation.edstewardId} ✅ CORRECTED`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Fetch data
  console.log('📥 Fetching regulation data from LLM Gateway...');
  const regulationData = await fetchRegulationData(regulation.slug);
  
  if (!regulationData) {
    console.log('❌ FAILED: Could not fetch regulation data\n');
    return { regulation: regulation.name, success: false, reason: 'Failed to fetch data' };
  }
  
  console.log('✅ Data fetched successfully');
  
  // Send to EdSteward
  console.log('\n📤 Sending to EdSteward with CORRECTED ID...');
  const result = await sendToEdSteward(regulation, regulationData);
  
  if (result.success) {
    console.log('✅ EdSteward ACCEPTED update!');
    console.log(`   Update ID: ${result.data.updateId || result.data.update?.id || 'N/A'}`);
    console.log(`   Regulation ID: ${result.data.regulationId || regulation.edstewardId}`);
    console.log(`   Status: ${result.data.status || result.data.update?.status || 'N/A'}`);
    return {
      regulation: regulation.name,
      success: true,
      updateId: result.data.updateId || result.data.update?.id
    };
  } else {
    console.log(`❌ EdSteward REJECTED update (HTTP ${result.status})`);
    console.log(`   Error: ${result.data?.error?.message || result.error || 'Unknown error'}`);
    return {
      regulation: regulation.name,
      success: false,
      reason: result.data?.error?.message || result.error || 'Unknown error'
    };
  }
}

async function runFullTest() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    🧪 EDSTEWARD INTEGRATION - CORRECTED IDS TEST                          ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 EdSteward URL: ${EDSTEWARD_URL}`);
  console.log(`📍 LLM Gateway URL: ${LLM_GATEWAY_URL}`);
  console.log(`📍 Total Regulations: ${TOP_10_REGULATIONS.length}\n`);
  
  // Step 1: Verify mapping file
  console.log('STEP 1: Verify ID Mapping File');
  console.log('='.repeat(80));
  const mappingCorrect = await verifyMappingFile();
  
  if (!mappingCorrect) {
    console.log('\n🔴 CRITICAL: ID mapping file has errors! Fix before continuing.\n');
    return;
  }
  
  console.log('\n✅ All ID mappings verified correct!\n');
  
  // Step 2: Health check
  console.log('\nSTEP 2: EdSteward Health Check');
  console.log('='.repeat(80));
  const isHealthy = await testHealthCheck();
  
  if (!isHealthy) {
    console.log('\n⚠️  WARNING: EdSteward health check failed');
    console.log('   Tests will likely fail, but continuing anyway...\n');
  } else {
    console.log();
  }
  
  // Step 3: Test all regulations
  console.log('\nSTEP 3: Test All 10 Regulations with Corrected IDs');
  console.log('='.repeat(80));
  
  const results = [];
  for (let i = 0; i < TOP_10_REGULATIONS.length; i++) {
    const regulation = TOP_10_REGULATIONS[i];
    console.log(`\n[${i + 1}/${TOP_10_REGULATIONS.length}]`);
    const result = await testRegulation(regulation);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    📊 TEST RESULTS WITH CORRECTED IDS                                     ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total: ${results.length} regulations`);
  console.log(`✅ Successful: ${successful} (${Math.round(successful / results.length * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed / results.length * 100)}%)\n`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${result.regulation}`);
    if (!result.success && result.reason) {
      console.log(`   └─ ${result.reason}`);
    }
  });
  
  // Friday Demo Readiness
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    🎯 FRIDAY DEMO READINESS                                                ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  if (successful === TOP_10_REGULATIONS.length) {
    console.log('🎉 PERFECT! All 10 regulations delivered successfully with corrected IDs!');
    console.log('✅ Integration is READY for Friday demo');
    console.log('✅ End-to-end delivery WORKING');
    console.log('✅ EdSteward accepting updates\n');
  } else if (successful >= 8) {
    console.log('🟡 MOSTLY READY: Most regulations delivered successfully');
    console.log(`⚠️  ${failed} regulation(s) need attention\n`);
  } else {
    console.log('🔴 NOT READY: Multiple regulations failed');
    console.log(`❌ ${failed} regulation(s) failed\n`);
  }
  
  console.log('📅 Timeline:');
  console.log('   ✅ Today (Monday): ID mapping corrected');
  console.log('   ✅ Today: Integration tested');
  console.log('   📅 Thursday: Joint test session with EdSteward');
  console.log('   🎉 Friday: Demo to counsel\n');
}

runFullTest().catch(console.error);

