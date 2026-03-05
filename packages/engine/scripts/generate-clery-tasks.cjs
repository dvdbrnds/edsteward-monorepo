/**
 * Generate Comprehensive Clery Act Compliance Tasks
 * 
 * The Clery Act requires extensive compliance activities:
 * - Annual Security Report (ASR) preparation and distribution
 * - Crime statistics collection and reporting
 * - Timely warning and emergency notification systems
 * - Campus security authority training
 * - VAWA compliance additions
 * - Fire safety reporting (for residential facilities)
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.USER,
  password: '',
});

// Comprehensive Clery Act compliance tasks
const cleryTasks = [
  // === ANNUAL SECURITY REPORT (ASR) ===
  {
    title: 'Compile Annual Crime Statistics',
    description: 'Gather crime statistics from campus security, local law enforcement, and other campus security authorities for the previous 3 calendar years.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'September 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '40 hours'
  },
  {
    title: 'Request Crime Data from Local Law Enforcement',
    description: 'Submit formal written requests to local police departments for crime statistics occurring on or near campus property.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Identify and Map Clery Geography',
    description: 'Review and update the campus Clery geography including on-campus, non-campus, and public property boundaries.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'June 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Draft Annual Security Report Content',
    description: 'Write the narrative sections of the ASR including policy statements, crime prevention programs, and emergency procedures.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'August 15',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '60 hours'
  },
  {
    title: 'Review ASR with Legal Counsel',
    description: 'Submit draft Annual Security Report for legal review to ensure compliance with all Clery Act requirements.',
    category: 'Annual Security Report',
    assignedRole: 'General Counsel',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'September 15',
    evidenceRequired: true,
    evidenceType: 'attestation',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Publish and Distribute ASR',
    description: 'Publish the Annual Security Report on the institution website and notify all students and employees of its availability by October 1.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'October 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Submit Crime Statistics to Department of Education',
    description: 'Submit annual crime statistics through the Department of Education\'s web-based data collection system.',
    category: 'Annual Security Report',
    assignedRole: 'Clery Compliance Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'October 15',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },

  // === CAMPUS SECURITY AUTHORITIES (CSA) ===
  {
    title: 'Identify Campus Security Authorities',
    description: 'Maintain an updated list of all individuals who qualify as Campus Security Authorities under Clery.',
    category: 'Campus Security Authorities',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'August 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Conduct CSA Training',
    description: 'Provide annual training to all Campus Security Authorities on their reporting obligations and crime classification.',
    category: 'Campus Security Authorities',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'September 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '24 hours'
  },
  {
    title: 'Distribute CSA Reporting Forms',
    description: 'Ensure all CSAs have access to and understand how to complete crime incident reporting forms.',
    category: 'Campus Security Authorities',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'September 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },
  {
    title: 'Collect and Review CSA Reports',
    description: 'Gather all CSA crime reports quarterly and incorporate into crime statistics database.',
    category: 'Campus Security Authorities',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'quarterly',
    dueDate: 'Quarterly',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },

  // === TIMELY WARNINGS ===
  {
    title: 'Review Timely Warning Policy',
    description: 'Annual review of timely warning policy to ensure it meets Clery requirements and reflects current practices.',
    category: 'Timely Warnings',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Test Timely Warning Distribution System',
    description: 'Conduct test of the timely warning notification system to ensure all methods (email, text, website) function properly.',
    category: 'Timely Warnings',
    assignedRole: 'IT Security',
    priority: 'high',
    frequency: 'semi-annual',
    dueDate: 'Semi-annual',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },
  {
    title: 'Document Timely Warning Decisions',
    description: 'Maintain documentation of all timely warning decisions including rationale for issuance or non-issuance.',
    category: 'Timely Warnings',
    assignedRole: 'Campus Security',
    priority: 'critical',
    frequency: 'ongoing',
    dueDate: 'As needed',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '2 hours per incident'
  },

  // === EMERGENCY NOTIFICATIONS ===
  {
    title: 'Review Emergency Response Procedures',
    description: 'Annual review of emergency response and evacuation procedures to ensure they meet Clery requirements.',
    category: 'Emergency Notifications',
    assignedRole: 'Emergency Management',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'June 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Conduct Emergency Notification Drill',
    description: 'Conduct at least one announced or unannounced emergency notification test per calendar year.',
    category: 'Emergency Notifications',
    assignedRole: 'Emergency Management',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'Annual',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Document Emergency Drill Results',
    description: 'Document the date, time, description, and assessment of each emergency drill for ASR inclusion.',
    category: 'Emergency Notifications',
    assignedRole: 'Emergency Management',
    priority: 'high',
    frequency: 'after each drill',
    dueDate: 'Within 7 days',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },
  {
    title: 'Update Emergency Contact Information',
    description: 'Ensure emergency contact systems have current student and employee contact information.',
    category: 'Emergency Notifications',
    assignedRole: 'IT Security',
    priority: 'high',
    frequency: 'semi-annual',
    dueDate: 'Semi-annual',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },

  // === VAWA COMPLIANCE ===
  {
    title: 'Review VAWA Policy Statements',
    description: 'Review and update policy statements on domestic violence, dating violence, sexual assault, and stalking.',
    category: 'VAWA Compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Conduct VAWA Prevention Programs',
    description: 'Provide primary prevention and awareness programs for incoming students and new employees.',
    category: 'VAWA Compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'September 30',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '40 hours'
  },
  {
    title: 'Conduct Ongoing VAWA Prevention',
    description: 'Provide ongoing prevention and awareness campaigns for students and employees throughout the year.',
    category: 'VAWA Compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    frequency: 'ongoing',
    dueDate: 'Ongoing',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '20 hours'
  },
  {
    title: 'Train Staff on VAWA Procedures',
    description: 'Train officials who conduct disciplinary proceedings on issues related to domestic violence, dating violence, sexual assault, and stalking.',
    category: 'VAWA Compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'August 15',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Review Victim Rights Procedures',
    description: 'Ensure written notification procedures for victims include all rights required under VAWA amendments.',
    category: 'VAWA Compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },

  // === DAILY CRIME LOG ===
  {
    title: 'Maintain Daily Crime Log',
    description: 'Record all crimes reported to campus security in the daily crime log within 2 business days.',
    category: 'Crime Log',
    assignedRole: 'Campus Security',
    priority: 'critical',
    frequency: 'daily',
    dueDate: 'Daily',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '1 hour per day'
  },
  {
    title: 'Make Crime Log Publicly Available',
    description: 'Ensure the daily crime log is open for public inspection during normal business hours.',
    category: 'Crime Log',
    assignedRole: 'Campus Security',
    priority: 'high',
    frequency: 'ongoing',
    dueDate: 'Ongoing',
    evidenceRequired: true,
    evidenceType: 'attestation',
    estimatedEffort: '2 hours'
  },
  {
    title: 'Review Crime Log Entries for Accuracy',
    description: 'Monthly review of crime log entries to ensure accuracy and completeness of information.',
    category: 'Crime Log',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'monthly',
    dueDate: 'Monthly',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },

  // === FIRE SAFETY (Residential) ===
  {
    title: 'Compile Fire Safety Statistics',
    description: 'Gather fire statistics for all on-campus student housing facilities for the previous 3 calendar years.',
    category: 'Fire Safety',
    assignedRole: 'Fire Safety Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'August 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '16 hours'
  },
  {
    title: 'Document Fire Safety Systems',
    description: 'Document fire safety systems in each on-campus student housing facility including sprinklers, alarms, and extinguishers.',
    category: 'Fire Safety',
    assignedRole: 'Fire Safety Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'August 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Conduct Fire Drills',
    description: 'Conduct fire drills in residential facilities and document dates, times, and participation.',
    category: 'Fire Safety',
    assignedRole: 'Fire Safety Officer',
    priority: 'high',
    frequency: 'semi-annual',
    dueDate: 'Semi-annual',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours per drill'
  },
  {
    title: 'Draft Annual Fire Safety Report',
    description: 'Prepare the Annual Fire Safety Report including fire statistics, policies, and evacuation procedures.',
    category: 'Fire Safety',
    assignedRole: 'Fire Safety Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'September 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '24 hours'
  },
  {
    title: 'Publish Fire Safety Report',
    description: 'Publish the Annual Fire Safety Report by October 1 and notify all students and employees.',
    category: 'Fire Safety',
    assignedRole: 'Fire Safety Officer',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'October 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },

  // === POLICY STATEMENTS ===
  {
    title: 'Review Missing Student Policy',
    description: 'Annual review of missing student notification policy for students residing in on-campus housing.',
    category: 'Policy Statements',
    assignedRole: 'Student Affairs',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },
  {
    title: 'Review Security Awareness Programs',
    description: 'Document and review security awareness and crime prevention programs offered to students and employees.',
    category: 'Policy Statements',
    assignedRole: 'Campus Security',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Review Campus Security Policies',
    description: 'Review policies on reporting crimes, security of campus facilities, and access to buildings.',
    category: 'Policy Statements',
    assignedRole: 'Campus Security',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  },
  {
    title: 'Review Drug and Alcohol Policies',
    description: 'Review institutional policies on alcohol and drug use and enforcement of state underage drinking laws.',
    category: 'Policy Statements',
    assignedRole: 'Student Affairs',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'July 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours'
  },
  {
    title: 'Update Sex Offender Registry Information',
    description: 'Ensure information about accessing sex offender registry is included in ASR and available to campus community.',
    category: 'Policy Statements',
    assignedRole: 'Clery Compliance Officer',
    priority: 'medium',
    frequency: 'annual',
    dueDate: 'September 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '2 hours'
  },

  // === MONITORING & COMPLIANCE ===
  {
    title: 'Conduct Clery Compliance Audit',
    description: 'Comprehensive internal audit of Clery Act compliance including all reporting and policy requirements.',
    category: 'Compliance Monitoring',
    assignedRole: 'Internal Audit',
    priority: 'critical',
    frequency: 'annual',
    dueDate: 'May 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '40 hours'
  },
  {
    title: 'Review for Program Review Readiness',
    description: 'Prepare documentation and procedures for potential Department of Education Clery program review.',
    category: 'Compliance Monitoring',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'annual',
    dueDate: 'June 1',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '24 hours'
  },
  {
    title: 'Monitor Regulatory Changes',
    description: 'Monitor Department of Education guidance and regulatory changes affecting Clery compliance.',
    category: 'Compliance Monitoring',
    assignedRole: 'Clery Compliance Officer',
    priority: 'medium',
    frequency: 'ongoing',
    dueDate: 'Ongoing',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '4 hours per month'
  },
  {
    title: 'Report Compliance Status to Leadership',
    description: 'Provide quarterly Clery compliance status report to institutional leadership and board.',
    category: 'Compliance Monitoring',
    assignedRole: 'Clery Compliance Officer',
    priority: 'high',
    frequency: 'quarterly',
    dueDate: 'Quarterly',
    evidenceRequired: true,
    evidenceType: 'document',
    estimatedEffort: '8 hours'
  }
];

async function generateCleryTasks() {
  console.log('='.repeat(70));
  console.log('GENERATING COMPREHENSIVE CLERY ACT COMPLIANCE TASKS');
  console.log('='.repeat(70));
  console.log(`Total tasks to generate: ${cleryTasks.length}\n`);

  // Get Clery Act regulation ID
  const cleryResult = await pool.query(
    "SELECT id, reg_key, name FROM regulations WHERE reg_key = 'REG-001'"
  );

  if (cleryResult.rows.length === 0) {
    console.error('ERROR: Clery Act (REG-001) not found in database!');
    process.exit(1);
  }

  const cleryRegId = cleryResult.rows[0].id;
  console.log(`Found Clery Act: ID=${cleryRegId}, RegKey=${cleryResult.rows[0].reg_key}`);
  console.log(`Name: ${cleryResult.rows[0].name}\n`);

  // Delete existing tasks
  const deleteResult = await pool.query(
    'DELETE FROM regulation_tasks WHERE regulation_id = $1',
    [cleryRegId]
  );
  console.log(`Deleted ${deleteResult.rowCount} existing tasks\n`);

  // Insert new comprehensive tasks
  let inserted = 0;
  for (let i = 0; i < cleryTasks.length; i++) {
    const task = cleryTasks[i];
    
    await pool.query(`
      INSERT INTO regulation_tasks (
        regulation_id,
        title,
        description,
        category,
        priority,
        assigned_role,
        estimated_effort,
        evidence_required,
        evidence_type,
        sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      cleryRegId,
      task.title,
      task.description,
      task.category,
      task.priority,
      task.assignedRole,
      task.estimatedEffort,
      task.evidenceRequired || false,
      task.evidenceType || 'document',
      i
    ]);
    
    inserted++;
  }

  console.log(`✅ Inserted ${inserted} comprehensive Clery Act tasks\n`);

  // Verify
  const verifyResult = await pool.query(
    'SELECT COUNT(*) as count FROM regulation_tasks WHERE regulation_id = $1',
    [cleryRegId]
  );
  
  console.log('='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Total Clery Act tasks in database: ${verifyResult.rows[0].count}`);

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

  // Show by priority
  const priorityResult = await pool.query(`
    SELECT priority, COUNT(*) as count
    FROM regulation_tasks
    WHERE regulation_id = $1
    GROUP BY priority
    ORDER BY 
      CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
  `, [cleryRegId]);

  console.log('\nTasks by Priority:');
  priorityResult.rows.forEach(row => {
    console.log(`  ${row.priority}: ${row.count}`);
  });

  await pool.end();
  console.log('\n✅ Clery Act task generation complete!');
}

generateCleryTasks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
