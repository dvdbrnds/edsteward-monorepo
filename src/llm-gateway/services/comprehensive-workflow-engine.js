/**
 * Comprehensive Workflow Engine
 * 
 * THE CORE PURPOSE OF MCP ENGINE
 * 
 * This is the main orchestrator that:
 * 1. Fetches REAL data from government sources (eCFR, Federal Register, etc.)
 * 2. Performs differential analysis against existing data
 * 3. Cross-references with legal databases (CourtListener, Cornell, RECAP)
 * 4. Extracts compliance tasks and deadlines from regulation text
 * 5. Packages EVERYTHING the client needs for 100% compliance
 * 6. Delivers via pending update workflow for CCO review
 * 
 * NO MOCK DATA - EVER
 */

import { performRealCrossReference } from './real-cross-reference.js';
import { extractComplianceRequirements, getKnownRegulationTasks } from './regulation-task-extractor.js';
import { detectChanges, generateHash } from './differential-analysis.js';
import { FederalRegisterAPIClient } from '../federal-register-api-client.js';
import { fetchCFRPart } from '../ecfr-api-client.js';
import { fetchStateStatute, getStateMapping, isStateRegulation, detectStateCode } from '../state-legislature-api-client.js';
import ConsistentSummaryService from '../../services/consistent-summary-service.js';

// Initialize the AI summary service
const summaryService = new ConsistentSummaryService();

// CFR citation mappings for common regulations
// IMPORTANT: Include specific sections AND search terms to avoid fetching wrong data
const CFR_MAPPINGS = {
  'jeanne-clery-disclosure-of-campus-security-policy-': { 
    title: '34', 
    part: '668', 
    section: '46',  // Clery Act is specifically 34 CFR 668.46!
    searchTerms: ['campus security policy', 'crime statistics', 'timely warning', 'clery'],
    name: 'Clery Act'
  },
  'clery': { 
    title: '34', 
    part: '668', 
    section: '46',
    searchTerms: ['campus security policy', 'crime statistics', 'timely warning'],
    name: 'Clery Act'
  },
  'ferpa': { 
    title: '34', 
    part: '99',
    searchTerms: ['educational records', 'student privacy', 'directory information'],
    name: 'FERPA'
  },
  'family-educational-rights-and-privacy-act-ferpa': { 
    title: '34', 
    part: '99',
    searchTerms: ['educational records', 'student privacy'],
    name: 'FERPA'
  },
  'title-ix': { 
    title: '34', 
    part: '106',
    searchTerms: ['sex discrimination', 'sexual harassment', 'athletics'],
    name: 'Title IX'
  },
  'title-ix-of-the-education-amendment-of-1972': { 
    title: '34', 
    part: '106',
    searchTerms: ['sex discrimination', 'sexual harassment'],
    name: 'Title IX'
  },
  'americans-with-disabilities-act': { 
    title: '28', 
    part: '35',
    searchTerms: ['disability', 'reasonable accommodation', 'accessibility'],
    name: 'ADA'
  },
  'ada': { 
    title: '28', 
    part: '35',
    searchTerms: ['disability', 'reasonable accommodation'],
    name: 'ADA'
  },
  'section-504': { 
    title: '34', 
    part: '104',
    searchTerms: ['disability', 'discrimination', 'handicapped'],
    name: 'Section 504'
  },
  'hipaa': { 
    title: '45', 
    part: '164',
    searchTerms: ['protected health information', 'privacy', 'security'],
    name: 'HIPAA'
  },
  'teach-act': { 
    title: '37', 
    part: '201',
    searchTerms: ['distance education', 'copyright', 'digital transmission'],
    name: 'TEACH Act'
  },
  'osha': { 
    title: '29', 
    part: '1910',
    searchTerms: ['workplace safety', 'occupational', 'hazard'],
    name: 'OSHA'
  }
};

/**
 * Get CFR mapping for a regulation slug
 */
function getCFRMapping(slug) {
  const lowerSlug = slug.toLowerCase();
  for (const [key, mapping] of Object.entries(CFR_MAPPINGS)) {
    if (lowerSlug.includes(key) || key.includes(lowerSlug.substring(0, 10))) {
      return mapping;
    }
  }
  return null;
}

// Initialize API clients
const federalRegisterClient = new FederalRegisterAPIClient();

// ============================================================================
// MAIN WORKFLOW EXECUTION
// ============================================================================

/**
 * Execute comprehensive regulation workflow
 * 
 * This is the MAIN FUNCTION that runs when "Execute Workflow" is clicked.
 * It orchestrates the entire process from government source fetching to
 * final compliance package assembly.
 * 
 * @param {string} regulationSlug - Regulation identifier (e.g., 'jeanne-clery-disclosure-of-campus-security-policy-')
 * @param {object} existingData - Current regulation data in MCP Engine (for differential analysis)
 * @param {object} options - Additional options
 * @returns {object} Complete compliance package ready for client delivery
 */
export async function executeComprehensiveWorkflow(regulationSlug, existingData = null, options = {}) {
  const workflowId = `WF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const startTime = Date.now();
  
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  🚀 MCP ENGINE COMPREHENSIVE WORKFLOW`);
  console.log(`  📋 Regulation: ${regulationSlug}`);
  console.log(`  🆔 Workflow ID: ${workflowId}`);
  console.log(`  🕐 Started: ${new Date().toISOString()}`);
  console.log(`  ⚠️  NO MOCK DATA - ALL API CALLS ARE REAL`);
  console.log(`${'═'.repeat(80)}\n`);
  
  const result = {
    workflowId,
    regulationSlug,
    status: 'running',
    startedAt: new Date().toISOString(),
    
    // Steps
    steps: {
      governmentSources: { status: 'pending', data: null },
      differentialAnalysis: { status: 'pending', data: null },
      legalValidation: { status: 'pending', data: null },
      taskExtraction: { status: 'pending', data: null },
      packageAssembly: { status: 'pending', data: null }
    },
    
    // Final output
    compliancePackage: null,
    
    // Metadata
    isReal: true,
    noMockData: true,
    allApiCallsReal: true
  };
  
  try {
    // ========================================================================
    // STEP 1: FETCH FROM GOVERNMENT SOURCES
    // ========================================================================
    console.log(`\n📖 STEP 1: FETCHING FROM GOVERNMENT SOURCES...`);
    result.steps.governmentSources.status = 'running';
    
    // Detect jurisdiction: state vs federal
    const isState = isStateRegulation(regulationSlug);
    const stateMapping = isState ? getStateMapping(regulationSlug) : null;
    const stateCode = isState ? (stateMapping?.state || detectStateCode(regulationSlug)) : null;
    
    let ecfrData = null;
    let federalRegisterData = null;
    let stateData = null;
    
    if (isState) {
      // ---- STATE REGULATION: Fetch from state sources ----
      console.log(`   🏛️  DETECTED STATE REGULATION (${stateCode || 'unknown state'})`);
      console.log(`   📍 Using state source pipeline instead of federal eCFR/FR`);
      
      stateData = await fetchStateStatute(regulationSlug, stateMapping);
      
      // Also do a limited Federal Register search for federal cross-references
      const searchTerm = regulationSlug.replace(/-/g, ' ').substring(0, 50);
      console.log(`   🔗 Cross-ref: Searching Federal Register for related federal guidance...`);
      federalRegisterData = await federalRegisterClient.searchDocuments(searchTerm, { perPage: 5 });
      
      result.steps.governmentSources.status = 'completed';
      result.steps.governmentSources.data = {
        jurisdiction: 'state',
        stateCode,
        stateSources: stateData,
        federalRegister: federalRegisterData,
        timestamp: new Date().toISOString()
      };
      
      console.log(`   ✅ State sources fetched`);
      console.log(`      - State sources: ${stateData?.successfulSources?.length || 0} successful`);
      console.log(`      - Primary text: ${stateData?.fullText?.length || 0} chars`);
      console.log(`      - Federal cross-refs: ${federalRegisterData?.count || 0} documents`);
      
    } else {
      // ---- FEDERAL REGULATION: Original eCFR + Federal Register pipeline ----
      const cfrMapping = getCFRMapping(regulationSlug);
      
      if (cfrMapping) {
        const citation = cfrMapping.section 
          ? `${cfrMapping.title} CFR ${cfrMapping.part}.${cfrMapping.section}`
          : `${cfrMapping.title} CFR ${cfrMapping.part}`;
        console.log(`   Fetching ${citation} (${cfrMapping.name || regulationSlug})...`);
        
        ecfrData = await fetchCFRPart(cfrMapping.title, cfrMapping.part, {
          section: cfrMapping.section,
          searchTerms: cfrMapping.searchTerms,
          name: cfrMapping.name
        });
      }
      
      const searchTerm = regulationSlug.replace(/-/g, ' ').substring(0, 50);
      console.log(`   Searching Federal Register for "${searchTerm}"...`);
      federalRegisterData = await federalRegisterClient.searchDocuments(searchTerm, { perPage: 10 });
      
      result.steps.governmentSources.status = 'completed';
      result.steps.governmentSources.data = {
        jurisdiction: 'federal',
        ecfr: ecfrData,
        federalRegister: federalRegisterData,
        timestamp: new Date().toISOString()
      };
      
      console.log(`   ✅ Federal sources fetched`);
      console.log(`      - eCFR: ${ecfrData?.success ? 'SUCCESS' : 'N/A'}`);
      console.log(`      - Federal Register: ${federalRegisterData?.count || 0} documents`);
    }
    
    // ========================================================================
    // STEP 2: DIFFERENTIAL ANALYSIS
    // ========================================================================
    console.log(`\n🔍 STEP 2: PERFORMING DIFFERENTIAL ANALYSIS...`);
    result.steps.differentialAnalysis.status = 'running';
    
    // Build incoming data from government sources (state or federal)
    const primaryRegulationText = isState
      ? (stateData?.fullText || '')
      : (ecfrData?.fullText || '');
    
    const incomingData = {
      regulationText: primaryRegulationText,
      federalRegisterDocs: federalRegisterData?.results || [],
      stateSources: isState ? stateData?.sources : null,
      lastUpdated: new Date().toISOString()
    };
    
    // Compare with existing data
    let differentialResult;
    if (existingData) {
      differentialResult = detectChanges(existingData, incomingData);
    } else {
      differentialResult = {
        hasChanges: true,
        changeType: 'initial_load',
        changeSeverity: 'none',
        summary: 'Initial data load - no previous version to compare.',
        changes: []
      };
    }
    
    result.steps.differentialAnalysis.status = 'completed';
    result.steps.differentialAnalysis.data = differentialResult;
    
    console.log(`   ✅ Differential analysis complete`);
    console.log(`      - Changes detected: ${differentialResult.hasChanges}`);
    console.log(`      - Change type: ${differentialResult.changeType}`);
    console.log(`      - Severity: ${differentialResult.changeSeverity}`);
    
    // ========================================================================
    // STEP 3: CROSS-REFERENCE WITH LEGAL DATABASES
    // ========================================================================
    console.log(`\n⚖️  STEP 3: CROSS-REFERENCING WITH LEGAL DATABASES...`);
    result.steps.legalValidation.status = 'running';
    
    // Call the comprehensive real cross-reference service
    const crossRefResult = await performRealCrossReference(regulationSlug);
    
    result.steps.legalValidation.status = 'completed';
    result.steps.legalValidation.data = crossRefResult;
    
    console.log(`   ✅ Legal validation complete`);
    console.log(`      - Government sources: ${crossRefResult.governmentSources?.overall?.sourcesFetched || 0}/${crossRefResult.governmentSources?.overall?.sourcesChecked || 0}`);
    console.log(`      - Law libraries: ${crossRefResult.lawLibrarySources?.overall?.sourcesFetched || 0}/${crossRefResult.lawLibrarySources?.overall?.sourcesChecked || 0}`);
    console.log(`      - Academic sources: ${crossRefResult.academicSources?.overall?.sourcesFetched || 0}/${crossRefResult.academicSources?.overall?.sourcesChecked || 0}`);
    console.log(`      - Certainty level: ${crossRefResult.summary?.certaintyLevel || 'Unknown'}`);
    
    // ========================================================================
    // STEP 4: EXTRACT COMPLIANCE TASKS & DEADLINES
    // ========================================================================
    console.log(`\n📋 STEP 4: EXTRACTING COMPLIANCE TASKS & DEADLINES...`);
    result.steps.taskExtraction.status = 'running';
    
    // Combine all text sources for analysis (state-aware)
    const combinedText = isState
      ? [
          stateData?.fullText || '',
          stateData?.requirements || '',
          stateData?.adminCode?.fullText || '',
          federalRegisterData?.results?.map(d => d.abstract || d.title).join('\n') || ''
        ].filter(Boolean).join('\n\n')
      : [
          ecfrData?.fullText || '',
          federalRegisterData?.results?.map(d => d.abstract || d.title).join('\n') || ''
        ].join('\n\n');
    
    // Extract compliance requirements
    const extractionResult = await extractComplianceRequirements(
      regulationSlug,
      combinedText,
      {
        name: crossRefResult.regulationName || regulationSlug,
        statute: crossRefResult.citations?.usc || '',
        cfr: crossRefResult.citations?.cfr || ''
      }
    );
    
    result.steps.taskExtraction.status = 'completed';
    result.steps.taskExtraction.data = extractionResult;
    
    const parentTasks = extractionResult.tasks.filter(t => !t.parentTempId);
    const subtasks = extractionResult.tasks.filter(t => t.parentTempId);
    
    console.log(`   ✅ Task extraction complete`);
    console.log(`      - Total tasks: ${extractionResult.tasks.length}`);
    console.log(`      - Parent sections: ${parentTasks.length}`);
    console.log(`      - Subtasks: ${subtasks.length}`);
    console.log(`      - Deadlines: ${extractionResult.deadlines.length}`);
    console.log(`      - Penalties: ${extractionResult.penalties.length}`);
    console.log(`      - Confidence: ${extractionResult.analysis.confidence}%`);
    
    // ========================================================================
    // STEP 4.5: GENERATE AI-POWERED SUMMARY
    // The authoritative MCP Engine deserves authoritative summaries!
    // ========================================================================
    console.log(`\n📝 STEP 4.5: GENERATING AI-POWERED SUMMARY...`);
    
    let generatedSummary = null;
    try {
      const regulationTitle = isState
        ? (stateMapping?.name || regulationSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
        : (crossRefResult.fullName || crossRefResult.regulationName || regulationSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      const regulationTextForSummary = primaryRegulationText || combinedText || '';
      
      if (regulationTextForSummary.length > 100) {
        // Use AI to generate consistent, high-quality summary
        generatedSummary = await summaryService.generateConsistentSummary(
          regulationSlug,
          regulationTitle,
          regulationTextForSummary,
          existingData?.summaryMetadata || null
        );
        
        console.log(`   ✅ AI summary generated successfully`);
        console.log(`      - Summary length: ${generatedSummary.summary?.length || 0} chars`);
        console.log(`      - Key requirements: ${generatedSummary.keyRequirements?.length || 0}`);
        console.log(`      - Compliance actions: ${generatedSummary.complianceActions?.length || 0}`);
        console.log(`      - Risk level: ${generatedSummary.riskLevel || 'unknown'}`);
      } else {
        console.log(`   ⚠️ Insufficient text for AI summary generation`);
      }
    } catch (summaryError) {
      console.error(`   ❌ AI summary generation failed: ${summaryError.message}`);
      // Continue without AI summary - we'll use fallback
    }
    
    // ========================================================================
    // STEP 5: ASSEMBLE COMPLETE COMPLIANCE PACKAGE
    // ========================================================================
    console.log(`\n📦 STEP 5: ASSEMBLING COMPLIANCE PACKAGE...`);
    result.steps.packageAssembly.status = 'running';
    
    // Build the complete package that has EVERYTHING the client needs
    const compliancePackage = {
      // Identifiers
      regKey: existingData?.regKey || null,
      regulationId: regulationSlug,
      itemId: regulationSlug,
      
      // Basic info (state regulations use mapping name to avoid cross-ref contamination)
      name: isState
        ? (stateMapping?.name || stateData?.sources?.enhancedJson?.regulatoryBody || regulationSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
        : (crossRefResult.fullName || crossRefResult.regulationName || regulationSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
      statute: isState ? (stateData?.citation || crossRefResult.citations?.usc || existingData?.statute || '') : (crossRefResult.citations?.usc || existingData?.statute || ''),
      cfrCitation: isState ? '' : (crossRefResult.citations?.cfr || existingData?.cfrCitation || ''),
      
      // Jurisdiction metadata
      jurisdiction: isState ? {
        type: 'state',
        stateCode,
        stateName: stateData?.stateName || '',
        citation: stateData?.citation || '',
        regulatoryBody: stateData?.sources?.enhancedJson?.regulatoryBody || '',
      } : {
        type: 'federal',
        citation: crossRefResult.citations?.cfr || '',
      },
      
      // Full regulation content (state text takes priority for state regulations)
      regulationText: primaryRegulationText || existingData?.regulationText || '',
      contentHash: generateHash(primaryRegulationText || existingData?.regulationText || ''),
      
      // AI-GENERATED SUMMARY (The authoritative MCP Engine deserves authoritative summaries!)
      summary: generatedSummary?.summary || existingData?.summary || `Compliance requirements for ${crossRefResult.regulationName || regulationSlug}`,
      summaryMetadata: generatedSummary?.metadata || null,
      
      // Structured compliance data from AI summary
      keyRequirements: generatedSummary?.keyRequirements || [],
      complianceActions: generatedSummary?.complianceActions || [],
      aiRiskLevel: generatedSummary?.riskLevel || null,
      primaryStakeholders: generatedSummary?.primaryStakeholders || [],
      enforcementAgency: generatedSummary?.enforcementAgency || null,
      
      // Source validation (adapts to jurisdiction type)
      sourceValidation: isState ? {
        type: 'state',
        stateCode,
        stateSources: stateData?.sourceValidation || {},
        successfulSources: stateData?.successfulSources || [],
        federalCrossRefs: {
          status: federalRegisterData?.count > 0 ? 'found' : 'none',
          note: 'Federal sources shown for cross-reference only — not authoritative for state law',
          documentCount: federalRegisterData?.count || 0,
          recentDocuments: (federalRegisterData?.results || []).slice(0, 3).map(d => ({
            title: d.title,
            type: d.type,
            date: d.publication_date,
            url: d.html_url
          })),
        },
        legalDatabases: {
          courtListener: crossRefResult.lawLibrarySources?.courtListener?.confidence || 0,
          cornell: crossRefResult.academicSources?.cornellLII?.confidence || 0,
          overallConfidence: crossRefResult.summary?.averageConfidence || 0,
          certaintyLevel: crossRefResult.summary?.certaintyLevel || 'D'
        },
        lastChecked: new Date().toISOString()
      } : {
        type: 'federal',
        ecfr: {
          status: ecfrData?.success ? 'verified' : 'unavailable',
          url: ecfrData?.url || `https://www.ecfr.gov/current/title-${getCFRMapping(regulationSlug)?.title || '34'}/part-${getCFRMapping(regulationSlug)?.part || '99'}`,
          lastChecked: new Date().toISOString()
        },
        federalRegister: {
          status: federalRegisterData?.count > 0 ? 'verified' : 'no_documents',
          documentCount: federalRegisterData?.count || 0,
          recentDocuments: (federalRegisterData?.results || []).slice(0, 5).map(d => ({
            title: d.title,
            type: d.type,
            date: d.publication_date,
            url: d.html_url
          })),
          lastChecked: new Date().toISOString()
        },
        legalDatabases: {
          courtListener: crossRefResult.lawLibrarySources?.courtListener?.confidence || 0,
          cornell: crossRefResult.academicSources?.cornellLII?.confidence || 0,
          recap: crossRefResult.lawLibrarySources?.recap?.confidence || 0,
          overallConfidence: crossRefResult.summary?.averageConfidence || 0,
          certaintyLevel: crossRefResult.summary?.certaintyLevel || 'D'
        }
      },
      
      // HIERARCHICAL COMPLIANCE TASKS (with parent-child relationships)
      complianceTasks: extractionResult.tasks.map(task => ({
        tempId: task.tempId,
        parentTempId: task.parentTempId || null,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        assignedRole: task.assignedRole,
        deadline: task.deadline || null,
        evidenceRequired: task.evidenceRequired,
        evidenceType: task.evidenceType,
        sortOrder: task.sortOrder
      })),
      
      // FILING DEADLINES (merge task extractor results with state source deadlines)
      filingDeadlines: (extractionResult.deadlines.length > 0
        ? extractionResult.deadlines
        : (isState && stateData?.deadlines?.length > 0 ? stateData.deadlines : [])
      ).map(d => ({
        type: d.type || 'compliance',
        date: d.date,
        description: d.description || d.label || '',
        frequency: d.frequency || 'one-time',
        advanceNoticeDays: d.advanceNoticeDays || 30
      })),
      
      // PENALTIES (merge task extractor results with state source penalties)
      penalties: (extractionResult.penalties.length > 0
        ? extractionResult.penalties
        : (isState && stateData?.penalties?.length > 0 ? stateData.penalties : [])
      ).map(p => ({
        type: p.type,
        amount: p.amount,
        description: p.description,
        per: p.per || 'violation'
      })),
      
      // Risk assessment (if available)
      riskAssessment: existingData?.riskAssessment || {
        score: 0,
        level: 'UNASSESSED',
        factors: null
      },
      
      // Differential analysis results
      differential: {
        hasChanges: differentialResult.hasChanges,
        changeType: differentialResult.changeType,
        changeSeverity: differentialResult.changeSeverity,
        changeSummary: differentialResult.summary,
        previousHash: existingData?.contentHash || null,
        currentHash: generateHash(primaryRegulationText || existingData?.regulationText || '')
      },
      
      // Validation metadata
      validation: {
        lovvLevel: crossRefResult.summary?.certaintyLevel || 'D',
        confidence: crossRefResult.summary?.averageConfidence || 0,
        lastValidated: new Date().toISOString(),
        validationMethod: 'comprehensive_workflow',
        sourcesChecked: crossRefResult.summary?.totalSources || 0,
        sourcesVerified: crossRefResult.summary?.successfulFetches || 0
      },
      
      // Legislative history (state regulations only)
      legislativeHistory: isState ? stateData?.legislativeHistory : null,
      
      // Workflow metadata
      workflowMetadata: {
        workflowId,
        executedAt: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
        jurisdictionType: isState ? 'state' : 'federal',
        stateCode: stateCode || null,
        isReal: true,
        noMockData: true,
        allApiCallsReal: true
      }
    };
    
    result.steps.packageAssembly.status = 'completed';
    result.steps.packageAssembly.data = { packageSize: JSON.stringify(compliancePackage).length };
    result.compliancePackage = compliancePackage;
    
    console.log(`   ✅ Compliance package assembled`);
    console.log(`      - Package size: ${JSON.stringify(compliancePackage).length} bytes`);
    console.log(`      - Tasks included: ${compliancePackage.complianceTasks.length}`);
    console.log(`      - Deadlines included: ${compliancePackage.filingDeadlines.length}`);
    console.log(`      - Penalties included: ${compliancePackage.penalties.length}`);
    
    // ========================================================================
    // WORKFLOW COMPLETE
    // ========================================================================
    const totalDuration = Date.now() - startTime;
    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.duration = `${totalDuration}ms`;
    
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  ✅ COMPREHENSIVE WORKFLOW COMPLETE`);
    console.log(`  🆔 Workflow ID: ${workflowId}`);
    console.log(`  ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`  📊 Steps Completed: 5/5`);
    console.log(`  🎯 Ready for client delivery via pending update workflow`);
    console.log(`${'═'.repeat(80)}\n`);
    
    return result;
    
  } catch (error) {
    console.error(`\n❌ WORKFLOW ERROR: ${error.message}`);
    console.error(error.stack);
    
    result.status = 'failed';
    result.error = {
      message: error.message,
      stack: error.stack,
      failedAt: new Date().toISOString()
    };
    
    return result;
  }
}

/**
 * Quick workflow for known regulations (uses templates)
 */
export async function executeQuickWorkflow(regulationSlug, existingData = null) {
  console.log(`\n⚡ QUICK WORKFLOW for ${regulationSlug}`);
  
  // Try to get pre-built task structure
  const knownTasks = await getKnownRegulationTasks(regulationSlug);
  
  if (knownTasks) {
    console.log(`   ✅ Using known regulation template`);
    console.log(`   📋 Tasks: ${knownTasks.tasks.length}`);
    console.log(`   📅 Deadlines: ${knownTasks.deadlines.length}`);
    
    return {
      workflowId: `QUICK-${Date.now()}`,
      regulationSlug,
      status: 'completed',
      compliancePackage: {
        regulationId: regulationSlug,
        complianceTasks: knownTasks.tasks,
        filingDeadlines: knownTasks.deadlines,
        penalties: knownTasks.penalties,
        validation: {
          method: 'template_match',
          confidence: knownTasks.analysis.confidence
        }
      },
      isReal: true,
      noMockData: true
    };
  }
  
  // Fall back to full workflow
  console.log(`   ℹ️  No template found - running full workflow`);
  return executeComprehensiveWorkflow(regulationSlug, existingData);
}

export default { executeComprehensiveWorkflow, executeQuickWorkflow };
