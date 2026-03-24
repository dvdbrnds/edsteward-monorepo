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
    taskId: 'TIX-001',
    title: 'Title IX Coordinator Designation',
    description: 'Designate and publicize a Title IX Coordinator.',
    instructions:
      'Complete a formal designation of a Title IX Coordinator, publish contact information widely, and verify it appears in all required notices.',
    category: 'Coordinator Requirements',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.8(a)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions:
      'Upload documentation showing designation authority and evidence that coordinator contact information was published.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Designation record, published contact information, and proof of inclusion in notices',
    assignedRole: 'President',
    priority: 'critical',
    children: [
      {
        taskId: 'TIX-001-A',
        title: 'Appoint Title IX Coordinator',
        description: 'Formally appoint a qualified Title IX Coordinator.',
        instructions:
          'Issue a written appointment with clear authority and access to senior leadership; retain the signed document in official records.',
        category: 'Coordinator Requirements',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.8(a)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the signed appointment letter, resolution, or contract naming the Title IX Coordinator.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Signed appointment letter or equivalent formal designation',
        assignedRole: 'President',
        priority: 'critical',
      },
      {
        taskId: 'TIX-001-B',
        title: 'Publish Contact Information',
        description: 'Post coordinator name, office, email, and phone prominently.',
        instructions:
          'Publish the coordinator’s name, office, telephone, and email on the website and other prominent locations required by regulation.',
        category: 'Coordinator Requirements',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'link',
        evidenceInstructions: 'Provide a live URL or PDF/screenshot showing the published contact information.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Public web page or document with coordinator contact details',
        assignedRole: 'Web Communications',
        priority: 'high',
      },
      {
        taskId: 'TIX-001-C',
        title: 'Include in Non-Discrimination Notice',
        description: 'Ensure coordinator info is in all non-discrimination notices.',
        instructions:
          'Update catalogs, handbooks, and policy notices so the Title IX Coordinator’s contact information appears wherever non-discrimination is stated.',
        category: 'Coordinator Requirements',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload excerpts or full documents showing coordinator contact in each non-discrimination notice.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Updated notices and handbooks containing coordinator contact information',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
    ],
  },

  // ===== SECTION 2: NON-DISCRIMINATION POLICY =====
  {
    taskId: 'TIX-002',
    title: 'Non-Discrimination Policy Publication',
    description: 'Publish and distribute Title IX non-discrimination policy.',
    instructions:
      'Review policy language for regulatory completeness, publish it prominently, and distribute it through handbooks and other required channels.',
    category: 'Policy',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.8(b)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the approved policy and proof of publication and distribution.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Published non-discrimination policy and distribution evidence',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    children: [
      {
        taskId: 'TIX-002-A',
        title: 'Review Policy Language',
        description: 'Ensure policy covers all required protections and categories.',
        instructions:
          'Compare the policy to Part 106 requirements and institutional jurisdiction; revise language with counsel as needed.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload redlined or final policy text and any counsel review memo.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Final policy language meeting Title IX notice requirements',
        assignedRole: 'General Counsel',
        priority: 'high',
      },
      {
        taskId: 'TIX-002-B',
        title: 'Post on Website',
        description: 'Prominently display policy on institution website.',
        instructions:
          'Place the non-discrimination policy in an easy-to-find location and verify it remains accessible year-round.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'link',
        evidenceInstructions: 'Provide the URL or screenshot showing the policy posted on the website.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Live policy page with appropriate prominence',
        assignedRole: 'Web Communications',
        priority: 'high',
      },
      {
        taskId: 'TIX-002-C',
        title: 'Include in Handbooks',
        description: 'Include in student, faculty, and employee handbooks.',
        instructions:
          'Insert the policy (or a clear summary with a link) into all relevant handbooks and confirm annual updates.',
        category: 'Policy',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Upload handbook excerpts or distribution records confirming inclusion.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Handbooks and employment materials containing the policy',
        assignedRole: 'HR Manager',
        priority: 'high',
      },
    ],
  },

  // ===== SECTION 3: GRIEVANCE PROCEDURES =====
  {
    taskId: 'TIX-003',
    title: 'Title IX Grievance Procedures',
    description: 'Establish and publish grievance procedures for sex discrimination complaints.',
    instructions:
      'Develop, legally review, and publish grievance procedures that meet 34 CFR Part 106, including timelines and appeals.',
    category: 'Grievance Process',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.45',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the adopted grievance procedures and proof of publication.',
    estimatedEffort: '16-24 hours',
    deliverable: 'Published grievance procedures compliant with 34 CFR 106.45',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    children: [
      {
        taskId: 'TIX-003-A',
        title: 'Draft Grievance Procedures',
        description: 'Create comprehensive procedures meeting regulatory requirements.',
        instructions:
          'Draft procedures covering intake, investigation, hearings (if applicable), and remedies consistent with current regulations.',
        category: 'Grievance Process',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.45',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the draft grievance procedures document.',
        estimatedEffort: '16-24 hours',
        deliverable: 'Complete draft grievance procedures',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
      },
      {
        taskId: 'TIX-003-B',
        title: 'Legal Review of Procedures',
        description: 'Have procedures reviewed by legal counsel.',
        instructions:
          'Submit the draft to counsel for review of legal sufficiency and institutional consistency, then incorporate feedback.',
        category: 'Grievance Process',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.45',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Upload counsel sign-off, memo, or email confirming review.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Legal review documentation and revised procedures',
        assignedRole: 'General Counsel',
        priority: 'high',
      },
      {
        taskId: 'TIX-003-C',
        title: 'Establish Investigation Timelines',
        description: 'Define reasonable timeframes for investigation and resolution.',
        instructions:
          'Specify reasonably prompt timeframes for each stage and circumstances for temporary delays or extensions.',
        category: 'Grievance Process',
        statutoryRole: 'Investigator',
        statutoryCitation: '34 CFR 106.45',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the section of procedures showing timelines or a standalone timeline document.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Documented investigation and resolution timelines',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
      {
        taskId: 'TIX-003-D',
        title: 'Create Appeal Process',
        description: 'Establish fair appeal procedures for both parties.',
        instructions:
          'Define appeal grounds, decision-maker training requirements, and timelines that align with Part 106.',
        category: 'Grievance Process',
        statutoryRole: 'Decision-Maker',
        statutoryCitation: '34 CFR 106.45(b)(7)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload appeal procedures and identification of appeal decision-makers (roles, not necessarily names).',
        estimatedEffort: '4-8 hours',
        deliverable: 'Written appeal process integrated with grievance procedures',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
    ],
  },

  // ===== SECTION 4: TRAINING =====
  {
    taskId: 'TIX-004',
    title: 'Title IX Training Program',
    description: 'Provide required training to Title IX personnel.',
    instructions:
      'Schedule and document training for the coordinator, investigators, and decision-makers; post materials as required.',
    category: 'Training',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.45(b)(1)(iii)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    evidenceRequired: true,
    evidenceType: 'document',
    dueDate: '2025-09-30',
    evidenceInstructions: 'Upload training agendas, attendance records, and posted training materials.',
    estimatedEffort: '16-24 hours',
    deliverable: 'Completed trainings with roster and publicly posted materials',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    children: [
      {
        taskId: 'TIX-004-A',
        title: 'Train Title IX Coordinator',
        description: 'Ensure coordinator receives comprehensive training.',
        instructions:
          'Enroll the coordinator in qualified training covering jurisdictional requirements, grievance process, and updates to regulations.',
        category: 'Training',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.45(b)(1)(iii)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload certificates of completion and training outlines or agendas.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Coordinator training completion records',
        assignedRole: 'HR Manager',
        priority: 'critical',
      },
      {
        taskId: 'TIX-004-B',
        title: 'Train Investigators',
        description: 'Train all investigators on investigation procedures.',
        instructions:
          'Deliver or procure training on evidence, impartiality, relevance, and report writing for all assigned investigators.',
        category: 'Training',
        statutoryRole: 'Investigator',
        statutoryCitation: '34 CFR 106.45(b)(1)(iii)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload sign-in sheets, certificates, or LMS completion reports for investigators.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Investigator training records for each investigator',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
      },
      {
        taskId: 'TIX-004-C',
        title: 'Train Decision-Makers',
        description: 'Train hearing officers and decision-makers.',
        instructions:
          'Provide training on evaluating evidence, avoiding bias, technology for live hearings, and issuing written determinations.',
        category: 'Training',
        statutoryRole: 'Decision-Maker',
        statutoryCitation: '34 CFR 106.45(b)(1)(iii)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload completion documentation for each decision-maker or panel member.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Decision-maker training documentation',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
      },
      {
        taskId: 'TIX-004-D',
        title: 'Post Training Materials',
        description: 'Make all training materials publicly available.',
        instructions:
          'Post training materials used for Title IX personnel on the website and update them when training content changes.',
        category: 'Training',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.45(b)(1)(iii)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'link',
        evidenceInstructions: 'Provide the URL where training materials are publicly posted.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Public webpage hosting current training materials',
        assignedRole: 'Web Communications',
        priority: 'high',
      },
    ],
  },

  // ===== SECTION 5: SEXUAL HARASSMENT RESPONSE =====
  {
    taskId: 'TIX-005',
    title: 'Sexual Harassment Response Procedures',
    description: 'Maintain procedures for responding to sexual harassment reports.',
    instructions:
      'Define sexual harassment, reporting options, supportive measures, and emergency processes in written procedures.',
    category: 'Grievance Process',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.44(a)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 30,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the procedures document covering definitions, reporting, and supportive measures.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Written sexual harassment response procedures',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    children: [
      {
        taskId: 'TIX-005-A',
        title: 'Define Sexual Harassment',
        description: 'Clearly define what constitutes sexual harassment under Title IX.',
        instructions:
          'Align definitions with 34 CFR 106.30 and institutional jurisdiction; publish definitions in policy materials.',
        category: 'Grievance Process',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.30(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload policy language showing the regulatory definition and examples.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Policy definitions consistent with 34 CFR 106.30',
        assignedRole: 'Title IX Coordinator',
        priority: 'critical',
      },
      {
        taskId: 'TIX-005-B',
        title: 'Establish Reporting Mechanisms',
        description: 'Create multiple ways to report harassment.',
        instructions:
          'Offer multiple reporting channels (online, phone, in-person) and describe how reports are routed to the coordinator.',
        category: 'Grievance Process',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.44(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload descriptions of reporting options from the website or handbook.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Documented reporting mechanisms available to the campus community',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
      {
        taskId: 'TIX-005-C',
        title: 'Document Supportive Measures',
        description: 'Define available supportive measures for complainants.',
        instructions:
          'List non-disciplinary, non-punitive supportive measures and how to request them without filing a formal complaint.',
        category: 'Grievance Process',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.44(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload policy section or standalone guide describing supportive measures.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Written supportive measures framework',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
      {
        taskId: 'TIX-005-D',
        title: 'Create Emergency Removal Process',
        description: 'Establish process for emergency removal of respondents.',
        instructions:
          'Document criteria and process for removal or leave consistent with 34 CFR 106.44 and due process considerations.',
        category: 'Grievance Process',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.44(a)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload procedures governing emergency removal or administrative leave.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Emergency removal process documentation',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
    ],
  },

  // ===== SECTION 6: RECORDKEEPING =====
  {
    taskId: 'TIX-006',
    title: 'Title IX Recordkeeping',
    description: 'Maintain required records of complaints and resolutions.',
    instructions:
      'Implement retention rules, complaint logs, and training records that satisfy Part 106 recordkeeping obligations.',
    category: 'Reporting',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.45(b)(10)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Upload attestation or sample records demonstrating compliant recordkeeping.',
    estimatedEffort: '8-16 hours',
    deliverable: 'Record retention policy and evidence of ongoing compliance',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    children: [
      {
        taskId: 'TIX-006-A',
        title: 'Establish Record Retention Policy',
        description: 'Maintain records for 7 years minimum.',
        instructions:
          'Adopt written retention periods for complaints, investigations, training materials, and appeals, meeting or exceeding seven years where required.',
        category: 'Reporting',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.45(b)(10)',
        requirementType: 'requirement',
        recurringSchedule: null,
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload the record retention policy or handbook section.',
        estimatedEffort: '4-8 hours',
        deliverable: 'Approved record retention policy',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
      {
        taskId: 'TIX-006-B',
        title: 'Document All Complaints',
        description: 'Keep records of all formal and informal complaints.',
        instructions:
          'Use a secure tracking system to log complaints, actions taken, and outcomes for the required retention period.',
        category: 'Reporting',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.45(b)(10)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'attestation',
        evidenceInstructions: 'Provide attestation or redacted sample log demonstrating complaint documentation (no confidential details).',
        estimatedEffort: '4-8 hours',
        deliverable: 'Complaint log process or attestation of compliant documentation',
        assignedRole: 'Title IX Coordinator',
        priority: 'high',
      },
      {
        taskId: 'TIX-006-C',
        title: 'Track Training Completion',
        description: 'Maintain records of all Title IX training.',
        instructions:
          'Retain attendance, materials, and dates for coordinator, investigator, and decision-maker training.',
        category: 'Reporting',
        statutoryRole: 'Title IX Coordinator',
        statutoryCitation: '34 CFR 106.45(b)(10)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload training rosters or LMS exports showing completion dates.',
        estimatedEffort: '2-4 hours',
        deliverable: 'Training completion records archive',
        assignedRole: 'Title IX Coordinator',
        priority: 'medium',
      },
    ],
  },

  // ===== SECTION 7: ATHLETICS EQUITY =====
  {
    taskId: 'TIX-007',
    title: 'Athletics Equity Compliance',
    description: 'Ensure equal opportunity in athletic programs.',
    instructions:
      'Assess participation, financial assistance, and treatment of male and female athletes; file required federal reports.',
    category: 'Reporting',
    statutoryRole: null,
    statutoryCitation: '34 CFR 106.41',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload equity analyses, scholarship summaries, and EADA submission confirmation.',
    estimatedEffort: '16-24 hours',
    deliverable: 'Athletics equity documentation and EADA filing evidence',
    assignedRole: 'Athletics Director',
    priority: 'high',
    children: [
      {
        taskId: 'TIX-007-A',
        title: 'Assess Participation Opportunities',
        description: 'Analyze equity in athletic participation opportunities.',
        instructions:
          'Compare participation rates to enrollment and document expansion or justification plans where disparities exist.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.41',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload participation analysis worksheets or reports.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Participation opportunity assessment',
        assignedRole: 'Athletics Director',
        priority: 'high',
      },
      {
        taskId: 'TIX-007-B',
        title: 'Review Athletic Scholarships',
        description: 'Ensure scholarship distribution is proportional.',
        instructions:
          'Compare athletic financial assistance to participation or use another permitted comparison method under Part 106.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.41',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload scholarship allocation summary and methodology notes.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Scholarship equity analysis',
        assignedRole: 'Athletics Director',
        priority: 'high',
      },
      {
        taskId: 'TIX-007-C',
        title: 'Evaluate Facilities and Equipment',
        description: 'Compare facilities and equipment across programs.',
        instructions:
          'Review game/practice schedules, facilities, locker rooms, and equipment for equivalency of treatment.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.41',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload facility comparison checklist or narrative assessment.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Facilities and equipment equity review',
        assignedRole: 'Athletics Director',
        priority: 'medium',
      },
      {
        taskId: 'TIX-007-D',
        title: 'Submit EADA Report',
        description: 'Complete annual Equity in Athletics Disclosure Act report.',
        instructions:
          'Gather required data and submit the EADA report by the federal deadline; retain confirmation.',
        category: 'Reporting',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.41',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 30,
        evidenceRequired: true,
        evidenceType: 'document',
        dueDate: '2025-10-15',
        evidenceInstructions: 'Upload submission confirmation or screenshot from the EADA system.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Filed EADA report and proof of submission',
        assignedRole: 'Athletics Director',
        priority: 'critical',
      },
    ],
  },

  // ===== SECTION 8: PREVENTION PROGRAMS =====
  {
    taskId: 'TIX-008',
    title: 'Prevention and Awareness Programs',
    description: 'Conduct prevention programs for students and employees.',
    instructions:
      'Deliver orientation and ongoing awareness programming; document schedules, attendance, and materials.',
    category: 'Prevention',
    statutoryRole: 'Title IX Coordinator',
    statutoryCitation: '34 CFR 106.8(b)',
    requirementType: 'requirement',
    recurringSchedule: 'annual',
    reminderDays: 14,
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload schedules, materials, and attendance or participation summaries.',
    estimatedEffort: '16-24 hours',
    deliverable: 'Documented prevention and awareness activities',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    children: [
      {
        taskId: 'TIX-008-A',
        title: 'New Student Orientation Program',
        description: 'Include Title IX awareness in new student orientation.',
        instructions:
          'Integrate Title IX rights, reporting, and resources into orientation sessions or modules for new students.',
        category: 'Prevention',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload orientation agenda and slides or recording confirmation.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Orientation materials with Title IX content',
        assignedRole: 'Student Affairs',
        priority: 'high',
      },
      {
        taskId: 'TIX-008-B',
        title: 'New Employee Training',
        description: 'Train all new employees on Title IX.',
        instructions:
          'Add Title IX module to onboarding and track completion for faculty and staff.',
        category: 'Prevention',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 14,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload LMS reports or sign-in sheets for new employee Title IX training.',
        estimatedEffort: '4-8 hours',
        deliverable: 'New hire Title IX training completion records',
        assignedRole: 'HR Manager',
        priority: 'high',
      },
      {
        taskId: 'TIX-008-C',
        title: 'Ongoing Awareness Campaigns',
        description: 'Conduct campus-wide awareness programs.',
        instructions:
          'Run at least one annual awareness campaign (e.g., posters, events, social media) on consent, reporting, and resources.',
        category: 'Prevention',
        statutoryRole: null,
        statutoryCitation: '34 CFR 106.8(b)',
        requirementType: 'requirement',
        recurringSchedule: 'annual',
        reminderDays: 7,
        evidenceRequired: true,
        evidenceType: 'document',
        evidenceInstructions: 'Upload samples of campaign materials and brief outcome summary.',
        estimatedEffort: '8-16 hours',
        deliverable: 'Awareness campaign artifacts and summary',
        assignedRole: 'Student Affairs',
        priority: 'medium',
      },
    ],
  },
];

function evidenceInstructionsValue(task) {
  if (!task.evidenceRequired) return null;
  return task.evidenceInstructions ?? null;
}

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

    const parentSql = `INSERT INTO compliance_tasks 
         (regulation_id, parent_task_id, task_id, title, description, instructions, category, statutory_role, statutory_citation, requirement_type, recurring_schedule, reminder_days, assigned_role, priority, evidence_required, evidence_type, evidence_instructions, estimated_effort, deliverable, due_date, status, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', $20, NOW(), NOW())
         RETURNING id`;

    const childSql = `INSERT INTO compliance_tasks 
             (regulation_id, parent_task_id, task_id, title, description, instructions, category, statutory_role, statutory_citation, requirement_type, recurring_schedule, reminder_days, assigned_role, priority, evidence_required, evidence_type, evidence_instructions, estimated_effort, deliverable, due_date, status, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending', $21, NOW(), NOW())`;

    for (const parentTask of titleIXTasks) {
      const parentResult = await client.query(parentSql, [
        TITLE_IX_REGULATION_ID,
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
        parentTask.assignedRole,
        parentTask.priority,
        parentTask.evidenceRequired,
        parentTask.evidenceType || 'document',
        evidenceInstructionsValue(parentTask),
        parentTask.estimatedEffort,
        parentTask.deliverable,
        parentTask.dueDate || null,
        sortOrder++,
      ]);

      const parentId = parentResult.rows[0].id;
      totalTasks++;
      console.log(`✅ Created parent task: ${parentTask.title}`);

      if (parentTask.children) {
        for (const childTask of parentTask.children) {
          await client.query(childSql, [
            TITLE_IX_REGULATION_ID,
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
            childTask.assignedRole,
            childTask.priority,
            childTask.evidenceRequired,
            childTask.evidenceType || 'document',
            evidenceInstructionsValue(childTask),
            childTask.estimatedEffort,
            childTask.deliverable,
            childTask.dueDate || null,
            sortOrder++,
          ]);
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
