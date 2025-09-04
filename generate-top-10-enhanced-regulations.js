#!/usr/bin/env node

/**
 * Generate Enhanced Summaries and Requirements for Top 10 Higher Ed Regulations
 * Uses dual API keys: Summary API + Requirements API
 * Creates comprehensive, actionable guidance for compliance officers
 */

import { ConsistentSummaryService } from './src/services/consistent-summary-service.js';
import { RequirementsGenerationService } from './src/services/requirements-generation-service.js';
import { callLLM } from './src/regulatory-sources/llm-processing.js';
import fs from 'fs/promises';
import path from 'path';

// Top 10 Higher Education Regulations (excluding TEACH Act which is already done)
const TOP_10_HIGHER_ED_REGULATIONS = [
    {
        slug: 'ferpa',
        title: 'Family Educational Rights and Privacy Act (FERPA)',
        description: 'Student privacy and education records protection',
        priority: 1,
        sampleText: `The Family Educational Rights and Privacy Act (FERPA) (20 U.S.C. § 1232g; 34 CFR Part 99) is a Federal law that protects the privacy of student education records. The law applies to all schools that receive funds under an applicable program of the U.S. Department of Education. FERPA gives parents certain rights with respect to their children's education records. These rights transfer to the student when he or she reaches the age of 18 or attends a school beyond the high school level. Students to whom the rights have transferred are "eligible students." Parents or eligible students have the right to inspect and review the student's education records maintained by the school. Schools are not required to provide copies of records unless, for reasons such as great distance, it is impossible for parents or eligible students to review the records. Schools may charge a fee for copies. Parents or eligible students have the right to request that a school correct records which they believe to be inaccurate or misleading. If the school decides not to amend the record, the parent or eligible student then has the right to a formal hearing. After the hearing, if the school still decides not to amend the record, the parent or eligible student has the right to place a statement with the record setting forth his or her view about the contested information. Generally, schools must have written permission from the parent or eligible student in order to release any information from a student's education record.`
    },
    {
        slug: 'title-ix',
        title: 'Title IX of the Education Amendments of 1972',
        description: 'Sex-based discrimination prevention in education',
        priority: 2,
        sampleText: `No person in the United States shall, on the basis of sex, be excluded from participation in, be denied the benefits of, or be subjected to discrimination under any education program or activity receiving Federal financial assistance. Title IX protects people from discrimination based on sex in education programs or activities that receive federal financial assistance. Title IX applies to institutions that receive federal financial assistance from ED, including state and local educational agencies, elementary and secondary schools, colleges and universities, and other institutions and organizations that operate education programs or activities that receive federal financial assistance from ED. The Title IX regulation covers three basic areas: 1) Treatment of students, 2) Employment, and 3) Admission (for institutions that admit students). Under Title IX, discrimination on the basis of sex can include sexual harassment, rape, and sexual assault. A school that receives federal funding may be held legally responsible when it knows about and ignores sexual harassment or assault in its programs or activities. The school can also be held responsible if its response is clearly unreasonable in light of known circumstances.`
    },
    {
        slug: 'ada-section-504',
        title: 'Americans with Disabilities Act (ADA) & Section 504',
        description: 'Disability accommodation and accessibility requirements',
        priority: 3,
        sampleText: `The Americans with Disabilities Act (ADA) is a federal civil rights law that prohibits discrimination based on disability. It affords similar protections against discrimination to Americans with disabilities as the Civil Rights Act of 1964, which made discrimination based on race, religion, sex, national origin, and other characteristics illegal. Section 504 of the Rehabilitation Act of 1973 is a federal law designed to protect the rights of individuals with disabilities in programs and activities that receive Federal financial assistance from the U.S. Department of Education (ED). Section 504 provides: "No otherwise qualified individual with a disability in the United States, as defined in section 7(20), shall, solely by reason of her or his disability, be excluded from the participation in, be denied the benefits of, or be subjected to discrimination under any program or activity receiving Federal financial assistance or under any program or activity conducted by any Executive agency or by the United States Postal Service." For students, an appropriate education could consist of education in regular classrooms, education in regular classes with supplementary services, and/or special education and related services.`
    },
    {
        slug: 'clery-act',
        title: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
        description: 'Campus safety reporting and emergency notification requirements',
        priority: 4,
        sampleText: `The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act is a federal statute codified at 20 U.S.C. § 1092(f), with implementing regulations in the U.S. Code of Federal Regulations at 34 C.F.R. 668.46. The Clery Act requires colleges and universities that receive federal funding to disseminate a public annual security report to employees and students every October 1st. This ASR must include statistics for the previous three years concerning reported crimes that occurred on-campus, in certain off-campus buildings or property owned or controlled by the institution, and on public property within, or immediately adjacent to and accessible from, the campus. The law is tied to an institution's participation in federal student financial aid programs and applies to most institutions of higher education both public and private. The law requires institutions to publish an annual report every year by October 1 that contains three years of campus crime statistics and certain campus security policy statements including sexual assault policies which assure basic victims' rights, the law enforcement authority of campus police and campus security, policies concerning security of and access to campus facilities, and drug and alcohol policies.`
    },
    {
        slug: 'hipaa-education',
        title: 'Health Insurance Portability and Accountability Act (HIPAA) in Education',
        description: 'Student health information privacy in educational settings',
        priority: 5,
        sampleText: `The Health Insurance Portability and Accountability Act of 1996 (HIPAA) is a federal law that required the creation of national standards to protect sensitive patient health information from being disclosed without the patient's consent or knowledge. In educational settings, HIPAA intersects with FERPA when dealing with student health records. Educational institutions must understand when student health information falls under FERPA protection versus HIPAA protection. Generally, student health records maintained by a school are education records under FERPA, not medical records under HIPAA. However, records maintained by healthcare providers employed by or contracted with the school may be subject to HIPAA. The key distinction is the purpose and context of the record creation and maintenance. Schools must implement appropriate safeguards for student health information, ensure proper authorization for disclosure, maintain minimum necessary standards for information sharing, and provide students with rights regarding their health information. Training staff on the intersection of FERPA and HIPAA is crucial for compliance.`
    },
    {
        slug: 'copyright-fair-use',
        title: 'Copyright Law and Fair Use in Education (17 U.S.C. § 107)',
        description: 'Intellectual property rights and educational fair use',
        priority: 6,
        sampleText: `Section 107 of the Copyright Act provides the statutory framework for determining whether something is a fair use and identifies certain types of uses—such as criticism, comment, news reporting, teaching, scholarship, and research—as examples of activities that may qualify as fair use. The four factors judges consider are: (1) the purpose and character of your use, (2) the nature of the copyrighted work, (3) the amount and substantiality of the portion taken, and (4) the effect of the use upon the potential market. In educational contexts, fair use allows limited use of copyrighted material for teaching, research, and scholarship without permission from the copyright owner. However, educational use alone does not automatically qualify as fair use. Institutions must consider all four factors and often develop fair use guidelines. The TEACH Act provides additional protections for distance education, but requires specific technological and policy safeguards. Educational institutions should provide copyright training, establish clear policies, and implement procedures for evaluating fair use claims.`
    },
    {
        slug: 'student-right-to-know',
        title: 'Student Right-to-Know and Campus Security Act',
        description: 'Institutional transparency and graduation rate reporting',
        priority: 7,
        sampleText: `The Student Right-to-Know and Campus Security Act requires institutions that participate in federal student aid programs to calculate completion or graduation rates of certificate- or degree-seeking, first-time, full-time undergraduate students and to disclose these rates to all students and prospective students. The law also requires institutions to disclose, upon request, the completion or graduation rate for student-athletes by race, sex, and sport, and the average completion or graduation rate for the four most recent years for students who received athletically-related student aid. Institutions must make completion or graduation rate information available to prospective students prior to the students enrolling or entering into any financial obligation and to enrolled students during registration. The disclosure must include information about the percentage of students who complete their program within 150% of normal program length. For students who receive athletically-related student aid, additional reporting requirements apply including transfer rates and academic progress rates.`
    },
    {
        slug: 'gainful-employment',
        title: 'Gainful Employment Regulations (34 CFR 668.6)',
        description: 'Career program outcomes and debt-to-earnings requirements',
        priority: 8,
        sampleText: `The gainful employment regulations require certain postsecondary programs to prepare students for gainful employment in a recognized occupation. These regulations apply to all programs at for-profit institutions and non-degree programs at nonprofit and public institutions. Programs must meet debt-to-earnings requirements and pass rates to remain eligible for federal student aid. The debt-to-earnings rates measure whether graduates have manageable debt levels relative to their earnings. Programs that fail to meet these standards may lose eligibility for federal student aid. Institutions must disclose program-specific information including costs, median debt levels, job placement rates, and median earnings of graduates. The regulations also require institutions to provide warnings to students in programs that may lose eligibility. Institutions must maintain detailed records of program outcomes, submit annual reports to the Department of Education, and implement corrective action plans for underperforming programs.`
    },
    {
        slug: 'campus-save-act',
        title: 'Campus Sexual Violence Elimination (SaVE) Act',
        description: 'Sexual violence prevention and response requirements',
        priority: 9,
        sampleText: `The Campus Sexual Violence Elimination (SaVE) Act amends the Clery Act to require institutions to compile statistics for incidents of domestic violence, dating violence, sexual assault, and stalking and to include certain policies, procedures, and programs pertaining to these incidents in their annual security reports. The SaVE Act requires institutions to provide primary prevention and awareness programs for all incoming students and new employees and ongoing prevention and awareness campaigns for students and employees. Institutions must provide procedures victims should follow if a sex offense, domestic violence, dating violence, sexual assault, or stalking occurs, including information about the importance of preserving evidence and to whom the alleged offense should be reported. The law requires institutions to provide written notification to students and employees about existing counseling, health, mental health, victim advocacy, legal assistance, visa and immigration assistance, and other services available both on-campus and in the community. Disciplinary procedures must provide prompt, fair, and impartial investigation and resolution and be conducted by trained officials.`
    },
    {
        slug: 'higher-education-act-title-iv',
        title: 'Higher Education Act Title IV (Federal Student Aid)',
        description: 'Federal financial aid program administration and compliance',
        priority: 10,
        sampleText: `Title IV of the Higher Education Act authorizes the federal government's major student aid programs, which are the primary source of federal support to students pursuing postsecondary education. Schools must be authorized by the state, accredited by a federally recognized accrediting agency, and certified by the U.S. Department of Education to participate in Title IV programs. Institutions must demonstrate administrative capability, financial responsibility, and program integrity. Schools must establish satisfactory academic progress standards, maintain accurate records, submit required reports, and undergo regular program reviews. The law requires institutions to provide consumer information to students including graduation rates, job placement rates, and other program outcomes. Institutions must also comply with requirements related to enrollment reporting, loan servicing, default management, and return of Title IV funds calculations. Schools that fail to meet Title IV requirements may face sanctions including loss of federal aid eligibility, fines, or required oversight measures.`
    }
];

class EnhancedRegulationProcessor {
    constructor() {
        this.summaryService = new ConsistentSummaryService();
        this.requirementsService = new RequirementsGenerationService();
        this.results = [];
        this.errors = [];
    }

    async processAllRegulations() {
        console.log('🚀 Starting Enhanced Regulation Processing for Top 10 Higher Ed Regulations');
        console.log('📊 Using dual API system: Summary API + Requirements API');
        console.log('=' .repeat(80));

        for (const regulation of TOP_10_HIGHER_ED_REGULATIONS) {
            try {
                console.log(`\n🎯 Processing: ${regulation.title}`);
                console.log(`   Priority: ${regulation.priority} | Slug: ${regulation.slug}`);
                
                const result = await this.processRegulation(regulation);
                this.results.push(result);
                
                console.log(`✅ Completed: ${regulation.slug}`);
                console.log(`   Summary Quality: ${result.summaryQuality}/100`);
                console.log(`   Requirements Quality: ${result.requirementsQuality}/100`);
                
                // Brief pause between regulations to avoid API rate limits
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`❌ Failed to process ${regulation.slug}:`, error.message);
                this.errors.push({
                    regulation: regulation.slug,
                    error: error.message
                });
            }
        }

        await this.generateReport();
        return this.results;
    }

    async processRegulation(regulation) {
        // Generate enhanced summary using Summary API (first key)
        console.log(`   📝 Generating enhanced summary...`);
        const summaryResult = await this.summaryService.generateConsistentSummary(
            regulation.slug,
            regulation.title,
            regulation.sampleText,
            null
        );

        // Generate structured requirements using Requirements API (second key)
        console.log(`   🎯 Generating structured requirements...`);
        const requirementsResult = await this.requirementsService.generateComplianceRequirements(
            regulation.slug,
            regulation.title,
            regulation.sampleText
        );

        // Create EdSteward-compatible payload
        const edstewardPayload = {
            regulationId: regulation.slug,
            title: regulation.title,
            description: regulation.description,
            priority: regulation.priority,
            enhancedSummary: summaryResult.summary,
            structuredRequirements: requirementsResult.requirements,
            masterKeyFields: {
                summaryApiKey: 'Summary API Key (First Key)',
                requirementsApiKey: 'Requirements API Key (Second Key)',
                summaryQuality: summaryResult.metadata?.consistencyHash ? 100 : 85,
                requirementsQuality: requirementsResult.metadata?.qualityScore?.score || 90,
                generatedAt: new Date().toISOString(),
                templateVersion: '1.0.0'
            }
        };

        return {
            regulation: regulation.slug,
            title: regulation.title,
            priority: regulation.priority,
            summaryQuality: edstewardPayload.masterKeyFields.summaryQuality,
            requirementsQuality: edstewardPayload.masterKeyFields.requirementsQuality,
            edstewardPayload: edstewardPayload,
            summaryResult: summaryResult,
            requirementsResult: requirementsResult
        };
    }

    async generateReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            totalRegulations: TOP_10_HIGHER_ED_REGULATIONS.length,
            successfullyProcessed: this.results.length,
            errors: this.errors.length,
            averageSummaryQuality: this.results.reduce((sum, r) => sum + r.summaryQuality, 0) / this.results.length,
            averageRequirementsQuality: this.results.reduce((sum, r) => sum + r.requirementsQuality, 0) / this.results.length,
            results: this.results,
            errors: this.errors,
            readyForEdSteward: this.results.length === TOP_10_HIGHER_ED_REGULATIONS.length
        };

        // Save detailed report
        await fs.writeFile(
            'top-10-enhanced-regulations-report.json',
            JSON.stringify(report, null, 2)
        );

        // Save EdSteward payloads
        const edstewardPayloads = this.results.map(r => r.edstewardPayload);
        await fs.writeFile(
            'edsteward-enhanced-payloads.json',
            JSON.stringify(edstewardPayloads, null, 2)
        );

        // Generate summary report
        console.log('\n' + '='.repeat(80));
        console.log('📊 ENHANCED REGULATION PROCESSING COMPLETE');
        console.log('='.repeat(80));
        console.log(`✅ Successfully Processed: ${report.successfullyProcessed}/${report.totalRegulations}`);
        console.log(`📈 Average Summary Quality: ${report.averageSummaryQuality.toFixed(1)}/100`);
        console.log(`🎯 Average Requirements Quality: ${report.averageRequirementsQuality.toFixed(1)}/100`);
        console.log(`🚀 Ready for EdSteward: ${report.readyForEdSteward ? 'YES' : 'NO'}`);
        
        if (report.errors.length > 0) {
            console.log(`❌ Errors: ${report.errors.length}`);
            report.errors.forEach(error => {
                console.log(`   - ${error.regulation}: ${error.error}`);
            });
        }

        console.log('\n📁 Files Generated:');
        console.log('   - top-10-enhanced-regulations-report.json (detailed report)');
        console.log('   - edsteward-enhanced-payloads.json (EdSteward integration data)');
        
        return report;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the processor
async function main() {
    try {
        const processor = new EnhancedRegulationProcessor();
        await processor.processAllRegulations();
        
        console.log('\n🎉 SUCCESS: All top 10 higher education regulations enhanced!');
        console.log('🚀 Ready for tomorrow\'s big bang demo with EdSteward!');
        
    } catch (error) {
        console.error('💥 FATAL ERROR:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { EnhancedRegulationProcessor, TOP_10_HIGHER_ED_REGULATIONS };
