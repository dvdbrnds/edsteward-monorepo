/**
 * MCP Engine Registry API - PostgreSQL Routes
 * 
 * These routes serve regulation data from PostgreSQL database.
 * This is the authoritative source of truth for all regulation data.
 */

import express from 'express';
import RegulationRepository from '../../../repositories/regulationRepository.js';
import { healthCheck, getStats, pool } from '../../../services/database.js';
// v2.0 validator uses CFR citations, URLs, DB metadata, and semantic similarity
// instead of fragile keyword matching
import { validateSourceData } from '../../../services/source-data-validator-v2.js';

const router = express.Router();

/**
 * Transform deadline object from snake_case to camelCase for EdSteward
 */
function transformDeadline(d) {
  if (!d) return null;
  
  // Build a date string for Inquisitor compatibility
  // For ongoing/event-triggered, use a descriptive date
  let dateValue = d.due_date;
  if (!dateValue && d.frequency) {
    // Map frequency to descriptive date for non-specific deadlines
    const frequencyDates = {
      'ongoing': 'ongoing - as needed',
      'event-triggered': 'event-triggered - upon occurrence',
      'annual': 'annual - specific date varies by institution',
      'quarterly': 'quarterly - specific date varies by institution',
      'monthly': 'monthly - specific date varies by institution'
    };
    dateValue = frequencyDates[d.frequency] || d.frequency;
  }
  
  return {
    id: d.id,
    regulationId: d.regulation_id,
    deadlineId: d.deadline_id,
    name: d.name,
    description: d.description,
    deadlineType: d.deadline_type,
    dueDate: d.due_date,
    frequency: d.frequency,
    recurringMonth: d.recurring_month,
    recurringDay: d.recurring_day,
    advanceNoticeDays: d.advance_notice_days,
    penaltyForMissing: d.penalty_for_missing,
    reportingTo: d.reporting_to,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    // Inquisitor compatibility fields
    type: d.deadline_type || d.name || d.frequency || 'regulatory',
    date: dateValue || 'see regulation for specific dates'
  };
}

/**
 * Transform task object from snake_case to camelCase for EdSteward
 */
function transformTask(t) {
  if (!t) return null;
  return {
    id: t.id,
    regulationId: t.regulation_id,
    deadlineId: t.deadline_id,
    parentTaskId: t.parent_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    instructions: t.instructions,
    category: t.category,
    topic: t.topic,  // Department/topic this task belongs to
    priority: t.priority,
    statutoryRole: t.statutory_role,  // Role required by statute (e.g., "Title IX Coordinator")
    statutoryCitation: t.statutory_citation,  // Legal citation (e.g., "34 CFR 106.8")
    assignedRole: t.assigned_role,    // Suggested operational assignee
    requirementType: t.requirement_type || 'requirement',
    estimatedEffort: t.estimated_effort,
    evidenceRequired: t.evidence_required,
    evidenceType: t.evidence_type,
    evidenceInstructions: t.evidence_instructions,
    deliverable: t.deliverable,
    deliverableTemplateUrl: t.deliverable_template_url,
    sortOrder: t.sort_order,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}

/**
 * GET /health - Database-aware health check
 */
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    const stats = await RegulationRepository.getStats();
    
    // Get certified console counts from console_versions table
    let certifiedConsoles = { gold: 0, draft: 0, review: 0 };
    try {
      const cvResult = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM console_versions 
        WHERE is_active = TRUE OR status = 'gold'
        GROUP BY status
      `);
      cvResult.rows.forEach(row => {
        certifiedConsoles[row.status] = parseInt(row.count);
      });
    } catch (cvErr) {
      console.log('[REGISTRY] Console versions table not available:', cvErr.message);
    }
    
    res.json({
      status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      database: dbHealth,
      certifiedConsoles: certifiedConsoles,
      regulations: {
        total: parseInt(stats.total),
        federal: parseInt(stats.federal),
        state: parseInt(stats.state),
        byState: {
          PA: parseInt(stats.pennsylvania),
          NJ: parseInt(stats.new_jersey)
        },
        withStatute: parseInt(stats.with_statute),
        lovvLevels: {
          A: parseInt(stats.lovv_a),
          B: parseInt(stats.lovv_b),
          C: parseInt(stats.lovv_c),
          D: parseInt(stats.lovv_d)
        }
      },
      deadlines: parseInt(stats.total_deadlines),
      tasks: parseInt(stats.total_tasks),
      auditEntries: parseInt(stats.audit_entries)
    });
  } catch (err) {
    console.error('[REGISTRY] Health check error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err.message,
      time: new Date().toISOString()
    });
  }
});

/**
 * GET /api/regulations - List all regulations from PostgreSQL
 */
router.get('/api/regulations', async (req, res) => {
  try {
    const filters = {
      jurisdiction: req.query.jurisdiction,
      state: req.query.state,
      category: req.query.category,
      topic: req.query.topic,
      lovvLevel: req.query.lovvLevel || req.query.lovv_level,
      search: req.query.search || req.query.q,
      limit: req.query.limit,
      offset: req.query.offset
    };
    
    const regulations = await RegulationRepository.findAll(filters);
    
    // Transform to API format for backward compatibility
    const transformed = regulations.map(r => ({
      regKey: r.reg_key,  // Universal key field (REG-001 to REG-251)
      reg_key: r.reg_key,  // Also include snake_case for UI compatibility
      regulationId: r.item_id,
      id: r.id,
      name: r.name,
      description: r.summary || 'No description available',
      summary: r.summary,  // Include raw summary
      requirements: r.requirements,  // Include requirements text
      regulation_text: r.regulation_text,  // Include full regulation text
      regulationText: r.regulation_text,  // camelCase version
      cfr: r.cfr,  // CFR citation
      version: r.version?.toString() || '1.0',
      enactedDate: r.effective_date || r.created_at,
      publicLaw: r.public_law || r.statute || 'Unknown',
      
      // Deadline information
      deadline: r.deadline || 'July 1',
      deadlineMonth: r.deadline_month || '7',
      deadlineLabel: r.deadline_label || '7-Jul',
      reportingRequirements: r.reporting_requirements || 'Annual compliance review',
      
      // Classification
      topic: r.topic || 'Uncategorized',
      category: r.category || 'Uncategorized',
      
      // Legal references
      statute: r.statute,
      statutes: [r.statute].filter(Boolean),
      regulations: [],
      
      // Jurisdiction
      jurisdictionSource: r.jurisdiction_source || 'federal',
      jurisdiction_source: r.jurisdiction_source || 'federal',
      stateCode: r.state_code || null,
      state_code: r.state_code || null,
      applicabilityScope: r.applicability_scope || 'institution_location',
      applicability_scope: r.applicability_scope || 'institution_location',
      
      // Validation
      lovvLevel: r.lovv_level,
      lovv_level: r.lovv_level,  // snake_case for UI
      lastValidated: r.last_validated,
      versionHash: r.version_hash,
      
      // Source
      sourceUrl: r.source_url,
      agencyName: r.agency_name,
      agencyUrl: r.agency_url,
      
      // Nested data (transformed to camelCase for EdSteward)
      filingDeadlines: (r.deadlines || []).map(transformDeadline),
      complianceTasks: (r.tasks || []).map(transformTask),
      tasks: r.tasks || [],  // Raw tasks for UI
      deadlines: r.deadlines || [],  // Raw deadlines for UI
      topics: r.topics || [],  // Already in camelCase from repository
      riskAssessment: r.risk_assessment || null,  // Institutional Risk Score
      risk_assessment: r.risk_assessment || null,  // snake_case for UI
      
      keyProvisions: [
        {
          title: r.topic || 'General Compliance',
          description: r.reporting_requirements || 'See regulation for details'
        }
      ],
      
      updatedAt: r.updated_at || new Date().toISOString()
    }));
    
    res.json(transformed);
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching regulations:', err);
    res.status(500).json({ error: 'Failed to fetch regulations', message: err.message });
  }
});

/**
 * GET /api/regulations/summary - Get summary counts
 */
router.get('/api/regulations/summary', async (req, res) => {
  try {
    const stats = await RegulationRepository.getStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      total: parseInt(stats.total),
      byJurisdiction: {
        federal: parseInt(stats.federal),
        state: parseInt(stats.state)
      },
      byState: {
        PA: parseInt(stats.pennsylvania),
        NJ: parseInt(stats.new_jersey)
      },
      edstewardReady: {
        total: parseInt(stats.total),
        withStatute: parseInt(stats.with_statute),
        withTopic: parseInt(stats.total) // All have topics
      },
      lovvValidation: {
        levelA: parseInt(stats.lovv_a),
        levelB: parseInt(stats.lovv_b),
        levelC: parseInt(stats.lovv_c),
        levelD: parseInt(stats.lovv_d),
        unvalidated: parseInt(stats.total) - parseInt(stats.lovv_a) - parseInt(stats.lovv_b) - parseInt(stats.lovv_c) - parseInt(stats.lovv_d)
      },
      source: 'PostgreSQL'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/regulations/stats - Get detailed statistics
 */
router.get('/api/regulations/stats', async (req, res) => {
  try {
    const stats = await RegulationRepository.getStats();
    
    res.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        federal: parseInt(stats.federal),
        state: parseInt(stats.state),
        thirdParty: 0,
        breakdown: {
          categories: {
            Federal: parseInt(stats.federal),
            State: parseInt(stats.state),
            'Third-Party': 0
          },
          states: {
            Pennsylvania: parseInt(stats.pennsylvania),
            'New Jersey': parseInt(stats.new_jersey)
          }
        },
        validation: {
          levelA: parseInt(stats.lovv_a),
          levelB: parseInt(stats.lovv_b),
          levelC: parseInt(stats.lovv_c),
          levelD: parseInt(stats.lovv_d)
        },
        deadlines: parseInt(stats.total_deadlines),
        tasks: parseInt(stats.total_tasks),
        auditEntries: parseInt(stats.audit_entries),
        coverage: {
          federalAgencies: ['Department of Education', 'Federal Register', 'CFR'],
          states: ['Pennsylvania', 'New Jersey'],
          thirdPartyAgencies: []
        },
        lastUpdated: new Date().toISOString(),
        source: 'PostgreSQL'
      }
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/regulations/search - Search regulations
 */
router.get('/api/regulations/search', async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Search query parameter "q" is required',
        example: '/api/regulations/search?q=privacy'
      });
    }
    
    const results = await RegulationRepository.search(q, parseInt(limit));
    
    const transformed = results.map(r => ({
      regKey: r.reg_key,  // Universal key field
      id: r.id,
      regulationId: r.item_id,
      name: r.name,
      topic: r.topic,
      category: r.category,
      slug: r.item_id,
      consoleUrl: `/console/${r.item_id}`,
      jurisdictionSource: r.jurisdiction_source,
      jurisdiction_source: r.jurisdiction_source,
      stateCode: r.state_code,
      state_code: r.state_code,
      applicabilityScope: r.applicability_scope || 'institution_location',
      applicability_scope: r.applicability_scope || 'institution_location',
      description: r.summary || `${r.topic} regulation`,
      lastUpdated: r.updated_at
    }));
    
    console.log(`[REGISTRY] Search for "${q}" returned ${results.length} results`);
    
    res.json({
      success: true,
      query: q,
      totalResults: results.length,
      returnedResults: transformed.length,
      limit: parseInt(limit),
      data: transformed,
      searchFields: ['name', 'statute'],
      source: 'PostgreSQL'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error searching regulations:', err);
    res.status(500).json({ error: 'Failed to search regulations', message: err.message });
  }
});

/**
 * GET /api/regulations/all - Get all regulations with console URLs
 */
router.get('/api/regulations/all', async (req, res) => {
  try {
    const regulations = await RegulationRepository.findAll();
    
    const transformed = regulations.map(r => ({
      regKey: r.reg_key,  // Universal key field
      reg_key: r.reg_key,
      id: r.id,
      regulationId: r.item_id,
      name: r.name,
      topic: r.topic,
      category: r.category,
      slug: r.item_id,
      consoleUrl: `/console/${r.item_id}`,
      jurisdictionSource: r.jurisdiction_source,
      jurisdiction_source: r.jurisdiction_source,
      stateCode: r.state_code,
      state_code: r.state_code,
      applicabilityScope: r.applicability_scope || 'institution_location',
      applicability_scope: r.applicability_scope || 'institution_location',
      lastUpdated: r.updated_at,
      updated_at: r.updated_at,
      version: r.version,
      lovvLevel: r.lovv_level,
      lovv_level: r.lovv_level
    }));
    
    res.json({
      data: transformed,
      total: transformed.length,
      source: 'PostgreSQL'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching all regulations:', err);
    res.status(500).json({ error: 'Failed to fetch regulations' });
  }
});

/**
 * GET /api/regulations/:id - Get single regulation
 */
router.get('/api/regulations/:id', async (req, res) => {
  try {
    const regulation = await RegulationRepository.findById(req.params.id);
    
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    // Transform to API format
    res.json({
      regKey: regulation.reg_key,  // Universal key field (REG-001 to REG-251)
      regulationId: regulation.item_id,
      id: regulation.id,
      name: regulation.name,
      description: regulation.summary,
      version: regulation.version?.toString() || '1.0',
      enactedDate: regulation.effective_date,
      publicLaw: regulation.public_law || regulation.statute,
      
      // Content
      summary: regulation.summary,
      requirements: regulation.requirements,
      regulationText: regulation.regulation_text,
      reportingRequirements: regulation.reporting_requirements,
      
      // Deadline
      deadline: regulation.deadline,
      deadlineMonth: regulation.deadline_month,
      deadlineLabel: regulation.deadline_label,
      
      // Classification
      topic: regulation.topic,
      category: regulation.category,
      statute: regulation.statute,
      
      // Jurisdiction
      jurisdictionSource: regulation.jurisdiction_source,
      stateCode: regulation.state_code,
      
      // Validation
      lovvLevel: regulation.lovv_level,
      lastValidated: regulation.last_validated,
      validationMethod: regulation.validation_method,
      versionHash: regulation.version_hash,
      
      // Source
      sourceUrl: regulation.source_url,
      agencyName: regulation.agency_name,
      agencyUrl: regulation.agency_url,
      
      // Nested data (transformed to camelCase for EdSteward)
      filingDeadlines: (regulation.deadlines || []).map(transformDeadline),
      complianceTasks: (regulation.tasks || []).map(transformTask),
      topics: regulation.topics || [],  // Already in camelCase from repository
      riskAssessment: regulation.risk_assessment || null,  // Institutional Risk Score
      versionHistory: regulation.version_history || [],
      
      // Metadata
      createdAt: regulation.created_at,
      updatedAt: regulation.updated_at,
      source: 'PostgreSQL'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching regulation:', err);
    res.status(500).json({ error: 'Failed to fetch regulation' });
  }
});

/**
 * GET /api/regulations/:id/audit - Get audit log for regulation
 */
router.get('/api/regulations/:id/audit', async (req, res) => {
  try {
    const regulation = await RegulationRepository.findById(req.params.id);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    const auditLog = await RegulationRepository.getAuditLog(regulation.id);
    
    res.json({
      regKey: regulation.reg_key,  // Universal key field
      regulationId: regulation.item_id,
      name: regulation.name,
      auditLog: auditLog,
      total: auditLog.length
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * POST /api/regulations - Create or update regulation
 */
router.post('/api/regulations', async (req, res) => {
  try {
    const performedBy = req.headers['x-performed-by'] || 'api';
    const regulations = Array.isArray(req.body) ? req.body : [req.body];
    
    const results = {
      added: [],
      updated: [],
      errors: []
    };
    
    for (const reg of regulations) {
      if (!reg.name) {
        results.errors.push({ name: 'unknown', error: 'Regulation name is required' });
        continue;
      }
      
      try {
        const result = await RegulationRepository.upsert(reg, performedBy);
        
        if (result.wasInserted) {
          results.added.push(result.itemId);
        } else {
          results.updated.push(result.itemId);
        }
      } catch (err) {
        results.errors.push({ name: reg.name, error: err.message });
      }
    }
    
    res.status(results.added.length > 0 ? 201 : 200).json({
      success: true,
      message: 'Regulations processed successfully',
      added: results.added.length,
      updated: results.updated.length,
      errors: results.errors.length,
      addedIds: results.added,
      updatedIds: results.updated,
      errorDetails: results.errors.length > 0 ? results.errors : undefined,
      source: 'PostgreSQL'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error processing regulations:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/regulations/:id - Update a regulation
 */
router.put('/api/regulations/:id', async (req, res) => {
  try {
    const performedBy = req.headers['x-performed-by'] || 'api';
    
    // First check if regulation exists
    const existing = await RegulationRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    // Merge with existing data
    const updated = {
      ...existing,
      ...req.body,
      itemId: existing.item_id // Preserve original ID
    };
    
    const result = await RegulationRepository.upsert(updated, performedBy);
    
    // Fetch and return updated regulation
    const regulation = await RegulationRepository.findById(result.itemId);
    
    res.json({
      success: true,
      message: 'Regulation updated',
      regulation: {
        id: regulation.id,
        itemId: regulation.item_id,
        name: regulation.name,
        version: regulation.version
      }
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error updating regulation:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/regulations/workflow-update - Save workflow results to database
 * 
 * This endpoint is called by the LLM Gateway after a comprehensive workflow
 * completes. It saves:
 * - Updated regulation text and summary
 * - Compliance tasks and deadlines
 * - Source validation metadata
 * - Creates a new version record
 * - Logs to audit trail
 */
router.post('/api/regulations/workflow-update', async (req, res) => {
  try {
    const {
      item_id,
      name,
      statute,
      summary,
      regulation_text,
      content_hash,
      lovv_level,
      tasks,
      deadlines,
      source_validation,
      risk_assessment,
      workflow_id,
      last_workflow_run,
      // New AI-generated fields
      summary_metadata,
      key_requirements,
      compliance_actions,
      ai_risk_level,
      primary_stakeholders,
      enforcement_agency,
      // Rich source data - SAVE EVERYTHING!
      ecfr_data,
      federal_register_data,
      legal_database_data,
      academic_sources_data,
      penalties,
      citations,
      differential_data,
      // Full backup
      full_compliance_package
    } = req.body;
    
    if (!item_id) {
      return res.status(400).json({ error: 'item_id is required' });
    }
    
    console.log(`[REGISTRY] 💾 COMPREHENSIVE Workflow update for: ${item_id}`);
    console.log(`[REGISTRY]    - Workflow ID: ${workflow_id}`);
    console.log(`[REGISTRY]    - Tasks: ${tasks?.length || 0}`);
    console.log(`[REGISTRY]    - Deadlines: ${deadlines?.length || 0}`);
    console.log(`[REGISTRY]    - Key Requirements: ${key_requirements?.length || 0}`);
    console.log(`[REGISTRY]    - Compliance Actions: ${compliance_actions?.length || 0}`);
    console.log(`[REGISTRY]    - Has AI Summary: ${summary?.length > 50 ? 'YES' : 'NO'}`);
    console.log(`[REGISTRY]    - Has Source Data: ${source_validation ? 'YES' : 'NO'}`);
    
    // Check if regulation exists
    const existing = await RegulationRepository.findById(item_id);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DATA PROTECTION: Check if regulation has manually-curated locked fields
    // This prevents workflow from overwriting carefully edited content
    // ═══════════════════════════════════════════════════════════════════════════
    const lockedFields = new Set(existing?.locked_fields || []);
    const isDataLocked = existing?.data_locked === true;
    
    if (isDataLocked && lockedFields.size > 0) {
      console.log(`[REGISTRY] 🔒 DATA PROTECTION ACTIVE for ${item_id}`);
      console.log(`[REGISTRY]    - Locked fields: ${Array.from(lockedFields).join(', ')}`);
      console.log(`[REGISTRY]    - Reason: ${existing?.locked_reason || 'Manual curation'}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SOURCE DATA VALIDATION: The Moat
    // Verify that fetched data actually matches the regulation we're updating
    // ═══════════════════════════════════════════════════════════════════════════
    const validationResult = await validateSourceData(item_id, {
      fullText: regulation_text,
      regulation_text,
      content: regulation_text,
      name: name,
      title: name
    }, existing);
    
    console.log(`[REGISTRY] 🛡️ SOURCE VALIDATION: ${validationResult.recommendation} (${validationResult.confidence}% confidence)`);
    
    if (validationResult.recommendation === 'REJECT') {
      console.log(`[REGISTRY] ❌ SOURCE DATA REJECTED - Wrong data detected!`);
      validationResult.errors.forEach(e => console.log(`   ❌ ${e.message}`));
      
      // Log to audit trail
      await pool.query(`
        INSERT INTO regulation_audit_log (regulation_id, entity_type, action, performed_by, new_values, performed_at)
        VALUES ($1, 'regulation', 'WORKFLOW_REJECTED', 'source-validator', $2, NOW())
      `, [
        existing?.id,
        JSON.stringify({
          reason: 'Source data validation failed',
          confidence: validationResult.confidence,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          attempted_item_id: item_id
        })
      ]);
      
      return res.status(400).json({
        error: 'Source data validation failed',
        validation: validationResult,
        message: 'The fetched data appears to be for a different regulation. Update rejected.'
      });
    }
    
    if (validationResult.recommendation === 'REVIEW') {
      console.log(`[REGISTRY] ⚠️ SOURCE DATA NEEDS REVIEW - Low confidence`);
      validationResult.warnings.forEach(w => console.log(`   ⚠️ ${w.message}`));
      // Allow update but log warning
    }
    
    // Clean summary - strip JSON code fences if present
    let cleanSummary = summary;
    if (cleanSummary && typeof cleanSummary === 'string') {
      cleanSummary = cleanSummary.trim();
      // Remove ```json or ``` wrapper
      if (cleanSummary.startsWith('```json')) {
        cleanSummary = cleanSummary.slice(7);
      } else if (cleanSummary.startsWith('```')) {
        cleanSummary = cleanSummary.slice(3);
      }
      if (cleanSummary.endsWith('```')) {
        cleanSummary = cleanSummary.slice(0, -3);
      }
      cleanSummary = cleanSummary.trim();
      
      // If summary is JSON object with a "summary" field, extract it
      if (cleanSummary.startsWith('{') && cleanSummary.includes('"summary"')) {
        try {
          const parsed = JSON.parse(cleanSummary);
          if (parsed.summary && typeof parsed.summary === 'string') {
            cleanSummary = parsed.summary;
          }
        } catch (e) {
          // Keep the original if parsing fails
        }
      }
    }
    
    console.log(`[REGISTRY]    - Clean summary length: ${cleanSummary?.length || 0} chars`);
    
    // Convert keyRequirements array to requirements text string
    let requirementsText = existing?.requirements || '';
    if (Array.isArray(key_requirements) && key_requirements.length > 0) {
      requirementsText = '## Key Compliance Requirements\n\n' + 
        key_requirements.map((r, i) => `${i + 1}. ${r}`).join('\n');
      console.log(`[REGISTRY]    - Built requirements from ${key_requirements.length} key requirements`);
    } else if (Array.isArray(compliance_actions) && compliance_actions.length > 0) {
      requirementsText = '## Required Compliance Actions\n\n' + 
        compliance_actions.map((a, i) => `${i + 1}. ${a}`).join('\n');
      console.log(`[REGISTRY]    - Built requirements from ${compliance_actions.length} compliance actions`);
    }
    console.log(`[REGISTRY]    - Requirements length: ${requirementsText?.length || 0} chars`);
    
    // Build COMPREHENSIVE update payload - SAVE EVERYTHING!
    // BUT respect locked fields that have been manually curated
    const updatePayload = {
      item_id: item_id,
      name: name || existing?.name,
      statute: statute || existing?.statute,
      // Respect lock on summary
      summary: (isDataLocked && lockedFields.has('summary')) 
        ? existing?.summary 
        : cleanSummary,
      // Respect lock on requirements
      requirements: (isDataLocked && lockedFields.has('requirements')) 
        ? existing?.requirements 
        : requirementsText,
      // Respect lock on regulation_text - THE MOST IMPORTANT ONE
      regulation_text: (isDataLocked && lockedFields.has('regulation_text')) 
        ? existing?.regulation_text 
        : regulation_text,
      content_hash: content_hash,
      lovv_level: lovv_level || existing?.lovv_level || 'D',
      source_validation: JSON.stringify(source_validation || {}),
      last_workflow_run: last_workflow_run || new Date().toISOString(),
      workflow_id: workflow_id
    };
    
    // Log what fields were protected
    if (isDataLocked) {
      const protectedCount = ['summary', 'requirements', 'regulation_text'].filter(f => lockedFields.has(f)).length;
      console.log(`[REGISTRY] 🛡️  Protected ${protectedCount} locked fields from overwrite`);
    }
    
    // Upsert the regulation
    const result = await RegulationRepository.upsert(updatePayload, 'workflow-engine');
    
    // Now save all the rich data directly to the database
    // This is THE AUTHORITATIVE SOURCE - save EVERYTHING!
    const regId = result.id || (await RegulationRepository.findById(item_id))?.id;
    if (regId) {
      try {
        await pool.query(`
          UPDATE regulations SET
            summary_metadata = $1,
            key_requirements = $2,
            compliance_actions = $3,
            ai_risk_level = $4,
            primary_stakeholders = $5,
            enforcement_agency = $6,
            ecfr_data = $7,
            federal_register_data = $8,
            legal_database_data = $9,
            academic_sources_data = $10,
            penalties = $11,
            citations = $12,
            differential_data = $13,
            full_compliance_package = $14
          WHERE id = $15
        `, [
          summary_metadata ? JSON.stringify(summary_metadata) : null,
          key_requirements ? JSON.stringify(key_requirements) : null,
          compliance_actions ? JSON.stringify(compliance_actions) : null,
          ai_risk_level || null,
          primary_stakeholders ? JSON.stringify(primary_stakeholders) : null,
          enforcement_agency || null,
          ecfr_data ? JSON.stringify(ecfr_data) : null,
          federal_register_data ? JSON.stringify(federal_register_data) : null,
          legal_database_data ? JSON.stringify(legal_database_data) : null,
          academic_sources_data ? JSON.stringify(academic_sources_data) : null,
          penalties ? JSON.stringify(penalties) : null,
          citations ? JSON.stringify(citations) : null,
          differential_data ? JSON.stringify(differential_data) : null,
          full_compliance_package ? JSON.stringify(full_compliance_package) : null,
          regId
        ]);
        console.log(`[REGISTRY]    ✅ Rich data saved to database`);
      } catch (richDataError) {
        console.error(`[REGISTRY]    ⚠️ Rich data save failed: ${richDataError.message}`);
      }
    }
    
    console.log(`[REGISTRY] ✅ Regulation saved: ${result.itemId} (version: ${result.version})`);
    
    // Update tasks if provided
    let actualTasksSaved = 0;
    if (tasks && tasks.length > 0) {
      try {
        // Get the regulation ID
        const reg = await RegulationRepository.findById(item_id);
        console.log(`[REGISTRY]    - Found regulation: ${reg ? 'yes (id=' + reg.id + ')' : 'no'}`);
        
        if (reg) {
          // Delete existing tasks
          const deleteResult = await pool.query('DELETE FROM regulation_tasks WHERE regulation_id = $1', [reg.id]);
          console.log(`[REGISTRY]    - Deleted ${deleteResult.rowCount} existing tasks`);
          
          // Insert new tasks
          for (const task of tasks) {
            try {
              await pool.query(`
                INSERT INTO regulation_tasks (
                  regulation_id, task_id, parent_task_id, title, description,
                  category, priority, assigned_role,
                  evidence_required, evidence_type, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              `, [
                reg.id,
                task.tempId || task.taskId || null,
                null, // Parent will be linked in second pass
                task.title,
                task.description || null,
                task.category || null,
                task.priority || 'medium',
                task.assignedRole || null,
                task.evidenceRequired || false,
                task.evidenceType || null,
                task.sortOrder || 0
              ]);
              actualTasksSaved++;
            } catch (insertError) {
              console.error(`[REGISTRY]    ❌ Failed to insert task "${task.title}": ${insertError.message}`);
            }
          }
          
          console.log(`[REGISTRY]    ✅ Saved ${actualTasksSaved}/${tasks.length} tasks`);
        } else {
          console.error(`[REGISTRY]    ❌ Regulation not found: ${item_id}`);
        }
      } catch (taskError) {
        console.error(`[REGISTRY]    ⚠️ Task save error: ${taskError.message}`);
        console.error(taskError.stack);
      }
    }
    
    // Update deadlines if provided
    let actualDeadlinesSaved = 0;
    if (deadlines && deadlines.length > 0) {
      try {
        const reg = await RegulationRepository.findById(item_id);
        if (reg) {
          // Delete existing deadlines
          await pool.query('DELETE FROM regulation_deadlines WHERE regulation_id = $1', [reg.id]);
          
          // Insert new deadlines
          for (const deadline of deadlines) {
            try {
              const deadlineName = deadline.name || deadline.type || 'Filing Deadline';
              await pool.query(`
                INSERT INTO regulation_deadlines (
                  regulation_id, name, deadline_type, due_date, description, frequency
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                reg.id,
                deadlineName,
                deadline.type || deadline.deadlineType || null,
                deadline.date || deadline.dueDate || null,
                deadline.description || null,
                deadline.frequency || null
              ]);
              actualDeadlinesSaved++;
            } catch (dlErr) {
              console.error(`[REGISTRY]    ❌ Failed to insert deadline "${deadline.type}": ${dlErr.message}`);
            }
          }
          
          console.log(`[REGISTRY]    ✅ Saved ${actualDeadlinesSaved}/${deadlines.length} deadlines`);
        }
      } catch (deadlineError) {
        console.error(`[REGISTRY]    ⚠️ Deadline save error: ${deadlineError.message}`);
      }
    }
    
    // Invalidate LLM Gateway cache so fresh data is served
    try {
      const cacheResponse = await fetch('http://localhost:3004/api/llm/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [item_id] })
      });
      if (cacheResponse.ok) {
        console.log(`[REGISTRY]    🔄 LLM Gateway cache invalidated for ${item_id}`);
      }
    } catch (cacheErr) {
      // Non-fatal - cache will eventually expire
      console.log(`[REGISTRY]    ⚠️ Could not invalidate cache: ${cacheErr.message}`);
    }
    
    res.json({
      success: true,
      message: 'Workflow results saved to database',
      itemId: result.itemId,
      version: result.version,
      tasksUpdated: actualTasksSaved,
      tasksRequested: tasks?.length || 0,
      deadlinesUpdated: actualDeadlinesSaved,
      deadlinesRequested: deadlines?.length || 0,
      workflowId: workflow_id,
      cacheInvalidated: true
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error saving workflow update:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/regulations/:id - Delete a regulation
 */
router.delete('/api/regulations/:id', async (req, res) => {
  try {
    const regulation = await RegulationRepository.findById(req.params.id);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    await RegulationRepository.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Regulation deleted successfully',
      regulation: regulation.name
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error deleting regulation:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/regulations/:id/transmit - Log EdSteward transmission
 */
router.post('/api/regulations/:id/transmit', async (req, res) => {
  try {
    const regulation = await RegulationRepository.findById(req.params.id);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }
    
    const transmission = await RegulationRepository.logTransmission({
      regulationId: regulation.id,
      regulationCount: 1,
      deadlineCount: (regulation.deadlines || []).length,
      taskCount: (regulation.tasks || []).length,
      payload: req.body.payload,
      payloadHash: req.body.payloadHash,
      status: 'pending',
      destination: req.body.destination || 'edsteward'
    });
    
    res.json({
      success: true,
      transmissionId: transmission.transmission_id,
      regulation: regulation.name,
      status: 'pending'
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error logging transmission:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/transmissions/:id - Update transmission status
 */
router.put('/api/transmissions/:id', async (req, res) => {
  try {
    const { status, responseData, errorMessage } = req.body;
    
    await RegulationRepository.updateTransmissionStatus(
      req.params.id,
      status,
      responseData,
      errorMessage
    );
    
    res.json({
      success: true,
      transmissionId: req.params.id,
      status: status
    });
    
  } catch (err) {
    console.error('[REGISTRY] Error updating transmission:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/alignment-status - Get alignment status for verification
 * Used by EdSteward and verification scripts to check MCP Engine data state
 */
router.get('/api/alignment-status', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM regulations WHERE is_current = TRUE) as total_regulations,
        (SELECT COUNT(*) FROM regulations WHERE jurisdiction_source = 'federal' AND is_current = TRUE) as federal,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'PA' AND is_current = TRUE) as pennsylvania,
        (SELECT COUNT(*) FROM regulations WHERE state_code = 'NJ' AND is_current = TRUE) as new_jersey,
        (SELECT COUNT(*) FROM regulations WHERE lovv_level IS NOT NULL AND is_current = TRUE) as mcp_validated,
        (SELECT COUNT(*) FROM regulation_topics) as topic_mappings,
        (SELECT COUNT(*) FROM regulation_deadlines) as deadlines,
        (SELECT COUNT(*) FROM regulation_tasks) as compliance_tasks,
        (SELECT COUNT(*) FROM risk_assessments) as risk_assessments,
        (SELECT MAX(updated_at) FROM regulations) as last_updated
    `);
    
    res.json({
      status: 'ok',
      source: 'mcp_engine',
      alignment: {
        ...stats.rows[0],
        last_sync: stats.rows[0].last_updated
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[REGISTRY] Error fetching alignment status:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/regulation-hashes - Get all regulation hashes for drift detection
 * Used by verification scripts to compare MCP Engine state with EdSteward
 */
router.get('/api/regulation-hashes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT item_id, version_hash, lovv_level, updated_at, version
      FROM regulations
      WHERE is_current = TRUE AND item_id IS NOT NULL
      ORDER BY item_id
    `);
    
    res.json({
      count: result.rows.length,
      regulations: result.rows,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[REGISTRY] Error fetching regulation hashes:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
