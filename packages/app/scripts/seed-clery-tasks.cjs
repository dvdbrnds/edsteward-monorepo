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

function reminderDaysForPriority(priority) {
  if (priority === 'critical') return 30;
  if (priority === 'high') return 14;
  return 7;
}

// Task template with hierarchical structure
// Parent tasks have children referenced by parentIndex
const cleryTasks = [
  // ===== SECTION 1: Annual Security Report (ASR) =====
  {
    taskId: 'CLERY-001',
    title: 'Annual Security Report (ASR) Publication',
    description: 'Prepare and publish the Annual Security Report by October 1st each year',
    instructions:
      'Coordinate data collection, policy compilation, and legal review, then publish and distribute the ASR to all required recipients before the statutory deadline.',
    category: 'Reporting',
    statutoryRole: null,
    statutoryCitation: '20 USC 1092(f)(1)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload the final published ASR PDF and proof of distribution (email logs, portal screenshots, or attestation of delivery).',
    estimatedEffort: '40-60 hours',
    deliverable: 'Published Annual Security Report',
    assignedRole: 'Compliance Officer',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-01',
    children: [
      {
        taskId: 'CLERY-001-A',
        title: 'Gather Crime Statistics (3-Year Data)',
        description:
          'Collect crime statistics from campus police, local law enforcement, and campus security authorities for the past three calendar years',
        instructions:
          'Request Clery crime data from all relevant offices, reconcile with law enforcement records, and validate counts against definitions before inclusion in the ASR.',
        category: 'Reporting',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(f)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload spreadsheets or summary documents showing the three-year crime statistics used in the ASR.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Compiled three-year Clery crime statistics',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-07-01',
      },
      {
        taskId: 'CLERY-001-B',
        title: 'Compile Policy Statements',
        description:
          'Gather all required policy statements including security procedures, crime prevention, alcohol/drug policies, sexual assault policies, etc.',
        instructions:
          'Collect current written policies for each ASR disclosure topic and confirm they match what the institution actually implements.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload policy documents or a consolidated policy appendix referenced in the ASR.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Policy compilation for ASR',
        assignedRole: 'Compliance Officer',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        taskId: 'CLERY-001-C',
        title: 'Legal Review of ASR Draft',
        description: 'Submit the draft ASR for legal counsel review to ensure compliance with all Clery Act requirements',
        instructions:
          'Send the near-final ASR draft to counsel, incorporate feedback, and retain documentation of sign-off or guidance.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions: null,
        estimatedEffort: '4-8 hours',
        deliverable: 'Counsel-reviewed ASR draft',
        assignedRole: 'Legal Counsel',
        priority: 'high',
        evidenceRequired: false,
        dueDate: '2025-09-01',
      },
      {
        taskId: 'CLERY-001-D',
        title: 'Distribute ASR to Campus Community',
        description:
          'Distribute the final ASR to all current students, employees, and make available to prospective students/employees',
        instructions:
          'Distribute via direct email or posted notice as required, and ensure prospective students and employees can access the report.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(1)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('critical'),
        evidenceInstructions:
          'Upload proof of distribution (mailing logs, LMS announcement, or website publication confirmation).',
        estimatedEffort: '2-4 hours',
        deliverable: 'Documented ASR distribution',
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
    taskId: 'CLERY-002',
    title: 'Department of Education Crime Statistics Submission',
    description: 'Submit crime statistics to the Department of Education via the Campus Safety and Security Survey',
    instructions:
      'Complete the annual DOE survey using your finalized Clery statistics and retain confirmation of submission.',
    category: 'Reporting',
    statutoryRole: null,
    statutoryCitation: '20 USC 1092(f)(1)(F)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload survey confirmation, submission receipt, or exported completion summary from the DOE system.',
    estimatedEffort: '8-12 hours',
    deliverable: 'Completed DOE survey submission',
    assignedRole: 'Compliance Officer',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-15',
    children: [
      {
        taskId: 'CLERY-002-A',
        title: 'Complete Campus Safety and Security Survey',
        description: 'Enter all required crime statistics into the DOE web-based data collection system',
        instructions:
          'Log into the survey, enter data for each geography and offense category, and resolve validation errors before finalizing.',
        category: 'Reporting',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(f)(1)(F)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload screenshot or PDF export showing completed survey sections or submission summary.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Completed online survey entries',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'screenshot',
        dueDate: '2025-10-10',
      },
      {
        taskId: 'CLERY-002-B',
        title: 'Verify Submission Confirmation',
        description: 'Obtain and file confirmation of successful submission to DOE',
        instructions:
          'Save the official confirmation email or PDF, and store it with your compliance records for audit.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(1)(F)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the confirmation email, receipt page, or PDF acknowledgment from the Department of Education.',
        estimatedEffort: '1-2 hours',
        deliverable: 'Filed DOE submission confirmation',
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
    taskId: 'CLERY-003',
    title: 'Daily Crime Log Maintenance',
    description: 'Maintain a public daily crime log recording all crimes reported to campus police/security',
    instructions:
      'Ensure the log is updated within required timeframes, contains mandated fields, and remains available for public inspection.',
    category: 'Record Keeping',
    statutoryRole: 'Campus Safety Director',
    statutoryCitation: '20 USC 1092(f)(4)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload a sample log excerpt, SOP reference, or photos showing public access to the crime log.',
    estimatedEffort: '4-8 hours',
    deliverable: 'Maintained daily crime log with public access',
    assignedRole: 'Director of Campus Safety',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-003-A',
        title: 'Establish Crime Log Procedures',
        description: 'Document procedures for maintaining and updating the daily crime log within two business days of a report',
        instructions:
          'Write SOPs covering who enters data, how entries are reviewed, and how the log is made available to the public.',
        category: 'Record Keeping',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(f)(4)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the written crime log procedures or departmental policy that governs log maintenance.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Written crime log standard operating procedures',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-003-B',
        title: 'Ensure Public Accessibility',
        description: 'Verify the crime log is available for public inspection during normal business hours',
        instructions:
          'Confirm physical or electronic access during posted hours and document how requestors may view the log.',
        category: 'Record Keeping',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(f)(4)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions: null,
        estimatedEffort: '1-2 hours',
        deliverable: 'Verification of public crime log access',
        assignedRole: 'Campus Police Officer',
        priority: 'medium',
        evidenceRequired: false,
      },
    ],
  },

  // ===== SECTION 4: Campus Security Authorities (CSAs) =====
  {
    taskId: 'CLERY-004',
    title: 'Campus Security Authority (CSA) Program',
    description: 'Identify, train, and maintain records of all Campus Security Authorities',
    instructions:
      'Maintain an accurate CSA list, deliver annual training, and ensure reporting pathways are documented and used.',
    category: 'Training',
    statutoryRole: 'Campus Security Authority',
    statutoryCitation: '20 USC 1092(f)(1)(A)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('high'),
    evidenceInstructions:
      'Upload training roster, sign-in sheets, or LMS completion reports for CSA training.',
    estimatedEffort: '12-20 hours',
    deliverable: 'Documented CSA program (list, training, reporting process)',
    assignedRole: 'HR Manager',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-09-01',
    children: [
      {
        taskId: 'CLERY-004-A',
        title: 'Identify All CSAs',
        description:
          'Compile comprehensive list of all individuals designated as Campus Security Authorities based on their job functions',
        instructions:
          'Review job descriptions annually and update the CSA roster; share the list with campus safety and Clery coordinator.',
        category: 'Training',
        statutoryRole: 'Campus Security Authority',
        statutoryCitation: '20 USC 1092(f)(1)(A)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the current CSA roster or HR attestation of CSA designations.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Current CSA roster',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        taskId: 'CLERY-004-B',
        title: 'Conduct Annual CSA Training',
        description: 'Provide mandatory training to all CSAs on their reporting obligations and crime definitions',
        instructions:
          'Schedule live or online training covering Clery crimes, reporting timelines, and institutional procedures.',
        category: 'Training',
        statutoryRole: 'Campus Security Authority',
        statutoryCitation: '20 USC 1092(f)(1)(A)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload attendance records, certificates, or LMS completion exports for all CSAs.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Completed annual CSA training records',
        assignedRole: 'Director of Campus Safety',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-09-01',
      },
      {
        taskId: 'CLERY-004-C',
        title: 'Establish CSA Reporting Mechanism',
        description: 'Create and distribute CSA crime report forms and establish submission procedures',
        instructions:
          'Publish forms and instructions so CSAs know how and where to submit crime reports, and archive a master copy.',
        category: 'Training',
        statutoryRole: 'Campus Security Authority',
        statutoryCitation: '20 USC 1092(f)(1)(A)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload the CSA reporting form, intranet page, or policy that describes submission steps.',
        estimatedEffort: '4-8 hours',
        deliverable: 'CSA reporting forms and submission procedures',
        assignedRole: 'Director of Campus Safety',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'form',
      },
    ],
  },

  // ===== SECTION 5: Timely Warnings =====
  {
    taskId: 'CLERY-005',
    title: 'Timely Warning System',
    description: 'Establish and maintain procedures for issuing timely warnings about Clery crimes posing ongoing threats',
    instructions:
      'Define when warnings are issued, who approves content, and how the campus is notified without undue delay.',
    category: 'Emergency Response',
    statutoryRole: null,
    statutoryCitation: '20 USC 1092(f)(3)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload the timely warning policy, recent warning samples (redacted if needed), or tabletop exercise summary.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Timely warning policy and operational records',
    assignedRole: 'Emergency Management Director',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-005-A',
        title: 'Develop Timely Warning Policy',
        description: 'Document criteria for issuing timely warnings, responsible parties, and distribution methods',
        instructions:
          'Draft and approve a policy aligned with Clery definitions of timely warnings and your campus communication channels.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the approved timely warning policy or emergency communications annex.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Adopted timely warning policy',
        assignedRole: 'Emergency Management Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-005-B',
        title: 'Train Staff on Timely Warning Procedures',
        description: 'Train relevant personnel on when and how to issue timely warnings',
        instructions:
          'Deliver training to dispatch, residence life, and communications staff on escalation and template use.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload training materials, attendance list, or completion certificates.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Staff training records for timely warnings',
        assignedRole: 'Emergency Management Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-005-C',
        title: 'Test Timely Warning Distribution',
        description: 'Conduct periodic tests of timely warning distribution systems',
        instructions:
          'Run a test message through email, SMS, and web channels and document delivery metrics and fixes.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload test results, screenshots, or after-action notes from the drill.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Timely warning distribution test documentation',
        assignedRole: 'IT Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 6: Emergency Notification =====
  {
    taskId: 'CLERY-006',
    title: 'Emergency Notification System',
    description: 'Maintain emergency notification procedures for immediate threats to campus',
    instructions:
      'Keep procedures current for confirming emergencies, crafting messages, and pushing alerts campus-wide without delay.',
    category: 'Emergency Response',
    statutoryRole: null,
    statutoryCitation: '20 USC 1092(f)(3)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload the emergency notification plan, test documentation, and public notice of test results if applicable.',
    estimatedEffort: '12-20 hours',
    deliverable: 'Emergency notification program documentation',
    assignedRole: 'Emergency Management Director',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-006-A',
        title: 'Document Emergency Notification Procedures',
        description:
          'Establish procedures for confirming emergencies, determining notification content, and initiating the system',
        instructions:
          'Document the decision chain, message templates, and multi-modal distribution for immediate threats.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the emergency notification SOP or annex to your emergency operations plan.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Written emergency notification procedures',
        assignedRole: 'Emergency Management Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-006-B',
        title: 'Annual Emergency Notification Test',
        description: 'Conduct and document at least one annual test of the emergency notification system',
        instructions:
          'Schedule the annual test, notify the community as required, and capture participation and delivery statistics.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload test reports, vendor logs, or after-action summaries from the annual test.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Annual emergency notification test record',
        assignedRole: 'IT Director',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-09-15',
      },
      {
        taskId: 'CLERY-006-C',
        title: 'Publicize Test Results',
        description: 'Document and publicize the emergency notification test results as required',
        instructions:
          'Post a summary of the test outcome and any corrective actions on your public safety or emergency site.',
        category: 'Emergency Response',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(f)(3)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload a screenshot or PDF of the public posting of test results.',
        estimatedEffort: '1-2 hours',
        deliverable: 'Public notice of emergency notification test results',
        assignedRole: 'Communications Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 7: Missing Student Procedures =====
  {
    taskId: 'CLERY-007',
    title: 'Missing Student Notification Procedures',
    description: 'Establish procedures for students in on-campus housing reported as missing',
    instructions:
      'Implement missing-student policies, contact registration, and notification timelines for designated contacts and law enforcement.',
    category: 'Policy',
    statutoryRole: null,
    statutoryCitation: '20 USC 1092(j)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('high'),
    evidenceInstructions:
      'Upload the missing student policy, housing addendum, and proof of annual notification to residential students.',
    estimatedEffort: '8-12 hours',
    deliverable: 'Missing student policy and notification program',
    assignedRole: 'Dean of Students',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-007-A',
        title: 'Develop Missing Student Policy',
        description: 'Document procedures for handling missing student reports including notification timelines',
        instructions:
          'Draft policy covering intake, 24-hour assessment, and notifications to confidential contacts and local law enforcement.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(j)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the board-approved or published missing student policy.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Adopted missing student policy',
        assignedRole: 'Dean of Students',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-007-B',
        title: 'Confidential Contact Registration',
        description: 'Provide mechanism for residential students to register a confidential emergency contact',
        instructions:
          'Ensure the housing application or student portal captures confidential contacts and explains use in missing-person cases.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(j)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload a screenshot or form template showing confidential contact registration.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Confidential contact registration process',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'form',
      },
      {
        taskId: 'CLERY-007-C',
        title: 'Inform Students of Procedures',
        description: 'Notify all residential students of missing student notification procedures annually',
        instructions:
          'Include procedures in housing materials and send an annual reminder with links to the full policy.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(j)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload the annual notice, email blast, or handbook page distributed to residential students.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Annual student notification of missing student procedures',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 8: Fire Safety =====
  {
    taskId: 'CLERY-008',
    title: 'Annual Fire Safety Report',
    description: 'Prepare and publish the Annual Fire Safety Report for on-campus student housing',
    instructions:
      'Compile fire statistics, system descriptions, fire drill records, and publish the report by October 1 for student housing.',
    category: 'Reporting',
    statutoryRole: 'Campus Safety Director',
    statutoryCitation: '20 USC 1092(i)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload the published fire safety report PDF and proof of distribution to student housing residents.',
    estimatedEffort: '24-40 hours',
    deliverable: 'Published Annual Fire Safety Report',
    assignedRole: 'Director of Facilities',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-10-01',
    children: [
      {
        taskId: 'CLERY-008-A',
        title: 'Gather Fire Statistics',
        description: 'Collect fire statistics for on-campus student housing facilities for the past three calendar years',
        instructions:
          'Pull fire incident data from fire department reports and internal logs for each housing facility.',
        category: 'Reporting',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(i)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload the fire statistics table or source data used in the fire safety report.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Three-year fire statistics for student housing',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-07-01',
      },
      {
        taskId: 'CLERY-008-B',
        title: 'Document Fire Safety Systems',
        description: 'Compile information on fire safety systems in each on-campus student housing facility',
        instructions:
          'Summarize alarms, sprinklers, extinguishers, and evacuation plans for each residence hall in the report.',
        category: 'Reporting',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(i)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload facility summaries or engineering letters referenced in the report.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Fire safety systems documentation by facility',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-08-01',
      },
      {
        taskId: 'CLERY-008-C',
        title: 'Conduct Fire Drills',
        description: 'Conduct and document fire drills in all on-campus student housing facilities',
        instructions:
          'Schedule drills per code and institutional policy, record attendance, and note corrective actions.',
        category: 'Reporting',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '20 USC 1092(i)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload drill logs, sign-in sheets, or after-action reports for each housing facility.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Documented fire drill compliance',
        assignedRole: 'Residential Life Director',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-008-D',
        title: 'Distribute Fire Safety Report',
        description: 'Publish and distribute the Fire Safety Report by October 1st',
        instructions:
          'Post the report online and provide notice to student housing residents as required.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '20 USC 1092(i)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('critical'),
        evidenceInstructions:
          'Upload proof of publication URL and resident notification (email or flyer).',
        estimatedEffort: '2-4 hours',
        deliverable: 'Distributed fire safety report',
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
    taskId: 'CLERY-009',
    title: 'Violence Against Women Act (VAWA) Compliance',
    description: 'Maintain policies and programs for domestic violence, dating violence, sexual assault, and stalking',
    instructions:
      'Keep VAWA-aligned policies current, deliver prevention education, and document training for disciplinary officials.',
    category: 'Policy',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 668.46(j)-(k)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('critical'),
    evidenceInstructions:
      'Upload policy statements, program descriptions, and training records supporting VAWA disclosures.',
    estimatedEffort: '40-60 hours',
    deliverable: 'VAWA compliance documentation package',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-009-A',
        title: 'VAWA Policy Development',
        description:
          'Maintain comprehensive policies addressing domestic violence, dating violence, sexual assault, and stalking',
        instructions:
          'Review and update policies annually; cross-reference with Title IX procedures and student conduct code.',
        category: 'Policy',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 668.46(j)-(k)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('critical'),
        evidenceInstructions:
          'Upload current policies and any board or cabinet approval memos.',
        estimatedEffort: '12-20 hours',
        deliverable: 'Current VAWA-related policies',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-009-B',
        title: 'Primary Prevention Programs (New Students)',
        description: 'Provide primary prevention and awareness programs for all incoming students',
        instructions:
          'Schedule orientation or online modules covering consent, bystander intervention, and reporting options.',
        category: 'Policy',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 668.46(j)-(k)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload syllabi, session slides, or attendance data for new student programming.',
        estimatedEffort: '8-16 hours',
        deliverable: 'New student prevention program records',
        assignedRole: 'Student Affairs VP',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-009-C',
        title: 'Primary Prevention Programs (New Employees)',
        description: 'Provide primary prevention and awareness programs for all new employees',
        instructions:
          'Include Clery/VAWA content in onboarding and track completion in HR systems.',
        category: 'Policy',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 668.46(j)-(k)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload HR reports or LMS completions for new employee training.',
        estimatedEffort: '4-8 hours',
        deliverable: 'New employee prevention training records',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-009-D',
        title: 'Ongoing Awareness Campaigns',
        description: 'Conduct ongoing prevention and awareness campaigns for the campus community',
        instructions:
          'Run campaigns throughout the year (events, newsletters, social media) and archive materials.',
        category: 'Policy',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 668.46(j)-(k)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload campaign flyers, calendar of events, or analytics summaries.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Ongoing awareness campaign documentation',
        assignedRole: 'Student Affairs VP',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-009-E',
        title: 'Train Disciplinary Officials',
        description:
          'Ensure annual training for all officials involved in disciplinary proceedings on VAWA-related issues',
        instructions:
          'Train hearing officers and appeals panels on trauma-informed practices and regulatory requirements.',
        category: 'Policy',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 668.46(j)-(k)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload rosters and materials for disciplinary official training sessions.',
        estimatedEffort: '8-12 hours',
        deliverable: 'Annual disciplinary official training records',
        assignedRole: 'HR Manager',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
    ],
  },

  // ===== SECTION 10: Geography Definitions =====
  {
    taskId: 'CLERY-010',
    title: 'Clery Geography Documentation',
    description: 'Maintain accurate documentation of Clery geography (on-campus, non-campus, public property)',
    instructions:
      'Keep maps and location lists current so crime statistics and warnings reflect the correct Clery geography.',
    category: 'Record Keeping',
    statutoryRole: 'Campus Safety Director',
    statutoryCitation: '34 CFR 668.46(a)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: reminderDaysForPriority('high'),
    evidenceInstructions:
      'Upload current maps, GIS layers, or location spreadsheets defining Clery geography.',
    estimatedEffort: '12-20 hours',
    deliverable: 'Clery geography documentation set',
    assignedRole: 'Director of Campus Safety',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    children: [
      {
        taskId: 'CLERY-010-A',
        title: 'Map Campus Geography',
        description: 'Create and maintain maps showing all Clery geography categories',
        instructions:
          'Produce labeled maps for on-campus, public property, and non-campus sites used for statistics and warnings.',
        category: 'Record Keeping',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '34 CFR 668.46(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('high'),
        evidenceInstructions:
          'Upload map files or PDFs with legend and geography boundaries.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Clery geography maps',
        assignedRole: 'Director of Facilities',
        priority: 'high',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-010-B',
        title: 'Identify Non-Campus Locations',
        description: 'Identify and document all non-campus buildings and properties owned/controlled by the institution',
        instructions:
          'Maintain a list of addresses for study abroad sites, leased spaces, and recurring non-campus activities.',
        category: 'Record Keeping',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '34 CFR 668.46(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions:
          'Upload the non-campus location inventory or lease schedule used for Clery reporting.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Non-campus location inventory',
        assignedRole: 'Director of Facilities',
        priority: 'medium',
        evidenceRequired: true,
        evidenceType: 'document',
      },
      {
        taskId: 'CLERY-010-C',
        title: 'Review Geography Annually',
        description: 'Conduct annual review of Clery geography to capture any changes',
        instructions:
          'Compare geography to new construction, leases, and program locations; update maps and survey data accordingly.',
        category: 'Record Keeping',
        statutoryRole: 'Campus Safety Director',
        statutoryCitation: '34 CFR 668.46(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: reminderDaysForPriority('medium'),
        evidenceInstructions: null,
        estimatedEffort: '4-8 hours',
        deliverable: 'Annual geography review memo or checklist',
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
         (regulation_id, parent_task_id, task_id, title, description, instructions, category, statutory_role, statutory_citation,
          requirement_type, recurring_schedule, reminder_days, evidence_instructions, estimated_effort, deliverable,
          assigned_role, priority, evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', $20, NOW(), NOW())
         RETURNING id`,
        [
          CLERY_REGULATION_ID,
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
          parentTask.evidenceInstructions,
          parentTask.estimatedEffort,
          parentTask.deliverable,
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
             (regulation_id, parent_task_id, task_id, title, description, instructions, category, statutory_role, statutory_citation,
              requirement_type, recurring_schedule, reminder_days, evidence_instructions, estimated_effort, deliverable,
              assigned_role, priority, evidence_required, evidence_type, due_date, status, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending', $21, NOW(), NOW())`,
            [
              CLERY_REGULATION_ID,
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
              childTask.evidenceInstructions,
              childTask.estimatedEffort,
              childTask.deliverable,
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
