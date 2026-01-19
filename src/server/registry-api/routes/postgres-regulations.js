/**
 * MCP Engine Registry API - PostgreSQL Routes
 * 
 * These routes serve regulation data from PostgreSQL database.
 * This is the authoritative source of truth for all regulation data.
 */

import express from 'express';
import RegulationRepository from '../../../repositories/regulationRepository.js';
import { healthCheck, getStats } from '../../../services/database.js';

const router = express.Router();

/**
 * Transform deadline object from snake_case to camelCase for EdSteward
 */
function transformDeadline(d) {
  if (!d) return null;
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
    updatedAt: d.updated_at
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
    assignedRole: t.assigned_role,
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
    
    res.json({
      status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      database: dbHealth,
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
      regulationId: r.item_id,
      id: r.id,
      name: r.name,
      description: r.summary || 'No description available',
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
      stateCode: r.state_code || null,
      
      // Validation
      lovvLevel: r.lovv_level,
      lastValidated: r.last_validated,
      versionHash: r.version_hash,
      
      // Source
      sourceUrl: r.source_url,
      agencyName: r.agency_name,
      agencyUrl: r.agency_url,
      
      // Nested data (transformed to camelCase for EdSteward)
      filingDeadlines: (r.deadlines || []).map(transformDeadline),
      complianceTasks: (r.tasks || []).map(transformTask),
      topics: r.topics || [],  // Already in camelCase from repository
      riskAssessment: r.risk_assessment || null,  // Institutional Risk Score
      
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
      id: r.id,
      regulationId: r.item_id,
      name: r.name,
      topic: r.topic,
      category: r.category,
      slug: r.item_id,
      consoleUrl: `/console/${r.item_id}`,
      jurisdictionSource: r.jurisdiction_source,
      stateCode: r.state_code,
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
      id: r.id,
      regulationId: r.item_id,
      name: r.name,
      topic: r.topic,
      category: r.category,
      slug: r.item_id,
      consoleUrl: `/console/${r.item_id}`,
      jurisdictionSource: r.jurisdiction_source,
      stateCode: r.state_code,
      lastUpdated: r.updated_at,
      version: r.version,
      lovvLevel: r.lovv_level
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

export default router;
