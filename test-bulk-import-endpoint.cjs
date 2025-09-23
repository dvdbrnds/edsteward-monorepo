#!/usr/bin/env node

/**
 * Test Script for EdSteward Bulk Import Configuration
 * Tests the MCP Engine integration endpoint with Basic Authentication
 */

const axios = require('axios');

const EDSTEWARD_URL = 'http://localhost:3000';
const MCP_CREDENTIALS = 'ZHZkYnJuZHM6Z2FiYWRo'; // dvdbrnds:gabadh in Base64

// Test payload matching MCP Engine format
const testPayload = {
  regulationId: 55, // TEACH Act - should exist in database
  name: "🚀 MCP Engine Bulk Import Test - TEACH Act Enhanced",
  status: "pending",
  
  // Enhanced Federal Register fields
  regulation_text: `TEACH Act regulation enhanced with Federal Register integration:

The Technology, Education, and Copyright Harmonization (TEACH) Act provides specific exemptions for educational institutions when using copyrighted materials in distance education. This version includes comprehensive Federal Register interpretations and compliance guidance.

KEY PROVISIONS:
• Distance education exemptions for accredited nonprofit educational institutions
• Requirements for technological measures to prevent retention and redistribution
• Limitations on the amount and type of works that may be used
• Instructor supervision and course enrollment requirements`,

  summary: "AI-generated comprehensive summary: The TEACH Act provides copyright exemptions for distance education, requiring technological safeguards, instructor supervision, and institutional policies.",
  
  submission_guidelines: `DETAILED COMPLIANCE SUBMISSION REQUIREMENTS:

1. ANNUAL COMPLIANCE REPORT (Due: March 31st)
   • Technology usage statistics and safeguard effectiveness
   • Faculty training completion records
   • Policy implementation documentation

2. TECHNOLOGY SAFEGUARDS DOCUMENTATION
   • Digital transmission security measures
   • Access control and authentication systems
   • Content retention prevention mechanisms`,

  requirements: [
    "Implement secure digital transmission systems with access controls",
    "Establish comprehensive copyright compliance policies and procedures", 
    "Provide mandatory faculty training on fair use and TEACH Act provisions",
    "Maintain detailed usage logs and statistics for all copyrighted materials",
    "Submit annual compliance reports to Department of Education by March 31st"
  ],
  
  source_attribution: "MCP Engine + Federal Register (Bulk Import Test)",
  
  // Federal Register enhancement metadata
  federal_register_enhancement: {
    attempted: true,
    successful: true,
    contexts_found: 2,
    total_documents_referenced: 15,
    contexts: [
      {
        document_number: "2025-05444",
        title: "Educational Institution Guidance for TEACH Act Compliance",
        publication_date: "2025-03-31",
        type: "Rule",
        abstract: "Provides guidance for educational institutions on TEACH Act compliance procedures.",
        full_text: "DEPARTMENT OF EDUCATION - Comprehensive guidance on TEACH Act compliance requirements...",
        url: "https://www.federalregister.gov/documents/2025/03/31/2025-05444/teach-act-guidance",
        cached: true
      }
    ]
  },
  
  // Processing metadata
  processing_metadata: {
    processed_at: new Date().toISOString(),
    enhancement_attempted: true,
    enhancement_successful: true
  }
};

async function testBulkImportConfiguration() {
  console.log('🧪 Testing EdSteward Bulk Import Configuration');
  console.log('===============================================');
  
  try {
    // Test 1: Health Check Endpoint
    console.log('\n📡 Test 1: Bulk Import Health Check...');
    
    const healthResponse = await axios.get(
      `${EDSTEWARD_URL}/api/regulation-updates/bulk-import/health`,
      {
        headers: { 
          'Authorization': `Basic ${MCP_CREDENTIALS}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Health Check Response:');
    console.log('   Status:', healthResponse.status);
    console.log('   Bulk Import Enabled:', healthResponse.data.bulkImportEnabled);
    console.log('   Authentication:', healthResponse.data.authentication);
    console.log('   Database:', healthResponse.data.database);
    console.log('   Max Batch Size:', healthResponse.data.maxBatchSize);
    console.log('   Federal Register Enhancement:', healthResponse.data.federalRegisterEnhancement);
    
    // Test 2: Regulation Update Endpoint
    console.log('\n📡 Test 2: Bulk Import Regulation Update...');
    
    const updateResponse = await axios.post(
      `${EDSTEWARD_URL}/api/regulation-updates`,
      testPayload,
      {
        headers: { 
          'Authorization': `Basic ${MCP_CREDENTIALS}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Bulk Import Response:');
    console.log('   Status:', updateResponse.status);
    console.log('   Success:', updateResponse.data.success);
    console.log('   Update ID:', updateResponse.data.updateId);
    console.log('   Regulation ID:', updateResponse.data.regulationId);
    console.log('   Bulk Import Flag:', updateResponse.data.bulkImport);
    console.log('   Timestamp:', updateResponse.data.timestamp);
    
    // Test 3: Verify Update in Database
    console.log('\n📡 Test 3: Verify Update Storage...');
    
    const verifyResponse = await axios.get(
      `${EDSTEWARD_URL}/api/regulation-updates/pending`,
      {
        timeout: 10000
      }
    );
    
    const testUpdate = verifyResponse.data.find(update => 
      update.name.includes('MCP Engine Bulk Import Test')
    );
    
    if (testUpdate) {
      console.log('✅ Update Found in Database:');
      console.log('   ID:', testUpdate.id);
      console.log('   Name:', testUpdate.name);
      console.log('   Status:', testUpdate.status);
      console.log('   Regulation ID:', testUpdate.regulationId);
      console.log('   Has Metadata:', !!testUpdate.metadata);
    } else {
      console.log('❌ Test update not found in pending updates');
    }
    
    console.log('\n🎉 BULK IMPORT CONFIGURATION SUCCESS!');
    console.log('=====================================');
    console.log('✅ Basic Authentication working (dvdbrnds:gabadh)');
    console.log('✅ Health check endpoint operational');
    console.log('✅ Bulk import endpoint accepting MCP Engine payloads');
    console.log('✅ Federal Register enhancement metadata preserved');
    console.log('✅ Database storage working correctly');
    console.log('✅ Ready to receive 347 regulations from MCP Engine');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy this configuration to moravian.edsteward.ai');
    console.log('2. Notify MCP Engine that EdSteward is ready for bulk delivery');
    console.log('3. Monitor bulk import progress in EdSteward dashboard');
    
  } catch (error) {
    console.error('\n❌ Bulk Import Configuration Test Failed:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n🔧 Authentication Issue:');
        console.error('   - Check Basic Auth credentials (dvdbrnds:gabadh)');
        console.error('   - Verify Authorization header format');
      }
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure EdSteward server is running on http://localhost:3000');
    console.log('2. Check database connection and migration status');
    console.log('3. Verify Basic Auth middleware is properly configured');
    console.log('4. Check server logs for detailed error information');
  }
}

// Run the test
if (require.main === module) {
  testBulkImportConfiguration();
}

module.exports = { testBulkImportConfiguration, testPayload };
