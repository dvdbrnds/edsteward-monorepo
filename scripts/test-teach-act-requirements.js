#!/usr/bin/env node
/**
 * Test TEACH ACT Requirements Generation
 * 
 * Demonstrates LLM Stage 2: Requirements Generation
 * Fixes the critical issue where full text was contaminating requirements field
 */

import { RequirementsGenerationService } from '../src/services/requirements-generation-service.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('🎯 TEACH ACT REQUIREMENTS GENERATION TEST');
console.log('='.repeat(70));
console.log('LLM Stage 2: Converting Full Text → Structured Requirements');
console.log('='.repeat(70));

// TEACH ACT full regulation text (what should be in regulation_text field)
const teachActFullText = `
Technology, Education and Copyright Harmonization Act of 2002 (TEACH Act)

Section 110(2) of Title 17, United States Code provides:

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

Requirements for compliance include:
- Accredited nonprofit educational institution status
- Instructor supervision of all transmissions
- Technology controls to prevent retention and redistribution
- Copyright policies and training materials
- Student enrollment verification systems
- Notice requirements for copyright protection

Additional Implementation Guidelines:
- Institutions must establish clear procedures for faculty use of copyrighted materials
- Technology infrastructure must support access controls and content protection
- Regular training programs must be conducted for faculty and staff
- Compliance monitoring and audit procedures must be implemented
- Documentation of all copyrighted material usage must be maintained
- Legal review processes for questionable copyright usage must be established
`;

async function testTeachActRequirements() {
  try {
    console.log('🔑 API Configuration:');
    console.log(`API Key: ${process.env.LLM_API_KEY ? 'LOADED ✅' : 'MISSING ❌'}`);
    console.log(`Model: ${process.env.LLM_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022'}`);
    console.log(`Temperature: 0.2 (balanced for requirements generation)`);
    console.log('');

    console.log('🚨 CURRENT PROBLEM:');
    console.log('❌ Regulation 55 (TEACH ACT): 3,102 chars of full text in requirements field');
    console.log('❌ Should be: Structured, actionable compliance requirements');
    console.log('❌ EdSteward shows: Massive text dump instead of clear requirements');
    console.log('');

    console.log('🎯 SOLUTION: LLM Stage 2 Requirements Generation');
    console.log('• Stage 1: Extract full regulation text → regulation_text field');
    console.log('• Stage 2: Generate structured requirements → requirements field');
    console.log('• Result: Clean separation, actionable guidance');
    console.log('');

    const requirementsService = new RequirementsGenerationService({
      logger: console
    });

    console.log('🤖 GENERATING STRUCTURED REQUIREMENTS...');
    console.log('Processing TEACH ACT with LLM Stage 2...');
    console.log('');

    const result = await requirementsService.generateComplianceRequirements(
      'teach-act',
      'Technology, Education and Copyright Harmonization Act (TEACH Act) of 2002',
      teachActFullText
    );

    console.log('✅ STRUCTURED REQUIREMENTS GENERATED:');
    console.log('='.repeat(70));
    console.log(result.requirements);
    console.log('='.repeat(70));
    console.log('');

    console.log('📊 REQUIREMENTS METADATA:');
    console.log(`• Template Version: ${result.metadata.templateVersion}`);
    console.log(`• Generated At: ${result.metadata.generatedAt}`);
    console.log(`• LLM Model: ${result.metadata.llmModel}`);
    console.log(`• Word Count: ${result.metadata.wordCount} words`);
    console.log(`• Character Count: ${result.metadata.characterCount} characters`);
    console.log(`• Quality Score: ${result.metadata.qualityScore.score}/100`);
    console.log(`• Requirements Hash: ${result.metadata.requirementsHash}`);
    console.log('');

    console.log('🔍 QUALITY VALIDATION:');
    console.log(`• Overall Score: ${result.metadata.qualityScore.score}/100`);
    console.log(`• Is Valid: ${result.metadata.qualityScore.isValid ? '✅' : '❌'}`);
    console.log(`• Word Count: ${result.metadata.qualityScore.wordCount} (target: 200-2000)`);
    console.log(`• Specificity Score: ${result.metadata.qualityScore.specificityScore}/8 indicators`);
    console.log(`• Legal Jargon Count: ${result.metadata.qualityScore.jargonCount} (target: <3)`);
    if (result.metadata.qualityScore.issues.length > 0) {
      console.log('• Issues:');
      result.metadata.qualityScore.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    } else {
      console.log('• Issues: None ✅');
    }
    console.log('');

    console.log('🚀 EDSTEWARD API PAYLOAD:');
    const payload = requirementsService.createEdStewardPayload(
      55, // Regulation ID
      'TEACH ACT',
      teachActFullText,
      result
    );
    
    console.log('```json');
    console.log(JSON.stringify(payload, null, 2));
    console.log('```');
    console.log('');

    console.log('🎯 WHAT THIS FIXES:');
    console.log('✅ BEFORE: 3,102 chars of full text dumped in requirements');
    console.log('✅ AFTER: Clean separation of full text and structured requirements');
    console.log('✅ BEFORE: Compliance officers confused by legal text');
    console.log('✅ AFTER: Clear, actionable requirements they can implement');
    console.log('✅ BEFORE: No structure or organization');
    console.log('✅ AFTER: Consistent sections across all regulations');
    console.log('');

    console.log('🎉 TEACH ACT REQUIREMENTS GENERATION COMPLETE!');
    console.log('Ready to fix regulation 55 contamination and roll out to all 354 regulations! 🚀');

  } catch (error) {
    console.error('❌ Error generating TEACH ACT requirements:', error);
    process.exit(1);
  }
}

// Run the test
testTeachActRequirements();
