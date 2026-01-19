/**
 * MCP Engine: Compliance Task Import Script
 * 
 * Creates compliance tasks based on regulation categories.
 * Tasks are standard compliance activities that apply across regulation types.
 * 
 * Run with: node scripts/import-tasks.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

// Standard tasks by category
const categoryTasks = {
  'Financial Aid': [
    { title: 'Review Financial Aid Policies', category: 'policy', priority: 'high', assigned_role: 'Financial Aid Director', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
    { title: 'Update Consumer Information Disclosures', category: 'disclosure', priority: 'high', assigned_role: 'Financial Aid Director', evidence_required: true, evidence_type: 'document' },
    { title: 'Verify Satisfactory Academic Progress Standards', category: 'compliance', priority: 'medium', assigned_role: 'Registrar', evidence_required: true },
    { title: 'Reconcile Pell Grant Disbursements', category: 'financial', priority: 'high', assigned_role: 'Student Accounts', evidence_required: true, evidence_type: 'document' },
    { title: 'Document Return of Title IV Funds Calculations', category: 'financial', priority: 'high', assigned_role: 'Financial Aid Director', evidence_required: true },
  ],
  'Environmental Health and Safety': [
    { title: 'Conduct Workplace Safety Inspection', category: 'inspection', priority: 'high', assigned_role: 'EHS Director', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Update Safety Data Sheet Inventory', category: 'documentation', priority: 'medium', assigned_role: 'Safety Officer', evidence_required: true },
    { title: 'Conduct Fire Drill', category: 'training', priority: 'medium', assigned_role: 'Safety Officer', evidence_required: true, evidence_type: 'attestation' },
    { title: 'Review Emergency Response Plan', category: 'policy', priority: 'high', assigned_role: 'EHS Director', evidence_required: true },
    { title: 'Verify Hazardous Waste Disposal Records', category: 'documentation', priority: 'high', assigned_role: 'EHS Director', evidence_required: true, evidence_type: 'document' },
  ],
  'Privacy & Information Security': [
    { title: 'Conduct Privacy Impact Assessment', category: 'assessment', priority: 'high', assigned_role: 'Privacy Officer', evidence_required: true, evidence_type: 'document', estimated_effort: '16 hours' },
    { title: 'Review Data Access Controls', category: 'technical', priority: 'high', assigned_role: 'CISO', evidence_required: true },
    { title: 'Update Privacy Notice', category: 'policy', priority: 'medium', assigned_role: 'Privacy Officer', evidence_required: true, evidence_type: 'document' },
    { title: 'Conduct Data Inventory', category: 'documentation', priority: 'medium', assigned_role: 'IT Security', evidence_required: true },
    { title: 'Deliver Privacy Training', category: 'training', priority: 'medium', assigned_role: 'Privacy Officer', evidence_required: true, evidence_type: 'attestation' },
  ],
  'Campus Safety': [
    { title: 'Compile Crime Statistics', category: 'reporting', priority: 'critical', assigned_role: 'Campus Police Chief', evidence_required: true, evidence_type: 'document', estimated_effort: '40 hours' },
    { title: 'Update Emergency Notification System', category: 'technical', priority: 'high', assigned_role: 'IT Director', evidence_required: true },
    { title: 'Train Campus Security Authorities', category: 'training', priority: 'high', assigned_role: 'Title IX Coordinator', evidence_required: true, evidence_type: 'attestation' },
    { title: 'Review Missing Student Notification Procedures', category: 'policy', priority: 'high', assigned_role: 'Dean of Students', evidence_required: true },
    { title: 'Conduct Campus Safety Walk', category: 'inspection', priority: 'medium', assigned_role: 'Campus Police', evidence_required: true },
  ],
  'Tax': [
    { title: 'Compile Form 990 Information', category: 'reporting', priority: 'critical', assigned_role: 'CFO', evidence_required: true, evidence_type: 'document', estimated_effort: '80 hours' },
    { title: 'Review Tax-Exempt Status Compliance', category: 'compliance', priority: 'high', assigned_role: 'General Counsel', evidence_required: true },
    { title: 'Document Unrelated Business Income', category: 'documentation', priority: 'medium', assigned_role: 'Controller', evidence_required: true, evidence_type: 'document' },
    { title: 'Verify Executive Compensation Reasonableness', category: 'review', priority: 'high', assigned_role: 'Board Compensation Committee', evidence_required: true },
  ],
  'Research': [
    { title: 'Review IRB Protocol Compliance', category: 'compliance', priority: 'critical', assigned_role: 'IRB Chair', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Verify Research Conflict of Interest Disclosures', category: 'disclosure', priority: 'high', assigned_role: 'Research Compliance Officer', evidence_required: true },
    { title: 'Conduct Lab Safety Inspection', category: 'inspection', priority: 'high', assigned_role: 'Lab Safety Officer', evidence_required: true },
    { title: 'Review Animal Care Protocols', category: 'compliance', priority: 'high', assigned_role: 'IACUC Chair', evidence_required: true },
    { title: 'Update Research Data Management Plan', category: 'policy', priority: 'medium', assigned_role: 'Research Compliance Officer', evidence_required: true },
  ],
  'Sexual Misconduct': [
    { title: 'Review Title IX Policies', category: 'policy', priority: 'critical', assigned_role: 'Title IX Coordinator', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Conduct Title IX Investigator Training', category: 'training', priority: 'high', assigned_role: 'Title IX Coordinator', evidence_required: true, evidence_type: 'attestation' },
    { title: 'Update Sexual Misconduct Prevention Materials', category: 'communication', priority: 'medium', assigned_role: 'Title IX Coordinator', evidence_required: true },
    { title: 'Review Case Resolution Procedures', category: 'policy', priority: 'high', assigned_role: 'General Counsel', evidence_required: true },
  ],
  'Diversity/Affirmative Action': [
    { title: 'Update Affirmative Action Plan', category: 'policy', priority: 'high', assigned_role: 'Chief Diversity Officer', evidence_required: true, evidence_type: 'document', estimated_effort: '40 hours' },
    { title: 'Conduct Adverse Impact Analysis', category: 'analysis', priority: 'high', assigned_role: 'HR Director', evidence_required: true },
    { title: 'Review Outreach and Recruitment Efforts', category: 'review', priority: 'medium', assigned_role: 'HR Director', evidence_required: true },
    { title: 'Document Good Faith Efforts', category: 'documentation', priority: 'medium', assigned_role: 'Chief Diversity Officer', evidence_required: true, evidence_type: 'document' },
  ],
  'Information Technology': [
    { title: 'Conduct IT Security Risk Assessment', category: 'assessment', priority: 'critical', assigned_role: 'CISO', evidence_required: true, evidence_type: 'document', estimated_effort: '40 hours' },
    { title: 'Review Access Control Policies', category: 'policy', priority: 'high', assigned_role: 'IT Security Manager', evidence_required: true },
    { title: 'Conduct Penetration Testing', category: 'technical', priority: 'high', assigned_role: 'IT Security', evidence_required: true, evidence_type: 'document' },
    { title: 'Update Incident Response Plan', category: 'policy', priority: 'high', assigned_role: 'CISO', evidence_required: true },
    { title: 'Verify Backup and Recovery Procedures', category: 'technical', priority: 'medium', assigned_role: 'IT Operations', evidence_required: true },
  ],
  'Accounting': [
    { title: 'Prepare Financial Statements', category: 'reporting', priority: 'critical', assigned_role: 'Controller', evidence_required: true, evidence_type: 'document', estimated_effort: '120 hours' },
    { title: 'Review Internal Controls', category: 'review', priority: 'high', assigned_role: 'Internal Auditor', evidence_required: true },
    { title: 'Reconcile Bank Accounts', category: 'financial', priority: 'high', assigned_role: 'Accounting Manager', evidence_required: true, evidence_type: 'document' },
    { title: 'Document Accounting Policies', category: 'policy', priority: 'medium', assigned_role: 'Controller', evidence_required: true },
  ],
  'Grants Management': [
    { title: 'Review Grant Expenditure Reports', category: 'review', priority: 'high', assigned_role: 'Grants Manager', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Verify Cost Allowability', category: 'compliance', priority: 'high', assigned_role: 'Grants Accountant', evidence_required: true },
    { title: 'Update Effort Reporting', category: 'documentation', priority: 'medium', assigned_role: 'Grants Manager', evidence_required: true },
    { title: 'Review Subrecipient Monitoring', category: 'review', priority: 'medium', assigned_role: 'Grants Manager', evidence_required: true },
  ],
  'Ethics': [
    { title: 'Conduct Ethics Training', category: 'training', priority: 'high', assigned_role: 'General Counsel', evidence_required: true, evidence_type: 'attestation', estimated_effort: '4 hours' },
    { title: 'Review Conflict of Interest Disclosures', category: 'review', priority: 'high', assigned_role: 'Ethics Officer', evidence_required: true },
    { title: 'Update Code of Conduct', category: 'policy', priority: 'medium', assigned_role: 'HR Director', evidence_required: true, evidence_type: 'document' },
  ],
  'Employee Benefits': [
    { title: 'Review Benefits Plan Documents', category: 'review', priority: 'high', assigned_role: 'Benefits Manager', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Verify ERISA Compliance', category: 'compliance', priority: 'high', assigned_role: 'HR Director', evidence_required: true },
    { title: 'Update Summary Plan Descriptions', category: 'documentation', priority: 'medium', assigned_role: 'Benefits Manager', evidence_required: true },
  ],
  'Contracts & Procurement': [
    { title: 'Review Procurement Policies', category: 'policy', priority: 'medium', assigned_role: 'Procurement Director', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
    { title: 'Verify Contractor Compliance', category: 'compliance', priority: 'medium', assigned_role: 'Procurement Manager', evidence_required: true },
    { title: 'Update Vendor Database', category: 'documentation', priority: 'low', assigned_role: 'Procurement Staff', evidence_required: true },
  ],
  'Copyright & Trademark': [
    { title: 'Review DMCA Compliance', category: 'compliance', priority: 'medium', assigned_role: 'General Counsel', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
    { title: 'Update Copyright Policies', category: 'policy', priority: 'medium', assigned_role: 'Library Director', evidence_required: true },
    { title: 'Conduct Copyright Training', category: 'training', priority: 'low', assigned_role: 'General Counsel', evidence_required: true },
  ],
  'Export Controls': [
    { title: 'Conduct Deemed Export Review', category: 'review', priority: 'high', assigned_role: 'Export Control Officer', evidence_required: true, evidence_type: 'document', estimated_effort: '8 hours' },
    { title: 'Screen Restricted Party Lists', category: 'compliance', priority: 'critical', assigned_role: 'Export Control Officer', evidence_required: true },
    { title: 'Update Export Control Training', category: 'training', priority: 'medium', assigned_role: 'Research Compliance', evidence_required: true },
  ],
  'Recruitment Hiring & Termination': [
    { title: 'Audit I-9 Forms', category: 'audit', priority: 'high', assigned_role: 'HR Director', evidence_required: true, evidence_type: 'document', estimated_effort: '16 hours' },
    { title: 'Review Hiring Procedures', category: 'policy', priority: 'medium', assigned_role: 'HR Director', evidence_required: true },
    { title: 'Update Job Descriptions', category: 'documentation', priority: 'low', assigned_role: 'HR Staff', evidence_required: true },
  ],
  'Wages': [
    { title: 'Verify Minimum Wage Compliance', category: 'compliance', priority: 'high', assigned_role: 'Payroll Manager', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
    { title: 'Review Overtime Classifications', category: 'review', priority: 'high', assigned_role: 'HR Director', evidence_required: true },
    { title: 'Conduct Pay Equity Analysis', category: 'analysis', priority: 'medium', assigned_role: 'HR Director', evidence_required: true },
  ],
  'Accreditation': [
    { title: 'Prepare Self-Study Materials', category: 'documentation', priority: 'critical', assigned_role: 'Accreditation Liaison', evidence_required: true, evidence_type: 'document', estimated_effort: '200 hours' },
    { title: 'Gather Assessment Data', category: 'data', priority: 'high', assigned_role: 'Institutional Research', evidence_required: true },
    { title: 'Review Compliance with Standards', category: 'review', priority: 'high', assigned_role: 'Provost', evidence_required: true },
  ],
  'Lobbying and Political Activities': [
    { title: 'Review Lobbying Activities', category: 'review', priority: 'high', assigned_role: 'Government Relations', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
    { title: 'Document Lobbying Expenditures', category: 'documentation', priority: 'high', assigned_role: 'Controller', evidence_required: true },
    { title: 'Train Staff on Political Activity Restrictions', category: 'training', priority: 'medium', assigned_role: 'General Counsel', evidence_required: true },
  ],
};

// Default tasks for categories without specific patterns
const defaultTasks = [
  { title: 'Review Compliance Policies', category: 'policy', priority: 'medium', assigned_role: 'Compliance Officer', evidence_required: true, evidence_type: 'document', estimated_effort: '4 hours' },
  { title: 'Conduct Annual Compliance Training', category: 'training', priority: 'medium', assigned_role: 'Compliance Officer', evidence_required: true, evidence_type: 'attestation' },
  { title: 'Document Compliance Activities', category: 'documentation', priority: 'low', assigned_role: 'Compliance Staff', evidence_required: true },
];

async function importTasks() {
  console.log('═'.repeat(60));
  console.log('    MCP ENGINE: Compliance Task Import');
  console.log('═'.repeat(60));
  console.log('');
  
  // Get all regulations with their categories
  const regulations = await pool.query(`
    SELECT id, item_id, name, category 
    FROM regulations 
    ORDER BY category, name
  `);
  
  console.log(`Found ${regulations.rows.length} regulations\n`);
  
  let totalTasks = 0;
  let regulationsProcessed = 0;
  const tasksPerCategory = {};
  
  for (const reg of regulations.rows) {
    // Normalize category
    const primaryCategory = reg.category.split(',')[0].trim();
    
    // Get tasks for this category
    let tasks = categoryTasks[primaryCategory] || defaultTasks;
    
    // Track by category
    if (!tasksPerCategory[primaryCategory]) {
      tasksPerCategory[primaryCategory] = 0;
    }
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Generate unique task_id
      const taskId = `${reg.item_id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      await pool.query(`
        INSERT INTO regulation_tasks (
          regulation_id, task_id, title, description, instructions,
          category, priority, assigned_role, estimated_effort,
          evidence_required, evidence_type, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING
      `, [
        reg.id,
        taskId,
        task.title,
        `${task.title} - compliance task for ${reg.name}`,
        task.instructions || null,
        task.category || 'general',
        task.priority || 'medium',
        task.assigned_role || 'Compliance Officer',
        task.estimated_effort || null,
        task.evidence_required || false,
        task.evidence_type || null,
        i
      ]);
      
      totalTasks++;
      tasksPerCategory[primaryCategory]++;
    }
    
    regulationsProcessed++;
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log('Tasks created by category:');
  Object.entries(tasksPerCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Regulations processed: ${regulationsProcessed}`);
  console.log(`Total tasks created: ${totalTasks}`);
  
  // Verify
  const count = await pool.query('SELECT COUNT(*) FROM regulation_tasks');
  console.log(`\n📊 Database now has ${count.rows[0].count} tasks`);
  
  // Show sample by priority
  const byPriority = await pool.query(`
    SELECT priority, COUNT(*) as count 
    FROM regulation_tasks 
    GROUP BY priority 
    ORDER BY 
      CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
  `);
  console.log('\nTasks by priority:');
  byPriority.rows.forEach(r => console.log(`  ${r.priority}: ${r.count}`));
  
  await pool.end();
}

importTasks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
