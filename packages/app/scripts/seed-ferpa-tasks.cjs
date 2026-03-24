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
    taskId: 'FERPA-001',
    title: 'Annual FERPA Rights Notification',
    description: 'Provide annual notification to students and parents of their FERPA rights.',
    instructions:
      'Plan the annual rights notification cycle, align content with current law and institutional policy, then distribute through approved channels before the start of each academic year.',
    category: 'Policy',
    statutoryRole: 'FERPA Compliance Officer',
    statutoryCitation: '20 USC 1232g(e)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    assignedRole: 'Registrar',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the finalized annual notification (PDF or portal screenshot) and proof of distribution.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Issued annual FERPA rights notification and distribution record',
    dueDate: '2025-08-15',
    children: [
      {
        taskId: 'FERPA-001-A',
        title: 'Draft Notification Content',
        description: 'Prepare notification content including all required FERPA rights information.',
        instructions:
          'Assemble required rights language, directory information, and complaint procedures; route draft for stakeholder review.',
        category: 'Policy',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g(e)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the draft notification document with version date.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Draft annual FERPA rights notification',
        dueDate: '2025-08-01',
      },
      {
        taskId: 'FERPA-001-B',
        title: 'Legal Review of Notification',
        description: 'Have notification reviewed by legal counsel for compliance.',
        instructions: 'Send the draft to counsel, incorporate edits, and retain written confirmation of review.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1232g(e)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Upload counsel sign-off email or memo approving the notification.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Documented legal review of the annual notification',
        dueDate: '2025-08-10',
      },
      {
        taskId: 'FERPA-001-C',
        title: 'Distribute to All Students',
        description: 'Send notification via email and post in student portal.',
        instructions: 'Schedule email sends, publish in the student portal, and confirm parents receive notice where applicable.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1232g(e)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        assignedRole: 'IT Services',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload screenshots or reports showing email delivery and portal publication.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Completed distribution with timestamps or reports',
        dueDate: '2025-08-15',
      },
    ],
  },

  // ===== SECTION 2: RECORD ACCESS PROCEDURES =====
  {
    taskId: 'FERPA-002',
    title: 'Education Record Access Procedures',
    description: 'Maintain procedures for students/parents to access education records.',
    instructions:
      'Publish and maintain written procedures for requesting and inspecting education records within the statutory timeframe.',
    category: 'Record Keeping',
    statutoryRole: 'Registrar',
    statutoryCitation: '20 USC 1232g(a)(1)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the current written access procedures and any office routing forms.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Maintained education record access procedures',
    children: [
      {
        taskId: 'FERPA-002-A',
        title: 'Document Access Request Process',
        description: 'Document the procedure for requesting access to education records.',
        instructions:
          'Describe intake, identity verification, response timelines, and how copies or inspections are provided.',
        category: 'Record Keeping',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(a)(1)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the published procedure document or handbook excerpt.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Written access request process documentation',
      },
      {
        taskId: 'FERPA-002-B',
        title: 'Train Staff on Access Procedures',
        description: 'Ensure all staff who handle records know the access procedures.',
        instructions: 'Deliver training and track completion for staff with record access.',
        category: 'Training',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g(a)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        assignedRole: 'Training Coordinator',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload attendance roster or LMS completion report.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Training completion records for records-access staff',
      },
      {
        taskId: 'FERPA-002-C',
        title: 'Establish 45-Day Response Timeline',
        description: 'Ensure system tracks and enforces 45-day response requirement.',
        instructions:
          'Configure workflow or ticketing so requests are date-stamped and escalated before the 45-day limit.',
        category: 'Record Keeping',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(a)(1)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Upload attestation or screenshot confirming 45-day tracking is active.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Operational 45-day response tracking (attestation or system evidence)',
      },
    ],
  },

  // ===== SECTION 3: AMENDMENT PROCEDURES =====
  {
    taskId: 'FERPA-003',
    title: 'Record Amendment Procedures',
    description: 'Maintain procedures for students to request amendments to records.',
    instructions:
      'Keep a clear process for amendment requests, hearings, and final decisions consistent with FERPA.',
    category: 'Record Keeping',
    statutoryRole: 'Registrar',
    statutoryCitation: '20 USC 1232g(a)(1)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the amendment policy and any request forms.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Maintained record amendment procedures',
    children: [
      {
        taskId: 'FERPA-003-A',
        title: 'Document Amendment Request Process',
        description: 'Create and publish procedure for requesting record amendments.',
        instructions: 'Publish steps, timelines, and decision notices for amendment requests.',
        category: 'Record Keeping',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(a)(1)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the published amendment request procedure.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Published amendment request process',
      },
      {
        taskId: 'FERPA-003-B',
        title: 'Establish Hearing Procedures',
        description: 'Document formal hearing procedures for disputed amendment requests.',
        instructions: 'Define hearing roles, notice, records, and outcome letters for disputes.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1232g(a)(1)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 7,
        assignedRole: 'Student Affairs',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload hearing procedure documentation approved by leadership.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Formal hearing procedure for amendment disputes',
      },
    ],
  },

  // ===== SECTION 4: DISCLOSURE POLICIES =====
  {
    taskId: 'FERPA-004',
    title: 'Disclosure and Consent Policies',
    description: 'Maintain policies governing disclosure of education records.',
    instructions:
      'Maintain written policies on consent, school-official sharing, and exceptions to consent for disclosures.',
    category: 'Policy',
    statutoryRole: 'FERPA Compliance Officer',
    statutoryCitation: '20 USC 1232g(b)(1)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    assignedRole: 'Registrar',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the consolidated disclosure and consent policy.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Current disclosure and consent policy suite',
    children: [
      {
        taskId: 'FERPA-004-A',
        title: 'Document Consent Requirements',
        description: 'Specify when written consent is required for disclosure.',
        instructions: 'List disclosure types requiring consent and required consent elements.',
        category: 'Policy',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g(b)(2)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 30,
        assignedRole: 'Registrar',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the consent requirements section of institutional policy.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Documented consent requirements for disclosures',
      },
      {
        taskId: 'FERPA-004-B',
        title: 'Define FERPA Exceptions',
        description: 'Document all disclosure exceptions (school officials, health/safety, etc.).',
        instructions: 'Map each statutory exception to institutional practice and approvals.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1232g(b)(1)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'General Counsel',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the exceptions matrix or policy appendix.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Written FERPA disclosure exceptions reference',
      },
      {
        taskId: 'FERPA-004-C',
        title: 'Maintain Disclosure Log',
        description: 'Keep record of all disclosures made without consent.',
        instructions: 'Ensure non-consensual disclosures are logged with recipient and purpose.',
        category: 'Record Keeping',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(b)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Upload attestation that the disclosure log is maintained or a redacted sample entry policy.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Ongoing disclosure log process (attestation or sample)',
      },
    ],
  },

  // ===== SECTION 5: DIRECTORY INFORMATION =====
  {
    taskId: 'FERPA-005',
    title: 'Directory Information Policy',
    description: 'Establish and communicate directory information policies.',
    instructions:
      'Designate directory categories, publish opt-out rights, and remind students annually of their choices.',
    category: 'Access Control',
    statutoryRole: 'Registrar',
    statutoryCitation: '20 USC 1232g(a)(5)(A)-(B)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload directory information policy and opt-out mechanism description.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Directory information policy and opt-out program evidence',
    children: [
      {
        taskId: 'FERPA-005-A',
        title: 'Define Directory Information Categories',
        description: 'Specify what information is designated as directory information.',
        instructions: 'List each data element classified as directory information and approval authority.',
        category: 'Access Control',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(a)(5)(A)-(B)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the official list of directory information elements.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Designated directory information categories list',
      },
      {
        taskId: 'FERPA-005-B',
        title: 'Publish Opt-Out Procedures',
        description: 'Provide mechanism for students to opt out of directory information disclosure.',
        instructions: 'Publish how to opt out, deadlines, and how opt-outs are honored across systems.',
        category: 'Access Control',
        statutoryRole: 'Registrar',
        statutoryCitation: '20 USC 1232g(a)(5)(A)-(B)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Registrar',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'link',
        evidenceInstructions: 'Provide URL or upload screenshot of opt-out instructions.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Published opt-out procedures (link or document)',
      },
      {
        taskId: 'FERPA-005-C',
        title: 'Annual Opt-Out Reminder',
        description: 'Send annual reminder about opt-out rights.',
        instructions: 'Schedule annual communications reminding students of directory opt-out rights.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1232g(a)(5)(A)-(B)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        assignedRole: 'Communications',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload copy of the annual reminder communication.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Annual opt-out reminder communication',
        dueDate: '2025-08-15',
      },
    ],
  },

  // ===== SECTION 6: STAFF TRAINING =====
  {
    taskId: 'FERPA-006',
    title: 'FERPA Staff Training Program',
    description: 'Ensure all staff with access to records receive FERPA training.',
    instructions:
      'Operate onboarding and refresher training so workforce members with record access understand FERPA obligations.',
    category: 'Training',
    statutoryRole: 'FERPA Compliance Officer',
    statutoryCitation: '20 USC 1232g',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    assignedRole: 'HR Manager',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training plan summary or LMS catalog listing FERPA modules.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Documented FERPA training program for staff with record access',
    dueDate: '2025-09-30',
    children: [
      {
        taskId: 'FERPA-006-A',
        title: 'Develop Training Materials',
        description: 'Create comprehensive FERPA training content.',
        instructions: 'Author modules covering access, disclosure, directory info, and institutional procedures.',
        category: 'Training',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        assignedRole: 'Training Coordinator',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload training outline, slides, or LMS module export.',
        estimatedEffort: '8-16 hours',
        deliverable: 'FERPA training content package',
      },
      {
        taskId: 'FERPA-006-B',
        title: 'Conduct New Employee Training',
        description: 'Train all new employees with record access within 30 days.',
        instructions: 'Enroll new hires with record access and track completion within 30 days of start.',
        category: 'Training',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload completion reports or roster for new-hire FERPA training.',
        estimatedEffort: '4-8 hours',
        deliverable: 'New employee FERPA training completion records',
      },
      {
        taskId: 'FERPA-006-C',
        title: 'Annual Refresher Training',
        description: 'Provide annual FERPA refresher for all staff.',
        instructions: 'Schedule and deliver annual refresher; track participation across units.',
        category: 'Training',
        statutoryRole: 'FERPA Compliance Officer',
        statutoryCitation: '20 USC 1232g',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        assignedRole: 'Training Coordinator',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload annual refresher attendance or completion summary.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Annual FERPA refresher completion summary',
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
         (regulation_id, parent_task_id, task_id, title, description, instructions, category,
          statutory_role, statutory_citation, requirement_type, recurring_schedule, reminder_days,
          evidence_required, evidence_type, evidence_instructions, estimated_effort, deliverable,
          due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending', $18, NOW(), NOW())
         RETURNING id`,
        [
          FERPA_REGULATION_ID,
          parentTask.taskId,
          parentTask.title,
          parentTask.description,
          parentTask.instructions,
          parentTask.category,
          parentTask.statutoryRole,
          parentTask.statutoryCitation,
          parentTask.requirementType,
          parentTask.recurringSchedule,
          parentTask.reminderDays,
          parentTask.evidenceRequired,
          parentTask.evidenceType || 'document',
          parentTask.evidenceRequired ? parentTask.evidenceInstructions : null,
          parentTask.estimatedEffort,
          parentTask.deliverable,
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
             (regulation_id, parent_task_id, task_id, title, description, instructions, category,
              statutory_role, statutory_citation, requirement_type, recurring_schedule, reminder_days,
              evidence_required, evidence_type, evidence_instructions, estimated_effort, deliverable,
              due_date, status, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending', $19, NOW(), NOW())`,
            [
              FERPA_REGULATION_ID,
              parentId,
              childTask.taskId,
              childTask.title,
              childTask.description,
              childTask.instructions,
              childTask.category,
              childTask.statutoryRole,
              childTask.statutoryCitation,
              childTask.requirementType,
              childTask.recurringSchedule,
              childTask.reminderDays,
              childTask.evidenceRequired,
              childTask.evidenceType || 'document',
              childTask.evidenceRequired ? childTask.evidenceInstructions : null,
              childTask.estimatedEffort,
              childTask.deliverable,
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
