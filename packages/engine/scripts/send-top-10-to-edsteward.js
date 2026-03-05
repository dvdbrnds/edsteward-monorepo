/**
 * Send Top 10 Regulations to EdSteward
 * Immediately sends all 10 demo regulations to EdSteward with complete data
 * 
 * Priority: FERPA and Drug-Free Schools first (critical gaps)
 */

import fetch from 'node-fetch';

const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:3000';
const LLM_GATEWAY_URL = 'http://localhost:3002';

// Priority order: FERPA and Drug-Free Schools first (critical)
const REGULATIONS_TO_SEND = [
  {
    slug: 'family-educational-rights-and-privacy-act-ferpa',
    name: 'Family Educational Rights and Privacy Act (FERPA)',
    edstewardId: 223,
    priority: 'CRITICAL'
  },
  {
    slug: 'title-ix-of-the-education-amendment-of-1972',
    name: 'Title IX of the Education Amendments of 1972',
    edstewardId: 7,
    priority: 'CRITICAL'
  },
  {
    slug: 'clery-act',
    name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
    edstewardId: 355,
    priority: 'HIGH'
  },
  {
    slug: 'americans-with-disabilities-act-of-1990',
    name: 'Americans with Disabilities Act of 1990 (ADA)',
    edstewardId: 2,
    priority: 'HIGH'
  },
  {
    slug: 'higher-education-act-title-iv-student-financial-a',
    name: 'Higher Education Act - Title IV (Student Financial Aid)',
    edstewardId: 78,
    priority: 'HIGH'
  },
  {
    slug: 'section-504-of-the-rehabilitation-act-of-1973',
    name: 'Section 504 of the Rehabilitation Act of 1973',
    edstewardId: 6,
    priority: 'HIGH'
  },
  {
    slug: 'title-vi-of-the-civil-rights-act-of-1964',
    name: 'Title VI of the Civil Rights Act of 1964',
    edstewardId: 8,
    priority: 'HIGH'
  },
  {
    slug: 'higher-education-opportunity-act-sections-152-and-153',
    name: 'Higher Education Opportunity Act (HEOA) - Sections 152 and 153',
    edstewardId: 87,
    priority: 'HIGH'
  },
  {
    slug: 'drug-free-schools-and-communities-act',
    name: 'Drug-Free Schools and Communities Act',
    edstewardId: 67,
    priority: 'HIGH'
  },
  {
    slug: 'technology-education-and-copyright-harmonization-a',
    name: 'Technology, Education and Copyright Harmonization Act (TEACH Act)',
    edstewardId: 55,
    priority: 'MEDIUM'
  }
];

async function fetchRegulationData(slug) {
  try {
    console.log(`   📥 Fetching from LLM Gateway...`);
    const response = await fetch(`${LLM_GATEWAY_URL}/api/llm/cfr/${slug}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('No data returned');
    }
    return data.data;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return null;
  }
}

async function sendToEdSteward(regulation, regulationData) {
  const payload = {
    regulationId: regulation.edstewardId,
    name: regulation.name,
    originalContent: '',
    updatedContent: regulationData.fullText || regulationData.content || regulationData.regulation_text || '',
    status: 'pending',
    
    // Structured fields
    summary: regulationData.summary || 'Regulation summary not available',
    requirements: regulationData.requirements || regulationData.keyRequirements || null,
    filingDeadlines: (regulationData.deadlines || regulationData.filingDeadlines) 
      ? JSON.stringify(regulationData.deadlines || regulationData.filingDeadlines) 
      : null,
    
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
      source: 'MCP_ENGINE',
      regulationSource: regulationData.source || regulationData.publicLaw || 'CFR',
      priority: regulation.priority,
      dataQualityScore: calculateQualityScore(regulationData),
      sentVia: 'send-top-10-to-edsteward.js'
    }
  };
  
  try {
    console.log(`   📤 Sending to EdSteward (ID ${regulation.edstewardId})...`);
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function calculateQualityScore(data) {
  let score = 0;
  const fullText = data.fullText || data.content || data.regulation_text || '';
  if (fullText.length > 1000) score += 40;
  else if (fullText.length > 500) score += 20;
  
  if (data.summary && data.summary.length > 100) score += 20;
  else if (data.summary && data.summary.length > 50) score += 10;
  
  if (data.deadlines && data.deadlines.length >= 2) score += 20;
  else if (data.deadlines && data.deadlines.length === 1) score += 10;
  
  if (data.requirements) score += 10;
  
  if (data.source || data.publicLaw) score += 10;
  
  return score;
}

async function sendRegulation(regulation) {
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`📋 ${regulation.priority}: ${regulation.name}`);
  console.log(`   EdSteward ID: ${regulation.edstewardId}`);
  console.log(`${'━'.repeat(80)}`);
  
  // Fetch data
  const regulationData = await fetchRegulationData(regulation.slug);
  if (!regulationData) {
    console.log(`   ❌ FAILED: Could not fetch regulation data\n`);
    return {
      regulation: regulation.name,
      success: false,
      reason: 'Failed to fetch data from LLM Gateway'
    };
  }
  
  // Quick data preview
  const fullText = regulationData.fullText || regulationData.content || regulationData.regulation_text || '';
  const summary = regulationData.summary || '';
  const deadlines = regulationData.deadlines || [];
  
  console.log(`   ✅ Data fetched: ${fullText.length} chars text, ${summary.length} chars summary, ${deadlines.length} deadlines`);
  
  // Send to EdSteward
  const result = await sendToEdSteward(regulation, regulationData);
  
  if (result.success) {
    console.log(`   ✅ SUCCESS: EdSteward accepted update!`);
    console.log(`   📝 Update ID: ${result.data.updateId || result.data.update?.id || 'N/A'}`);
    console.log(`   📊 Quality: ${calculateQualityScore(regulationData)}%`);
    return {
      regulation: regulation.name,
      success: true,
      updateId: result.data.updateId || result.data.update?.id,
      quality: calculateQualityScore(regulationData)
    };
  } else {
    console.log(`   ❌ FAILED: ${result.error}`);
    return {
      regulation: regulation.name,
      success: false,
      reason: result.error
    };
  }
}

async function sendAll() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    📤 SENDING TOP 10 REGULATIONS TO EDSTEWARD                             ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`🎯 Target: ${EDSTEWARD_URL}/api/regulation-updates`);
  console.log(`📊 Total to send: ${REGULATIONS_TO_SEND.length} regulations`);
  console.log(`⚡ Priority: CRITICAL regulations first (FERPA, Drug-Free Schools)\n`);
  
  const results = [];
  
  for (let i = 0; i < REGULATIONS_TO_SEND.length; i++) {
    const regulation = REGULATIONS_TO_SEND[i];
    console.log(`\n[${i + 1}/${REGULATIONS_TO_SEND.length}]`);
    
    const result = await sendRegulation(regulation);
    results.push(result);
    
    // Small delay between sends
    if (i < REGULATIONS_TO_SEND.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                            ║');
  console.log('║    📊 DELIVERY SUMMARY                                                     ║');
  console.log('║                                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total Sent: ${results.length}`);
  console.log(`✅ Successful: ${successful.length} (${Math.round(successful.length / results.length * 100)}%)`);
  console.log(`❌ Failed: ${failed.length} (${Math.round(failed.length / results.length * 100)}%)\n`);
  
  if (successful.length > 0) {
    console.log('✅ Successfully Delivered:');
    successful.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.regulation} (Quality: ${r.quality}%)`);
    });
    console.log();
  }
  
  if (failed.length > 0) {
    console.log('❌ Failed Deliveries:');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.regulation}`);
      console.log(`      Reason: ${r.reason}`);
    });
    console.log();
  }
  
  // Final status
  if (successful.length === results.length) {
    console.log('🎉 PERFECT! All regulations delivered successfully!');
    console.log('✅ EdSteward now has complete data for all 10 demo regulations');
    console.log('✅ Ready for Friday demo!\n');
  } else if (successful.length >= 8) {
    console.log('🟡 MOSTLY SUCCESSFUL: Most regulations delivered');
    console.log(`⚠️  ${failed.length} regulation(s) need attention\n`);
  } else {
    console.log('🔴 ISSUES DETECTED: Multiple failures');
    console.log('⚠️  Check EdSteward endpoint and retry failed regulations\n');
  }
}

// Run it!
sendAll().catch(console.error);

