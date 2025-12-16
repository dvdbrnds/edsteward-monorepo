#!/usr/bin/env node
/**
 * Seed Clery Act Compliance Tasks
 * 
 * Pre-populates the compliance_tasks table with the full Clery Act checklist
 * for the Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Clery Act regulation ID (found via query)
const CLERY_REGULATION_ID = 9;

// Task template with hierarchical structure
// Parent tasks have children referenced by parentIndex
const cleryTasks = [
  // ===== SECTION 1: Annual Security Report (ASR) =====
  {
    title: 'Annual Security Report (ASR) Publication',
    description: 'Prepare and publish the Annual Security Report by October 1st each year',
    assignedRole: 'Compliance Officer',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-01',
    children: [
      {
        title: 'Gather Crime Statistics (3-Year Data)',
        description: 'Collect crime statistics from campus police, local law enforcement, and campus security authorities for the past three calendar years',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-07-01',
      },
      {
        title: 'Compile Policy Statements',
        description: 'Gather all required policy statements including security procedures, crime prevention, alcohol/drug policies, sexual assault policies, etc.',
        assignedRole: 'Compliance Officer',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        title: 'Legal Review of ASR Draft',
        description: 'Submit the draft ASR for legal counsel review to ensure compliance with all Clery Act requirements',
        assignedRole: 'Legal Counsel',
        priority: 'high',
        evidenceRequired: false,
        dueDate: '2025-09-01',
      },
      {
        title: 'Distribute ASR to Campus Community',
        description: 'Distribute the final ASR to all current students, employees, and make available to prospective students/employees',
        assignedRole: 'Communications Director',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-10-01',
      },
    ],
  },

  // ===== SECTION 2: DOE Submission =====
  {
    title: 'Department of Education Crime Statistics Submission',
    description: 'Submit crime statistics to the Department of Education via the Campus Safety and Security Survey',
    assignedRole: 'Compliance Officer',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-15',
    children: [
      {
        title: 'Complete Campus Safety and Security Survey',
        description: 'Enter all required crime statistics into the DOE web-based data collection system',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'screenshot',
        dueDate: '2025-10-10',
      },
      {
        title: 'Verify Submission Confirmation',
        description: 'Obtain and file confirmation of successful submission to DOE',
        assignedRole: 'Compliance Officer',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-10-15',
      },
    ],
  },

  // ===== SECTION 3: Daily Crime Log =====
  {
    title: 'Daily Crime Log Maintenance',
    description: 'Maintain a public daily crime log recording all crimes reported to campus police/security',
    assignedRole: 'Director of Campus Safety',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Establish Crime Log Procedures',
        description: 'Document procedures for maintaining and updating the daily crime log within two business days of a report',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Ensure Public Accessibility',
        description: 'Verify the crime log is available for public inspection during normal business hours',
        assignedRole: 'Campus Police Officer',
        priority: 'medium',
        evidenceRequired: false,
      },
    ],
  },

  // ===== SECTION 4: Campus Security Authorities (CSAs) =====
  {
    title: 'Campus Security Authority (CSA) Program',
    description: 'Identify, train, and maintain records of all Campus Security Authorities',
    assignedRole: 'HR Manager',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-09-01',
    children: [
      {
        title: 'Identify All CSAs',
        description: 'Compile comprehensive list of all individuals designated as Campus Security Authorities based on their job functions',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        title: 'Conduct Annual CSA Training',
        description: 'Provide mandatory training to all CSAs on their reporting obligations and crime definitions',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-09-01',
      },
      {
        title: 'Establish CSA Reporting Mechanism',
        description: 'Create and distribute CSA crime report forms and establish submission procedures',
        assignedRole: 'Director of Campus Safety',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'form',
      },
    ],
  },

  // ===== SECTION 5: Timely Warnings =====
  {
    title: 'Timely Warning System',
    description: 'Establish and maintain procedures for issuing timely warnings about Clery crimes posing ongoing threats',
    assignedRole: 'Emergency Management Director',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Develop Timely Warning Policy',
        description: 'Document criteria for issuing timely warnings, responsible parties, and distribution methods',
        assignedRole: 'Emergency Management Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Train Staff on Timely Warning Procedures',
        description: 'Train relevant personnel on when and how to issue timely warnings',
        assignedRole: 'Emergency Management Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Test Timely Warning Distribution',
        description: 'Conduct periodic tests of timely warning distribution systems',
        assignedRole: 'IT Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 6: Emergency Notification =====
  {
    title: 'Emergency Notification System',
    description: 'Maintain emergency notification procedures for immediate threats to campus',
    assignedRole: 'Emergency Management Director',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Document Emergency Notification Procedures',
        description: 'Establish procedures for confirming emergencies, determining notification content, and initiating the system',
        assignedRole: 'Emergency Management Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Annual Emergency Notification Test',
        description: 'Conduct and document at least one annual test of the emergency notification system',
        assignedRole: 'IT Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-09-15',
      },
      {
        title: 'Publicize Test Results',
        description: 'Document and publicize the emergency notification test results as required',
        assignedRole: 'Communications Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 7: Missing Student Procedures =====
  {
    title: 'Missing Student Notification Procedures',
    description: 'Establish procedures for students in on-campus housing reported as missing',
    assignedRole: 'Dean of Students',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Develop Missing Student Policy',
        description: 'Document procedures for handling missing student reports including notification timelines',
        assignedRole: 'Dean of Students',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Confidential Contact Registration',
        description: 'Provide mechanism for residential students to register a confidential emergency contact',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'form',
      },
      {
        title: 'Inform Students of Procedures',
        description: 'Notify all residential students of missing student notification procedures annually',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 8: Fire Safety =====
  {
    title: 'Annual Fire Safety Report',
    description: 'Prepare and publish the Annual Fire Safety Report for on-campus student housing',
    assignedRole: 'Director of Facilities',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-01',
    children: [
      {
        title: 'Gather Fire Statistics',
        description: 'Collect fire statistics for on-campus student housing facilities for the past three calendar years',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-07-01',
      },
      {
        title: 'Document Fire Safety Systems',
        description: 'Compile information on fire safety systems in each on-campus student housing facility',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        title: 'Conduct Fire Drills',
        description: 'Conduct and document fire drills in all on-campus student housing facilities',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Distribute Fire Safety Report',
        description: 'Publish and distribute the Fire Safety Report by October 1st',
        assignedRole: 'Communications Director',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-10-01',
      },
    ],
  },

  // ===== SECTION 9: VAWA Compliance =====
  {
    title: 'Violence Against Women Act (VAWA) Compliance',
    description: 'Maintain policies and programs for domestic violence, dating violence, sexual assault, and stalking',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'VAWA Policy Development',
        description: 'Maintain comprehensive policies addressing domestic violence, dating violence, sexual assault, and stalking',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Primary Prevention Programs (New Students)',
        description: 'Provide primary prevention and awareness programs for all incoming students',
        assignedRole: 'Student Affairs VP',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Primary Prevention Programs (New Employees)',
        description: 'Provide primary prevention and awareness programs for all new employees',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Ongoing Awareness Campaigns',
        description: 'Conduct ongoing prevention and awareness campaigns for the campus community',
        assignedRole: 'Student Affairs VP',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Train Disciplinary Officials',
        description: 'Ensure annual training for all officials involved in disciplinary proceedings on VAWA-related issues',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 10: Geography Definitions =====
  {
    title: 'Clery Geography Documentation',
    description: 'Maintain accurate documentation of Clery geography (on-campus, non-campus, public property)',
    assignedRole: 'Director of Campus Safety',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Map Campus Geography',
        description: 'Create and maintain maps showing all Clery geography categories',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Identify Non-Campus Locations',
        description: 'Identify and document all non-campus buildings and properties owned/controlled by the institution',
        assignedRole: 'Director of Facilities',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Review Geography Annually',
        description: 'Conduct annual review of Clery geography to capture any changes',
        assignedRole: 'Compliance Officer',
        priority: 'medium',
        evidenceRequired: false,
        dueDate: '2025-06-01',
      },
    ],
  },
];

async function seedCleryTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    
    // Check if tasks already exist
    const existingCheck = await client.query(
      'SELECT COUNT(*) as count FROM compliance_tasks WHERE regulation_id = $1',
      [CLERY_REGULATION_ID]
    );
    
    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log('⚠️  Tasks already exist for Clery Act regulation. Skipping...');
      console.log('   To re-seed, first delete existing tasks with:');
      console.log(`   DELETE FROM compliance_tasks WHERE regulation_id = ${CLERY_REGULATION_ID};`);
      return;
    }
    
    await client.query('BEGIN');
    
    let sortOrder = 1;
    let totalTasks = 0;
    
    for (const parentTask of cleryTasks) {
      // Insert parent task
      const parentResult = await client.query(
        `INSERT INTO compliance_tasks 
         (regulation_id, parent_task_id, title, description, assigned_role, priority, 
          evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())
         RETURNING id`,
        [
          CLERY_REGULATION_ID,
          parentTask.title,
          parentTask.description,
          parentTask.assignedRole,
          parentTask.priority,
          parentTask.evidenceRequired,
          parentTask.evidenceType || 'document',
          parentTask.dueDate || null,
          sortOrder++,
        ]
      );
      
      const parentId = parentResult.rows[0].id;
      totalTasks++;
      console.log(`✅ Created parent task: ${parentTask.title}`);
      
      // Insert child tasks
      if (parentTask.children) {
        for (const childTask of parentTask.children) {
          await client.query(
            `INSERT INTO compliance_tasks 
             (regulation_id, parent_task_id, title, description, assigned_role, priority,
              evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW(), NOW())`,
            [
              CLERY_REGULATION_ID,
              parentId,
              childTask.title,
              childTask.description,
              childTask.assignedRole,
              childTask.priority,
              childTask.evidenceRequired,
              childTask.evidenceType || 'document',
              childTask.dueDate || null,
              sortOrder++,
            ]
          );
          totalTasks++;
          console.log(`   └─ Created sub-task: ${childTask.title}`);
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n🎉 Successfully seeded Clery Act compliance tasks!');
    console.log(`   Total tasks created: ${totalTasks}`);
    console.log(`   Regulation ID: ${CLERY_REGULATION_ID}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding tasks:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
seedCleryTasks().catch(console.error);

