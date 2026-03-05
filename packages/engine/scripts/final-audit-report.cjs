#!/usr/bin/env node
/**
 * Final Audit Report — Universal Console Standards Update
 * 
 * Generates a comprehensive report of all 242 regulations after the
 * universal console standards update, including:
 * - Console generation status (jurisdiction-aware template)
 * - Enhanced JSON schema version
 * - Task and deadline counts
 * - LOVV levels
 * - Data quality scores
 * - Certification readiness
 * 
 * Usage: node scripts/final-audit-report.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ENHANCED_DIR = path.join(__dirname, '../enhanced-regulations');
const CONSOLES_DIR = path.join(__dirname, '../src/client/public/regulations');
const REPORT_DIR = path.join(__dirname, '../logs');

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
    ORDER BY r.jurisdiction_source, r.state_code, r.reg_key
  `);
  return result.rows;
}

function checkConsole(itemId) {
  const consolePath = path.join(CONSOLES_DIR, `${itemId}-console.html`);
  if (!fs.existsSync(consolePath)) return { exists: false, hasJurisdiction: false };
  
  const content = fs.readFileSync(consolePath, 'utf-8');
  return {
    exists: true,
    hasJurisdiction: content.includes("const JURISDICTION_SOURCE = "),
    hasStateCode: content.includes("const STATE_CODE = "),
    hasEnforcingAgency: content.includes("const ENFORCING_AGENCY = "),
    hasBanner: content.includes('state-regulation-banner'),
    hasStep0: content.includes('id="step0"'),
    lineCount: content.split('\n').length
  };
}

function checkEnhancedJson(itemId) {
  const jsonPath = path.join(ENHANCED_DIR, `${itemId}.json`);
  if (!fs.existsSync(jsonPath)) return { exists: false };
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  return {
    exists: true,
    schemaVersion: data.schemaVersion || 'v1',
    hasJurisdiction: !!data.jurisdiction,
    hasDeadlines: Array.isArray(data.deadlines),
    deadlineCount: Array.isArray(data.deadlines) ? data.deadlines.length : 0,
    hasRelationships: Array.isArray(data.relationships),
    hasTags: Array.isArray(data.tags) && data.tags.length > 0,
    hasFullText: !!data.enhanced?.fullText,
    hasSummary: !!data.enhanced?.summary,
    hasRequirements: !!data.enhanced?.requirements,
    auditScore: data.audit?.score || null,
    auditCertainty: data.audit?.certainty || null
  };
}

function calculateQualityScore(reg, console, json) {
  let score = 0;
  const maxScore = 100;
  
  // Console exists and has jurisdiction support (20 pts)
  if (console.exists) score += 10;
  if (console.hasJurisdiction) score += 5;
  if (console.hasStep0) score += 5;
  
  // Enhanced JSON quality (30 pts)
  if (json.exists) score += 5;
  if (json.hasFullText) score += 10;
  if (json.hasSummary) score += 5;
  if (json.hasRequirements) score += 5;
  if (json.hasDeadlines) score += 5;
  
  // Task count (25 pts)
  const tasks = parseInt(reg.task_count);
  if (tasks >= 30) score += 25;
  else if (tasks >= 15) score += 20;
  else if (tasks >= 10) score += 15;
  else if (tasks >= 5) score += 10;
  else score += 5;
  
  // Deadline count (15 pts)
  const deadlines = parseInt(reg.deadline_count);
  if (deadlines >= 5) score += 15;
  else if (deadlines >= 3) score += 12;
  else if (deadlines >= 1) score += 8;
  
  // LOVV level (10 pts)
  if (reg.lovv_level === 'A') score += 10;
  else if (reg.lovv_level === 'B') score += 7;
  else if (reg.lovv_level === 'C') score += 4;
  
  return Math.min(score, maxScore);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📊 FINAL AUDIT REPORT — Universal Console Standards Update');
  console.log(`   Date: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const regs = await getAllRegulations();
  
  const results = [];
  const scoreBuckets = { excellent: 0, good: 0, fair: 0, needsWork: 0 };
  
  for (const reg of regs) {
    const consoleInfo = checkConsole(reg.item_id);
    const jsonInfo = checkEnhancedJson(reg.item_id);
    const qualityScore = calculateQualityScore(reg, consoleInfo, jsonInfo);
    
    if (qualityScore >= 80) scoreBuckets.excellent++;
    else if (qualityScore >= 60) scoreBuckets.good++;
    else if (qualityScore >= 40) scoreBuckets.fair++;
    else scoreBuckets.needsWork++;
    
    results.push({
      regKey: reg.reg_key,
      name: reg.name,
      slug: reg.item_id,
      jurisdiction: reg.jurisdiction_source || 'federal',
      stateCode: reg.state_code || null,
      lovvLevel: reg.lovv_level,
      tasks: parseInt(reg.task_count),
      deadlines: parseInt(reg.deadline_count),
      qualityScore,
      console: consoleInfo,
      json: jsonInfo
    });
  }
  
  // Statistics
  const totalRegs = results.length;
  const avgScore = Math.round(results.reduce((s, r) => s + r.qualityScore, 0) / totalRegs);
  const consolesWithJurisdiction = results.filter(r => r.console.hasJurisdiction).length;
  const jsonWithDeadlines = results.filter(r => r.json.hasDeadlines).length;
  const stateRegsWithBanner = results.filter(r => r.jurisdiction === 'state' && r.console.hasBanner).length;
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📊 OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Total Regulations: ${totalRegs}`);
  console.log(`  Average Quality Score: ${avgScore}/100`);
  console.log(`  Consoles with jurisdiction support: ${consolesWithJurisdiction}/${totalRegs}`);
  console.log(`  Enhanced JSON with deadlines: ${jsonWithDeadlines}/${totalRegs}`);
  console.log(`  State regs with banner support: ${stateRegsWithBanner}/16`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 QUALITY DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Excellent (80-100): ${scoreBuckets.excellent} regulations`);
  console.log(`  Good (60-79):       ${scoreBuckets.good} regulations`);
  console.log(`  Fair (40-59):       ${scoreBuckets.fair} regulations`);
  console.log(`  Needs Work (<40):   ${scoreBuckets.needsWork} regulations`);
  
  // By jurisdiction
  const federal = results.filter(r => r.jurisdiction === 'federal');
  const state = results.filter(r => r.jurisdiction === 'state');
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 BY JURISDICTION');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Federal: ${federal.length} | Avg score: ${Math.round(federal.reduce((s,r) => s + r.qualityScore, 0) / federal.length)}`);
  console.log(`  State:   ${state.length} | Avg score: ${Math.round(state.reduce((s,r) => s + r.qualityScore, 0) / state.length)}`);
  
  // By LOVV
  const lovvGroups = {};
  for (const r of results) {
    const level = r.lovvLevel || 'Unclassified';
    if (!lovvGroups[level]) lovvGroups[level] = [];
    lovvGroups[level].push(r);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 BY LOVV LEVEL');
  console.log('═══════════════════════════════════════════════════════════════════');
  for (const [level, entries] of Object.entries(lovvGroups).sort()) {
    const avg = Math.round(entries.reduce((s, r) => s + r.qualityScore, 0) / entries.length);
    const avgTasks = Math.round(entries.reduce((s, r) => s + r.tasks, 0) / entries.length);
    console.log(`  LOVV ${level}: ${entries.length} regs | Avg score: ${avg} | Avg tasks: ${avgTasks}`);
  }
  
  // Top 10 highest scoring
  const sorted = [...results].sort((a, b) => b.qualityScore - a.qualityScore);
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 TOP 10 HIGHEST QUALITY');
  console.log('═══════════════════════════════════════════════════════════════════');
  sorted.slice(0, 10).forEach(r => {
    console.log(`  ${r.qualityScore}/100 | ${r.regKey} | ${r.name.substring(0, 60)} | T:${r.tasks} D:${r.deadlines}`);
  });
  
  // Bottom 10 lowest scoring
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 BOTTOM 10 LOWEST QUALITY (need attention)');
  console.log('═══════════════════════════════════════════════════════════════════');
  sorted.slice(-10).forEach(r => {
    console.log(`  ${r.qualityScore}/100 | ${r.regKey} | ${r.name.substring(0, 60)} | T:${r.tasks} D:${r.deadlines}`);
  });
  
  // State regulations detail
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 STATE REGULATIONS DETAIL');
  console.log('═══════════════════════════════════════════════════════════════════');
  state.forEach(r => {
    const jur = r.console.hasJurisdiction ? '✅' : '❌';
    const v2 = r.json.schemaVersion === '2.0' ? '✅' : '❌';
    console.log(`  ${r.qualityScore}/100 | ${jur} JUR | ${v2} v2 | ${r.regKey} | ${r.stateCode} | ${r.name.substring(0, 50)} | T:${r.tasks} D:${r.deadlines}`);
  });
  
  // Save JSON report
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalRegulations: totalRegs,
      averageQualityScore: avgScore,
      consolesWithJurisdiction,
      jsonWithDeadlines,
      stateRegsWithBanner,
      qualityDistribution: scoreBuckets,
    },
    regulations: results
  };
  
  const reportPath = path.join(REPORT_DIR, 'final-audit-report.json');
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Full JSON report: ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
