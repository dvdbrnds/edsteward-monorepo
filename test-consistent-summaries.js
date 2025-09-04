#!/usr/bin/env node
/**
 * Test Consistent Summaries
 * 
 * Demonstrates the consistent summary generation system that maintains
 * voice and tone across regulation updates for differential view tools.
 */

import { EnhancedSummaryIntegration } from './src/services/enhanced-summary-integration.js';
import { setupLogger } from './src/utils/logger.js';

const logger = setupLogger('test-consistent-summaries');

// Sample regulation texts for testing consistency
const sampleRegulations = {
  'teach-act': {
    title: 'Technology Education and Copyright Harmonization Act (TEACH Act)',
    originalText: `17 U.S.C. § 110(2) - Limitations on exclusive rights: Exemption of certain performances and displays

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
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination.`,
    
    updatedText: `17 U.S.C. § 110(2) - Limitations on exclusive rights: Exemption of certain performances and displays

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
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination.

AMENDMENT: Effective January 1, 2025, institutions must also provide annual training to faculty on TEACH Act compliance requirements and maintain documentation of such training.`
  },
  
  'ferpa': {
    title: 'Family Educational Rights and Privacy Act (FERPA)',
    originalText: `20 U.S.C. § 1232g - Family educational and privacy rights

(a) Conditions for availability of funds to educational agencies or institutions; inspection and review of education records; specific information to be made available; procedure for access to education records; reasonableness of time for such access; hearings; written explanations by parents; definitions

(1)(A) No funds shall be made available under any applicable program to any educational agency or institution which has a policy or practice of permitting the release of education records (or personally identifiable information contained therein other than directory information, as defined in paragraph (5) of this subsection) of students without the written consent of their parents to any individual, agency, or organization, other than to the following—

(i) other school officials, including teachers, within the educational institution or local educational agency who have legitimate educational interests;
(ii) officials of other schools or school systems in which the student seeks or intends to enroll, upon condition that the student's parents be notified of the transfer, receive a copy of the record if desired, and have an opportunity for a hearing to challenge the content of the record;
(iii) authorized representatives of (I) the Comptroller General of the United States, (II) the Secretary, (III) an administrative head of an education agency (as defined in section 1221e–3 of this title), or (IV) State educational authorities, under the conditions set forth in paragraph (3) of this subsection;`
  }
};

async function testConsistentSummaries() {
  try {
    logger.info('🧪 Starting Consistent Summary Testing');
    
    // Initialize the integration service
    const integration = new EnhancedSummaryIntegration({
      enableEdStewardDelivery: false, // Disable for testing
      enableCache: false // Disable cache for testing
    });
    
    console.log('\n=== CONSISTENCY TEST: TEACH ACT ===\n');
    
    // Generate initial summary
    console.log('📝 Generating initial TEACH Act summary...');
    const initialSummary = await integration.enhanceRegulationForGateway(
      'teach-act',
      sampleRegulations['teach-act'].title,
      sampleRegulations['teach-act'].originalText
    );
    
    console.log('✅ Initial Summary:');
    console.log(`"${initialSummary.data.summary}"`);
    console.log(`\nConsistency Hash: ${initialSummary.data.metadata.consistencyHash}`);
    console.log(`Template Version: ${initialSummary.data.metadata.enhancementVersion}`);
    
    // Wait a moment to simulate time passing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate summary for "updated" regulation
    console.log('\n📝 Generating summary for updated TEACH Act (with minor amendment)...');
    const updatedSummary = await integration.enhanceRegulationForGateway(
      'teach-act',
      sampleRegulations['teach-act'].title,
      sampleRegulations['teach-act'].updatedText
    );
    
    console.log('✅ Updated Summary:');
    console.log(`"${updatedSummary.data.summary}"`);
    console.log(`\nConsistency Hash: ${updatedSummary.data.metadata.consistencyHash}`);
    console.log(`Is Consistent: ${updatedSummary.data.metadata.isConsistent}`);
    
    // Test change detection
    console.log('\n🔍 Testing Change Detection...');
    const changeAnalysis = await integration.handleRegulationUpdate(
      'teach-act',
      sampleRegulations['teach-act'].originalText,
      sampleRegulations['teach-act'].updatedText,
      { summary: initialSummary.data.summary }
    );
    
    console.log('📊 Change Analysis Results:');
    console.log(`Has Substantive Changes: ${changeAnalysis.hasChanges}`);
    console.log(`Change Type: ${changeAnalysis.changeType}`);
    console.log(`Impact Level: ${changeAnalysis.impactLevel}`);
    console.log(`Differential View Safe: ${changeAnalysis.differentialViewSafe}`);
    console.log('Changes Detected:', changeAnalysis.changes);
    
    // Test FERPA for comparison
    console.log('\n=== CONSISTENCY TEST: FERPA ===\n');
    
    console.log('📝 Generating FERPA summary...');
    const ferpaSummary = await integration.enhanceRegulationForGateway(
      'ferpa',
      sampleRegulations['ferpa'].title,
      sampleRegulations['ferpa'].originalText
    );
    
    console.log('✅ FERPA Summary:');
    console.log(`"${ferpaSummary.data.summary}"`);
    
    // Compare voice consistency
    console.log('\n🎯 VOICE CONSISTENCY ANALYSIS:');
    console.log('Both summaries should:');
    console.log('✓ Start with "Your" (organization/institution)');
    console.log('✓ Use action words (must, ensure, provide, etc.)');
    console.log('✓ Be 2-3 sentences');
    console.log('✓ Focus on business actions, not legal theory');
    
    const teachActStartsWithYour = initialSummary.data.summary.toLowerCase().startsWith('your');
    const ferpaStartsWithYour = ferpaSummary.data.summary.toLowerCase().startsWith('your');
    const teachActHasActionWords = /must|shall|should|require|ensure|provide|maintain/.test(initialSummary.data.summary.toLowerCase());
    const ferpaHasActionWords = /must|shall|should|require|ensure|provide|maintain/.test(ferpaSummary.data.summary.toLowerCase());
    
    console.log(`\nTEACH Act - Starts with "Your": ${teachActStartsWithYour ? '✅' : '❌'}`);
    console.log(`TEACH Act - Has Action Words: ${teachActHasActionWords ? '✅' : '❌'}`);
    console.log(`FERPA - Starts with "Your": ${ferpaStartsWithYour ? '✅' : '❌'}`);
    console.log(`FERPA - Has Action Words: ${ferpaHasActionWords ? '✅' : '❌'}`);
    
    // Test batch processing
    console.log('\n=== BATCH PROCESSING TEST ===\n');
    
    const batchRegulations = [
      {
        slug: 'teach-act-batch',
        title: sampleRegulations['teach-act'].title,
        text: sampleRegulations['teach-act'].originalText
      },
      {
        slug: 'ferpa-batch',
        title: sampleRegulations['ferpa'].title,
        text: sampleRegulations['ferpa'].originalText
      }
    ];
    
    console.log('📦 Testing batch enhancement...');
    const batchResults = await integration.batchEnhanceRegulations(batchRegulations);
    
    console.log(`✅ Batch Results: ${batchResults.filter(r => r.success).length}/${batchResults.length} successful`);
    
    batchResults.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.regulation}: Enhanced successfully`);
        console.log(`   Summary: "${result.data.summary.substring(0, 100)}..."`);
      } else {
        console.log(`❌ ${result.regulation}: Failed - ${result.error}`);
      }
    });
    
    // Health check
    console.log('\n=== HEALTH CHECK ===\n');
    const healthCheck = await integration.healthCheck();
    console.log('🏥 Health Check Results:', JSON.stringify(healthCheck, null, 2));
    
    // Statistics
    console.log('\n=== INTEGRATION STATISTICS ===\n');
    const stats = integration.getIntegrationStats();
    console.log('📊 Integration Stats:', JSON.stringify(stats, null, 2));
    
    console.log('\n🎉 Consistent Summary Testing Complete!');
    console.log('\n📋 KEY BENEFITS FOR DIFFERENTIAL VIEW TOOLS:');
    console.log('✓ Consistent voice and tone across all summaries');
    console.log('✓ Deterministic generation with low temperature (0.1)');
    console.log('✓ Change detection focuses on substantive changes only');
    console.log('✓ Template versioning for controlled evolution');
    console.log('✓ Consistency validation and scoring');
    console.log('✓ Fallback strategies for reliability');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    console.error('Test Error:', error.message);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testConsistentSummaries().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testConsistentSummaries };
