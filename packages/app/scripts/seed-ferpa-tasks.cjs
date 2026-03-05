#!/usr/bin/env node
/**
 * Seed FERPA Compliance Tasks
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// FERPA regulation ID
const FERPA_REGULATION_ID = 223;

const ferpaTasks = [
  // ===== SECTION 1: ANNUAL NOTIFICATION =====
  {
    title: 'Annual FERPA Rights Notification',
    description: 'Provide annual notification to students and parents of their FERPA rights.',
    assignedRole: 'Registrar',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-08-15',
    children: [
      {
        title: 'Draft Notification Content',
        description: 'Prepare notification content including all required FERPA rights information.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        title: 'Legal Review of Notification',
        description: 'Have notification reviewed by legal counsel for compliance.',
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
        dueDate: '2025-08-10',
      },
      {
        title: 'Distribute to All Students',
        description: 'Send notification via email and post in student portal.',
        assignedRole: 'IT Services',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-15',
      },
    ],
  },

  // ===== SECTION 2: RECORD ACCESS PROCEDURES =====
  {
    title: 'Education Record Access Procedures',
    description: 'Maintain procedures for students/parents to access education records.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Document Access Request Process',
        description: 'Document the procedure for requesting access to education records.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Train Staff on Access Procedures',
        description: 'Ensure all staff who handle records know the access procedures.',
        assignedRole: 'Training Coordinator',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Establish 45-Day Response Timeline',
        description: 'Ensure system tracks and enforces 45-day response requirement.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
      },
    ],
  },

  // ===== SECTION 3: AMENDMENT PROCEDURES =====
  {
    title: 'Record Amendment Procedures',
    description: 'Maintain procedures for students to request amendments to records.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Document Amendment Request Process',
        description: 'Create and publish procedure for requesting record amendments.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Establish Hearing Procedures',
        description: 'Document formal hearing procedures for disputed amendment requests.',
        assignedRole: 'Student Affairs',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 4: DISCLOSURE POLICIES =====
  {
    title: 'Disclosure and Consent Policies',
    description: 'Maintain policies governing disclosure of education records.',
    assignedRole: 'Registrar',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Document Consent Requirements',
        description: 'Specify when written consent is required for disclosure.',
        assignedRole: 'Registrar',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Define FERPA Exceptions',
        description: 'Document all disclosure exceptions (school officials, health/safety, etc.).',
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Maintain Disclosure Log',
        description: 'Keep record of all disclosures made without consent.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
      },
    ],
  },

  // ===== SECTION 5: DIRECTORY INFORMATION =====
  {
    title: 'Directory Information Policy',
    description: 'Establish and communicate directory information policies.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Define Directory Information Categories',
        description: 'Specify what information is designated as directory information.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Publish Opt-Out Procedures',
        description: 'Provide mechanism for students to opt out of directory information disclosure.',
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'link',
      },
      {
        title: 'Annual Opt-Out Reminder',
        description: 'Send annual reminder about opt-out rights.',
        assignedRole: 'Communications',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-15',
      },
    ],
  },

  // ===== SECTION 6: STAFF TRAINING =====
  {
    title: 'FERPA Staff Training Program',
    description: 'Ensure all staff with access to records receive FERPA training.',
    assignedRole: 'HR Manager',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-09-30',
    children: [
      {
        title: 'Develop Training Materials',
        description: 'Create comprehensive FERPA training content.',
        assignedRole: 'Training Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Conduct New Employee Training',
        description: 'Train all new employees with record access within 30 days.',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Annual Refresher Training',
        description: 'Provide annual FERPA refresher for all staff.',
        assignedRole: 'Training Coordinator',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-09-30',
      },
    ],
  },
];

async function seedFerpaTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    
    const existingCheck = await client.query(
      'SELECT COUNT(*) as count FROM compliance_tasks WHERE regulation_id = $1',
      [FERPA_REGULATION_ID]
    );
    
    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log('⚠️  Tasks already exist for FERPA regulation. Skipping...');
      return;
    }
    
    await client.query('BEGIN');
    
    let sortOrder = 1;
    let totalTasks = 0;
    
    for (const parentTask of ferpaTasks) {
      const parentResult = await client.query(
        `INSERT INTO compliance_tasks 
         (regulation_id, parent_task_id, title, description, assigned_role, priority, 
          evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())
         RETURNING id`,
        [
          FERPA_REGULATION_ID,
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
      
      if (parentTask.children) {
        for (const childTask of parentTask.children) {
          await client.query(
            `INSERT INTO compliance_tasks 
             (regulation_id, parent_task_id, title, description, assigned_role, priority,
              evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW(), NOW())`,
            [
              FERPA_REGULATION_ID,
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
    
    console.log('\n🎉 Successfully seeded FERPA compliance tasks!');
    console.log(`   Total tasks created: ${totalTasks}`);
    console.log(`   Regulation ID: ${FERPA_REGULATION_ID}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding tasks:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedFerpaTasks().catch(console.error);

