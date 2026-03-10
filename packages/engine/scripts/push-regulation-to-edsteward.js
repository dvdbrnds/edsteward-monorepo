/**
 * Push Single Regulation to EdSteward
 * Usage: node push-regulation-to-edsteward.js REG-001
 * 
 * Sends a regulation with all its tasks (requirements + best practices) to EdSteward
 */

import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;

// Configuration
const EDSTEWARD_URL = process.env.EDSTEWARD_URL || 'https://moravian.edsteward.ai';
const EDSTEWARD_USER = process.env.EDSTEWARD_USER || 'dvdbrnds';
const EDSTEWARD_PASS = process.env.EDSTEWARD_PASSWORD || process.env.EDSTEWARD_PASS;
const EDSTEWARD_AUTH = Buffer.from(`${EDSTEWARD_USER}:${EDSTEWARD_PASS}`).toString('base64');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mcp_engine',
  user: process.env.PGUSER || process.env.USER,
});

// EdSteward ID mapping for known regulations
const EDSTEWARD_ID_MAP = {
  'REG-001': 355,  // Clery Act
  'REG-002': 7,    // Title IX
  'REG-004': 223,  // FERPA
  'REG-015': 2,    // ADA
  'REG-018': 6,    // Section 504
  'REG-008': 8,    // Title VI
  'REG-020': 76,   // HIPAA
  'REG-023': 67,   // Drug Free Schools
  // Add more as needed
};

async function getRegulationFromDB(regKey) {
  const client = await pool.connect();
  try {
    // Get regulation
    const regResult = await client.query(`
      SELECT id, reg_key, name, statute, cfr, summary, effective_date
      FROM regulations 
      WHERE reg_key = $1 AND is_current = true
    `, [regKey]);
    
    if (regResult.rows.length === 0) {
      throw new Error(`Regulation ${regKey} not found`);
    }
    
    const regulation = regResult.rows[0];
    
    // Get tasks
    const tasksResult = await client.query(`
      SELECT task_id, title, description, priority, requirement_type, sort_order
      FROM regulation_tasks 
      WHERE regulation_id = $1
      ORDER BY sort_order
    `, [regulation.id]);
    
    // Get deadlines
    const deadlinesResult = await client.query(`
      SELECT deadline_id, name, description, frequency, recurring_month, recurring_day, reporting_to
      FROM regulation_deadlines 
      WHERE regulation_id = $1
    `, [regulation.id]);
    
    return {
      regulation,
      tasks: tasksResult.rows,
      deadlines: deadlinesResult.rows
    };
  } finally {
    client.release();
  }
}

function formatForEdSteward(regKey, data) {
  const { regulation, tasks, deadlines } = data;
  
  // Format compliance tasks
  const complianceTasks = tasks.map(task => ({
    taskId: task.task_id,
    title: task.title,
    description: task.description || task.title,
    priority: task.priority || 'medium',
    requirementType: task.requirement_type || 'requirement',
    sortOrder: task.sort_order || 0
  }));
  
  // Format deadlines
  const formattedDeadlines = deadlines.map(d => ({
    deadlineId: d.deadline_id,
    name: d.name,
    description: d.description,
    frequency: d.frequency,
    recurringMonth: d.recurring_month,
    recurringDay: d.recurring_day,
    reportingTo: d.reporting_to
  }));
  
  // Build payload
  return {
    regulationId: EDSTEWARD_ID_MAP[regKey] || null,
    mcpRegKey: regKey,
    name: regulation.name,
    statute: regulation.statute,
    cfr: regulation.cfr,
    summary: regulation.summary || `Compliance requirements for ${regulation.name}`,
    effectiveDate: regulation.effective_date,
    complianceTasks,
    deadlines: formattedDeadlines,
    taskStats: {
      total: tasks.length,
      requirements: tasks.filter(t => t.requirement_type === 'requirement').length,
      bestPractices: tasks.filter(t => t.requirement_type === 'best_practice').length
    },
    source: 'mcp-engine',
    syncTimestamp: new Date().toISOString()
  };
}

async function sendToEdSteward(payload) {
  console.log(`\n📤 Sending to EdSteward...`);
  console.log(`   URL: ${EDSTEWARD_URL}/api/regulation-updates`);
  console.log(`   Regulation: ${payload.name}`);
  console.log(`   Tasks: ${payload.taskStats.total} (${payload.taskStats.requirements} req, ${payload.taskStats.bestPractices} best)`);
  
  try {
    const response = await fetch(`${EDSTEWARD_URL}/api/regulation-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${EDSTEWARD_AUTH}`,
        'X-MCP-Source': 'mcp-engine',
        'X-Sync-Type': 'gold-certified'
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      return { success: true, status: response.status, result };
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log(`   Response: ${responseText.substring(0, 200)}`);
      return { success: false, status: response.status, error: responseText };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const regKey = process.argv[2];
  
  if (!regKey) {
    console.log('Usage: node push-regulation-to-edsteward.js REG-001');
    console.log('\nAvailable gold-certified regulations:');
    console.log('  REG-001 (Clery Act)');
    console.log('  REG-002 (Title IX)');
    console.log('  REG-004 (FERPA)');
    console.log('  REG-015 (ADA)');
    console.log('  REG-020 (HIPAA)');
    console.log('  ... and 236 more');
    process.exit(1);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║     PUSH REGULATION TO EDSTEWARD                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📋 Regulation: ${regKey}`);
  
  try {
    // Step 1: Get from database
    console.log('\n📥 Step 1: Fetching from MCP Engine database...');
    const data = await getRegulationFromDB(regKey);
    console.log(`   Found: ${data.regulation.name}`);
    console.log(`   Tasks: ${data.tasks.length}`);
    console.log(`   Deadlines: ${data.deadlines.length}`);
    
    // Step 2: Format for EdSteward
    console.log('\n🔄 Step 2: Formatting for EdSteward...');
    const payload = formatForEdSteward(regKey, data);
    
    // Show task breakdown
    console.log(`   Requirements: ${payload.taskStats.requirements}`);
    console.log(`   Best Practices: ${payload.taskStats.bestPractices}`);
    
    // Step 3: Send to EdSteward
    console.log('\n📤 Step 3: Sending to EdSteward...');
    const result = await sendToEdSteward(payload);
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    if (result.success) {
      console.log(`✅ ${regKey} successfully pushed to EdSteward`);
    } else {
      console.log(`❌ ${regKey} failed to push to EdSteward`);
    }
    console.log('═'.repeat(70));
    
    // Save payload for reference
    const fs = await import('fs');
    const outputFile = `edsteward-payload-${regKey}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));
    console.log(`\n📄 Payload saved to: ${outputFile}`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
