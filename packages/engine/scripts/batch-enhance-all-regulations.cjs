#!/usr/bin/env node
/**
 * Batch Enhance All Regulations — Data Quality Pipeline
 * 
 * For ALL 242 regulations, ensures enhanced JSON has:
 * - deadlines array (pulled from PostgreSQL)
 * - relationships array (empty if none)
 * - tags array (from topic if empty)
 * - audit block preserved
 * 
 * Also generates a data quality report showing:
 * - Task counts and gaps
 * - Deadline counts and gaps
 * - Missing enhanced JSON fields
 * - LOVV level before/after potential
 * 
 * Usage: node scripts/batch-enhance-all-regulations.cjs [--fix] [--report]
 *   --fix    Apply fixes to enhanced JSON files
 *   --report Generate summary report only (no fixes)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ENHANCED_DIR = path.join(__dirname, '../enhanced-regulations');
const REPORT_FILE = path.join(__dirname, '../logs/data-quality-report.json');

const pool = new Pool({
  host: 'localhost',
  database: 'mcp_engine',
  port: 5432
});

async function getAllRegulations() {
  const result = await pool.query(`
    SELECT 
      r.id, r.item_id, r.reg_key, r.name, r.statute, r.cfr,
      r.lovv_level, r.jurisdiction_source, r.state_code,
      r.topic, r.category,
      (SELECT COUNT(*) FROM regulation_tasks rt WHERE rt.regulation_id = r.id) as task_count,
      (SELECT COUNT(*) FROM regulation_deadlines rd WHERE rd.regulation_id = r.id) as deadline_count
    FROM regulations r
    WHERE r.is_current = TRUE
    ORDER BY r.jurisdiction_source, r.lovv_level, r.reg_key
  `);
  return result.rows;
}

async function getDeadlinesFromDB(regId) {
  const result = await pool.query(`
    SELECT name, due_date, deadline_type, description,
           frequency, recurring_month, recurring_day,
           penalty_for_missing, reporting_to
    FROM regulation_deadlines
    WHERE regulation_id = $1
    ORDER BY due_date NULLS LAST
  `, [regId]);
  
  return result.rows.map(row => {
    const isRecurring = !!row.frequency && row.frequency !== 'one-time';
    let dateStr = 'continuous';
    if (row.recurring_month && row.recurring_day) {
      dateStr = `${String(row.recurring_month).padStart(2, '0')}-${String(row.recurring_day).padStart(2, '0')}`;
    } else if (row.due_date) {
      dateStr = row.due_date.toISOString().split('T')[0];
    }
    return {
      date: dateStr,
      label: row.name,
      type: row.deadline_type || 'compliance',
      description: row.description || '',
      isRecurring,
      recurrenceFrequency: isRecurring ? (row.frequency || 'annual') : null
    };
  });
}

async function getTaskQualityStats(regId) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as has_desc,
      COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as has_priority,
      COUNT(CASE WHEN assigned_role IS NOT NULL THEN 1 END) as has_role,
      COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as has_category
    FROM regulation_tasks
    WHERE regulation_id = $1
  `, [regId]);
  return result.rows[0];
}

async function processRegulation(reg, applyFixes) {
  const entry = {
    regKey: reg.reg_key,
    name: reg.name,
    slug: reg.item_id,
    jurisdiction: reg.jurisdiction_source || 'federal',
    stateCode: reg.state_code || null,
    lovvLevel: reg.lovv_level || null,
    tasks: parseInt(reg.task_count),
    deadlines: parseInt(reg.deadline_count),
    issues: [],
    fixes: [],
    jsonExists: false,
    jsonHasDeadlines: false,
    jsonHasRelationships: false,
    jsonHasTags: false,
    taskQuality: null
  };
  
  // Task quality check
  const quality = await getTaskQualityStats(reg.id);
  const total = parseInt(quality.total);
  entry.taskQuality = {
    total,
    hasDescription: parseInt(quality.has_desc),
    hasPriority: parseInt(quality.has_priority),
    hasRole: parseInt(quality.has_role),
    hasCategory: parseInt(quality.has_category)
  };
  
  if (total < 10) entry.issues.push('CRITICAL_LOW_TASKS');
  else if (total < 15) entry.issues.push('LOW_TASKS');
  
  if (entry.deadlines === 0) entry.issues.push('NO_DEADLINES');
  else if (entry.deadlines < 3) entry.issues.push('LOW_DEADLINES');
  
  // Enhanced JSON check and fix
  const jsonPath = path.join(ENHANCED_DIR, `${reg.item_id}.json`);
  if (fs.existsSync(jsonPath)) {
    entry.jsonExists = true;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    if (!data.enhanced?.fullText) entry.issues.push('MISSING_FULLTEXT');
    if (!data.enhanced?.summary) entry.issues.push('MISSING_SUMMARY');
    if (!data.enhanced?.requirements) entry.issues.push('MISSING_REQUIREMENTS');
    
    entry.jsonHasDeadlines = Array.isArray(data.deadlines) && data.deadlines.length > 0;
    entry.jsonHasRelationships = Array.isArray(data.relationships);
    entry.jsonHasTags = Array.isArray(data.tags) && data.tags.length > 0;
    
    if (applyFixes) {
      let modified = false;
      
      // Add deadlines from DB if missing
      if (!entry.jsonHasDeadlines) {
        const dbDeadlines = await getDeadlinesFromDB(reg.id);
        if (dbDeadlines.length > 0) {
          data.deadlines = dbDeadlines;
          entry.fixes.push(`added_${dbDeadlines.length}_deadlines`);
          modified = true;
        } else if (!Array.isArray(data.deadlines)) {
          data.deadlines = [];
          modified = true;
        }
      }
      
      // Add relationships if missing
      if (!Array.isArray(data.relationships)) {
        data.relationships = [];
        entry.fixes.push('added_relationships_array');
        modified = true;
      }
      
      // Add tags if missing
      if (!entry.jsonHasTags) {
        const tags = [];
        if (reg.topic) tags.push(reg.topic);
        if (reg.category && reg.category !== reg.topic) tags.push(reg.category);
        data.tags = tags.length > 0 ? tags : [reg.name];
        entry.fixes.push('added_tags');
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
      }
    }
  } else {
    entry.issues.push('NO_JSON_FILE');
  }
  
  return entry;
}

async function main() {
  const args = process.argv.slice(2);
  const applyFixes = args.includes('--fix');
  const reportOnly = args.includes('--report');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Batch Regulation Data Quality Pipeline');
  console.log(`   Mode: ${applyFixes ? 'FIX (applying changes)' : reportOnly ? 'REPORT ONLY' : 'DRY RUN'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const regs = await getAllRegulations();
  console.log(`Processing ${regs.length} regulations...\n`);
  
  const results = [];
  let fixCount = 0;
  let issueCount = 0;
  
  for (const reg of regs) {
    const entry = await processRegulation(reg, applyFixes);
    results.push(entry);
    fixCount += entry.fixes.length;
    issueCount += entry.issues.length;
  }
  
  // Summary by tier
  const tiers = {
    'LOVV-A': results.filter(r => r.lovvLevel === 'A'),
    'LOVV-B': results.filter(r => r.lovvLevel === 'B'),
    'LOVV-C': results.filter(r => r.lovvLevel === 'C'),
    'Unclassified': results.filter(r => !r.lovvLevel || !['A','B','C'].includes(r.lovvLevel)),
  };
  
  const jurisdictions = {
    'Federal': results.filter(r => r.jurisdiction === 'federal'),
    'State': results.filter(r => r.jurisdiction === 'state'),
  };
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY BY LOVV LEVEL');
  console.log('═══════════════════════════════════════════════════════════════');
  
  for (const [tier, entries] of Object.entries(tiers)) {
    if (entries.length === 0) continue;
    const clean = entries.filter(e => e.issues.length === 0).length;
    const avgTasks = Math.round(entries.reduce((s, e) => s + e.tasks, 0) / entries.length);
    const avgDeadlines = Math.round(entries.reduce((s, e) => s + e.deadlines, 0) / entries.length * 10) / 10;
    const noJson = entries.filter(e => !e.jsonExists).length;
    
    console.log(`\n  ${tier}: ${entries.length} regulations`);
    console.log(`    Clean: ${clean} | Issues: ${entries.length - clean}`);
    console.log(`    Avg tasks: ${avgTasks} | Avg deadlines: ${avgDeadlines}`);
    if (noJson > 0) console.log(`    Missing JSON: ${noJson}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY BY JURISDICTION');
  console.log('═══════════════════════════════════════════════════════════════');
  
  for (const [jur, entries] of Object.entries(jurisdictions)) {
    const avgTasks = Math.round(entries.reduce((s, e) => s + e.tasks, 0) / entries.length);
    console.log(`\n  ${jur}: ${entries.length} regulations | Avg tasks: ${avgTasks}`);
  }
  
  // Issue breakdown
  const issueCounts = {};
  for (const r of results) {
    for (const issue of r.issues) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 ISSUE BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const [issue, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${issue}: ${count} regulations`);
  }
  
  console.log(`\n  Total issues: ${issueCount}`);
  if (applyFixes) console.log(`  Fixes applied: ${fixCount}`);
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    mode: applyFixes ? 'fix' : 'report',
    totalRegulations: results.length,
    totalIssues: issueCount,
    fixesApplied: fixCount,
    tiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, v.length])),
    issueCounts,
    regulations: results
  };
  
  const logsDir = path.dirname(REPORT_FILE);
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${REPORT_FILE}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
