#!/usr/bin/env node
/**
 * Seed FERPA and Title IX compliance tasks
 * 
 * This script populates the compliance_tasks table with predefined tasks
 * for FERPA (reg ID 223) and Title IX (reg ID 7).
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ===== FERPA TASKS =====
const FERPA_TASKS = [
  // SECTION 1: ANNUAL NOTIFICATION
  { tempId: 'ferpa-notification-main', parentTempId: null, title: 'Annual FERPA Rights Notification', description: 'Provide annual notification to students and parents of their FERPA rights.', assignedRole: 'Registrar', dueDate: 'Start of Fall Semester', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-notification-content', parentTempId: 'ferpa-notification-main', title: 'Draft Notification Content', description: 'Prepare notification content including all required FERPA rights information.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-notification-legal', parentTempId: 'ferpa-notification-main', title: 'Legal Review of Notification', description: 'Have notification reviewed by legal counsel for compliance.', assignedRole: 'General Counsel', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 2 },
  { tempId: 'ferpa-notification-distribute', parentTempId: 'ferpa-notification-main', title: 'Distribute Annual Notification', description: 'Send notification via email and post on institutional website.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'screenshot', sortOrder: 3 },
  
  // SECTION 2: DIRECTORY INFORMATION
  { tempId: 'ferpa-directory-main', parentTempId: null, title: 'Directory Information Policy', description: 'Maintain and communicate directory information policies.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'ferpa-directory-define', parentTempId: 'ferpa-directory-main', title: 'Define Directory Information Categories', description: 'Document what information is designated as directory information.', assignedRole: 'Registrar', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-directory-optout', parentTempId: 'ferpa-directory-main', title: 'Implement Opt-Out Process', description: 'Provide students a way to opt out of directory information disclosure.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'link', sortOrder: 2 },
  { tempId: 'ferpa-directory-track', parentTempId: 'ferpa-directory-main', title: 'Track Opt-Out Requests', description: 'Maintain system to track students who have opted out.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 3 },
  
  // SECTION 3: RECORD ACCESS PROCEDURES
  { tempId: 'ferpa-access-main', parentTempId: null, title: 'Record Access Procedures', description: 'Maintain procedures for students/parents to access education records.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  { tempId: 'ferpa-access-request', parentTempId: 'ferpa-access-main', title: 'Record Request Process', description: 'Document process for students to request access to their records.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-access-identity', parentTempId: 'ferpa-access-main', title: 'Identity Verification Procedures', description: 'Establish procedures to verify identity before releasing records.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  
  // SECTION 4: AMENDMENT PROCEDURES
  { tempId: 'ferpa-amend-main', parentTempId: null, title: 'Record Amendment Procedures', description: 'Maintain procedures for students to request amendments to records.', assignedRole: 'Registrar', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 4 },
  { tempId: 'ferpa-amend-request', parentTempId: 'ferpa-amend-main', title: 'Amendment Request Form', description: 'Provide form for students to request record amendments.', assignedRole: 'Registrar', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-amend-hearing', parentTempId: 'ferpa-amend-main', title: 'Hearing Procedures', description: 'Document hearing procedures if amendment is denied.', assignedRole: 'General Counsel', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  
  // SECTION 5: CONSENT & DISCLOSURE
  { tempId: 'ferpa-consent-main', parentTempId: null, title: 'Consent and Disclosure Procedures', description: 'Maintain procedures for obtaining consent and documenting disclosures.', assignedRole: 'Registrar', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 5 },
  { tempId: 'ferpa-consent-form', parentTempId: 'ferpa-consent-main', title: 'Written Consent Form', description: 'Provide form for students to authorize disclosure of records.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-consent-log', parentTempId: 'ferpa-consent-main', title: 'Disclosure Log Maintenance', description: 'Maintain log of all disclosures made from student records.', assignedRole: 'Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 2 },
  { tempId: 'ferpa-consent-exceptions', parentTempId: 'ferpa-consent-main', title: 'Document Consent Exceptions', description: 'Document situations where disclosure is permitted without consent.', assignedRole: 'General Counsel', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  
  // SECTION 6: TRAINING
  { tempId: 'ferpa-training-main', parentTempId: null, title: 'FERPA Staff Training', description: 'Provide annual FERPA training to all staff with access to student records.', assignedRole: 'HR / Compliance Officer', dueDate: 'Start of Academic Year', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 6 },
  { tempId: 'ferpa-training-develop', parentTempId: 'ferpa-training-main', title: 'Develop Training Materials', description: 'Create or update FERPA training content.', assignedRole: 'Compliance Officer', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'ferpa-training-conduct', parentTempId: 'ferpa-training-main', title: 'Conduct Training Sessions', description: 'Deliver FERPA training to all relevant staff.', assignedRole: 'HR / Compliance Officer', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'ferpa-training-track', parentTempId: 'ferpa-training-main', title: 'Track Training Completion', description: 'Maintain records of staff who have completed FERPA training.', assignedRole: 'HR', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  
  // SECTION 7: SECURITY
  { tempId: 'ferpa-security-main', parentTempId: null, title: 'Record Security Measures', description: 'Implement appropriate security measures for education records.', assignedRole: 'IT Security / Registrar', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 7 },
  { tempId: 'ferpa-security-access', parentTempId: 'ferpa-security-main', title: 'Access Controls', description: 'Implement role-based access controls for student information systems.', assignedRole: 'IT Security', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 1 },
  { tempId: 'ferpa-security-audit', parentTempId: 'ferpa-security-main', title: 'Access Audit', description: 'Conduct periodic audit of who has access to student records.', assignedRole: 'IT Security', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'ferpa-security-physical', parentTempId: 'ferpa-security-main', title: 'Physical Record Security', description: 'Ensure physical records are stored securely.', assignedRole: 'Registrar', priority: 'medium', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 3 },
];

// ===== TITLE IX TASKS =====
const TITLE_IX_TASKS = [
  // SECTION 1: COORDINATOR
  { tempId: 'tix-coordinator-main', parentTempId: null, title: 'Title IX Coordinator Designation', description: 'Designate and publicize a Title IX Coordinator.', assignedRole: 'President / Provost', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-coordinator-appoint', parentTempId: 'tix-coordinator-main', title: 'Appoint Title IX Coordinator', description: 'Formally appoint a qualified Title IX Coordinator.', assignedRole: 'President / Provost', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-coordinator-publish', parentTempId: 'tix-coordinator-main', title: 'Publish Coordinator Contact Information', description: 'Make coordinator name, title, office, phone, and email publicly available.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'screenshot', sortOrder: 2 },
  { tempId: 'tix-coordinator-deputies', parentTempId: 'tix-coordinator-main', title: 'Designate Deputy Coordinators (if applicable)', description: 'Consider designating deputy coordinators for different areas.', assignedRole: 'Title IX Coordinator', priority: 'medium', evidenceRequired: false, evidenceType: 'none', sortOrder: 3 },
  
  // SECTION 2: POLICY
  { tempId: 'tix-policy-main', parentTempId: null, title: 'Non-Discrimination Policy', description: 'Adopt and publish policy prohibiting sex discrimination.', assignedRole: 'Title IX Coordinator', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'tix-policy-draft', parentTempId: 'tix-policy-main', title: 'Draft/Update Policy', description: 'Create or update non-discrimination policy covering sex-based discrimination.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-policy-legal', parentTempId: 'tix-policy-main', title: 'Legal Review of Policy', description: 'Have policy reviewed by legal counsel.', assignedRole: 'General Counsel', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 2 },
  { tempId: 'tix-policy-publish', parentTempId: 'tix-policy-main', title: 'Publish Policy', description: 'Make policy publicly available in required locations.', assignedRole: 'Communications', priority: 'high', evidenceRequired: true, evidenceType: 'link', sortOrder: 3 },
  
  // SECTION 3: GRIEVANCE
  { tempId: 'tix-grievance-main', parentTempId: null, title: 'Grievance Procedures', description: 'Establish and publish grievance procedures for sex discrimination complaints.', assignedRole: 'Title IX Coordinator', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  { tempId: 'tix-grievance-draft', parentTempId: 'tix-grievance-main', title: 'Draft Grievance Procedures', description: 'Create comprehensive grievance procedures compliant with Title IX regulations.', assignedRole: 'Title IX Coordinator', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-grievance-legal', parentTempId: 'tix-grievance-main', title: 'Legal Review of Procedures', description: 'Have grievance procedures reviewed for legal compliance.', assignedRole: 'General Counsel', priority: 'critical', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 2 },
  { tempId: 'tix-grievance-publish', parentTempId: 'tix-grievance-main', title: 'Publish Grievance Procedures', description: 'Make procedures publicly available.', assignedRole: 'Communications', priority: 'high', evidenceRequired: true, evidenceType: 'link', sortOrder: 3 },
  { tempId: 'tix-grievance-forms', parentTempId: 'tix-grievance-main', title: 'Create Complaint Forms', description: 'Develop intake forms for filing complaints.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 4 },
  
  // SECTION 4: TRAINING
  { tempId: 'tix-training-main', parentTempId: null, title: 'Title IX Training Program', description: 'Provide required training to Title IX personnel and campus community.', assignedRole: 'Title IX Coordinator', dueDate: 'Start of Academic Year', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 4 },
  { tempId: 'tix-training-coordinator', parentTempId: 'tix-training-main', title: 'Coordinator Training', description: 'Ensure Title IX Coordinator receives comprehensive training.', assignedRole: 'HR / Compliance', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-training-investigators', parentTempId: 'tix-training-main', title: 'Investigator Training', description: 'Train all investigators on Title IX requirements.', assignedRole: 'Title IX Coordinator', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'tix-training-decision-makers', parentTempId: 'tix-training-main', title: 'Decision-Maker Training', description: 'Train hearing officers and decision-makers.', assignedRole: 'Title IX Coordinator', priority: 'critical', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  { tempId: 'tix-training-employees', parentTempId: 'tix-training-main', title: 'Employee Awareness Training', description: 'Provide Title IX awareness training to all employees.', assignedRole: 'HR', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 4 },
  { tempId: 'tix-training-students', parentTempId: 'tix-training-main', title: 'Student Awareness Education', description: 'Provide Title IX education to students.', assignedRole: 'Student Affairs', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 5 },
  { tempId: 'tix-training-publish', parentTempId: 'tix-training-main', title: 'Publish Training Materials', description: 'Make training materials available on website as required.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'link', sortOrder: 6 },
  
  // SECTION 5: RECORDKEEPING
  { tempId: 'tix-records-main', parentTempId: null, title: 'Title IX Recordkeeping', description: 'Maintain required records of Title IX matters.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 5 },
  { tempId: 'tix-records-complaints', parentTempId: 'tix-records-main', title: 'Complaint Records', description: 'Maintain records of all complaints, investigations, and resolutions.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 1 },
  { tempId: 'tix-records-supportive', parentTempId: 'tix-records-main', title: 'Supportive Measures Records', description: 'Document supportive measures offered and implemented.', assignedRole: 'Title IX Coordinator', priority: 'medium', evidenceRequired: true, evidenceType: 'attestation', sortOrder: 2 },
  { tempId: 'tix-records-training', parentTempId: 'tix-records-main', title: 'Training Records', description: 'Maintain records of all Title IX training.', assignedRole: 'Title IX Coordinator', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  
  // SECTION 6: ATHLETICS
  { tempId: 'tix-athletics-main', parentTempId: null, title: 'Athletics Equity Review', description: 'Ensure equal opportunity in intercollegiate athletics.', assignedRole: 'Athletic Director', dueDate: 'Annual Review', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 6 },
  { tempId: 'tix-athletics-participation', parentTempId: 'tix-athletics-main', title: 'Participation Opportunities', description: 'Assess and document athletic participation opportunities by sex.', assignedRole: 'Athletic Director', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-athletics-scholarships', parentTempId: 'tix-athletics-main', title: 'Scholarship Distribution', description: 'Ensure athletic scholarships are proportionally distributed.', assignedRole: 'Athletic Director', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 2 },
  { tempId: 'tix-athletics-benefits', parentTempId: 'tix-athletics-main', title: 'Equal Treatment Assessment', description: 'Review equality of equipment, facilities, travel, coaching, etc.', assignedRole: 'Athletic Director', priority: 'medium', evidenceRequired: true, evidenceType: 'document', sortOrder: 3 },
  
  // SECTION 7: PREGNANCY
  { tempId: 'tix-pregnancy-main', parentTempId: null, title: 'Pregnant and Parenting Student Support', description: 'Ensure non-discrimination for pregnant and parenting students.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 7 },
  { tempId: 'tix-pregnancy-policy', parentTempId: 'tix-pregnancy-main', title: 'Pregnancy Accommodation Policy', description: 'Establish policy for accommodating pregnant students.', assignedRole: 'Title IX Coordinator', priority: 'high', evidenceRequired: true, evidenceType: 'document', sortOrder: 1 },
  { tempId: 'tix-pregnancy-communicate', parentTempId: 'tix-pregnancy-main', title: 'Communicate Support Services', description: 'Inform students of pregnancy-related support and accommodations.', assignedRole: 'Student Services', priority: 'medium', evidenceRequired: true, evidenceType: 'link', sortOrder: 2 },
];

async function seedTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database');
    
    // Seed FERPA tasks (regulation ID 223)
    const ferpaRegId = 223;
    const existingFerpa = await client.query(
      'SELECT COUNT(*) as count FROM compliance_tasks WHERE regulation_id = $1',
      [ferpaRegId]
    );
    
    if (parseInt(existingFerpa.rows[0].count) > 0) {
      console.log(`⚠️  FERPA tasks already exist (${existingFerpa.rows[0].count} tasks). Skipping.`);
    } else {
      console.log(`\n📋 Seeding FERPA compliance tasks (regulation ID ${ferpaRegId})...`);
      await seedRegulationTasks(client, ferpaRegId, FERPA_TASKS);
      console.log(`✅ FERPA tasks seeded successfully!`);
    }
    
    // Seed Title IX tasks (regulation ID 7)
    const titleIXRegId = 7;
    const existingTitleIX = await client.query(
      'SELECT COUNT(*) as count FROM compliance_tasks WHERE regulation_id = $1',
      [titleIXRegId]
    );
    
    if (parseInt(existingTitleIX.rows[0].count) > 0) {
      console.log(`⚠️  Title IX tasks already exist (${existingTitleIX.rows[0].count} tasks). Skipping.`);
    } else {
      console.log(`\n📋 Seeding Title IX compliance tasks (regulation ID ${titleIXRegId})...`);
      await seedRegulationTasks(client, titleIXRegId, TITLE_IX_TASKS);
      console.log(`✅ Title IX tasks seeded successfully!`);
    }
    
    console.log('\n🎉 Task seeding complete!');
    
  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedRegulationTasks(client, regulationId, tasks) {
  const tempIdToDbId = new Map();
  
  // First pass: insert all parent tasks
  const parentTasks = tasks.filter(t => !t.parentTempId);
  for (const task of parentTasks) {
    const result = await client.query(`
      INSERT INTO compliance_tasks (
        regulation_id, parent_task_id, title, description, assigned_role,
        due_date, priority, evidence_required, evidence_type, status, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id
    `, [
      regulationId,
      null,
      task.title,
      task.description,
      task.assignedRole,
      null, // due_date - would need conversion
      task.priority,
      task.evidenceRequired,
      task.evidenceType,
      'pending',
      task.sortOrder
    ]);
    
    tempIdToDbId.set(task.tempId, result.rows[0].id);
    console.log(`   ✓ Created parent: ${task.title}`);
  }
  
  // Second pass: insert all child tasks
  const childTasks = tasks.filter(t => t.parentTempId);
  for (const task of childTasks) {
    const parentDbId = tempIdToDbId.get(task.parentTempId);
    
    const result = await client.query(`
      INSERT INTO compliance_tasks (
        regulation_id, parent_task_id, title, description, assigned_role,
        due_date, priority, evidence_required, evidence_type, status, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id
    `, [
      regulationId,
      parentDbId,
      task.title,
      task.description,
      task.assignedRole,
      null,
      task.priority,
      task.evidenceRequired,
      task.evidenceType,
      'pending',
      task.sortOrder
    ]);
    
    tempIdToDbId.set(task.tempId, result.rows[0].id);
    console.log(`      └─ Created sub-task: ${task.title}`);
  }
  
  console.log(`   Total tasks created: ${tasks.length}`);
}

seedTasks();

