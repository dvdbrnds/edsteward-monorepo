#!/usr/bin/env node

/**
 * MCP Engine Content Diagnosis - Federal + PA Regulations
 * 
 * Diagnoses which regulations return actual content vs. TEACH Act template fallback
 * Tests both federal and Pennsylvania regulations to identify content engine issues
 */

import https from 'https';
import http from 'http';

const LLM_GATEWAY_URL = 'http://localhost:3002';

// Sample of key federal regulations that Moravian University likely needs
const FEDERAL_REGULATIONS = [
  'ferpa',
  'title-ix-of-the-education-amendment-of-1972',
  'jeanne-clery-disclosure-of-campus-security-policy-',
  'americans-with-disabilities-act-of-1990',
  'family-and-medical-leave-act-fmla',
  'age-discrimination-act-of-1975',
  'rehabilitation-act-of-1973-section-504',
  'title-vii-of-the-civil-rights-act-of-1964',
  'campus-sex-crimes-prevention-act-1601-of-the-victi',
  'drug-free-workplace-act'
];

// Pennsylvania regulations we added
const PA_REGULATIONS = [
  'pennsylvania-uniform-crime-reporting-act',
  'pennsylvania-sexual-violence-education-act-article-',
  'pennsylvania-higher-education-gift-disclosure-act',
  'pennsylvania-english-fluency-in-higher-education-a',
  'pennsylvania-graduation-rates-reporting-act-88-of-'
];

/**
 * HTTP GET utility
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: response.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: response.statusCode,
            data: data,
            parseError: error.message
          });
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Analyze regulation content to determine if it's actual content or template fallback
 */
function analyzeContent(regulationSlug, responseData) {
  if (!responseData || !responseData.data) {
    return {
      regulation: regulationSlug,
      status: 'ERROR',
      issue: 'No response data',
      hasActualContent: false
    };
  }

  const data = responseData.data;
  
  // Check for TEACH Act template indicators
  const teachActIndicators = [
    'TEACH Act',
    'Technology, Education and Copyright Harmonization Act',
    'CFR Title 37',
    'section 110(2)',
    'digital distance education'
  ];
  
  // Check for generic compliance template indicators
  const genericTemplateIndicators = [
    'Compliance Guide for',
    'Topic-Specific Compliance Database',
    'Enhanced Compliance Service',
    'Dynamic Compliance Service'
  ];
  
  const content = (data.content || data.regulationText || data.fullText || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  const source = (data.metadata?.source || '').toLowerCase();
  
  // Determine content type
  let contentType = 'UNKNOWN';
  let hasActualContent = false;
  let issues = [];
  
  // Check for TEACH Act fallback
  const hasTeachActContent = teachActIndicators.some(indicator => 
    content.includes(indicator.toLowerCase()) || title.includes(indicator.toLowerCase())
  );
  
  // Check for generic template
  const hasGenericTemplate = genericTemplateIndicators.some(indicator =>
    title.includes(indicator.toLowerCase()) || source.includes(indicator.toLowerCase())
  );
  
  if (hasTeachActContent) {
    contentType = 'TEACH_ACT_FALLBACK';
    issues.push('Returning TEACH Act content instead of actual regulation');
  } else if (hasGenericTemplate) {
    contentType = 'GENERIC_TEMPLATE';
    issues.push('Returning generic compliance template');
  } else if (content.length > 500 && (
    content.includes('usc') || content.includes('cfr') || 
    content.includes('pennsylvania') || content.includes('federal') ||
    content.includes('section') || content.includes('chapter')
  )) {
    contentType = 'ACTUAL_CONTENT';
    hasActualContent = true;
  } else if (content.length < 100) {
    contentType = 'MINIMAL_CONTENT';
    issues.push('Very short content - likely placeholder');
  } else {
    contentType = 'UNCLEAR';
    issues.push('Content type unclear - needs manual review');
  }
  
  return {
    regulation: regulationSlug,
    status: contentType,
    hasActualContent,
    issues,
    details: {
      contentLength: content.length,
      title: data.title,
      source: data.metadata?.source || 'Unknown',
      citation: data.citation || 'Not provided',
      confidence: data.metadata?.confidence || 'Not provided'
    }
  };
}

/**
 * Test a regulation for content quality
 */
async function testRegulation(regulationSlug, type = 'federal') {
  const url = `${LLM_GATEWAY_URL}/api/llm/compliance/${regulationSlug}`;
  
  try {
    console.log(`\n🔍 Testing ${type}: ${regulationSlug}`);
    
    const response = await httpGet(url);
    
    if (response.status !== 200) {
      console.log(`  ❌ HTTP ${response.status}`);
      return {
        regulation: regulationSlug,
        type,
        status: 'HTTP_ERROR',
        httpStatus: response.status,
        hasActualContent: false
      };
    }
    
    const analysis = analyzeContent(regulationSlug, response.data);
    analysis.type = type;
    
    // Display results
    const statusIcon = analysis.hasActualContent ? '✅' : '❌';
    console.log(`  ${statusIcon} Status: ${analysis.status}`);
    console.log(`  📄 Title: ${analysis.details.title}`);
    console.log(`  📊 Content: ${analysis.details.contentLength} chars`);
    console.log(`  🏛️ Source: ${analysis.details.source}`);
    
    if (analysis.issues.length > 0) {
      console.log(`  ⚠️ Issues: ${analysis.issues.join(', ')}`);
    }
    
    return analysis;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return {
      regulation: regulationSlug,
      type,
      status: 'ERROR',
      error: error.message,
      hasActualContent: false
    };
  }
}

/**
 * Main diagnostic function
 */
async function runContentDiagnosis() {
  console.log('🔬 MCP ENGINE CONTENT DIAGNOSIS - FEDERAL + PA REGULATIONS');
  console.log('=' .repeat(80));
  console.log('Diagnosing which regulations return actual content vs. template fallback...\n');
  
  const results = [];
  
  // Test Federal Regulations
  console.log('📊 TESTING FEDERAL REGULATIONS (Key Moravian Requirements)');
  console.log('-' .repeat(60));
  
  for (const regulation of FEDERAL_REGULATIONS) {
    const result = await testRegulation(regulation, 'federal');
    results.push(result);
  }
  
  // Test Pennsylvania Regulations
  console.log('\n📊 TESTING PENNSYLVANIA REGULATIONS');
  console.log('-' .repeat(60));
  
  for (const regulation of PA_REGULATIONS) {
    const result = await testRegulation(regulation, 'pennsylvania');
    results.push(result);
  }
  
  // Analysis Summary
  console.log('\n' + '=' .repeat(80));
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('=' .repeat(80));
  
  const federalResults = results.filter(r => r.type === 'federal');
  const paResults = results.filter(r => r.type === 'pennsylvania');
  
  const federalWorking = federalResults.filter(r => r.hasActualContent).length;
  const paWorking = paResults.filter(r => r.hasActualContent).length;
  
  console.log(`\n📊 FEDERAL REGULATIONS (${federalResults.length} tested):`);
  console.log(`  ✅ Working (actual content): ${federalWorking}/${federalResults.length}`);
  console.log(`  ❌ Template/Fallback: ${federalResults.length - federalWorking}/${federalResults.length}`);
  
  console.log(`\n📊 PENNSYLVANIA REGULATIONS (${paResults.length} tested):`);
  console.log(`  ✅ Working (actual content): ${paWorking}/${paResults.length}`);
  console.log(`  ❌ Template/Fallback: ${paResults.length - paWorking}/${paResults.length}`);
  
  // Problem Identification
  const problemRegulations = results.filter(r => !r.hasActualContent);
  
  if (problemRegulations.length > 0) {
    console.log(`\n❌ REGULATIONS WITH CONTENT ISSUES (${problemRegulations.length} total):`);
    console.log('-' .repeat(60));
    
    problemRegulations.forEach(reg => {
      console.log(`\n🔴 ${reg.regulation} (${reg.type})`);
      console.log(`   Status: ${reg.status}`);
      if (reg.issues) {
        console.log(`   Issues: ${reg.issues.join(', ')}`);
      }
      if (reg.details) {
        console.log(`   Source: ${reg.details.source}`);
        console.log(`   Content Length: ${reg.details.contentLength} chars`);
      }
    });
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    
    const teachActFallbacks = problemRegulations.filter(r => r.status === 'TEACH_ACT_FALLBACK');
    const genericTemplates = problemRegulations.filter(r => r.status === 'GENERIC_TEMPLATE');
    const errors = problemRegulations.filter(r => r.status === 'ERROR' || r.status === 'HTTP_ERROR');
    
    if (teachActFallbacks.length > 0) {
      console.log(`\n1. Fix TEACH Act Fallback (${teachActFallbacks.length} regulations):`);
      teachActFallbacks.forEach(reg => console.log(`   - ${reg.regulation}`));
      console.log('   → Create specific content engines for these regulations');
    }
    
    if (genericTemplates.length > 0) {
      console.log(`\n2. Fix Generic Templates (${genericTemplates.length} regulations):`);
      genericTemplates.forEach(reg => console.log(`   - ${reg.regulation}`));
      console.log('   → Route to actual regulation content sources');
    }
    
    if (errors.length > 0) {
      console.log(`\n3. Fix Errors (${errors.length} regulations):`);
      errors.forEach(reg => console.log(`   - ${reg.regulation}: ${reg.error || reg.httpStatus}`));
      console.log('   → Debug endpoint and service issues');
    }
    
  } else {
    console.log('\n🎉 ALL TESTED REGULATIONS HAVE ACTUAL CONTENT!');
    console.log('✅ No template fallback issues detected');
    console.log('✅ Ready for Moravian University deployment');
  }
  
  console.log('\n📈 MORAVIAN UNIVERSITY READINESS:');
  const totalWorking = federalWorking + paWorking;
  const totalTested = federalResults.length + paResults.length;
  const readinessPercent = Math.round((totalWorking / totalTested) * 100);
  
  console.log(`  Overall Content Quality: ${totalWorking}/${totalTested} (${readinessPercent}%)`);
  
  if (readinessPercent >= 90) {
    console.log('  🟢 HIGH READINESS - Minimal fixes needed');
  } else if (readinessPercent >= 70) {
    console.log('  🟡 MEDIUM READINESS - Some content engines need fixing');
  } else {
    console.log('  🔴 LOW READINESS - Major content engine issues need resolution');
  }
  
  return {
    totalTested: totalTested,
    totalWorking: totalWorking,
    readinessPercent: readinessPercent,
    problemRegulations: problemRegulations,
    federalWorking: federalWorking,
    paWorking: paWorking
  };
}

// Run the diagnosis
runContentDiagnosis()
  .then(results => {
    console.log(`\n🎯 DIAGNOSIS COMPLETE - ${results.readinessPercent}% content quality`);
    process.exit(results.readinessPercent >= 90 ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });
