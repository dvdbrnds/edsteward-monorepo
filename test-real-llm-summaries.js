#!/usr/bin/env node
/**
 * Test Real LLM Summaries
 * 
 * Tests the enhanced summary system with real LLM API calls
 * to generate comprehensive, readable regulation summaries
 */

import dotenv from 'dotenv';
import { EnhancedSummaryIntegration } from './src/services/enhanced-summary-integration.js';

// Load environment variables
dotenv.config();

console.log('🚀 TESTING REAL LLM ENHANCED SUMMARIES');
console.log('='.repeat(60));

// Sample TEACH Act regulation text
const teachActText = `17 U.S.C. § 110(2) - Limitations on exclusive rights: Exemption of certain performances and displays

Notwithstanding the provisions of section 106, the following are not infringements of copyright:

(2) except with respect to a work produced or marketed primarily for performance or display as part of mediated instructional activities transmitted via digital networks, or a performance or display that is given by means of a copy or phonorecord that is not lawfully made and acquired under this title, and the transmitting government body or accredited nonprofit educational institution knew or had reason to believe was not lawfully made and acquired, the performance of a nondramatic literary or musical work or reasonable and limited portions of any other work, or display of a work in an amount comparable to that which is typically displayed in the course of a live classroom session, by or in the course of a transmission, if—

(A) the performance or display is made by, at the direction of, or under the actual supervision of an instructor as an integral part of a class session offered as a regular part of the systematic mediated instructional activities of a governmental body or an accredited nonprofit educational institution;

(B) the performance or display is directly related and of material assistance to the teaching content of the transmission;

(C) the transmission is made solely for, and, to the extent technologically feasible, the reception is limited to—
(i) students officially enrolled in the course for which the transmission is made; or
(ii) officers or employees of governmental bodies as a part of their official duties or employment; and

(D) the transmitting body or institution—
(i) institutes policies regarding copyright, provides informational materials to faculty, students, and relevant staff members that accurately describe, and promote compliance with, the laws of the United States relating to copyright, and provides notice to students that materials used in connection with the course may be subject to copyright protection; and
(ii) applies technological measures that reasonably prevent—
(I) retention of the work in accessible form by recipients of the transmission from the transmitting body or institution for longer than the class session; and
(II) unauthorized further dissemination of the work in accessible form by such recipients to others; and
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination.`;

async function testRealLLMSummaries() {
  try {
    console.log('🔑 API Key Status:', process.env.LLM_API_KEY ? 'LOADED ✅' : 'MISSING ❌');
    console.log('🤖 Model:', process.env.LLM_DEFAULT_MODEL || 'gpt-4o');
    console.log('🌡️ Temperature:', process.env.LLM_TEMPERATURE || '0.1');
    
    if (!process.env.LLM_API_KEY) {
      console.log('❌ No LLM API key found. Please set LLM_API_KEY in .env file');
      return;
    }
    
    console.log('\n📝 Generating enhanced summary for TEACH Act...');
    
    // Initialize the enhanced summary integration
    const integration = new EnhancedSummaryIntegration({
      enableEdStewardDelivery: false, // Disable for testing
      enableConsistencyChecking: true,
      enableBatchProcessing: false
    });
    
    // Generate enhanced summary
    const startTime = Date.now();
    const enhanced = await integration.enhanceRegulationForGateway(
      'teach-act',
      'Technology Education and Copyright Harmonization Act (TEACH Act)',
      teachActText
    );
    const endTime = Date.now();
    
    console.log(`⏱️ Generation time: ${endTime - startTime}ms`);
    
    if (enhanced.success) {
      console.log('\n✅ ENHANCED SUMMARY GENERATED:');
      console.log('='.repeat(60));
      console.log(`"${enhanced.data.summary}"`);
      
      console.log('\n📊 ENHANCED DATA:');
      console.log('Source:', enhanced.data.summarySource);
      console.log('Confidence:', enhanced.data.metadata.confidence);
      console.log('Consistency Hash:', enhanced.data.metadata.consistencyHash);
      console.log('Is Consistent:', enhanced.data.metadata.isConsistent);
      
      if (enhanced.data.keyRequirements) {
        console.log('\n🔑 KEY REQUIREMENTS:');
        enhanced.data.keyRequirements.forEach((req, i) => {
          console.log(`${i + 1}. ${req}`);
        });
      }
      
      if (enhanced.data.complianceActions) {
        console.log('\n✅ COMPLIANCE ACTIONS:');
        enhanced.data.complianceActions.forEach((action, i) => {
          console.log(`${i + 1}. ${action}`);
        });
      }
      
      if (enhanced.data.businessImpact) {
        console.log('\n💼 BUSINESS IMPACT:');
        console.log(enhanced.data.businessImpact);
      }
      
      console.log('\n🎯 COMPARISON WITH OLD SUMMARY:');
      console.log('OLD (Terrible):');
      console.log('"Permits an instructor to display virtually all types of works during on-line instruction..."');
      console.log('\nNEW (Enhanced):');
      console.log(`"${enhanced.data.summary}"`);
      
      console.log('\n🚀 SUCCESS! Ready for EdSteward delivery and big bang demo!');
      
    } else {
      console.log('❌ Enhanced summary generation failed');
      console.log('Error:', enhanced.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testRealLLMSummaries().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
