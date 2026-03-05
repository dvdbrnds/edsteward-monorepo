#!/usr/bin/env node
/**
 * Tenant Provisioning Script
 * 
 * Bulk syncs ALL regulations to a new tenant's EdSteward instance.
 * Uses direct sync (bypasses approval workflow) for initial setup.
 * 
 * Usage:
 *   node scripts/provision-tenant.js --customer=moravian-dev
 *   node scripts/provision-tenant.js --customer=moravian-prod --dry-run
 *   node scripts/provision-tenant.js --url=http://newclient.edsteward.ai --auth=user:pass
 */

import pg from 'pg';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

// Configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mcp_engine',
  user: process.env.PGUSER || process.env.USER,
});

// Load customer config
const customersPath = path.join(__dirname, '..', 'config', 'customers.json');
const customersConfig = JSON.parse(fs.readFileSync(customersPath, 'utf8'));

function normalizePriority(priority) {
  if (!priority) return 'medium';
  const p = priority.toLowerCase();
  if (p === 'critical' || p === 'urgent') return 'high';
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

// Normalize assigned roles to EdSteward's standard role names
// EdSteward standard roles: Registrar, Title IX Coordinator, Campus Police Chief,
// Dean of Students, HR Director, Financial Aid Director, VP Academic Affairs,
// VP Student Affairs, IT Security Officer, Legal Counsel, Disability Services, Athletic Director
function normalizeRole(role) {
  if (!role) return null;
  
  const roleMapping = {
    'general counsel': 'Legal Counsel',
    'legal': 'Legal Counsel',
    'university counsel': 'Legal Counsel',
    'campus safety director': 'Campus Police Chief',
    'campus police/security': 'Campus Police Chief',
    'campus safety': 'Campus Police Chief',
    'security director': 'Campus Police Chief',
    'public safety director': 'Campus Police Chief',
    'academic affairs': 'VP Academic Affairs',
    'provost': 'VP Academic Affairs',
    'chief academic officer': 'VP Academic Affairs',
    'student affairs': 'VP Student Affairs',
    'chief student affairs officer': 'VP Student Affairs',
    'it director': 'IT Security Officer',
    'ciso': 'IT Security Officer',
    'chief information security officer': 'IT Security Officer',
    'information security': 'IT Security Officer',
    'disability services director': 'Disability Services',
    'ada coordinator': 'Disability Services',
    'accessibility coordinator': 'Disability Services',
    'human resources': 'HR Director',
    'hr': 'HR Director',
    'hr/training': 'HR Director',
    'hr/title ix': 'HR Director',
    'athletics director': 'Athletic Director',
    'athletics': 'Athletic Director'
  };
  
  const normalized = role.toLowerCase().trim();
  return roleMapping[normalized] || role;
}

async function getCustomerConfig(customerId) {
  const customer = customersConfig.customers.find(c => c.id === customerId);
  if (!customer) {
    throw new Error(`Customer "${customerId}" not found in config/customers.json`);
  }
  return customer;
}

async function getAllRegulations() {
  const result = await pool.query(`
    SELECT 
      r.id, r.reg_key, r.name, r.item_id, r.statute, r.cfr, 
      r.category, r.topic, r.summary, r.effective_date,
      r.jurisdiction_source
    FROM regulations r
    WHERE r.is_current = true AND r.reg_key IS NOT NULL
    ORDER BY r.reg_key
  `);
  return result.rows;
}

async function getRegulationTasks(regulationId) {
  const result = await pool.query(`
    SELECT 
      id, task_id, title, description, category, priority,
      requirement_type, assigned_role, evidence_required, 
      evidence_type, sort_order, parent_task_id
    FROM regulation_tasks
    WHERE regulation_id = $1
    ORDER BY sort_order, id
  `, [regulationId]);
  return result.rows;
}

async function getRegulationDeadlines(regulationId) {
  const result = await pool.query(`
    SELECT 
      deadline_id, name, description, frequency, 
      recurring_month, recurring_day
    FROM regulation_deadlines
    WHERE regulation_id = $1
  `, [regulationId]);
  return result.rows;
}

function buildHierarchicalTasks(tasks) {
  const taskMap = new Map();
  const hierarchicalTasks = [];
  
  // First pass: create tempId mapping
  for (const task of tasks) {
    const tempId = `task-${task.id}`;
    taskMap.set(task.id, tempId);
  }
  
  // Second pass: build hierarchical structure
  const parentTasks = tasks.filter(t => !t.parent_task_id);
  const childTasks = tasks.filter(t => t.parent_task_id);
  
  // Add parent tasks first
  for (const task of parentTasks) {
    hierarchicalTasks.push({
      tempId: taskMap.get(task.id),
      taskId: task.task_id || taskMap.get(task.id),
      title: task.title,
      description: task.description || '',
      category: task.category || '',
      priority: normalizePriority(task.priority),
      requirementType: task.requirement_type || 'requirement',
      assignedRole: normalizeRole(task.assigned_role) || '',
      evidenceRequired: task.evidence_required || false,
      evidenceType: task.evidence_type || 'document',
      sortOrder: task.sort_order || 0
    });
  }
  
  // Add child tasks with parentTempId
  for (const task of childTasks) {
    const parentTempId = taskMap.get(task.parent_task_id);
    hierarchicalTasks.push({
      tempId: taskMap.get(task.id),
      taskId: task.task_id || taskMap.get(task.id),
      parentTempId: parentTempId,
      title: task.title,
      description: task.description || '',
      category: task.category || '',
      priority: normalizePriority(task.priority),
      requirementType: task.requirement_type || 'requirement',
      assignedRole: normalizeRole(task.assigned_role) || '',
      evidenceRequired: task.evidence_required || false,
      evidenceType: task.evidence_type || 'document',
      sortOrder: task.sort_order || 0
    });
  }
  
  return hierarchicalTasks;
}

async function syncRegulationToTenant(regulation, tasks, deadlines, customer, dryRun = false) {
  const hierarchicalTasks = buildHierarchicalTasks(tasks);
  
  const payload = {
    mcpRegKey: regulation.reg_key,
    regKey: regulation.reg_key,
    itemId: regulation.item_id,
    name: regulation.name,
    statute: regulation.statute || 'See CFR',
    cfr: regulation.cfr || '',
    category: regulation.category || 'Uncategorized',
    topic: regulation.topic || 'General',
    jurisdictionSource: regulation.jurisdiction_source || 'federal',
    summary: regulation.summary || '',
    effectiveDate: regulation.effective_date,
    complianceTasks: hierarchicalTasks,
    deadlines: deadlines.map(d => ({
      name: d.name,
      description: d.description,
      frequency: d.frequency,
      recurringMonth: d.recurring_month,
      recurringDay: d.recurring_day
    })),
    metadata: {
      source: 'MCP_ENGINE_PROVISION',
      timestamp: new Date().toISOString(),
      provisionType: 'bulk-sync'
    }
  };
  
  if (dryRun) {
    return { 
      success: true, 
      dryRun: true, 
      taskCount: hierarchicalTasks.length,
      deadlineCount: deadlines.length
    };
  }
  
  // Use direct sync endpoint for provisioning
  const syncUrl = `${customer.url}/api/mcp/regulations/sync`;
  
  const headers = { 'Content-Type': 'application/json' };
  if (customer.auth?.method === 'basic') {
    const authString = Buffer.from(`${customer.auth.username}:${customer.auth.password}`).toString('base64');
    headers['Authorization'] = `Basic ${authString}`;
  }
  
  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    return {
      success: response.ok,
      statusCode: response.status,
      taskCount: hierarchicalTasks.length,
      deadlineCount: deadlines.length,
      response: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      taskCount: hierarchicalTasks.length,
      deadlineCount: deadlines.length
    };
  }
}

async function provisionTenant(customerId, options = {}) {
  const { dryRun = false, limit = null, startFrom = null } = options;
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          MCP ENGINE - TENANT PROVISIONING                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  
  // Get customer config
  let customer;
  if (customerId) {
    customer = await getCustomerConfig(customerId);
    console.log(`📍 Target: ${customer.name} (${customer.url})`);
  } else if (args.url) {
    customer = {
      name: 'Custom URL',
      url: args.url,
      auth: args.auth ? {
        method: 'basic',
        username: args.auth.split(':')[0],
        password: args.auth.split(':')[1]
      } : null
    };
    console.log(`📍 Target: ${args.url}`);
  } else {
    throw new Error('Must specify --customer=<id> or --url=<url>');
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  console.log();
  
  // Get all regulations
  let regulations = await getAllRegulations();
  console.log(`📋 Found ${regulations.length} regulations to sync`);
  
  // Apply filters
  if (startFrom) {
    const startIdx = regulations.findIndex(r => r.reg_key === startFrom);
    if (startIdx >= 0) {
      regulations = regulations.slice(startIdx);
      console.log(`   Starting from ${startFrom} (${regulations.length} remaining)`);
    }
  }
  
  if (limit) {
    regulations = regulations.slice(0, parseInt(limit));
    console.log(`   Limited to ${limit} regulations`);
  }
  
  console.log();
  console.log('Starting sync...');
  console.log('─'.repeat(60));
  
  const results = {
    total: regulations.length,
    success: 0,
    failed: 0,
    totalTasks: 0,
    totalDeadlines: 0,
    errors: []
  };
  
  for (let i = 0; i < regulations.length; i++) {
    const reg = regulations[i];
    const progress = `[${i + 1}/${regulations.length}]`;
    
    try {
      const tasks = await getRegulationTasks(reg.id);
      const deadlines = await getRegulationDeadlines(reg.id);
      
      const result = await syncRegulationToTenant(reg, tasks, deadlines, customer, dryRun);
      
      if (result.success) {
        results.success++;
        results.totalTasks += result.taskCount;
        results.totalDeadlines += result.deadlineCount;
        console.log(`✅ ${progress} ${reg.reg_key}: ${reg.name.substring(0, 40)}... (${result.taskCount} tasks)`);
      } else {
        results.failed++;
        results.errors.push({ regKey: reg.reg_key, error: result.error || result.response?.error });
        console.log(`❌ ${progress} ${reg.reg_key}: ${result.error || result.response?.error}`);
      }
      
      // Rate limiting - small delay between requests
      if (!dryRun && i < regulations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push({ regKey: reg.reg_key, error: error.message });
      console.log(`❌ ${progress} ${reg.reg_key}: ${error.message}`);
    }
  }
  
  console.log();
  console.log('═'.repeat(60));
  console.log('PROVISIONING COMPLETE');
  console.log('═'.repeat(60));
  console.log(`✅ Success: ${results.success}/${results.total}`);
  console.log(`❌ Failed:  ${results.failed}/${results.total}`);
  console.log(`📋 Tasks:   ${results.totalTasks}`);
  console.log(`📅 Deadlines: ${results.totalDeadlines}`);
  
  if (results.errors.length > 0) {
    console.log();
    console.log('Errors:');
    for (const err of results.errors.slice(0, 10)) {
      console.log(`  - ${err.regKey}: ${err.error}`);
    }
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`);
    }
  }
  
  return results;
}

// Main execution
async function main() {
  try {
    if (args.help) {
      console.log(`
Tenant Provisioning Script

Usage:
  node scripts/provision-tenant.js --customer=<customer-id> [options]
  node scripts/provision-tenant.js --url=<url> --auth=<user:pass> [options]

Options:
  --customer=<id>    Customer ID from config/customers.json (e.g., moravian-dev)
  --url=<url>        Direct URL to EdSteward instance
  --auth=<user:pass> Basic auth credentials for direct URL
  --dry-run          Preview what would be synced without making changes
  --limit=<n>        Only sync first N regulations
  --start-from=<key> Start from specific reg_key (e.g., REG-050)
  --help             Show this help message

Examples:
  node scripts/provision-tenant.js --customer=moravian-dev --dry-run
  node scripts/provision-tenant.js --customer=moravian-prod --limit=10
  node scripts/provision-tenant.js --url=http://newclient.edsteward.ai --auth=admin:secret
      `);
      process.exit(0);
    }
    
    await provisionTenant(args.customer, {
      dryRun: args['dry-run'] || false,
      limit: args.limit,
      startFrom: args['start-from']
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
