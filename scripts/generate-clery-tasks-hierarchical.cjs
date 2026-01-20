/**
 * Generate Hierarchical Clery Act Compliance Tasks
 * 
 * Matches EdSteward's structure:
 * - 10 parent sections
 * - 32 subtasks
 * - Total: 42 tasks
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.USER,
  password: '',
});

// Hierarchical Clery Act compliance tasks (10 sections + 32 subtasks = 42 total)
const cleryTasks = [
  // === SECTION 1: Annual Security Report (ASR) Publication ===
  {
    tempId: 'section-1',
    title: 'Annual Security Report (ASR) Publication',
    description: 'Prepare and publish the Annual Security Report by October 1 deadline.',
    category: 'Annual Security Report',
    priority: 'critical',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-10-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-1a',
    parentTempId: 'section-1',
    title: 'Gather Crime Statistics (3-Year Data)',
    description: 'Compile campus crime statistics from all sources for the previous 3 calendar years.',
    category: 'Annual Security Report',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-07-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-1b',
    parentTempId: 'section-1',
    title: 'Compile Policy Statements',
    description: 'Draft all required policy statements for inclusion in the ASR.',
    category: 'Annual Security Report',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-08-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-1c',
    parentTempId: 'section-1',
    title: 'Legal Review of ASR',
    description: 'Submit draft ASR for legal counsel review and approval.',
    category: 'Annual Security Report',
    priority: 'critical',
    assignedRole: 'General Counsel',
    dueDate: '2026-09-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'attestation'
  },
  {
    tempId: 'task-1d',
    parentTempId: 'section-1',
    title: 'Distribute ASR Notification',
    description: 'Notify all students and employees of ASR availability by October 1.',
    category: 'Annual Security Report',
    priority: 'critical',
    assignedRole: 'Communications',
    dueDate: '2026-10-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 2: Department of Education Crime Statistics Submission ===
  {
    tempId: 'section-2',
    title: 'Department of Education Crime Statistics Submission',
    description: 'Submit annual crime statistics to the Department of Education via the Campus Safety and Security Survey.',
    category: 'Federal Reporting',
    priority: 'critical',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-10-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-2a',
    parentTempId: 'section-2',
    title: 'Complete Campus Safety Survey',
    description: 'Enter all required crime data into the Department of Education web survey system.',
    category: 'Federal Reporting',
    priority: 'critical',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-10-10',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-2b',
    parentTempId: 'section-2',
    title: 'Verify Submission Confirmation',
    description: 'Confirm successful submission and retain confirmation receipt.',
    category: 'Federal Reporting',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-10-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 3: Daily Crime Log Maintenance ===
  {
    tempId: 'section-3',
    title: 'Daily Crime Log Maintenance',
    description: 'Maintain an accurate and current daily crime log open for public inspection.',
    category: 'Crime Log',
    priority: 'critical',
    assignedRole: 'Campus Security',
    dueDate: null,
    recurringSchedule: 'daily',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-3a',
    parentTempId: 'section-3',
    title: 'Record All Reported Crimes Within 2 Business Days',
    description: 'Enter all crimes reported to campus security into the daily crime log within 2 business days of report.',
    category: 'Crime Log',
    priority: 'critical',
    assignedRole: 'Campus Security',
    dueDate: null,
    recurringSchedule: 'daily',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-3b',
    parentTempId: 'section-3',
    title: 'Ensure Public Accessibility',
    description: 'Make crime log available for public inspection during normal business hours.',
    category: 'Crime Log',
    priority: 'high',
    assignedRole: 'Campus Security',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'attestation'
  },

  // === SECTION 4: Campus Security Authority (CSA) Program ===
  {
    tempId: 'section-4',
    title: 'Campus Security Authority (CSA) Program',
    description: 'Identify, train, and coordinate all Campus Security Authorities for crime reporting.',
    category: 'Campus Security Authorities',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-09-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-4a',
    parentTempId: 'section-4',
    title: 'Identify All CSAs',
    description: 'Maintain comprehensive list of all employees who qualify as Campus Security Authorities.',
    category: 'Campus Security Authorities',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-08-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-4b',
    parentTempId: 'section-4',
    title: 'Conduct Annual CSA Training',
    description: 'Train all CSAs on reporting obligations, crime classification, and documentation requirements.',
    category: 'Campus Security Authorities',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-09-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-4c',
    parentTempId: 'section-4',
    title: 'Collect Quarterly CSA Reports',
    description: 'Gather all CSA crime reports quarterly and incorporate into statistics database.',
    category: 'Campus Security Authorities',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: null,
    recurringSchedule: 'quarterly',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 5: Timely Warning System ===
  {
    tempId: 'section-5',
    title: 'Timely Warning System',
    description: 'Maintain and operate the timely warning notification system for Clery crimes.',
    category: 'Timely Warnings',
    priority: 'critical',
    assignedRole: 'Campus Security',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-5a',
    parentTempId: 'section-5',
    title: 'Review Timely Warning Policy Annually',
    description: 'Review and update timely warning policy and procedures to ensure compliance.',
    category: 'Timely Warnings',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-07-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-5b',
    parentTempId: 'section-5',
    title: 'Test Warning Distribution System',
    description: 'Conduct semi-annual test of all timely warning notification methods.',
    category: 'Timely Warnings',
    priority: 'high',
    assignedRole: 'IT Security',
    dueDate: null,
    recurringSchedule: 'semi-annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-5c',
    parentTempId: 'section-5',
    title: 'Document All Timely Warning Decisions',
    description: 'Maintain documentation of all timely warning decisions including rationale.',
    category: 'Timely Warnings',
    priority: 'critical',
    assignedRole: 'Campus Security',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 6: Emergency Notification System ===
  {
    tempId: 'section-6',
    title: 'Emergency Notification System',
    description: 'Maintain emergency notification and evacuation procedures.',
    category: 'Emergency Notifications',
    priority: 'critical',
    assignedRole: 'Emergency Management',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-6a',
    parentTempId: 'section-6',
    title: 'Review Emergency Procedures Annually',
    description: 'Annual review of emergency response and evacuation procedures.',
    category: 'Emergency Notifications',
    priority: 'critical',
    assignedRole: 'Emergency Management',
    dueDate: '2026-06-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-6b',
    parentTempId: 'section-6',
    title: 'Conduct Annual Emergency Drill',
    description: 'Conduct at least one emergency notification test per calendar year.',
    category: 'Emergency Notifications',
    priority: 'critical',
    assignedRole: 'Emergency Management',
    dueDate: null,
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-6c',
    parentTempId: 'section-6',
    title: 'Document Drill Results',
    description: 'Document date, time, description, and assessment of each emergency drill.',
    category: 'Emergency Notifications',
    priority: 'high',
    assignedRole: 'Emergency Management',
    dueDate: null,
    recurringSchedule: 'after each drill',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 7: Missing Student Notification Procedures ===
  {
    tempId: 'section-7',
    title: 'Missing Student Notification Procedures',
    description: 'Maintain missing student notification procedures for residential students.',
    category: 'Missing Students',
    priority: 'high',
    assignedRole: 'Student Affairs',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-7a',
    parentTempId: 'section-7',
    title: 'Review Missing Student Policy',
    description: 'Annual review of missing student notification policy and procedures.',
    category: 'Missing Students',
    priority: 'high',
    assignedRole: 'Student Affairs',
    dueDate: '2026-07-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-7b',
    parentTempId: 'section-7',
    title: 'Collect Emergency Contacts',
    description: 'Ensure all residential students provide emergency contact information.',
    category: 'Missing Students',
    priority: 'high',
    assignedRole: 'Housing',
    dueDate: '2026-09-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-7c',
    parentTempId: 'section-7',
    title: 'Train Residence Staff',
    description: 'Train residence life staff on missing student procedures.',
    category: 'Missing Students',
    priority: 'high',
    assignedRole: 'Housing',
    dueDate: '2026-08-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 8: Annual Fire Safety Report ===
  {
    tempId: 'section-8',
    title: 'Annual Fire Safety Report',
    description: 'Prepare and publish the Annual Fire Safety Report for residential facilities.',
    category: 'Fire Safety',
    priority: 'critical',
    assignedRole: 'Fire Safety Officer',
    dueDate: '2026-10-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-8a',
    parentTempId: 'section-8',
    title: 'Compile Fire Statistics (3-Year Data)',
    description: 'Gather fire statistics for all on-campus student housing for previous 3 years.',
    category: 'Fire Safety',
    priority: 'high',
    assignedRole: 'Fire Safety Officer',
    dueDate: '2026-08-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-8b',
    parentTempId: 'section-8',
    title: 'Document Fire Safety Systems',
    description: 'Document fire safety systems in each residential facility.',
    category: 'Fire Safety',
    priority: 'high',
    assignedRole: 'Fire Safety Officer',
    dueDate: '2026-08-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-8c',
    parentTempId: 'section-8',
    title: 'Conduct Fire Drills',
    description: 'Conduct and document fire drills in all residential facilities.',
    category: 'Fire Safety',
    priority: 'high',
    assignedRole: 'Fire Safety Officer',
    dueDate: null,
    recurringSchedule: 'semi-annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-8d',
    parentTempId: 'section-8',
    title: 'Publish Fire Safety Report',
    description: 'Publish Annual Fire Safety Report by October 1.',
    category: 'Fire Safety',
    priority: 'critical',
    assignedRole: 'Fire Safety Officer',
    dueDate: '2026-10-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 9: Violence Against Women Act (VAWA) Compliance ===
  {
    tempId: 'section-9',
    title: 'Violence Against Women Act (VAWA) Compliance',
    description: 'Maintain VAWA compliance including prevention programs and policy statements.',
    category: 'VAWA Compliance',
    priority: 'critical',
    assignedRole: 'Title IX Coordinator',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-9a',
    parentTempId: 'section-9',
    title: 'Review VAWA Policy Statements',
    description: 'Annual review of policies on domestic violence, dating violence, sexual assault, and stalking.',
    category: 'VAWA Compliance',
    priority: 'critical',
    assignedRole: 'Title IX Coordinator',
    dueDate: '2026-07-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-9b',
    parentTempId: 'section-9',
    title: 'Conduct Primary Prevention Programs',
    description: 'Provide prevention programs for incoming students and new employees.',
    category: 'VAWA Compliance',
    priority: 'critical',
    assignedRole: 'Title IX Coordinator',
    dueDate: '2026-09-30',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-9c',
    parentTempId: 'section-9',
    title: 'Conduct Ongoing Awareness Campaigns',
    description: 'Provide ongoing prevention and awareness campaigns throughout the year.',
    category: 'VAWA Compliance',
    priority: 'high',
    assignedRole: 'Title IX Coordinator',
    dueDate: null,
    recurringSchedule: 'ongoing',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-9d',
    parentTempId: 'section-9',
    title: 'Train Hearing Officials',
    description: 'Train officials conducting disciplinary proceedings on VAWA issues.',
    category: 'VAWA Compliance',
    priority: 'critical',
    assignedRole: 'Title IX Coordinator',
    dueDate: '2026-08-15',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-9e',
    parentTempId: 'section-9',
    title: 'Review Victim Rights Notifications',
    description: 'Ensure written victim notification procedures include all VAWA-required rights.',
    category: 'VAWA Compliance',
    priority: 'critical',
    assignedRole: 'Title IX Coordinator',
    dueDate: '2026-07-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },

  // === SECTION 10: Clery Geography Documentation ===
  {
    tempId: 'section-10',
    title: 'Clery Geography Documentation',
    description: 'Maintain accurate documentation of Clery geography boundaries.',
    category: 'Geography',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-06-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-10a',
    parentTempId: 'section-10',
    title: 'Review On-Campus Property Boundaries',
    description: 'Review and update on-campus property boundaries for crime reporting.',
    category: 'Geography',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-06-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-10b',
    parentTempId: 'section-10',
    title: 'Update Non-Campus Property List',
    description: 'Review and update list of non-campus buildings and properties.',
    category: 'Geography',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-06-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  },
  {
    tempId: 'task-10c',
    parentTempId: 'section-10',
    title: 'Map Public Property Areas',
    description: 'Review and update public property areas adjacent to campus.',
    category: 'Geography',
    priority: 'high',
    assignedRole: 'Clery Compliance Officer',
    dueDate: '2026-06-01',
    recurringSchedule: 'annual',
    evidenceRequired: true,
    evidenceType: 'document'
  }
];

async function generateCleryTasks() {
  console.log('='.repeat(70));
  console.log('GENERATING HIERARCHICAL CLERY ACT COMPLIANCE TASKS');
  console.log('='.repeat(70));
  console.log(`Total tasks: ${cleryTasks.length} (10 sections + 32 subtasks = 42)`);
  console.log('');

  // Get Clery Act regulation ID
  const cleryResult = await pool.query(
    "SELECT id, reg_key, name FROM regulations WHERE reg_key = 'REG-001'"
  );

  if (cleryResult.rows.length === 0) {
    console.error('ERROR: Clery Act (REG-001) not found!');
    process.exit(1);
  }

  const cleryRegId = cleryResult.rows[0].id;
  console.log(`Found Clery Act: ID=${cleryRegId}, RegKey=REG-001`);

  // Delete existing tasks
  const deleteResult = await pool.query(
    'DELETE FROM regulation_tasks WHERE regulation_id = $1',
    [cleryRegId]
  );
  console.log(`Deleted ${deleteResult.rowCount} existing tasks\n`);

  // Insert hierarchical tasks
  let sections = 0;
  let subtasks = 0;
  
  for (let i = 0; i < cleryTasks.length; i++) {
    const task = cleryTasks[i];
    const isSection = !task.parentTempId;
    
    if (isSection) sections++;
    else subtasks++;

    await pool.query(`
      INSERT INTO regulation_tasks (
        regulation_id,
        title,
        description,
        category,
        priority,
        assigned_role,
        evidence_required,
        evidence_type,
        sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      cleryRegId,
      task.title,
      task.description,
      task.category,
      task.priority,
      task.assignedRole,
      task.evidenceRequired || false,
      task.evidenceType || 'document',
      i
    ]);
  }

  console.log(`✅ Inserted ${sections} sections + ${subtasks} subtasks = ${sections + subtasks} total tasks`);

  // Verify
  const verifyResult = await pool.query(
    'SELECT COUNT(*) as count FROM regulation_tasks WHERE regulation_id = $1',
    [cleryRegId]
  );
  
  console.log(`\nDatabase verification: ${verifyResult.rows[0].count} tasks`);

  // Show by category
  const categoryResult = await pool.query(`
    SELECT category, COUNT(*) as count
    FROM regulation_tasks
    WHERE regulation_id = $1
    GROUP BY category
    ORDER BY count DESC
  `, [cleryRegId]);

  console.log('\nTasks by Category:');
  categoryResult.rows.forEach(row => {
    console.log(`  ${row.category}: ${row.count}`);
  });

  await pool.end();
  console.log('\n✅ Hierarchical Clery Act task generation complete!');
}

generateCleryTasks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
