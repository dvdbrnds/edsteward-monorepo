#!/usr/bin/env node

/**
 * Test single regulation processing to debug the batch script
 */

import { ConsistentSummaryService } from './src/services/consistent-summary-service.js';
import { RequirementsGenerationService } from './src/services/requirements-generation-service.js';

async function testSingleRegulation() {
    try {
        console.log('🧪 Testing single regulation processing...');
        
        // Test FERPA
        const regulation = {
            slug: 'ferpa',
            title: 'Family Educational Rights and Privacy Act (FERPA)',
            sampleText: 'The Family Educational Rights and Privacy Act (FERPA) protects the privacy of student education records. Schools must have written permission from parents or eligible students to release information from education records.'
        };
        
        console.log('📝 Testing summary generation...');
        const summaryService = new ConsistentSummaryService();
        const summaryResult = await summaryService.generateConsistentSummary(
            regulation.slug,
            regulation.title,
            regulation.sampleText,
            null
        );
        
        console.log('✅ Summary generated successfully');
        console.log('Summary:', summaryResult.summary.substring(0, 100) + '...');
        
        console.log('\n🎯 Testing requirements generation...');
        const requirementsService = new RequirementsGenerationService();
        const requirementsResult = await requirementsService.generateComplianceRequirements(
            regulation.slug,
            regulation.title,
            regulation.sampleText
        );
        
        console.log('✅ Requirements generated successfully');
        console.log('Requirements length:', requirementsResult.requirements.length, 'characters');
        console.log('Quality score:', requirementsResult.metadata.qualityScore.score);
        
        console.log('\n🎉 Single regulation test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

testSingleRegulation();
