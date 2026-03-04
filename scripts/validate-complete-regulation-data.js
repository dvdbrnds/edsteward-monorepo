#!/usr/bin/env node

/**
 * COMPLETE REGULATION DATA VALIDATION
 * 
 * This script validates that ALL required fields are being sent to customers:
 * 1. updatedContent - Full regulation text (5K-30K+ characters)
 * 2. summary - 1-2 sentence summary
 * 3. requirements - Detailed markdown-formatted compliance requirements
 * 4. filingDeadlines - Deadline information (defaults to July 1 if not specified)
 * 
 * Tests the COMPLETE data flow from government sources → extraction → delivery
 */

import fetch from 'node-fetch';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function validateRegulationData(regulationId, regulationName) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`📋 VALIDATING: ${regulationName}`, 'cyan');
  log(`🆔 ID: ${regulationId}`, 'gray');
  log('='.repeat(80), 'cyan');
  
  const issues = [];
  const warnings = [];
  
  try {
    // Step 1: Fetch from LLM Gateway USC endpoint
    log('\n🔍 Step 1: Fetching from LLM Gateway USC endpoint...', 'blue');
    const uscUrl = `http://localhost:3002/api/llm/usc/${regulationId}`;
    log(`   URL: ${uscUrl}`, 'gray');
    
    const uscResponse = await fetch(uscUrl);
    const uscData = await uscResponse.json();
    
    if (!uscResponse.ok || !uscData.success) {
      log(`   ❌ USC fetch failed: ${uscData.error || 'Unknown error'}`, 'red');
      issues.push('USC endpoint failed');
    } else {
      const contentLength = uscData.data?.content?.length || 0;
      log(`   ✅ USC data received: ${contentLength} characters`, 'green');
      
      if (contentLength < 1000) {
        warnings.push(`USC content is short (${contentLength} chars) - may not be complete`);
        log(`   ⚠️  WARNING: Content seems short for a full regulation`, 'yellow');
      }
    }
    
    // Step 2: Fetch from Compliance endpoint
    log('\n🔍 Step 2: Fetching from Compliance endpoint...', 'blue');
    const complianceUrl = `http://localhost:3002/api/llm/compliance/${regulationId}`;
    log(`   URL: ${complianceUrl}`, 'gray');
    
    const complianceResponse = await fetch(complianceUrl);
    const complianceData = await complianceResponse.json();
    
    if (!complianceResponse.ok || !complianceData.success) {
      log(`   ❌ Compliance fetch failed: ${complianceData.error || 'Unknown error'}`, 'red');
      issues.push('Compliance endpoint failed');
    } else {
      log(`   ✅ Compliance data received`, 'green');
      
      // Check for summary
      const summary = complianceData.data?.summary || complianceData.data?.content?.substring(0, 200);
      if (summary) {
        log(`   ✅ Summary: ${summary.substring(0, 100)}...`, 'green');
      } else {
        warnings.push('No summary found in compliance data');
        log(`   ⚠️  No summary found`, 'yellow');
      }
      
      // Check for requirements
      const requirements = complianceData.data?.requirements || complianceData.data?.content;
      if (requirements && requirements.length > 100) {
        log(`   ✅ Requirements: ${requirements.length} characters`, 'green');
      } else {
        warnings.push('Requirements data is missing or incomplete');
        log(`   ⚠️  Requirements data incomplete or missing`, 'yellow');
      }
    }
    
    // Step 3: Trigger manual update through Delivery System
    log('\n🔍 Step 3: Triggering manual update through Delivery System...', 'blue');
    const triggerUrl = `http://localhost:3051/api/trigger-update`;
    log(`   URL: ${triggerUrl}`, 'gray');
    
    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regulationId: regulationId,
        source: 'VALIDATION_SCRIPT',
        message: `Validation test for ${regulationName}`
      })
    });
    
    const triggerData = await triggerResponse.json();
    
    if (!triggerResponse.ok || !triggerData.success) {
      log(`   ❌ Manual update trigger failed: ${triggerData.error || 'Unknown error'}`, 'red');
      issues.push('Manual update trigger failed');
    } else {
      log(`   ✅ Manual update triggered successfully`, 'green');
      
      // Check the fetched regulation data
      const fetchedData = triggerData.regulationData;
      if (!fetchedData) {
        log(`   ❌ No regulation data in response`, 'red');
        issues.push('No regulation data returned from trigger');
      } else {
        log('\n📊 COMPLETE DATA VALIDATION:', 'cyan');
        
        // Validate updatedContent
        const updatedContent = fetchedData.updatedContent || fetchedData.fullText || fetchedData.content;
        if (updatedContent && updatedContent.length > 1000) {
          log(`   ✅ updatedContent: ${updatedContent.length} characters`, 'green');
          log(`      Preview: ${updatedContent.substring(0, 150)}...`, 'gray');
        } else {
          issues.push(`updatedContent missing or too short (${updatedContent?.length || 0} chars)`);
          log(`   ❌ updatedContent: ${updatedContent?.length || 0} characters (INSUFFICIENT!)`, 'red');
        }
        
        // Validate summary
        const summary = fetchedData.summary;
        if (summary && summary.length > 50 && summary.length < 500) {
          log(`   ✅ summary: ${summary.length} characters`, 'green');
          log(`      "${summary}"`, 'gray');
        } else {
          issues.push(`summary missing or wrong length (${summary?.length || 0} chars)`);
          log(`   ❌ summary: ${summary?.length || 0} characters (should be 50-500)`, 'red');
        }
        
        // Validate requirements
        const requirements = fetchedData.requirements;
        if (requirements && requirements.length > 200 && requirements.includes('**')) {
          log(`   ✅ requirements: ${requirements.length} characters (markdown formatted)`, 'green');
          const sections = requirements.match(/\*\*.*?\*\*/g) || [];
          log(`      Contains ${sections.length} sections: ${sections.slice(0, 3).join(', ')}...`, 'gray');
        } else {
          issues.push(`requirements missing or not properly formatted (${requirements?.length || 0} chars)`);
          log(`   ❌ requirements: ${requirements?.length || 0} characters (NOT PROPERLY FORMATTED!)`, 'red');
        }
        
        // Validate filingDeadlines
        const filingDeadlines = fetchedData.filingDeadlines;
        if (filingDeadlines && filingDeadlines.length > 0) {
          log(`   ✅ filingDeadlines: "${filingDeadlines}"`, 'green');
        } else {
          warnings.push('filingDeadlines missing (should default to July 1)');
          log(`   ⚠️  filingDeadlines: MISSING (should default to "July 1")`, 'yellow');
        }
      }
    }
    
    // Step 4: Verify CDC monitoring would detect changes
    log('\n🔍 Step 4: Checking CDC monitoring configuration...', 'blue');
    const healthUrl = `http://localhost:3051/health`;
    const healthResponse = await fetch(healthUrl);
    const healthData = await healthResponse.json();
    
    if (healthData.status === 'healthy' && healthData.details?.cdc?.active) {
      const monitoredCount = healthData.details.cdc.regulations || 0;
      log(`   ✅ CDC is active and monitoring ${monitoredCount} regulation(s)`, 'green');
      log(`   ✅ Automatic polling enabled: Yes`, 'green');
    } else {
      warnings.push('CDC monitoring may not be active');
      log(`   ⚠️  CDC monitoring status unclear`, 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`, 'red');
    issues.push(`Critical error: ${error.message}`);
  }
  
  // Summary Report
  log(`\n${'='.repeat(80)}`, 'cyan');
  log('📊 VALIDATION SUMMARY', 'cyan');
  log('='.repeat(80), 'cyan');
  
  if (issues.length === 0 && warnings.length === 0) {
    log('\n✅ ALL VALIDATION CHECKS PASSED!', 'green');
    log('   All required fields are present and properly formatted', 'green');
    log('   Customers will receive complete regulation data', 'green');
  } else {
    if (issues.length > 0) {
      log(`\n❌ CRITICAL ISSUES (${issues.length}):`, 'red');
      issues.forEach((issue, idx) => {
        log(`   ${idx + 1}. ${issue}`, 'red');
      });
    }
    
    if (warnings.length > 0) {
      log(`\n⚠️  WARNINGS (${warnings.length}):`, 'yellow');
      warnings.forEach((warning, idx) => {
        log(`   ${idx + 1}. ${warning}`, 'yellow');
      });
    }
  }
  
  return { issues, warnings };
}

// Main execution
(async () => {
  log('\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                  COMPLETE REGULATION DATA VALIDATION                      ║', 'cyan');
  log('║                                                                            ║', 'cyan');
  log('║  Validating that ALL required fields are sent to customers:               ║', 'cyan');
  log('║  • updatedContent (full regulation text)                                  ║', 'cyan');
  log('║  • summary (1-2 sentence overview)                                        ║', 'cyan');
  log('║  • requirements (detailed markdown compliance guide)                      ║', 'cyan');
  log('║  • filingDeadlines (defaults to July 1 if not specified)                  ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const testCases = [
    { id: 'technology-education-and-copyright-harmonization-a', name: 'TEACH Act (USC 17 Section 110)' },
    { id: 'age-discrimination-act', name: 'Age Discrimination Act' },
    { id: 'family-educational-rights-and-privacy-act-ferpa', name: 'FERPA' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await validateRegulationData(testCase.id, testCase.name);
    results.push({ ...testCase, ...result });
    
    // Delay between tests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Overall Summary
  log('\n\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                        OVERALL VALIDATION RESULTS                          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  
  results.forEach((result, idx) => {
    const status = result.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
    const color = result.issues.length === 0 ? 'green' : 'red';
    log(`\n${idx + 1}. ${result.name}: ${status}`, color);
    log(`   Issues: ${result.issues.length} | Warnings: ${result.warnings.length}`, 'gray');
  });
  
  log('\n' + '─'.repeat(80), 'gray');
  log(`Total Issues: ${totalIssues} | Total Warnings: ${totalWarnings}`, totalIssues === 0 ? 'green' : 'red');
  
  if (totalIssues === 0) {
    log('\n🎉 SUCCESS: All regulations are sending complete data to customers!', 'green');
  } else {
    log('\n⚠️  ACTION REQUIRED: Fix the issues above to ensure complete data delivery', 'red');
  }
  
  process.exit(totalIssues > 0 ? 1 : 0);
})();


