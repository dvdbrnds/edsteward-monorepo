#!/usr/bin/env node

/**
 * Test Federal Register Integration
 * 
 * Tests the new Federal Register API integration with sample regulations
 * and validates EdSteward compatibility
 */

import FederalRegisterAPIClient from '../src/llm-gateway/federal-register-api-client.js';
import EnhancedRegulationProcessor from '../src/llm-gateway/enhanced-regulation-processor.js';

async function testFederalRegisterAPI() {
  console.log('🧪 Testing Federal Register API Client...\n');
  
  const client = new FederalRegisterAPIClient();
  
  try {
    // Test 1: CFR Citation Parsing
    console.log('📋 Test 1: CFR Citation Parsing');
    const testCitations = [
      '34 CFR 668.14',
      '37 CFR 201.40',
      'CFR Title 34, Part 99',
      '17 CFR 110.2'
    ];
    
    for (const citation of testCitations) {
      const parsed = client.parseCFRCitation(citation);
      console.log(`  "${citation}" -> Title: ${parsed?.title}, Part: ${parsed?.part}`);
    }
    console.log('');
    
    // Test 2: Search by CFR Citation
    console.log('📋 Test 2: Federal Register Search');
    const searchResults = await client.searchByCFRCitation('37 CFR 201', {
      limit: 5
    });
    
    console.log(`  Found ${searchResults.totalCount} documents for 37 CFR 201`);
    console.log(`  Retrieved ${searchResults.documents.length} document summaries`);
    
    if (searchResults.documents.length > 0) {
      const firstDoc = searchResults.documents[0];
      console.log(`  First document: "${firstDoc.title}" (${firstDoc.publication_date})`);
    }
    console.log('');
    
    // Test 3: Get Regulation Context
    console.log('📋 Test 3: Comprehensive Regulation Context');
    const context = await client.getRegulationContext('37 CFR 201', {
      documentLimit: 3,
      detailLimit: 2
    });
    
    console.log(`  Context found: ${context.foundDocuments}`);
    if (context.foundDocuments) {
      console.log(`  Total documents: ${context.totalDocuments}`);
      console.log(`  Detailed documents: ${context.detailedDocuments.length}`);
      console.log(`  Enhanced content sections: ${Object.keys(context.enhancedContent || {}).length}`);
    }
    console.log('');
    
    return { success: true, client };
    
  } catch (error) {
    console.error('❌ Federal Register API test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEnhancedRegulationProcessor() {
  console.log('🧪 Testing Enhanced Regulation Processor...\n');
  
  const processor = new EnhancedRegulationProcessor();
  
  try {
    // Test with sample TEACH Act regulation data
    const sampleRegulation = {
      title: "Technology, Education and Copyright Harmonization Act (TEACH Act) of 2002",
      source: "37 CFR 201.40",
      fullText: `Code of Federal Regulations - Title 37: Patents, Trademarks, and Copyrights

TEACH Act Implementation Requirements:

§ 201.40 Educational uses under section 110(2)

(a) General. Section 110(2) of title 17, United States Code, as amended by the Technology, Education and Copyright Harmonization Act of 2002 (TEACH Act), provides limitations on the exclusive rights of copyright owners for certain performances and displays in the course of digital distance education.

(b) Eligible institutions. To qualify for the exemption under section 110(2), an institution must be a governmental body or an accredited nonprofit educational institution.`,
      summary: "The TEACH Act provides exemptions for educational institutions to use copyrighted materials in distance education.",
      keyRequirements: [
        "Institute policies regarding copyright",
        "Provide informational materials about copyright to faculty and students",
        "Apply technological measures to prevent retention and redistribution"
      ]
    };
    
    console.log('📋 Processing sample TEACH Act regulation...');
    const enhancedRegulation = await processor.processRegulation(sampleRegulation, {
      documentLimit: 5,
      detailLimit: 2
    });
    
    console.log('✅ Enhanced regulation processing completed');
    console.log(`📊 Results:`);
    console.log(`  - Regulation text length: ${enhancedRegulation.regulation_text.length} characters`);
    console.log(`  - Summary length: ${enhancedRegulation.summary.length} characters`);
    console.log(`  - Requirements count: ${enhancedRegulation.requirements.length}`);
    console.log(`  - Source attribution: ${enhancedRegulation.source_attribution}`);
    console.log(`  - Federal Register enhanced: ${enhancedRegulation.federal_register_enhancement.successful}`);
    
    if (enhancedRegulation.federal_register_enhancement.successful) {
      console.log(`  - CFR citations processed: ${enhancedRegulation.federal_register_enhancement.cfr_citations_processed.join(', ')}`);
      console.log(`  - Total documents referenced: ${enhancedRegulation.federal_register_enhancement.total_documents_referenced}`);
    }
    
    console.log('');
    return { success: true, enhancedRegulation };
    
  } catch (error) {
    console.error('❌ Enhanced regulation processor test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEdStewardCompatibility(enhancedRegulation) {
  console.log('🧪 Testing EdSteward Compatibility...\n');
  
  try {
    // Simulate EdSteward payload structure
    const edstewardPayload = {
      regulationId: 4661, // Sample EdSteward ID
      name: "TEACH Act Enhanced",
      originalContent: "Original CFR text...",
      updatedContent: enhancedRegulation.regulation_text,
      status: "pending",
      summary: enhancedRegulation.summary,
      submission_guidelines: enhancedRegulation.submission_guidelines,
      requirements: enhancedRegulation.requirements,
      source_attribution: enhancedRegulation.source_attribution,
      federal_register_enhancement: enhancedRegulation.federal_register_enhancement,
      metadata: {
        mcpEngineId: "REG-66",
        timestamp: new Date().toISOString(),
        enhanced: true,
        federalRegisterEnhanced: enhancedRegulation.federal_register_enhancement.successful
      }
    };
    
    console.log('📋 EdSteward payload structure validation:');
    console.log(`  - Regulation ID: ${edstewardPayload.regulationId}`);
    console.log(`  - Name: ${edstewardPayload.name}`);
    console.log(`  - Original content length: ${edstewardPayload.originalContent.length}`);
    console.log(`  - Updated content length: ${edstewardPayload.updatedContent.length}`);
    console.log(`  - Enhanced fields included: ${!!edstewardPayload.summary}`);
    console.log(`  - Federal Register enhanced: ${edstewardPayload.metadata.federalRegisterEnhanced}`);
    
    // Validate required fields
    const requiredFields = ['regulationId', 'name', 'originalContent', 'updatedContent', 'status'];
    const missingFields = requiredFields.filter(field => !edstewardPayload[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ EdSteward compatibility validation passed');
    console.log('');
    
    return { success: true, payload: edstewardPayload };
    
  } catch (error) {
    console.error('❌ EdSteward compatibility test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEndToEndIntegration() {
  console.log('🧪 Testing End-to-End Federal Register Integration...\n');
  
  try {
    // Test the enhanced CFR endpoint
    console.log('📋 Testing enhanced CFR endpoint...');
    
    const testUrl = 'http://localhost:3002/api/llm/cfr/enhanced/teach-act?federal_register=true';
    console.log(`  Making request to: ${testUrl}`);
    
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Enhanced CFR endpoint test completed');
    console.log(`📊 Response analysis:`);
    console.log(`  - Success: ${data.success}`);
    console.log(`  - Enhanced: ${data.data.enhanced}`);
    console.log(`  - Federal Register enhanced: ${data.data.metadata.federal_register_enhanced}`);
    console.log(`  - Source: ${data.data.source}`);
    console.log(`  - Content length: ${data.data.regulation_text?.length || 0} characters`);
    
    return { success: true, endpointData: data };
    
  } catch (error) {
    console.error('❌ End-to-end integration test failed:', error.message);
    console.log('ℹ️  Note: This test requires the MCP Engine server to be running on port 3002');
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Federal Register Integration Test Suite\n');
  console.log('=' .repeat(60));
  console.log('');
  
  const results = {
    federalRegisterAPI: await testFederalRegisterAPI(),
    enhancedProcessor: await testEnhancedRegulationProcessor(),
    edstewardCompatibility: null,
    endToEndIntegration: await testEndToEndIntegration()
  };
  
  // Test EdSteward compatibility if we have enhanced regulation data
  if (results.enhancedProcessor.success) {
    results.edstewardCompatibility = await testEdStewardCompatibility(
      results.enhancedProcessor.enhancedRegulation
    );
  }
  
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`Federal Register API: ${results.federalRegisterAPI.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Enhanced Processor: ${results.enhancedProcessor.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`EdSteward Compatibility: ${results.edstewardCompatibility?.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`End-to-End Integration: ${results.endToEndIntegration.success ? '✅ PASS' : '❌ FAIL'}`);
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r?.success).length;
  
  console.log('');
  console.log(`Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Federal Register integration is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Review the errors above before deploying.');
  }
  
  return results;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  });
}

export { runAllTests, testFederalRegisterAPI, testEnhancedRegulationProcessor, testEdStewardCompatibility };

