#!/usr/bin/env node

/**
 * Pennsylvania Regulation Content Fix - Comprehensive Test
 * 
 * Tests that PA regulations now return actual Pennsylvania state education regulation content
 * instead of generic TEACH Act templates
 */

import https from 'https';
import http from 'http';

const LLM_GATEWAY_URL = 'http://localhost:3002';

// Pennsylvania regulations to test
const PA_REGULATIONS = [
  'pennsylvania-uniform-crime-reporting-act',
  'pennsylvania-sexual-violence-education-act-article-',
  'pennsylvania-higher-education-gift-disclosure-act', 
  'pennsylvania-english-fluency-in-higher-education-a',
  'pennsylvania-graduation-rates-reporting-act-88-of-'
];

// Expected PA regulation data
const EXPECTED_PA_DATA = {
  'pennsylvania-uniform-crime-reporting-act': {
    citation: '24 Pa.C.S. § 2502',
    title: 'Pennsylvania Uniform Crime Reporting Act',
    enforcementAgency: 'Pennsylvania Department of Education',
    keyContent: 'Pennsylvania State Police'
  },
  'pennsylvania-sexual-violence-education-act-article-': {
    citation: '24 Pa.C.S. § 2502-A',
    title: 'Pennsylvania Sexual Violence Education Act',
    enforcementAgency: 'Pennsylvania Department of Education',
    keyContent: 'sexual violence education programs'
  },
  'pennsylvania-higher-education-gift-disclosure-act': {
    citation: '24 Pa.C.S. § 2510',
    title: 'Pennsylvania Higher Education Gift Disclosure Act',
    enforcementAgency: 'Pennsylvania State Ethics Commission',
    keyContent: 'Gifts from foreign sources'
  },
  'pennsylvania-english-fluency-in-higher-education-a': {
    citation: '24 Pa.C.S. § 2603',
    title: 'Pennsylvania English Fluency in Higher Education Act',
    enforcementAgency: 'Pennsylvania Department of Education',
    keyContent: 'English fluency of all faculty'
  },
  'pennsylvania-graduation-rates-reporting-act-88-of-': {
    citation: '24 Pa.C.S. § 2604',
    title: 'Pennsylvania Graduation Rates Reporting Act',
    enforcementAgency: 'Pennsylvania Department of Education',
    keyContent: 'Graduation rates for degree and certificate programs'
  }
};

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
 * Test PA regulation content
 */
async function testPARegulation(regulationSlug) {
  const url = `${LLM_GATEWAY_URL}/api/llm/compliance/${regulationSlug}`;
  
  try {
    console.log(`\n🔍 Testing: ${regulationSlug}`);
    
    const response = await httpGet(url);
    
    if (response.status !== 200) {
      return {
        regulation: regulationSlug,
        success: false,
        error: `HTTP ${response.status}`,
        details: response.data
      };
    }
    
    const data = response.data.data;
    const expected = EXPECTED_PA_DATA[regulationSlug];
    
    if (!data) {
      return {
        regulation: regulationSlug,
        success: false,
        error: 'No data in response'
      };
    }
    
    // Test 1: Has actual PA citation (not generic template)
    const hasCitation = data.citation === expected.citation;
    console.log(`  ✓ Citation: ${data.citation} ${hasCitation ? '✅' : '❌'}`);
    
    // Test 2: Has correct enforcement agency
    const hasCorrectAgency = data.enforcementAgency === expected.enforcementAgency;
    console.log(`  ✓ Agency: ${data.enforcementAgency} ${hasCorrectAgency ? '✅' : '❌'}`);
    
    // Test 3: Contains actual PA regulation content (not TEACH Act template)
    const hasActualContent = data.content && data.content.includes(expected.keyContent);
    console.log(`  ✓ Content: Contains "${expected.keyContent}" ${hasActualContent ? '✅' : '❌'}`);
    
    // Test 4: Not generic template (should not contain "TEACH Act" or generic compliance language)
    const isNotTemplate = !data.content.includes('TEACH Act') && 
                         !data.title.includes('Compliance Guide for') &&
                         data.metadata.source === 'Pennsylvania Department of Education';
    console.log(`  ✓ Not Template: ${isNotTemplate ? '✅' : '❌'}`);
    
    // Test 5: Has proper PA regulation structure
    const hasProperStructure = data.sections && data.sections.length > 0 && 
                              data.regulationText && data.regulationText.includes('Pennsylvania');
    console.log(`  ✓ Structure: ${hasProperStructure ? '✅' : '❌'}`);
    
    const allTestsPassed = hasCitation && hasCorrectAgency && hasActualContent && isNotTemplate && hasProperStructure;
    
    return {
      regulation: regulationSlug,
      success: allTestsPassed,
      tests: {
        citation: hasCitation,
        agency: hasCorrectAgency,
        content: hasActualContent,
        notTemplate: isNotTemplate,
        structure: hasProperStructure
      },
      data: {
        citation: data.citation,
        agency: data.enforcementAgency,
        source: data.metadata?.source,
        contentLength: data.content?.length || 0
      }
    };
    
  } catch (error) {
    return {
      regulation: regulationSlug,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function runPAContentTests() {
  console.log('🎯 PENNSYLVANIA REGULATION CONTENT FIX - COMPREHENSIVE TEST');
  console.log('=' .repeat(70));
  console.log('Testing that PA regulations return actual PA state regulation content');
  console.log('instead of generic TEACH Act templates...\n');
  
  const results = [];
  
  for (const regulation of PA_REGULATIONS) {
    const result = await testPARegulation(regulation);
    results.push(result);
    
    if (result.success) {
      console.log(`  🎉 PASS: ${regulation}`);
    } else {
      console.log(`  ❌ FAIL: ${regulation} - ${result.error || 'Multiple test failures'}`);
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(70));
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total} regulations`);
  console.log(`❌ Failed: ${total - passed}/${total} regulations`);
  
  if (passed === total) {
    console.log('\n🎉 SUCCESS: All Pennsylvania regulations now return actual PA state regulation content!');
    console.log('✅ PA content engine is working correctly');
    console.log('✅ No more TEACH Act template fallbacks');
    console.log('✅ Ready for EdSteward integration and Moravian University deployment');
  } else {
    console.log('\n❌ ISSUES FOUND: Some PA regulations still returning incorrect content');
    console.log('🔧 Check the failed regulations above for specific issues');
  }
  
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach(result => {
    if (!result.success) {
      console.log(`\n❌ ${result.regulation}:`);
      if (result.tests) {
        Object.entries(result.tests).forEach(([test, passed]) => {
          console.log(`   ${test}: ${passed ? '✅' : '❌'}`);
        });
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  
  return passed === total;
}

// Run the tests
runPAContentTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
