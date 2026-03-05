#!/usr/bin/env node
/**
 * Seed Title IX Compliance Tasks
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Title IX regulation ID
const TITLE_IX_REGULATION_ID = 7;

const titleIXTasks = [
  // ===== SECTION 1: TITLE IX COORDINATOR =====
  {
    title: 'Title IX Coordinator Designation',
    description: 'Designate and publicize a Title IX Coordinator.',
    assignedRole: 'President',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Appoint Title IX Coordinator',
        description: 'Formally appoint a qualified Title IX Coordinator.',
        assignedRole: 'President',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Publish Contact Information',
        description: 'Post coordinator name, office, email, and phone prominently.',
        assignedRole: 'Web Communications',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'link',
      },
      {
        title: 'Include in Non-Discrimination Notice',
        description: 'Ensure coordinator info is in all non-discrimination notices.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 2: NON-DISCRIMINATION POLICY =====
  {
    title: 'Non-Discrimination Policy Publication',
    description: 'Publish and distribute Title IX non-discrimination policy.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Review Policy Language',
        description: 'Ensure policy covers all required protections and categories.',
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Post on Website',
        description: 'Prominently display policy on institution website.',
        assignedRole: 'Web Communications',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'link',
      },
      {
        title: 'Include in Handbooks',
        description: 'Include in student, faculty, and employee handbooks.',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
      },
    ],
  },

  // ===== SECTION 3: GRIEVANCE PROCEDURES =====
  {
    title: 'Title IX Grievance Procedures',
    description: 'Establish and publish grievance procedures for sex discrimination complaints.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Draft Grievance Procedures',
        description: 'Create comprehensive procedures meeting regulatory requirements.',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Legal Review of Procedures',
        description: 'Have procedures reviewed by legal counsel.',
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
      },
      {
        title: 'Establish Investigation Timelines',
        description: 'Define reasonable timeframes for investigation and resolution.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Create Appeal Process',
        description: 'Establish fair appeal procedures for both parties.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 4: TRAINING =====
  {
    title: 'Title IX Training Program',
    description: 'Provide required training to Title IX personnel.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-09-30',
    children: [
      {
        title: 'Train Title IX Coordinator',
        description: 'Ensure coordinator receives comprehensive training.',
        assignedRole: 'HR Manager',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Train Investigators',
        description: 'Train all investigators on investigation procedures.',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Train Decision-Makers',
        description: 'Train hearing officers and decision-makers.',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Post Training Materials',
        description: 'Make all training materials publicly available.',
        assignedRole: 'Web Communications',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'link',
      },
    ],
  },

  // ===== SECTION 5: SEXUAL HARASSMENT RESPONSE =====
  {
    title: 'Sexual Harassment Response Procedures',
    description: 'Maintain procedures for responding to sexual harassment reports.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Define Sexual Harassment',
        description: 'Clearly define what constitutes sexual harassment under Title IX.',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Establish Reporting Mechanisms',
        description: 'Create multiple ways to report harassment.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Document Supportive Measures',
        description: 'Define available supportive measures for complainants.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Create Emergency Removal Process',
        description: 'Establish process for emergency removal of respondents.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 6: RECORDKEEPING =====
  {
    title: 'Title IX Recordkeeping',
    description: 'Maintain required records of complaints and resolutions.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    children: [
      {
        title: 'Establish Record Retention Policy',
        description: 'Maintain records for 7 years minimum.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Document All Complaints',
        description: 'Keep records of all formal and informal complaints.',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
      },
      {
        title: 'Track Training Completion',
        description: 'Maintain records of all Title IX training.',
        assignedRole: 'Title IX Coordinator',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 7: ATHLETICS EQUITY =====
  {
    title: 'Athletics Equity Compliance',
    description: 'Ensure equal opportunity in athletic programs.',
    assignedRole: 'Athletics Director',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'Assess Participation Opportunities',
        description: 'Analyze equity in athletic participation opportunities.',
        assignedRole: 'Athletics Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Review Athletic Scholarships',
        description: 'Ensure scholarship distribution is proportional.',
        assignedRole: 'Athletics Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Evaluate Facilities and Equipment',
        description: 'Compare facilities and equipment across programs.',
        assignedRole: 'Athletics Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Submit EADA Report',
        description: 'Complete annual Equity in Athletics Disclosure Act report.',
        assignedRole: 'Athletics Director',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-10-15',
      },
    ],
  },

  // ===== SECTION 8: PREVENTION PROGRAMS =====
  {
    title: 'Prevention and Awareness Programs',
    description: 'Conduct prevention programs for students and employees.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        title: 'New Student Orientation Program',
        description: 'Include Title IX awareness in new student orientation.',
        assignedRole: 'Student Affairs',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'New Employee Training',
        description: 'Train all new employees on Title IX.',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        title: 'Ongoing Awareness Campaigns',
        description: 'Conduct campus-wide awareness programs.',
        assignedRole: 'Student Affairs',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },
];

async function seedTitleIXTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    
    const existingCheck = await client.query(
      'SELECT COUNT(*) as count FROM compliance_tasks WHERE regulation_id = $1',
      [TITLE_IX_REGULATION_ID]
    );
    
    if (parseInt(existingCheck.rows[0].count) > 0) {
      console.log('⚠️  Tasks already exist for Title IX regulation. Skipping...');
      return;
    }
    
    await client.query('BEGIN');
    
    let sortOrder = 1;
    let totalTasks = 0;
    
    for (const parentTask of titleIXTasks) {
      const parentResult = await client.query(
        `INSERT INTO compliance_tasks 
         (regulation_id, parent_task_id, title, description, assigned_role, priority, 
          evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())
         RETURNING id`,
        [
          TITLE_IX_REGULATION_ID,
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
              TITLE_IX_REGULATION_ID,
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
    
    console.log('\n🎉 Successfully seeded Title IX compliance tasks!');
    console.log(`   Total tasks created: ${totalTasks}`);
    console.log(`   Regulation ID: ${TITLE_IX_REGULATION_ID}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding tasks:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTitleIXTasks().catch(console.error);

