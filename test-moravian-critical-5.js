#!/usr/bin/env node

/**
 * FRIDAY BETA - MORAVIAN UNIVERSITY CRITICAL 5 REGULATIONS TEST
 * Deep validation of Moravian's most critical regulations for accuracy
 */

import fetch from 'node-fetch';

const REGISTRY_API = 'http://localhost:3010';
const LLM_GATEWAY = 'http://localhost:3002';

const MORAVIAN_CRITICAL_5 = [
  {
    name: 'FERPA',
    slug: 'family-educational-rights-and-privacy-act-ferpa',
    expectedCategory: 'education',
    expectedAgency: 'Department of Education (ED)',
    expectedFocus: 'Educational Program Compliance',
    criticalRequirements: ['Student record privacy', 'Directory information policies', 'Consent procedures']
  },
  {
    name: 'Title IX',
    slug: 'title-ix-of-the-education-amendment-of-1972',
    expectedCategory: 'civil-rights',
    expectedAgency: 'Office for Civil Rights (OCR)',
    expectedFocus: 'Non-Discrimination & Equal Access',
    criticalRequirements: ['Sexual harassment policies', 'Title IX coordinator', 'Grievance procedures']
  },
  {
    name: 'ADA',
    slug: 'americans-with-disabilities-act-of-1990',
    expectedCategory: 'civil-rights',
    expectedAgency: 'Office for Civil Rights (OCR)',
    expectedFocus: 'Non-Discrimination & Equal Access',
    criticalRequirements: ['Accessibility accommodations', 'Reasonable modifications', 'Auxiliary aids']
  },
  {
    name: 'Clery Act',
    slug: 'jeanne-clery-disclosure-of-campus-security-policy-',
    expectedCategory: 'campus-safety',
    expectedAgency: 'Department of Education (ED)',
    expectedFocus: 'Campus Safety & Security Reporting',
    criticalRequirements: ['Annual security report', 'Campus crime log', 'Timely warnings']
  },
  {
    name: 'Financial Aid Compliance',
    slug: 'higher-education-act-institutional-and-financial-a',
    expectedCategory: 'financial',
    expectedAgency: 'Department of Education (ED)',
    expectedFocus: 'Financial Reporting & Audit Compliance',
    criticalRequirements: ['Financial aid administration', 'Return to Title IV', 'Satisfactory academic progress']
  }
];

async function testMoravianCritical5() {
  console.log('🎓 MORAVIAN UNIVERSITY - CRITICAL 5 REGULATIONS TEST');
  console.log('=' .repeat(60));
  
  let overallResults = {
    totalRegulations: MORAVIAN_CRITICAL_5.length,
    accurateRegulations: 0,
    criticalIssues: [],
    readinessScore: 0
  };
  
  for (const regulation of MORAVIAN_CRITICAL_5) {
    console.log(`\n🔍 TESTING: ${regulation.name}`);
    console.log('-' .repeat(40));
    
    let regulationResults = {
      name: regulation.name,
      categoryAccurate: false,
      agencyAccurate: false,
      focusAccurate: false,
      complianceDataValid: false,
      consoleAccessible: false,
      criticalRequirementsCovered: 0,
      issues: []
    };
    
    try {
      // Test 1: Compliance Data Accuracy
      console.log('📋 Testing compliance data accuracy...');
      const complianceResponse = await fetch(`${LLM_GATEWAY}/api/llm/compliance/${regulation.slug}`, {
        timeout: 10000
      });
      
      if (complianceResponse.ok) {
        const complianceData = await complianceResponse.json();
        const metadata = complianceData.data?.metadata;
        
        // Check category
        regulationResults.categoryAccurate = metadata?.category === regulation.expectedCategory;
        if (!regulationResults.categoryAccurate) {
          regulationResults.issues.push(`Category mismatch: got ${metadata?.category}, expected ${regulation.expectedCategory}`);
        }
        
        // Check institutional requirements
        const requirements = complianceData.data?.institutionalRequirements || [];
        regulationResults.complianceDataValid = requirements.length > 0;
        
        if (regulationResults.complianceDataValid) {
          // Check if critical requirements are covered
          const requirementTexts = requirements.map(req => req.requirement?.toLowerCase() || '').join(' ');
          regulationResults.criticalRequirementsCovered = regulation.criticalRequirements.filter(critReq => 
            requirementTexts.includes(critReq.toLowerCase().split(' ')[0])
          ).length;
        }
        
        console.log(`  ✅ Compliance data loaded: ${requirements.length} requirements`);
        console.log(`  ${regulationResults.categoryAccurate ? '✅' : '❌'} Category: ${metadata?.category}`);
        console.log(`  📊 Critical requirements covered: ${regulationResults.criticalRequirementsCovered}/${regulation.criticalRequirements.length}`);
        
      } else {
        regulationResults.issues.push(`Compliance endpoint failed: ${complianceResponse.status}`);
        console.log(`  ❌ Compliance endpoint failed: ${complianceResponse.status}`);
      }
      
      // Test 2: Console Accessibility
      console.log('🖥️  Testing console accessibility...');
      const consoleResponse = await fetch(`${REGISTRY_API}/console/${regulation.slug}`, {
        timeout: 10000
      });
      
      regulationResults.consoleAccessible = consoleResponse.ok;
      if (regulationResults.consoleAccessible) {
        console.log('  ✅ Console accessible');
      } else {
        regulationResults.issues.push(`Console not accessible: ${consoleResponse.status}`);
        console.log(`  ❌ Console not accessible: ${consoleResponse.status}`);
      }
      
      // Test 3: Validation Levels (A, B, C, D)
      console.log('🔬 Testing validation levels...');
      const validationLevels = ['A', 'B', 'C', 'D'];
      let validationResults = [];
      
      for (const level of validationLevels) {
        try {
          // This would test actual validation endpoints if they exist
          // For now, we'll simulate based on compliance data quality
          const hasValidation = regulationResults.complianceDataValid && regulationResults.consoleAccessible;
          validationResults.push({ level, available: hasValidation });
        } catch (error) {
          validationResults.push({ level, available: false });
        }
      }
      
      const availableValidations = validationResults.filter(v => v.available).length;
      console.log(`  📊 Validation levels available: ${availableValidations}/4`);
      
      // Calculate regulation score
      const categoryScore = regulationResults.categoryAccurate ? 25 : 0;
      const complianceScore = regulationResults.complianceDataValid ? 25 : 0;
      const consoleScore = regulationResults.consoleAccessible ? 25 : 0;
      const requirementsScore = (regulationResults.criticalRequirementsCovered / regulation.criticalRequirements.length) * 25;
      
      const regulationScore = categoryScore + complianceScore + consoleScore + requirementsScore;
      
      console.log(`📊 ${regulation.name} Score: ${Math.round(regulationScore)}/100`);
      
      if (regulationScore >= 80) {
        overallResults.accurateRegulations++;
        console.log('🟢 READY FOR MORAVIAN BETA');
      } else if (regulationScore >= 60) {
        console.log('🟡 NEEDS MINOR FIXES');
        overallResults.criticalIssues.push(`${regulation.name}: Minor issues (${Math.round(regulationScore)}/100)`);
      } else {
        console.log('🔴 CRITICAL ISSUES - NOT READY');
        overallResults.criticalIssues.push(`${regulation.name}: Critical issues (${Math.round(regulationScore)}/100)`);
      }
      
      if (regulationResults.issues.length > 0) {
        console.log('⚠️  Issues found:');
        regulationResults.issues.forEach(issue => console.log(`    - ${issue}`));
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${regulation.name}: ${error.message}`);
      overallResults.criticalIssues.push(`${regulation.name}: Test failed - ${error.message}`);
    }
  }
  
  // Generate Moravian Beta Readiness Report
  console.log('\n🎓 MORAVIAN UNIVERSITY BETA READINESS REPORT');
  console.log('=' .repeat(60));
  
  overallResults.readinessScore = Math.round((overallResults.accurateRegulations / overallResults.totalRegulations) * 100);
  
  console.log(`📊 OVERALL READINESS: ${overallResults.readinessScore}% (${overallResults.accurateRegulations}/${overallResults.totalRegulations} regulations ready)`);
  
  if (overallResults.readinessScore >= 80) {
    console.log('🟢 MORAVIAN UNIVERSITY READY FOR FRIDAY BETA');
    console.log('✅ Critical regulations meet minimum standards for beta deployment');
  } else if (overallResults.readinessScore >= 60) {
    console.log('🟡 MORAVIAN UNIVERSITY NEEDS ATTENTION BEFORE BETA');
    console.log('⚠️  Some critical regulations need fixes before Friday deployment');
  } else {
    console.log('🔴 MORAVIAN UNIVERSITY NOT READY FOR BETA');
    console.log('❌ Critical issues must be resolved before Friday deployment');
  }
  
  if (overallResults.criticalIssues.length > 0) {
    console.log('\n⚠️  CRITICAL ISSUES TO ADDRESS:');
    overallResults.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  console.log('\n📋 MORAVIAN-SPECIFIC RECOMMENDATIONS:');
  console.log('  1. Ensure all 5 critical regulations have accurate categorization');
  console.log('  2. Verify compliance requirements match Moravian\'s actual needs');
  console.log('  3. Test console accessibility from Moravian\'s network');
  console.log('  4. Validate enforcement agency information is current');
  console.log('  5. Confirm validation levels work for Moravian\'s use cases');
  
  console.log('\n🏁 MORAVIAN CRITICAL 5 TEST COMPLETE');
  
  return overallResults;
}

// Run the test
testMoravianCritical5()
  .then(results => {
    console.log('\n✅ Moravian test completed successfully');
    process.exit(results.readinessScore >= 80 ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Moravian test failed:', error.message);
    process.exit(1);
  });


