/**
 * MCP Engine Regulation Repository
 * 
 * Data access layer for regulations, deadlines, and tasks.
 * Uses PostgreSQL as the authoritative source of truth.
 */

import { query, getClient } from '../services/database.js';
import crypto from 'crypto';

/**
 * Generate SHA-256 hash for version tracking
 */
function generateVersionHash(reg) {
  const content = [
    reg.name || '',
    reg.statute || '',
    reg.summary || '',
    reg.requirements || '',
    reg.regulation_text || ''
  ].join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

const RegulationRepository = {
  
  /**
   * Get all regulations with optional filtering
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAll(filters = {}) {
    let sql = `
      SELECT 
        r.*,
        (SELECT json_agg(d.* ORDER BY d.id) 
         FROM regulation_deadlines d 
         WHERE d.regulation_id = r.id) as deadlines,
        (SELECT json_agg(t.* ORDER BY t.sort_order, t.id) 
         FROM regulation_tasks t 
         WHERE t.regulation_id = r.id) as tasks,
        (SELECT json_agg(json_build_object(
           'topic', rt.topic,
           'topicId', rt.topic_id,
           'department', rt.department,
           'responsibleRole', rt.responsible_role
         ) ORDER BY rt.topic)
         FROM regulation_topics rt 
         WHERE rt.regulation_id = r.id) as topics,
        (SELECT json_build_object(
           'riskScore', ra.risk_score,
           'riskLevel', ra.risk_level,
           'riskFactors', json_build_object(
             'financialPenalty', ra.financial_penalty,
             'federalFunding', ra.federal_funding,
             'accreditationImpact', ra.accreditation_impact,
             'reputationalLegal', ra.reputational_legal,
             'operationalDisruption', ra.operational_disruption
           ),
           'enforcementTrend', ra.enforcement_trend,
           'recentEnforcementActions', ra.recent_enforcement_actions,
           'assessmentDate', ra.assessment_date,
           'assessmentVersion', ra.assessment_version,
           'isPreliminary', ra.is_preliminary
         )
         FROM risk_assessments ra 
         WHERE ra.regulation_id = r.id) as risk_assessment
      FROM regulations r
      WHERE r.is_current = TRUE
    `;
    const params = [];
    
    if (filters.jurisdiction) {
      params.push(filters.jurisdiction);
      sql += ` AND r.jurisdiction_source = $${params.length}`;
    }
    
    if (filters.state) {
      params.push(filters.state.toUpperCase());
      sql += ` AND r.state_code = $${params.length}`;
    }
    
    if (filters.category) {
      params.push(filters.category);
      sql += ` AND r.category = $${params.length}`;
    }
    
    if (filters.topic) {
      params.push(filters.topic);
      sql += ` AND r.topic = $${params.length}`;
    }
    
    if (filters.lovvLevel) {
      params.push(filters.lovvLevel);
      sql += ` AND r.lovv_level = $${params.length}`;
    }
    
    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (r.name ILIKE $${params.length} OR r.statute ILIKE $${params.length})`;
    }
    
    sql += ' ORDER BY r.name';
    
    if (filters.limit) {
      params.push(parseInt(filters.limit));
      sql += ` LIMIT $${params.length}`;
    }
    
    if (filters.offset) {
      params.push(parseInt(filters.offset));
      sql += ` OFFSET $${params.length}`;
    }
    
    const result = await query(sql, params);
    return result.rows.map(r => ({
      ...r,
      deadlines: r.deadlines || [],
      tasks: r.tasks || [],
      topics: r.topics || [],
      risk_assessment: r.risk_assessment || null
    }));
  },
  
  /**
   * Get single regulation by ID or item_id
   * @param {string|number} id - Regulation ID or item_id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    // First try as item_id (string slug)
    let sql = `
      SELECT 
        r.*,
        (SELECT json_agg(d.* ORDER BY d.id) 
         FROM regulation_deadlines d 
         WHERE d.regulation_id = r.id) as deadlines,
        (SELECT json_agg(t.* ORDER BY t.sort_order, t.id) 
         FROM regulation_tasks t 
         WHERE t.regulation_id = r.id) as tasks,
        (SELECT json_agg(v.* ORDER BY v.version DESC) 
         FROM regulation_versions v 
         WHERE v.regulation_id = r.id) as version_history,
        (SELECT json_agg(json_build_object(
           'topic', rt.topic,
           'topicId', rt.topic_id,
           'department', rt.department,
           'responsibleRole', rt.responsible_role
         ) ORDER BY rt.topic)
         FROM regulation_topics rt 
         WHERE rt.regulation_id = r.id) as topics,
        (SELECT json_build_object(
           'riskScore', ra.risk_score,
           'riskLevel', ra.risk_level,
           'riskFactors', json_build_object(
             'financialPenalty', ra.financial_penalty,
             'federalFunding', ra.federal_funding,
             'accreditationImpact', ra.accreditation_impact,
             'reputationalLegal', ra.reputational_legal,
             'operationalDisruption', ra.operational_disruption
           ),
           'enforcementTrend', ra.enforcement_trend,
           'recentEnforcementActions', ra.recent_enforcement_actions,
           'assessmentDate', ra.assessment_date,
           'assessmentVersion', ra.assessment_version,
           'isPreliminary', ra.is_preliminary
         )
         FROM risk_assessments ra 
         WHERE ra.regulation_id = r.id) as risk_assessment
      FROM regulations r
      WHERE r.item_id = $1 AND r.is_current = TRUE
    `;
    
    let result = await query(sql, [id]);
    
    // If not found, try as numeric ID
    if (result.rows.length === 0 && !isNaN(parseInt(id))) {
      sql = sql.replace('r.item_id = $1 AND r.is_current = TRUE', 'r.id = $1 AND r.is_current = TRUE');
      result = await query(sql, [parseInt(id)]);
    }
    
    // If still not found with is_current filter, try without (for historical lookups)
    if (result.rows.length === 0) {
      sql = sql.replace('AND r.is_current = TRUE', '');
      result = await query(sql, [id]);
    }
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const reg = result.rows[0];
    return {
      ...reg,
      deadlines: reg.deadlines || [],
      tasks: reg.tasks || [],
      version_history: reg.version_history || [],
      topics: reg.topics || [],
      risk_assessment: reg.risk_assessment || null
    };
  },
  
  /**
   * Create or update a regulation
   * @param {Object} regulation - Regulation data
   * @param {string} performedBy - User/system performing the action
   * @returns {Promise<Object>}
   */
  async upsert(regulation, performedBy = 'system') {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const versionHash = generateVersionHash(regulation);
      const itemId = regulation.itemId || regulation.item_id || 
        (regulation.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 100);
      
      // Upsert regulation
      const result = await client.query(`
        INSERT INTO regulations (
          item_id, name, statute, public_law, category, topic,
          jurisdiction_source, state_code,
          summary, requirements, regulation_text, reporting_requirements,
          source_url, agency_name, agency_url,
          effective_date, lovv_level, last_validated, validation_method,
          deadline, deadline_month, deadline_label,
          version_hash, created_by, updated_by,
          content_hash, source_validation, last_workflow_run, workflow_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15,
          $16, $17, NOW(), $18,
          $19, $20, $21,
          $22, $23, $23,
          $24, $25, $26, $27
        )
        ON CONFLICT (item_id) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, regulations.name),
          statute = COALESCE(EXCLUDED.statute, regulations.statute),
          public_law = COALESCE(EXCLUDED.public_law, regulations.public_law),
          category = COALESCE(EXCLUDED.category, regulations.category),
          topic = COALESCE(EXCLUDED.topic, regulations.topic),
          summary = COALESCE(EXCLUDED.summary, regulations.summary),
          requirements = COALESCE(EXCLUDED.requirements, regulations.requirements),
          regulation_text = COALESCE(EXCLUDED.regulation_text, regulations.regulation_text),
          reporting_requirements = COALESCE(EXCLUDED.reporting_requirements, regulations.reporting_requirements),
          source_url = COALESCE(EXCLUDED.source_url, regulations.source_url),
          agency_name = COALESCE(EXCLUDED.agency_name, regulations.agency_name),
          agency_url = COALESCE(EXCLUDED.agency_url, regulations.agency_url),
          effective_date = COALESCE(EXCLUDED.effective_date, regulations.effective_date),
          lovv_level = COALESCE(EXCLUDED.lovv_level, regulations.lovv_level),
          last_validated = NOW(),
          validation_method = COALESCE(EXCLUDED.validation_method, regulations.validation_method),
          deadline = COALESCE(EXCLUDED.deadline, regulations.deadline),
          deadline_month = COALESCE(EXCLUDED.deadline_month, regulations.deadline_month),
          deadline_label = COALESCE(EXCLUDED.deadline_label, regulations.deadline_label),
          version_hash = EXCLUDED.version_hash,
          updated_by = EXCLUDED.updated_by,
          content_hash = COALESCE(EXCLUDED.content_hash, regulations.content_hash),
          source_validation = COALESCE(EXCLUDED.source_validation, regulations.source_validation),
          last_workflow_run = COALESCE(EXCLUDED.last_workflow_run, regulations.last_workflow_run),
          workflow_id = COALESCE(EXCLUDED.workflow_id, regulations.workflow_id),
          version = regulations.version + 1
        RETURNING id, item_id, version, (xmax = 0) as was_inserted
      `, [
        itemId,
        regulation.name,
        regulation.statute,
        regulation.publicLaw || regulation.public_law,
        regulation.category || 'Uncategorized',
        regulation.topic || regulation.category || 'General',
        regulation.jurisdictionSource || regulation.jurisdiction_source || 'federal',
        regulation.stateCode || regulation.state_code,
        regulation.summary,
        regulation.requirements,
        regulation.regulationText || regulation.regulation_text,
        regulation.reportingRequirements || regulation.reporting_requirements,
        regulation.sourceUrl || regulation.source_url,
        regulation.agencyName || regulation.agency_name,
        regulation.agencyUrl || regulation.agency_url,
        regulation.effectiveDate || regulation.effective_date,
        regulation.lovvLevel || regulation.lovv_level,
        regulation.validationMethod || regulation.validation_method,
        regulation.deadline,
        regulation.deadlineMonth || regulation.deadline_month,
        regulation.deadlineLabel || regulation.deadline_label,
        versionHash,
        performedBy,
        regulation.contentHash || regulation.content_hash,
        regulation.sourceValidation || regulation.source_validation,
        regulation.lastWorkflowRun || regulation.last_workflow_run,
        regulation.workflowId || regulation.workflow_id
      ]);
      
      const regId = result.rows[0].id;
      
      // Handle deadlines if provided
      const deadlines = regulation.deadlines || regulation.filingDeadlines;
      if (Array.isArray(deadlines) && deadlines.length > 0) {
        await client.query('DELETE FROM regulation_deadlines WHERE regulation_id = $1', [regId]);
        
        for (const deadline of deadlines) {
          await client.query(`
            INSERT INTO regulation_deadlines (
              regulation_id, name, description, deadline_type,
              due_date, frequency, advance_notice_days
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            regId,
            deadline.name || deadline.type,
            deadline.description,
            deadline.type || deadline.deadline_type,
            deadline.date || deadline.due_date,
            deadline.frequency,
            deadline.advanceNoticeDays || deadline.advance_notice_days || 30
          ]);
        }
      }
      
      // Handle tasks if provided
      const tasks = regulation.tasks || regulation.complianceTasks;
      if (Array.isArray(tasks) && tasks.length > 0) {
        await client.query('DELETE FROM regulation_tasks WHERE regulation_id = $1', [regId]);
        
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          await client.query(`
            INSERT INTO regulation_tasks (
              regulation_id, title, description, category,
              priority, assigned_role, estimated_effort,
              evidence_required, evidence_type, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            regId,
            task.title || task.name,
            task.description,
            task.category,
            task.priority || 'medium',
            task.assignedRole || task.assigned_role,
            task.estimatedEffort || task.estimated_effort,
            task.evidenceRequired || task.evidence_required || false,
            task.evidenceType || task.evidence_type,
            task.sortOrder || task.sort_order || i
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      return {
        id: regId,
        itemId: result.rows[0].item_id,
        version: result.rows[0].version,
        wasInserted: result.rows[0].was_inserted
      };
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  
  /**
   * Delete a regulation
   * @param {string|number} id - Regulation ID or item_id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await query(
      'DELETE FROM regulations WHERE item_id = $1 OR id = $1::integer RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  },
  
  /**
   * Get statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN jurisdiction_source = 'federal' THEN 1 END) as federal,
        COUNT(CASE WHEN jurisdiction_source = 'state' THEN 1 END) as state,
        COUNT(CASE WHEN state_code = 'PA' THEN 1 END) as pennsylvania,
        COUNT(CASE WHEN state_code = 'NJ' THEN 1 END) as new_jersey,
        COUNT(CASE WHEN lovv_level = 'A' THEN 1 END) as lovv_a,
        COUNT(CASE WHEN lovv_level = 'B' THEN 1 END) as lovv_b,
        COUNT(CASE WHEN lovv_level = 'C' THEN 1 END) as lovv_c,
        COUNT(CASE WHEN lovv_level = 'D' THEN 1 END) as lovv_d,
        COUNT(CASE WHEN statute IS NOT NULL THEN 1 END) as with_statute,
        (SELECT COUNT(*) FROM regulation_deadlines) as total_deadlines,
        (SELECT COUNT(*) FROM regulation_tasks) as total_tasks,
        (SELECT COUNT(*) FROM regulation_audit_log) as audit_entries
      FROM regulations
      WHERE is_current = TRUE
    `);
    
    return result.rows[0];
  },
  
  /**
   * Get audit log for a regulation
   * @param {number} regulationId - Regulation ID
   * @param {number} limit - Max entries to return
   * @returns {Promise<Array>}
   */
  async getAuditLog(regulationId, limit = 50) {
    const result = await query(`
      SELECT * FROM regulation_audit_log
      WHERE regulation_id = $1
      ORDER BY performed_at DESC
      LIMIT $2
    `, [regulationId, limit]);
    
    return result.rows;
  },
  
  /**
   * Log a transmission to EdSteward
   * @param {Object} data - Transmission data
   * @returns {Promise<Object>}
   */
  async logTransmission(data) {
    const result = await query(`
      INSERT INTO transmission_log (
        regulation_id, regulation_count, deadline_count, task_count,
        payload, payload_hash, status, destination
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, transmission_id
    `, [
      data.regulationId,
      data.regulationCount || 1,
      data.deadlineCount || 0,
      data.taskCount || 0,
      data.payload ? JSON.stringify(data.payload) : null,
      data.payloadHash,
      data.status || 'pending',
      data.destination || 'edsteward'
    ]);
    
    return result.rows[0];
  },
  
  /**
   * Update transmission status
   * @param {string} transmissionId - Transmission UUID
   * @param {string} status - New status
   * @param {Object} responseData - Response data
   * @param {string} errorMessage - Error message if failed
   */
  async updateTransmissionStatus(transmissionId, status, responseData = null, errorMessage = null) {
    await query(`
      UPDATE transmission_log SET
        status = $2,
        response_data = $3,
        error_message = $4,
        acknowledged_at = CASE WHEN $2 = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
        retry_count = CASE WHEN $2 = 'failed' THEN retry_count + 1 ELSE retry_count END
      WHERE transmission_id = $1
    `, [transmissionId, status, responseData ? JSON.stringify(responseData) : null, errorMessage]);
  },
  
  /**
   * Get transmission history for a regulation
   * @param {number} regulationId - Regulation ID
   * @param {number} limit - Max entries
   * @returns {Promise<Array>}
   */
  async getTransmissionHistory(regulationId, limit = 20) {
    const result = await query(`
      SELECT * FROM transmission_log
      WHERE regulation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [regulationId, limit]);
    
    return result.rows;
  },
  
  /**
   * Search regulations with full-text search
   * @param {string} searchTerm - Search term
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async search(searchTerm, limit = 50) {
    const result = await query(`
      SELECT 
        r.*,
        ts_rank(to_tsvector('english', r.name), plainto_tsquery('english', $1)) as rank
      FROM regulations r
      WHERE 
        to_tsvector('english', r.name) @@ plainto_tsquery('english', $1)
        OR r.name ILIKE $2
        OR r.statute ILIKE $2
      ORDER BY rank DESC, r.name
      LIMIT $3
    `, [searchTerm, `%${searchTerm}%`, limit]);
    
    return result.rows;
  }
};

export default RegulationRepository;
