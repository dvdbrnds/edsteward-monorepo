#!/usr/bin/env node
/**
 * Validate and Gap-Fill LOVV-A Federal Regulations
 * 
 * Checks all LOVV Level A federal regulations for data completeness:
 * - Task counts (target: 15+ for secondary, 30+ for major)
 * - Deadline counts (target: 3+)
 * - Enhanced JSON field completeness
 * - Task quality (has title, description, priority, role, category)
 * - Adds deadlines array to enhanced JSON from DB
 * 
 * Usage: node scripts/validate-lovva-federal.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ENHANCED_DIR = path.join(__dirname, '../enhanced-regulations');

const pool = new Pool({
  host: 'localhost',
  database: 'mcp_engine',
  port: 5432
});

async function getRegulations() {
  const result = await pool.query(`
    SELECT r.id, r.item_id, r.reg_key, r.name, r.statute, r.cfr,
           r.lovv_level, r.jurisdiction_source,
           (SELECT COUNT(*) FROM regulation_tasks rt WHERE rt.regulation_id = r.id) as task_count,
           (SELECT COUNT(*) FROM regulation_deadlines rd WHERE rd.regulation_id = r.id) as deadline_count
    FROM regulations r
    WHERE r.is_current = TRUE 
      AND r.lovv_level = 'A' 
      AND r.jurisdiction_source = 'federal'
    ORDER BY r.reg_key
  `);
  return result.rows;
}

async function getTaskQuality(regId) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as has_title,
      COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as has_description,
      COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as has_priority,
      COUNT(CASE WHEN assigned_role IS NOT NULL THEN 1 END) as has_role,
      COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as has_category
    FROM regulation_tasks
    WHERE regulation_id = $1
  `, [regId]);
  return result.rows[0];
}

async function getDeadlinesFromDB(regId) {
  const result = await pool.query(`
    SELECT name, due_date, deadline_type, description,
           frequency, recurring_month, recurring_day
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
      type: row.deadline_type || 'reporting',
      description: row.description || '',
      isRecurring,
      recurrenceFrequency: isRecurring ? (row.frequency || 'annual') : null
    };
  });
}

async function validateAndFix(reg) {
  const issues = [];
  const fixes = [];
  
  // Check task counts
  const taskCount = parseInt(reg.task_count);
  if (taskCount < 15) {
    issues.push(`LOW TASKS: ${taskCount} (target: 15+)`);
  }
  
  // Check deadline counts
  const deadlineCount = parseInt(reg.deadline_count);
  if (deadlineCount === 0) {
    issues.push(`NO DEADLINES`);
  } else if (deadlineCount < 3) {
    issues.push(`LOW DEADLINES: ${deadlineCount} (target: 3+)`);
  }
  
  // Check task quality
  const quality = await getTaskQuality(reg.id);
  const total = parseInt(quality.total);
  if (total > 0) {
    const missingDesc = total - parseInt(quality.has_description);
    const missingPriority = total - parseInt(quality.has_priority);
    const missingRole = total - parseInt(quality.has_role);
    const missingCategory = total - parseInt(quality.has_category);
    if (missingDesc > 0) issues.push(`${missingDesc} tasks missing description`);
    if (missingPriority > 0) issues.push(`${missingPriority} tasks missing priority`);
    if (missingRole > 0) issues.push(`${missingRole} tasks missing role`);
    if (missingCategory > 0) issues.push(`${missingCategory} tasks missing category`);
  }
  
  // Check and update enhanced JSON
  const jsonPath = path.join(ENHANCED_DIR, `${reg.item_id}.json`);
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    if (!data.enhanced?.fullText) issues.push('JSON: missing fullText');
    if (!data.enhanced?.summary) issues.push('JSON: missing summary');
    if (!data.enhanced?.requirements) issues.push('JSON: missing requirements');
    
    // Add deadlines array if missing
    if (!Array.isArray(data.deadlines) || data.deadlines.length === 0) {
      const dbDeadlines = await getDeadlinesFromDB(reg.id);
      if (dbDeadlines.length > 0) {
        data.deadlines = dbDeadlines;
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
        fixes.push(`Added ${dbDeadlines.length} deadlines to JSON`);
      }
    }
    
    // Add relationships array if missing
    if (!Array.isArray(data.relationships)) {
      data.relationships = [];
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
      fixes.push('Added empty relationships array');
    }
    
    // Add tags if missing
    if (!Array.isArray(data.tags)) {
      data.tags = [reg.name].filter(Boolean);
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
      fixes.push('Added tags array');
    }
  } else {
    issues.push('JSON: file not found');
  }
  
  return { issues, fixes };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 LOVV-A Federal Regulation Validation & Gap-Fill');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const regs = await getRegulations();
  console.log(`Found ${regs.length} LOVV-A federal regulations\n`);
  
  let totalIssues = 0;
  let totalFixes = 0;
  const summary = [];
  
  for (const reg of regs) {
    const { issues, fixes } = await validateAndFix(reg);
    const status = issues.length === 0 ? '✅' : '⚠️';
    
    console.log(`${status} ${reg.reg_key} | ${reg.name}`);
    console.log(`   Tasks: ${reg.task_count} | Deadlines: ${reg.deadline_count}`);
    
    if (fixes.length > 0) {
      fixes.forEach(f => console.log(`   🔧 FIX: ${f}`));
      totalFixes += fixes.length;
    }
    if (issues.length > 0) {
      issues.forEach(i => console.log(`   ⚠️  ${i}`));
      totalIssues += issues.length;
    }
    console.log('');
    
    summary.push({
      regKey: reg.reg_key,
      name: reg.name,
      tasks: parseInt(reg.task_count),
      deadlines: parseInt(reg.deadline_count),
      issues: issues.length,
      fixes: fixes.length
    });
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Summary: ${regs.length} regulations validated`);
  console.log(`   ✅ Clean: ${summary.filter(s => s.issues === 0).length}`);
  console.log(`   ⚠️  Issues: ${totalIssues}`);
  console.log(`   🔧 Fixes applied: ${totalFixes}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
