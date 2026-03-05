#!/usr/bin/env node

/**
 * COMPREHENSIVE MCP Engine Content Diagnosis - ALL 295+ Regulations
 * 
 * Tests ALL regulations in the system to understand the real scope of content engine issues
 * Not just a tiny sample - the full system diagnosis
 */

import https from 'https';
import http from 'http';

const REGISTRY_API_URL = 'http://localhost:3010';
const LLM_GATEWAY_URL = 'http://localhost:3002';

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
 * Get all regulations from the Registry API
 */
async function getAllRegulations() {
  try {
    console.log('📋 Fetching ALL regulations from Registry API...');
    const response = await httpGet(`${REGISTRY_API_URL}/api/regulations/all`);
    
    if (response.status !== 200) {
      throw new Error(`Registry API returned ${response.status}`);
    }
    
    const regulations = response.data.data || [];
    console.log(`✅ Found ${regulations.length} total regulations in the system`);
    
    return regulations;
    
  } catch (error) {
    console.error('❌ Error fetching regulations:', error.message);
    throw error;
  }
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
    content.includes('section') || content.includes('chapter') ||
    content.includes('title') || content.includes('part')
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
async function testRegulation(regulation, index, total) {
  const regulationSlug = regulation.slug;
  const url = `${LLM_GATEWAY_URL}/api/llm/compliance/${regulationSlug}`;
  
  try {
    // Progress indicator
    const progress = Math.round((index / total) * 100);
    console.log(`\n🔍 [${progress}%] Testing ${index}/${total}: ${regulationSlug}`);
    
    const response = await httpGet(url);
    
    if (response.status !== 200) {
      console.log(`  ❌ HTTP ${response.status}`);
      return {
        regulation: regulationSlug,
        name: regulation.name,
        status: 'HTTP_ERROR',
        httpStatus: response.status,
        hasActualContent: false
      };
    }
    
    const analysis = analyzeContent(regulationSlug, response.data);
    analysis.name = regulation.name;
    
    // Display results
    const statusIcon = analysis.hasActualContent ? '✅' : '❌';
    console.log(`  ${statusIcon} Status: ${analysis.status}`);
    console.log(`  📄 Name: ${regulation.name}`);
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
      name: regulation.name,
      status: 'ERROR',
      error: error.message,
      hasActualContent: false
    };
  }
}

/**
 * Main diagnostic function for ALL 295+ regulations
 */
async function runComprehensiveDiagnosis() {
  console.log('🔬 COMPREHENSIVE MCP ENGINE DIAGNOSIS - ALL 295+ REGULATIONS');
  console.log('=' .repeat(80));
  console.log('Testing ALL regulations in the system to understand real content engine issues...\n');
  
  try {
    // Get all regulations
    const allRegulations = await getAllRegulations();
    
    if (allRegulations.length === 0) {
      throw new Error('No regulations found in Registry API');
    }
    
    console.log(`\n📊 TESTING ALL ${allRegulations.length} REGULATIONS`);
    console.log('-' .repeat(80));
    console.log('This will take several minutes to complete...\n');
    
    const results = [];
    const batchSize = 10; // Test in batches to avoid overwhelming the system
    
    // Process in batches
    for (let i = 0; i < allRegulations.length; i += batchSize) {
      const batch = allRegulations.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allRegulations.length / batchSize);
      
      console.log(`\n📦 BATCH ${batchNumber}/${totalBatches} (Regulations ${i + 1}-${Math.min(i + batchSize, allRegulations.length)})`);
      console.log('-' .repeat(60));
      
      // Test batch regulations
      for (let j = 0; j < batch.length; j++) {
        const regulation = batch[j];
        const overallIndex = i + j + 1;
        const result = await testRegulation(regulation, overallIndex, allRegulations.length);
        results.push(result);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Batch summary
      const batchWorking = results.slice(i, i + batch.length).filter(r => r.hasActualContent).length;
      console.log(`\n📊 Batch ${batchNumber} Summary: ${batchWorking}/${batch.length} working`);
      
      // Longer delay between batches
      if (i + batchSize < allRegulations.length) {
        console.log('⏳ Pausing 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final Analysis
    console.log('\n' + '=' .repeat(80));
    console.log('📋 COMPREHENSIVE DIAGNOSIS RESULTS - ALL REGULATIONS');
    console.log('=' .repeat(80));
    
    const totalTested = results.length;
    const totalWorking = results.filter(r => r.hasActualContent).length;
    const totalBroken = totalTested - totalWorking;
    const readinessPercent = Math.round((totalWorking / totalTested) * 100);
    
    console.log(`\n📊 OVERALL SYSTEM STATUS:`);
    console.log(`  Total Regulations Tested: ${totalTested}`);
    console.log(`  ✅ Working (actual content): ${totalWorking}/${totalTested} (${readinessPercent}%)`);
    console.log(`  ❌ Template/Fallback/Error: ${totalBroken}/${totalTested} (${100 - readinessPercent}%)`);
    
    // Breakdown by status
    const statusBreakdown = {};
    results.forEach(r => {
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
    });
    
    console.log(`\n📊 BREAKDOWN BY STATUS:`);
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      const percentage = Math.round((count / totalTested) * 100);
      const icon = status === 'ACTUAL_CONTENT' ? '✅' : '❌';
      console.log(`  ${icon} ${status}: ${count}/${totalTested} (${percentage}%)`);
    });
    
    // Problem regulations
    const problemRegulations = results.filter(r => !r.hasActualContent);
    
    if (problemRegulations.length > 0) {
      console.log(`\n❌ REGULATIONS WITH CONTENT ISSUES (${problemRegulations.length} total):`);
      console.log('-' .repeat(80));
      
      // Show first 20 problem regulations as examples
      const sampleProblems = problemRegulations.slice(0, 20);
      sampleProblems.forEach((reg, index) => {
        console.log(`\n${index + 1}. 🔴 ${reg.regulation}`);
        console.log(`   Name: ${reg.name}`);
        console.log(`   Status: ${reg.status}`);
        if (reg.issues) {
          console.log(`   Issues: ${reg.issues.join(', ')}`);
        }
        if (reg.details) {
          console.log(`   Source: ${reg.details.source}`);
          console.log(`   Content Length: ${reg.details.contentLength} chars`);
        }
      });
      
      if (problemRegulations.length > 20) {
        console.log(`\n... and ${problemRegulations.length - 20} more regulations with similar issues`);
      }
    }
    
    // Moravian University Readiness Assessment
    console.log('\n📈 MORAVIAN UNIVERSITY DEPLOYMENT READINESS:');
    
    if (readinessPercent >= 90) {
      console.log('  🟢 HIGH READINESS - System ready for deployment');
    } else if (readinessPercent >= 70) {
      console.log('  🟡 MEDIUM READINESS - Some content engines need fixing');
    } else if (readinessPercent >= 50) {
      console.log('  🟠 LOW READINESS - Major content engine issues need resolution');
    } else {
      console.log('  🔴 CRITICAL - System not ready for deployment, widespread content issues');
    }
    
    console.log(`  Overall Content Quality: ${totalWorking}/${totalTested} (${readinessPercent}%)`);
    console.log(`  Regulations Needing Fixes: ${totalBroken}`);
    
    return {
      totalTested,
      totalWorking,
      totalBroken,
      readinessPercent,
      problemRegulations,
      statusBreakdown
    };
    
  } catch (error) {
    console.error('❌ Comprehensive diagnosis failed:', error.message);
    throw error;
  }
}

// Run the comprehensive diagnosis
runComprehensiveDiagnosis()
  .then(results => {
    console.log(`\n🎯 COMPREHENSIVE DIAGNOSIS COMPLETE`);
    console.log(`📊 SYSTEM READINESS: ${results.readinessPercent}% (${results.totalWorking}/${results.totalTested} regulations working)`);
    console.log(`🔧 REGULATIONS NEEDING FIXES: ${results.totalBroken}`);
    
    // Exit code based on readiness
    process.exit(results.readinessPercent >= 70 ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Comprehensive diagnosis failed:', error);
    process.exit(1);
  });
