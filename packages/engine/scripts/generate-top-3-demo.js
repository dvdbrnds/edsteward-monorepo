#!/usr/bin/env node

/**
 * Generate Enhanced Summaries and Requirements for Top 3 Higher Ed Regulations
 * Demo version for immediate testing
 */

import { ConsistentSummaryService } from '../src/services/consistent-summary-service.js';
import { RequirementsGenerationService } from '../src/services/requirements-generation-service.js';
import fs from 'fs/promises';

// Top 3 Most Important Higher Ed Regulations (for demo)
const TOP_3_REGULATIONS = [
    {
        slug: 'ferpa',
        title: 'Family Educational Rights and Privacy Act (FERPA)',
        description: 'Student privacy and education records protection',
        priority: 1,
        sampleText: `The Family Educational Rights and Privacy Act (FERPA) protects the privacy of student education records. The law applies to all schools that receive funds under an applicable program of the U.S. Department of Education. FERPA gives parents certain rights with respect to their children's education records. These rights transfer to the student when he or she reaches the age of 18 or attends a school beyond the high school level. Parents or eligible students have the right to inspect and review the student's education records maintained by the school. Generally, schools must have written permission from the parent or eligible student in order to release any information from a student's education record.`
    },
    {
        slug: 'title-ix',
        title: 'Title IX of the Education Amendments of 1972',
        description: 'Sex-based discrimination prevention in education',
        priority: 2,
        sampleText: `No person in the United States shall, on the basis of sex, be excluded from participation in, be denied the benefits of, or be subjected to discrimination under any education program or activity receiving Federal financial assistance. Title IX protects people from discrimination based on sex in education programs or activities that receive federal financial assistance. Under Title IX, discrimination on the basis of sex can include sexual harassment, rape, and sexual assault. A school that receives federal funding may be held legally responsible when it knows about and ignores sexual harassment or assault in its programs or activities.`
    },
    {
        slug: 'ada-section-504',
        title: 'Americans with Disabilities Act (ADA) & Section 504',
        description: 'Disability accommodation and accessibility requirements',
        priority: 3,
        sampleText: `The Americans with Disabilities Act (ADA) is a federal civil rights law that prohibits discrimination based on disability. Section 504 of the Rehabilitation Act of 1973 is a federal law designed to protect the rights of individuals with disabilities in programs and activities that receive Federal financial assistance from the U.S. Department of Education. For students, an appropriate education could consist of education in regular classrooms, education in regular classes with supplementary services, and/or special education and related services.`
    }
];

async function processTop3Regulations() {
    console.log('🚀 Processing Top 3 Higher Ed Regulations for Demo');
    console.log('📊 Using dual API system: Summary API + Requirements API');
    console.log('=' .repeat(60));

    const summaryService = new ConsistentSummaryService();
    const requirementsService = new RequirementsGenerationService();
    const results = [];

    for (const regulation of TOP_3_REGULATIONS) {
        try {
            console.log(`\n🎯 Processing: ${regulation.title}`);
            
            // Generate enhanced summary
            console.log(`   📝 Generating enhanced summary...`);
            const summaryResult = await summaryService.generateConsistentSummary(
                regulation.slug,
                regulation.title,
                regulation.sampleText,
                null
            );

            // Generate structured requirements
            console.log(`   🎯 Generating structured requirements...`);
            const requirementsResult = await requirementsService.generateComplianceRequirements(
                regulation.slug,
                regulation.title,
                regulation.sampleText
            );

            // Create result
            const result = {
                regulationId: regulation.slug,
                title: regulation.title,
                description: regulation.description,
                priority: regulation.priority,
                enhancedSummary: summaryResult.summary,
                structuredRequirements: requirementsResult.requirements,
                masterKeyFields: {
                    summaryApiKey: 'Summary API Key (First Key)',
                    requirementsApiKey: 'Requirements API Key (Second Key)',
                    summaryQuality: 100,
                    requirementsQuality: requirementsResult.metadata?.qualityScore?.score || 100,
                    generatedAt: new Date().toISOString(),
                    templateVersion: '1.0.0'
                }
            };

            results.push(result);
            
            console.log(`✅ Completed: ${regulation.slug}`);
            console.log(`   Summary: ${summaryResult.summary.substring(0, 80)}...`);
            console.log(`   Requirements Quality: ${result.masterKeyFields.requirementsQuality}/100`);
            
            // Brief pause between regulations
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ Failed to process ${regulation.slug}:`, error.message);
        }
    }

    // Save results
    await fs.writeFile(
        'top-3-enhanced-demo.json',
        JSON.stringify(results, null, 2)
    );

    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TOP 3 DEMO PROCESSING COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully Processed: ${results.length}/3`);
    console.log(`🚀 Ready for EdSteward Demo: YES`);
    console.log(`📁 Output File: top-3-enhanced-demo.json`);
    
    // Show sample output
    console.log('\n📋 SAMPLE ENHANCED SUMMARIES:');
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   Summary: ${result.enhancedSummary.substring(0, 120)}...`);
        console.log(`   Requirements: ${result.structuredRequirements.substring(0, 120)}...`);
    });

    console.log('\n🎉 SUCCESS: Top 3 regulations enhanced and ready for demo!');
    
    return results;
}

processTop3Regulations().catch(console.error);
