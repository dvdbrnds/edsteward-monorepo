#!/usr/bin/env node
/**
 * Regulation Decontamination Script
 * 
 * Run this BEFORE gold certification to detect and clean contaminated data.
 * Contamination = tasks/deadlines that belong to a different regulation
 * 
 * Usage: node scripts/decontaminate-regulation.cjs REG-XXX [--fix]
 */

const { Client } = require('pg');

const KNOWN_REGULATION_PATTERNS = {
  // Key terms that indicate specific regulations
  // Use word boundaries where needed to avoid false matches
  'title-ix': ['REG-002', 'REG-003'], // Title IX
  'title-vi': ['REG-008', 'REG-009'],
  'title-vii': ['REG-010'],
  'clery': ['REG-001'],
  'ferpa': ['REG-004', 'REG-005', 'REG-006'],
  'hipaa': ['REG-020', 'REG-021', 'REG-022'],
  // Note: 'ada' removed - too many false positives (eada, canada, etc.)
  'americans-with-disabilities': ['REG-015', 'REG-016'],
  'section-504': ['REG-018'],
  'cscpa': ['REG-007'],
  'campus-sex-crimes': ['REG-007'],
  'eada': ['REG-017'],
  'equity-in-athletics': ['REG-017'],
  'false-claims': ['REG-011'],
  'facta': ['REG-029'], // FACTA is REG-029
  'gramm-leach': ['REG-032'], // GLBA is REG-032
  'glba': ['REG-032'],
  'coppa': ['REG-027'],
  'ecpa': ['REG-028'],
  'epcra': ['REG-019', 'REG-131'], // Both EPCRA entries (will merge)
  'drug-free-schools': ['REG-023', 'REG-129'], // Drug Free Schools duplicates
  'drug-free-workplace': ['REG-130'], // Drug Free Workplace Act (different law)
  'drug-and-alcohol': ['REG-023', 'REG-129'], // HEA Drug/Alcohol Prevention
  'hazing': ['REG-024'],
  'uniform-crime': ['REG-025', 'REG-026'],
};

// Common contamination indicators - tasks that clearly belong elsewhere
const CONTAMINATION_INDICATORS = [
  { pattern: /title.?ix|sexual.?misconduct|title.?9/i, belongsTo: 'Title IX (REG-002)' },
  { pattern: /clery|campus.?security|crime.?statistics/i, belongsTo: 'Clery Act (REG-001)' },
  { pattern: /ferpa|education.?records|student.?privacy/i, belongsTo: 'FERPA (REG-004)' },
  { pattern: /hipaa|health.?information|phi\b|protected.?health/i, belongsTo: 'HIPAA (REG-020)' },
  { pattern: /ada\b|disabilities.?act|wheelchair|accessible/i, belongsTo: 'ADA (REG-015)' },
  { pattern: /section.?504|rehabilitation.?act/i, belongsTo: 'Section 504 (REG-018)' },
  { pattern: /title.?vii|eeoc|employment.?discrimination/i, belongsTo: 'Title VII (REG-010)' },
  { pattern: /title.?vi\b|lep|limited.?english/i, belongsTo: 'Title VI (REG-008/009)' },
  { pattern: /eada|equity.?in.?athletics|athletic.?disclosure/i, belongsTo: 'EADA (REG-017)' },
  { pattern: /gramm.?leach|glba|financial.?privacy/i, belongsTo: 'GLBA (REG-029)' },
  { pattern: /coppa|children.*online.*privacy/i, belongsTo: 'COPPA (REG-027)' },
];

async function decontaminateRegulation(regKey, shouldFix = false) {
  const client = new Client({ database: 'mcp_engine' });
  
  try {
    await client.connect();
    
    // Get regulation info
    const regResult = await client.query(`
      SELECT id, reg_key, name, statute, category, topic, lovv_level
      FROM regulations WHERE reg_key = $1
    `, [regKey]);
    
    if (regResult.rows.length === 0) {
      console.error(`❌ Regulation ${regKey} not found`);
      process.exit(1);
    }
    
    const reg = regResult.rows[0];
    console.log('\n' + '='.repeat(70));
    console.log(`🔍 DECONTAMINATION CHECK: ${reg.reg_key}`);
    console.log('='.repeat(70));
    console.log(`Name: ${reg.name}`);
    console.log(`Category: ${reg.category}`);
    console.log(`Current LOVV: ${reg.lovv_level || 'Not set'}`);
    console.log('');
    
    // Get tasks
    const tasksResult = await client.query(`
      SELECT task_id, title, description, category
      FROM regulation_tasks WHERE regulation_id = $1
      ORDER BY category, sort_order
    `, [reg.id]);
    
    // Get deadlines
    const deadlinesResult = await client.query(`
      SELECT deadline_id, name, description
      FROM regulation_deadlines WHERE regulation_id = $1
    `, [reg.id]);
    
    console.log(`📋 Found ${tasksResult.rows.length} tasks, ${deadlinesResult.rows.length} deadlines\n`);
    
    const contaminated = {
      tasks: [],
      deadlines: [],
      summary: []
    };
    
    // Check each task for contamination
    console.log('🧪 Checking tasks for contamination...');
    for (const task of tasksResult.rows) {
      const issues = [];
      
      // Check task_id for wrong regulation prefix
      for (const [pattern, allowedRegs] of Object.entries(KNOWN_REGULATION_PATTERNS)) {
        if (task.task_id.toLowerCase().includes(pattern) && !allowedRegs.includes(regKey)) {
          issues.push(`task_id contains "${pattern}" (belongs to ${allowedRegs.join('/')})`);
        }
      }
      
      // Check title and description for contamination indicators
      const textToCheck = `${task.title} ${task.description || ''}`;
      for (const indicator of CONTAMINATION_INDICATORS) {
        if (indicator.pattern.test(textToCheck)) {
          // Check if this indicator is appropriate for this regulation
          const isAppropriate = Object.entries(KNOWN_REGULATION_PATTERNS).some(([key, regs]) => {
            return regs.includes(regKey) && indicator.pattern.test(key.replace(/-/g, '.?'));
          });
          
          if (!isAppropriate) {
            issues.push(`Content mentions ${indicator.belongsTo}`);
          }
        }
      }
      
      if (issues.length > 0) {
        contaminated.tasks.push({
          task_id: task.task_id,
          title: task.title,
          issues
        });
      }
    }
    
    // Check each deadline for contamination
    console.log('🧪 Checking deadlines for contamination...');
    for (const deadline of deadlinesResult.rows) {
      const issues = [];
      
      // Check deadline_id for wrong regulation prefix
      for (const [pattern, allowedRegs] of Object.entries(KNOWN_REGULATION_PATTERNS)) {
        if (deadline.deadline_id.toLowerCase().includes(pattern) && !allowedRegs.includes(regKey)) {
          issues.push(`deadline_id contains "${pattern}" (belongs to ${allowedRegs.join('/')})`);
        }
      }
      
      // Check name and description
      const textToCheck = `${deadline.name} ${deadline.description || ''}`;
      for (const indicator of CONTAMINATION_INDICATORS) {
        if (indicator.pattern.test(textToCheck)) {
          const isAppropriate = Object.entries(KNOWN_REGULATION_PATTERNS).some(([key, regs]) => {
            return regs.includes(regKey) && indicator.pattern.test(key.replace(/-/g, '.?'));
          });
          
          if (!isAppropriate) {
            issues.push(`Content mentions ${indicator.belongsTo}`);
          }
        }
      }
      
      if (issues.length > 0) {
        contaminated.deadlines.push({
          deadline_id: deadline.deadline_id,
          name: deadline.name,
          issues
        });
      }
    }
    
    // Report findings
    console.log('\n' + '-'.repeat(70));
    
    if (contaminated.tasks.length === 0 && contaminated.deadlines.length === 0) {
      console.log('✅ NO CONTAMINATION DETECTED');
      console.log(`   ${regKey} appears clean and ready for certification.`);
    } else {
      console.log('⚠️  CONTAMINATION DETECTED');
      console.log('');
      
      if (contaminated.tasks.length > 0) {
        console.log(`🔴 ${contaminated.tasks.length} CONTAMINATED TASKS:`);
        for (const task of contaminated.tasks) {
          console.log(`   - ${task.task_id}`);
          console.log(`     "${task.title}"`);
          for (const issue of task.issues) {
            console.log(`     ⚠️  ${issue}`);
          }
        }
        console.log('');
      }
      
      if (contaminated.deadlines.length > 0) {
        console.log(`🔴 ${contaminated.deadlines.length} CONTAMINATED DEADLINES:`);
        for (const deadline of contaminated.deadlines) {
          console.log(`   - ${deadline.deadline_id}`);
          console.log(`     "${deadline.name}"`);
          for (const issue of deadline.issues) {
            console.log(`     ⚠️  ${issue}`);
          }
        }
        console.log('');
      }
      
      if (shouldFix) {
        console.log('🧹 CLEANING CONTAMINATED DATA...');
        
        // Delete contaminated tasks
        if (contaminated.tasks.length > 0) {
          const taskIds = contaminated.tasks.map(t => t.task_id);
          await client.query(`
            DELETE FROM regulation_tasks 
            WHERE regulation_id = $1 AND task_id = ANY($2)
          `, [reg.id, taskIds]);
          console.log(`   ✅ Deleted ${contaminated.tasks.length} contaminated tasks`);
        }
        
        // Delete contaminated deadlines
        if (contaminated.deadlines.length > 0) {
          const deadlineIds = contaminated.deadlines.map(d => d.deadline_id);
          await client.query(`
            DELETE FROM regulation_deadlines 
            WHERE regulation_id = $1 AND deadline_id = ANY($2)
          `, [reg.id, deadlineIds]);
          console.log(`   ✅ Deleted ${contaminated.deadlines.length} contaminated deadlines`);
        }
        
        // Get remaining counts
        const remainingTasks = await client.query(
          'SELECT COUNT(*) FROM regulation_tasks WHERE regulation_id = $1', [reg.id]
        );
        const remainingDeadlines = await client.query(
          'SELECT COUNT(*) FROM regulation_deadlines WHERE regulation_id = $1', [reg.id]
        );
        
        console.log('');
        console.log(`📊 REMAINING: ${remainingTasks.rows[0].count} tasks, ${remainingDeadlines.rows[0].count} deadlines`);
        
        if (parseInt(remainingTasks.rows[0].count) === 0) {
          console.log('');
          console.log('⚠️  ALL TASKS WERE CONTAMINATED - Regulation needs fresh task data');
        }
      } else {
        console.log('💡 Run with --fix to remove contaminated data:');
        console.log(`   node scripts/decontaminate-regulation.cjs ${regKey} --fix`);
      }
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
    return {
      regKey,
      clean: contaminated.tasks.length === 0 && contaminated.deadlines.length === 0,
      contaminated
    };
    
  } finally {
    await client.end();
  }
}

// Batch check all regulations
async function checkAllRegulations() {
  const client = new Client({ database: 'mcp_engine' });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT reg_key FROM regulations 
      WHERE is_current = true 
        AND name NOT LIKE '[MERGED%'
        AND lovv_level != 'A'
      ORDER BY reg_key
    `);
    
    console.log(`\n🔍 Checking ${result.rows.length} regulations for contamination...\n`);
    
    const contaminated = [];
    
    for (const row of result.rows) {
      // Quick check
      const tasksResult = await client.query(`
        SELECT task_id, title FROM regulation_tasks rt
        JOIN regulations r ON rt.regulation_id = r.id
        WHERE r.reg_key = $1
      `, [row.reg_key]);
      
      let hasIssues = false;
      for (const task of tasksResult.rows) {
        for (const [pattern, allowedRegs] of Object.entries(KNOWN_REGULATION_PATTERNS)) {
          if (task.task_id.toLowerCase().includes(pattern) && !allowedRegs.includes(row.reg_key)) {
            hasIssues = true;
            break;
          }
        }
        if (hasIssues) break;
      }
      
      if (hasIssues) {
        contaminated.push(row.reg_key);
        console.log(`  ⚠️  ${row.reg_key} - CONTAMINATION DETECTED`);
      } else {
        console.log(`  ✅ ${row.reg_key} - Clean`);
      }
    }
    
    if (contaminated.length > 0) {
      console.log(`\n🔴 ${contaminated.length} regulations need decontamination:`);
      console.log(`   ${contaminated.join(', ')}`);
      console.log('\nRun individual checks with:');
      console.log(`   node scripts/decontaminate-regulation.cjs <REG-KEY>`);
    } else {
      console.log('\n✅ All regulations appear clean!');
    }
    
  } finally {
    await client.end();
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--all') {
  checkAllRegulations().catch(console.error);
} else {
  const regKey = args[0].toUpperCase();
  const shouldFix = args.includes('--fix');
  decontaminateRegulation(regKey, shouldFix).catch(console.error);
}
