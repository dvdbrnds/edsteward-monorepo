/**
 * MCP ENGINE → EDSTEWARD ALIGNMENT SCRIPT
 * 
 * Synchronizes all regulations, topics, deadlines, and tasks from MCP Engine
 * PostgreSQL database to EdSteward's compliance management system.
 * 
 * Prerequisites:
 * - MCP Engine PostgreSQL database must be running with enriched data
 * - EdSteward must be running and accessible
 * 
 * Usage:
 *   node scripts/execute-alignment.cjs
 * 
 * Environment Variables:
 *   MCP_DB_HOST       - MCP Engine database host (default: localhost)
 *   MCP_DB_PORT       - MCP Engine database port (default: 5432)
 *   MCP_DB_NAME       - MCP Engine database name (default: mcp_engine)
 *   MCP_DB_USER       - MCP Engine database user (default: current user)
 *   MCP_DB_PASSWORD   - MCP Engine database password (default: empty)
 *   EDSTEWARD_URL     - EdSteward API URL (default: http://localhost:5000)
 *   EDSTEWARD_USER    - EdSteward username (default: dvdbrnds)
 *   EDSTEWARD_PASS    - EdSteward password (default: gabadh)
 */

const { Pool } = require('pg');

// MCP Engine database
const mcpPool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

// EdSteward configuration
const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'http://localhost:5000';
const EDSTEWARD_USER = process.env.EDSTEWARD_USER || 'dvdbrnds';
const EDSTEWARD_PASS = process.env.EDSTEWARD_PASS || 'gabadh';
const EDSTEWARD_AUTH = Buffer.from(`${EDSTEWARD_USER}:${EDSTEWARD_PASS}`).toString('base64');

// Rate limiting configuration  
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '100');  // Max requests per window
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '900000');  // 15 minutes
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '500');  // Delay between requests

// Dry run mode (test without sending to EdSteward)
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Fetch all regulations with related data from MCP Engine
 */
async function getAllRegulations() {
  console.log('Fetching all regulations from MCP Engine database...');
  
  const result = await mcpPool.query(`
    SELECT 
      r.*,
      (SELECT json_agg(json_build_object(
        'topic', rt.topic,
        'topicId', rt.topic_id,
        'department', rt.department,
        'responsibleRole', rt.responsible_role
      ) ORDER BY rt.topic)
      FROM regulation_topics rt 
      WHERE rt.regulation_id = r.id) as topics,
      (SELECT json_agg(json_build_object(
        'id', d.id,
        'name', d.name,
        'description', d.description,
        'deadlineType', d.deadline_type,
        'dueDate', d.due_date,
        'frequency', d.frequency,
        'recurringMonth', d.recurring_month,
        'recurringDay', d.recurring_day,
        'advanceNoticeDays', d.advance_notice_days,
        'penaltyForMissing', d.penalty_for_missing,
        'reportingTo', d.reporting_to
      ) ORDER BY d.id)
      FROM regulation_deadlines d 
      WHERE d.regulation_id = r.id) as deadlines,
      (SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'category', t.category,
        'topic', t.topic,
        'priority', t.priority,
        'assignedRole', t.assigned_role,
        'estimatedEffort', t.estimated_effort,
        'evidenceRequired', t.evidence_required,
        'evidenceType', t.evidence_type,
        'sortOrder', t.sort_order
      ) ORDER BY t.sort_order, t.id)
      FROM regulation_tasks t 
      WHERE t.regulation_id = r.id) as tasks,
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
        'isPreliminary', ra.is_preliminary,
        'dataSources', ra.data_sources
      )
      FROM risk_assessments ra 
      WHERE ra.regulation_id = r.id) as risk_assessment
    FROM regulations r
    WHERE r.is_current = TRUE
    ORDER BY r.name
  `);
  
  console.log(`Found ${result.rows.length} regulations`);
  return result.rows;
}

/**
 * Transform MCP Engine regulation format to EdSteward expected format
 */
function transformForEdSteward(reg) {
  return {
    // Core identification
    regulationId: reg.item_id,
    name: reg.name,
    statute: reg.statute,
    category: reg.category,
    topic: reg.topic,
    
    // Jurisdiction
    jurisdictionSource: reg.jurisdiction_source,
    stateCode: reg.state_code,
    
    // Content
    summary: reg.summary,
    requirements: reg.requirements,
    regulationText: reg.regulation_text,
    reportingRequirements: reg.reporting_requirements,
    
    // Validation (L.O.V.V.)
    lovvLevel: reg.lovv_level,
    lastValidated: reg.last_validated,
    validationMethod: reg.validation_method,
    version: reg.version,
    versionHash: reg.version_hash,
    
    // Source
    sourceUrl: reg.source_url,
    agencyName: reg.agency_name,
    agencyUrl: reg.agency_url,
    effectiveDate: reg.effective_date,
    
    // Topic mappings (department responsibility - many-to-many)
    topics: reg.topics || [],
    
    // Institutional Risk Assessment
    riskAssessment: reg.risk_assessment || null,
    
    // Deadlines
    filingDeadlines: (reg.deadlines || []).map(d => ({
      type: d.name || d.deadlineType,
      deadlineType: d.deadlineType,
      date: d.dueDate,
      frequency: d.frequency,
      recurringMonth: d.recurringMonth,
      recurringDay: d.recurringDay,
      description: d.description,
      advanceNoticeDays: d.advanceNoticeDays || 30,
      penaltyForMissing: d.penaltyForMissing,
      reportingTo: d.reportingTo
    })),
    
    // Compliance Tasks
    complianceTasks: (reg.tasks || []).map((t, idx) => ({
      tempId: `task-${reg.item_id}-${idx}`,
      title: t.title,
      description: t.description,
      category: t.category,
      topic: t.topic,  // Department/area this task belongs to
      assignedRole: t.assignedRole,
      priority: t.priority || 'medium',
      evidenceRequired: t.evidenceRequired || false,
      evidenceType: t.evidenceType,
      estimatedEffort: t.estimatedEffort,
      sortOrder: t.sortOrder || idx
    })),
    
    // Metadata
    createdAt: reg.created_at,
    updatedAt: reg.updated_at
  };
}

/**
 * Send a regulation to EdSteward (with rate limit handling)
 * Uses /api/mcp/regulations/sync for UPSERT behavior (create OR update)
 */
async function sendToEdSteward(regulation, retryCount = 0) {
  if (DRY_RUN) {
    // In dry-run mode, simulate success
    return { success: true, dryRun: true, regulationId: regulation.regulationId };
  }
  
  const response = await fetch(`${EDSTEWARD_URL}/api/mcp/regulations/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${EDSTEWARD_AUTH}`,
      'X-Source': 'MCP-Engine',
      'X-Alignment-Version': '1.0'
    },
    body: JSON.stringify(regulation)
  });
  
  let result;
  const responseText = await response.text();
  
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    result = { error: responseText || `HTTP ${response.status}` };
  }
  
  // Handle rate limiting with exponential backoff
  if (response.status === 429 && retryCount < 3) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    const waitTime = Math.min(retryAfter * 1000, 60000); // Cap at 60 seconds
    console.log(`  ⏳ Rate limited, waiting ${waitTime/1000}s before retry...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return sendToEdSteward(regulation, retryCount + 1);
  }
  
  if (!response.ok) {
    // Capture detailed validation errors
    const errorMsg = result.error || result.message || result.details || 
                     (result.errors ? JSON.stringify(result.errors) : null) ||
                     `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return result;
}

/**
 * Log a transmission to MCP Engine's transmission_log table
 */
async function logTransmission(reg, status, responseData = null, errorMessage = null) {
  try {
    await mcpPool.query(`
      INSERT INTO transmission_log (
        regulation_id, regulation_count, deadline_count, task_count,
        payload_hash, status, destination, error_message, response_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      reg.id,
      1,
      (reg.deadlines || []).length,
      (reg.tasks || []).length,
      reg.version_hash,
      status,
      'edsteward',
      errorMessage,
      responseData ? JSON.stringify(responseData) : null
    ]);
  } catch (err) {
    // Don't fail alignment if logging fails
    console.warn(`Warning: Could not log transmission for ${reg.name}: ${err.message}`);
  }
}

/**
 * Main alignment execution
 */
async function executeAlignment() {
  console.log('═'.repeat(70));
  console.log('    MCP ENGINE → EDSTEWARD ALIGNMENT');
  console.log('═'.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`EdSteward URL: ${EDSTEWARD_URL}`);
  console.log(`Request delay: ${REQUEST_DELAY_MS}ms`);
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️  DRY RUN MODE - No data will be sent to EdSteward');
  }
  console.log('');
  
  // Test EdSteward connection first
  console.log('Testing EdSteward connection...');
  try {
    const healthResponse = await fetch(`${EDSTEWARD_URL}/api/health`, {
      headers: { 'Authorization': `Basic ${EDSTEWARD_AUTH}` }
    });
    if (!healthResponse.ok) {
      throw new Error(`EdSteward health check failed: ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log(`✅ EdSteward is reachable (status: ${healthData.status || 'ok'})\n`);
  } catch (err) {
    console.error(`❌ Cannot reach EdSteward: ${err.message}`);
    console.error('Make sure EdSteward is running and EDSTEWARD_URL is correct');
    console.error(`Tried URL: ${EDSTEWARD_URL}/api/health`);
    await mcpPool.end();
    process.exit(1);
  }
  
  // Get all regulations from MCP Engine
  const regulations = await getAllRegulations();
  
  // Pre-alignment statistics
  console.log('\n─'.repeat(70));
  console.log('PRE-ALIGNMENT MCP ENGINE STATISTICS');
  console.log('─'.repeat(70));
  
  const stats = await mcpPool.query(`
    SELECT 
      COUNT(DISTINCT r.id) as regulations,
      COUNT(DISTINCT rt.id) as topic_mappings,
      COUNT(DISTINCT rd.id) as deadlines,
      COUNT(DISTINCT t.id) as tasks,
      COUNT(DISTINCT CASE WHEN r.lovv_level = 'A' THEN r.id END) as lovv_a,
      COUNT(DISTINCT CASE WHEN r.lovv_level = 'B' THEN r.id END) as lovv_b,
      COUNT(DISTINCT CASE WHEN r.lovv_level = 'C' THEN r.id END) as lovv_c,
      COUNT(DISTINCT CASE WHEN r.lovv_level = 'D' THEN r.id END) as lovv_d
    FROM regulations r
    LEFT JOIN regulation_topics rt ON rt.regulation_id = r.id
    LEFT JOIN regulation_deadlines rd ON rd.regulation_id = r.id
    LEFT JOIN regulation_tasks t ON t.regulation_id = r.id
    WHERE r.is_current = TRUE
  `);
  
  console.log(`  Regulations: ${stats.rows[0].regulations}`);
  console.log(`  Topic mappings: ${stats.rows[0].topic_mappings}`);
  console.log(`  Deadlines: ${stats.rows[0].deadlines}`);
  console.log(`  Tasks: ${stats.rows[0].tasks}`);
  console.log(`  L.O.V.V. Levels: A=${stats.rows[0].lovv_a}, B=${stats.rows[0].lovv_b}, C=${stats.rows[0].lovv_c}, D=${stats.rows[0].lovv_d}`);
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Starting alignment of ${regulations.length} regulations...`);
  console.log('─'.repeat(70) + '\n');
  
  let success = 0;
  let failed = 0;
  let errors = [];
  const startTime = Date.now();
  
  for (let i = 0; i < regulations.length; i++) {
    const reg = regulations[i];
    const payload = transformForEdSteward(reg);
    
    try {
      const result = await sendToEdSteward(payload);
      success++;
      
      // Log successful transmission (skip in dry run)
      if (!DRY_RUN) {
        await logTransmission(reg, 'sent', result);
      }
      
      // Progress indicator every 25 regulations or at the end
      if ((i + 1) % 25 === 0 || i === regulations.length - 1) {
        const pct = Math.round(((i + 1) / regulations.length) * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Progress: ${i + 1}/${regulations.length} (${pct}%) - ${success} success, ${failed} failed [${elapsed}s]`);
      }
      
    } catch (err) {
      failed++;
      errors.push({
        name: reg.name,
        itemId: reg.item_id,
        error: err.message
      });
      
      // Log failed transmission (skip in dry run)
      if (!DRY_RUN) {
        await logTransmission(reg, 'failed', null, err.message);
      }
      
      // Log failures immediately
      console.error(`  ❌ Failed: ${reg.name.substring(0, 50)}... - ${err.message}`);
    }
    
    // Delay between requests to avoid rate limiting
    if (i < regulations.length - 1 && !DRY_RUN) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('    ALIGNMENT COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log(`Total time: ${totalTime} seconds`);
  console.log('');
  console.log(`Total regulations: ${regulations.length}`);
  console.log(`Successful: ${success} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success rate: ${((success / regulations.length) * 100).toFixed(1)}%`);
  
  if (errors.length > 0) {
    console.log('\n─'.repeat(70));
    console.log('ERRORS');
    console.log('─'.repeat(70));
    errors.slice(0, 20).forEach(e => {
      console.log(`  ${e.name.substring(0, 50)}`);
      console.log(`    ID: ${e.itemId}`);
      console.log(`    Error: ${e.error}`);
    });
    if (errors.length > 20) {
      console.log(`  ... and ${errors.length - 20} more errors`);
    }
  }
  
  // Data summary
  console.log('\n─'.repeat(70));
  console.log('DATA TRANSFERRED TO EDSTEWARD');
  console.log('─'.repeat(70));
  
  let totalDeadlines = 0;
  let totalTasks = 0;
  let totalTopics = 0;
  
  regulations.forEach(r => {
    totalDeadlines += (r.deadlines || []).length;
    totalTasks += (r.tasks || []).length;
    totalTopics += (r.topics || []).length;
  });
  
  console.log(`  Regulations: ${success}`);
  console.log(`  Topic mappings: ${totalTopics}`);
  console.log(`  Deadlines: ${totalDeadlines}`);
  console.log(`  Tasks: ${totalTasks}`);
  
  console.log('\n' + '═'.repeat(70));
  
  await mcpPool.end();
  
  // Return exit code based on success
  process.exit(failed > 0 ? 1 : 0);
}

// Run alignment
executeAlignment().catch(err => {
  console.error('Alignment failed:', err);
  process.exit(1);
});
