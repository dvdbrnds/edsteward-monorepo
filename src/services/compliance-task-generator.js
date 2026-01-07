/**
 * Compliance Task Generator Service
 * 
 * Generates structured compliance tasks for EdSteward integration.
 * Based on EdSteward AI response (January 6, 2026):
 * - Hybrid approach: templateHint for Clery/FERPA/Title IX
 * - Generated tasks for Tier 1 regulations (ADA, Title IV, OSHA, etc.)
 * - No tasks for simple attestation regulations
 */

/**
 * Standard EdSteward roles
 */
const ROLES = {
  CAMPUS_SAFETY: 'Director of Campus Safety',
  CAMPUS_SAFETY_ADMIN: 'Campus Safety Administrator',
  REGISTRAR: 'Registrar',
  TITLE_IX: 'Title IX Coordinator',
  GENERAL_COUNSEL: 'General Counsel',
  PRESIDENT: 'President / Provost',
  HR: 'HR / Compliance',
  IT_SECURITY: 'IT Security',
  WEB_COMMS: 'Web Communications',
  CAMPUS_COMMS: 'Campus Communications',
  TRAINING: 'Training Coordinator',
  STUDENT_AFFAIRS: 'Student Affairs',
  ATHLETIC_DIRECTOR: 'Athletic Director',
  COMPLIANCE: 'Compliance Officer',
  DISABILITY: 'Disability Services Director',
  FINANCIAL_AID: 'Financial Aid Director',
  FACILITIES: 'Facilities Director'
};

/**
 * Evidence types supported by EdSteward
 */
const EVIDENCE_TYPES = {
  NONE: 'none',
  DOCUMENT: 'document',
  LINK: 'link',
  SCREENSHOT: 'screenshot',
  ATTESTATION: 'attestation',
  FORM: 'form'
};

/**
 * Regulations that have EdSteward templates - send templateHint only
 */
const TEMPLATE_REGULATIONS = {
  'clery-act': 'clery',
  'jeanne-clery-disclosure-of-campus-security-policy-': 'clery',
  'family-educational-rights-and-privacy-act-ferpa': 'ferpa',
  'ferpa': 'ferpa',
  'title-ix-of-the-education-amendment-of-1972': 'title-ix',
  'title-ix': 'title-ix'
};

/**
 * Tier 1 regulations that need generated tasks
 */
const TIER_1_REGULATIONS = [
  'americans-with-disabilities-act-of-1990',
  'ada',
  'higher-education-act-title-iv-student-financial-a',
  'occupational-safety-and-health-act-of-1970',
  'osha',
  'health-insurance-portability-and-accountability-ac',
  'hipaa',
  'gramm-leach-bliley-act-glba',
  'glba'
];

/**
 * Tier 2 regulations that need generated tasks
 */
const TIER_2_REGULATIONS = [
  'drug-free-schools-and-communities-act',
  'campus-sexual-violence-elimination-act',
  'save-act',
  'technology-education-and-copyright-harmonization-a',
  'teach-act',
  'reg-66',
  'section-504-of-the-rehabilitation-act-of-1973',
  'violence-against-women-reauthorization-act',
  'vawa',
  'family-medical-leave-act',
  'fmla',
  'copyright-dmca',
  'digital-millennium-copyright-act',
  'solomon-amendment',
  'higher-education-opportunity-act',
  'heoa'
];

/**
 * ADA Task Template
 */
const ADA_TASKS = [
  {
    tempId: 'ada-coordinator',
    parentTempId: null,
    title: 'ADA Coordinator Designation',
    description: 'Designate and publicize an ADA/Section 504 Coordinator',
    instructions: 'Coordinator must have authority to ensure compliance, handle grievances, and coordinate accommodations. Publish contact info on website and in student/employee handbooks.',
    assignedRole: ROLES.PRESIDENT,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload official designation letter naming ADA Coordinator',
    sortOrder: 1
  },
  {
    tempId: 'ada-policy',
    parentTempId: null,
    title: 'ADA Non-Discrimination Policy',
    description: 'Adopt and publish policy prohibiting disability discrimination',
    instructions: 'Policy must cover: non-discrimination statement, reasonable accommodation procedures, grievance process, and coordinator contact information.',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload approved ADA policy document',
    sortOrder: 2
  },
  {
    tempId: 'ada-policy-publish',
    parentTempId: 'ada-policy',
    title: 'Publish ADA Policy on Website',
    description: 'Post ADA policy on institution\'s public website',
    assignedRole: ROLES.WEB_COMMS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to published ADA policy',
    sortOrder: 1
  },
  {
    tempId: 'ada-policy-handbook',
    parentTempId: 'ada-policy',
    title: 'Include ADA Policy in Handbooks',
    description: 'Include ADA policy in student and employee handbooks',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload handbook sections showing ADA policy',
    sortOrder: 2
  },
  {
    tempId: 'ada-grievance',
    parentTempId: null,
    title: 'ADA Grievance Procedures',
    description: 'Establish and publish grievance procedures for disability complaints',
    instructions: 'Procedures must include: how to file, investigation process, timeframes, appeal rights.',
    assignedRole: ROLES.DISABILITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload grievance procedures document',
    sortOrder: 3
  },
  {
    tempId: 'ada-accommodation-process',
    parentTempId: null,
    title: 'Accommodation Request Process',
    description: 'Document and communicate process for requesting reasonable accommodations',
    instructions: 'Include: request forms, documentation requirements, interactive process, timeline for decisions.',
    assignedRole: ROLES.DISABILITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload accommodation procedures and request forms',
    sortOrder: 4
  },
  {
    tempId: 'ada-accessibility-audit',
    parentTempId: null,
    title: 'Facilities Accessibility Audit',
    description: 'Conduct periodic audit of facility accessibility',
    dueDate: 'Annual',
    recurringSchedule: 'annual',
    assignedRole: ROLES.FACILITIES,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload accessibility audit report',
    sortOrder: 5
  },
  {
    tempId: 'ada-web-accessibility',
    parentTempId: null,
    title: 'Website Accessibility Compliance',
    description: 'Ensure website meets WCAG 2.1 AA accessibility standards',
    instructions: 'Regular testing with accessibility tools, alt text for images, keyboard navigation, screen reader compatibility.',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload WCAG compliance audit report',
    sortOrder: 6
  },
  {
    tempId: 'ada-training',
    parentTempId: null,
    title: 'ADA Training for Staff',
    description: 'Provide ADA awareness training to faculty and staff',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials and attendance records',
    sortOrder: 7
  }
];

/**
 * OSHA Task Template
 */
const OSHA_TASKS = [
  {
    tempId: 'osha-safety-program',
    parentTempId: null,
    title: 'Occupational Safety Program',
    description: 'Establish and maintain comprehensive workplace safety program',
    assignedRole: ROLES.HR,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload safety program documentation',
    sortOrder: 1
  },
  {
    tempId: 'osha-emergency-action-plan',
    parentTempId: null,
    title: 'Emergency Action Plan',
    description: 'Develop and maintain written Emergency Action Plan (EAP)',
    instructions: 'Must include: evacuation procedures, emergency contacts, alarm systems, training requirements.',
    assignedRole: ROLES.CAMPUS_SAFETY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload Emergency Action Plan document',
    sortOrder: 2
  },
  {
    tempId: 'osha-eap-training',
    parentTempId: 'osha-emergency-action-plan',
    title: 'Emergency Action Plan Training',
    description: 'Train employees on Emergency Action Plan procedures',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training records and attendance sheets',
    sortOrder: 1
  },
  {
    tempId: 'osha-hazcom',
    parentTempId: null,
    title: 'Hazard Communication Program',
    description: 'Maintain written hazard communication program with SDS access',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload HazCom program and SDS inventory',
    sortOrder: 3
  },
  {
    tempId: 'osha-injury-log',
    parentTempId: null,
    title: 'OSHA 300 Log Maintenance',
    description: 'Maintain OSHA Form 300 Log of Work-Related Injuries',
    recurringSchedule: 'annual',
    dueDate: 'February 1',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload current OSHA 300 Log',
    sortOrder: 4
  },
  {
    tempId: 'osha-300a-posting',
    parentTempId: 'osha-injury-log',
    title: 'Post OSHA 300A Summary',
    description: 'Post annual summary (Form 300A) February 1 - April 30',
    dueDate: 'February 1',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.SCREENSHOT,
    evidenceInstructions: 'Upload photo of posted 300A Summary',
    sortOrder: 1
  },
  {
    tempId: 'osha-workplace-inspection',
    parentTempId: null,
    title: 'Workplace Safety Inspections',
    description: 'Conduct regular workplace safety inspections',
    recurringSchedule: 'quarterly',
    assignedRole: ROLES.HR,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload inspection reports',
    sortOrder: 5
  },
  {
    tempId: 'osha-ppe',
    parentTempId: null,
    title: 'PPE Assessment and Training',
    description: 'Assess PPE needs and train employees on proper use',
    recurringSchedule: 'annual',
    assignedRole: ROLES.HR,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload PPE hazard assessment and training records',
    sortOrder: 6
  }
];

/**
 * Higher Education Act Title IV Task Template
 */
const TITLE_IV_TASKS = [
  {
    tempId: 'title-iv-ppa',
    parentTempId: null,
    title: 'Program Participation Agreement',
    description: 'Maintain current PPA with Department of Education',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload current signed PPA',
    sortOrder: 1
  },
  {
    tempId: 'title-iv-consumer-info',
    parentTempId: null,
    title: 'Consumer Information Disclosure',
    description: 'Disclose required consumer information to students and prospective students',
    dueDate: 'Before enrollment',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to consumer information page',
    sortOrder: 2
  },
  {
    tempId: 'title-iv-net-price-calc',
    parentTempId: 'title-iv-consumer-info',
    title: 'Net Price Calculator',
    description: 'Maintain functional net price calculator on website',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to net price calculator',
    sortOrder: 1
  },
  {
    tempId: 'title-iv-entrance-counseling',
    parentTempId: null,
    title: 'Entrance Counseling',
    description: 'Ensure all first-time borrowers complete entrance counseling',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest that entrance counseling process is in place',
    sortOrder: 3
  },
  {
    tempId: 'title-iv-exit-counseling',
    parentTempId: null,
    title: 'Exit Counseling',
    description: 'Provide exit counseling to all borrowers leaving school',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest that exit counseling process is in place',
    sortOrder: 4
  },
  {
    tempId: 'title-iv-satisfactory-progress',
    parentTempId: null,
    title: 'Satisfactory Academic Progress Policy',
    description: 'Establish and publish SAP policy for financial aid eligibility',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload SAP policy document',
    sortOrder: 5
  },
  {
    tempId: 'title-iv-r2t4',
    parentTempId: null,
    title: 'Return of Title IV Funds Policy',
    description: 'Maintain and follow R2T4 calculation procedures',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload R2T4 policy and sample calculation',
    sortOrder: 6
  },
  {
    tempId: 'title-iv-verification',
    parentTempId: null,
    title: 'Verification Procedures',
    description: 'Maintain verification procedures for selected FAFSA applications',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload verification procedures document',
    sortOrder: 7
  },
  {
    tempId: 'title-iv-cohort-default',
    parentTempId: null,
    title: 'Monitor Cohort Default Rate',
    description: 'Monitor and manage institutional cohort default rate',
    recurringSchedule: 'annual',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload most recent CDR notification',
    sortOrder: 8
  }
];

/**
 * Drug-Free Schools Act Task Template
 */
const DRUG_FREE_SCHOOLS_TASKS = [
  {
    tempId: 'dfsa-policy',
    parentTempId: null,
    title: 'Drug and Alcohol Policy',
    description: 'Maintain comprehensive drug and alcohol abuse prevention policy',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload current drug and alcohol policy',
    sortOrder: 1
  },
  {
    tempId: 'dfsa-notification',
    parentTempId: null,
    title: 'Annual Drug Prevention Notification',
    description: 'Distribute annual notification to all students and employees',
    dueDate: 'Start of academic year',
    recurringSchedule: 'annual',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload notification and distribution evidence',
    sortOrder: 2
  },
  {
    tempId: 'dfsa-standards',
    parentTempId: 'dfsa-notification',
    title: 'Standards of Conduct',
    description: 'Include standards prohibiting unlawful drug/alcohol possession',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload standards of conduct section',
    sortOrder: 1
  },
  {
    tempId: 'dfsa-sanctions',
    parentTempId: 'dfsa-notification',
    title: 'Disciplinary Sanctions',
    description: 'Document sanctions for drug/alcohol policy violations',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload sanctions policy',
    sortOrder: 2
  },
  {
    tempId: 'dfsa-health-risks',
    parentTempId: 'dfsa-notification',
    title: 'Health Risks Information',
    description: 'Provide information on health risks of drug/alcohol abuse',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload health risks information',
    sortOrder: 3
  },
  {
    tempId: 'dfsa-resources',
    parentTempId: 'dfsa-notification',
    title: 'Treatment Resources',
    description: 'Provide list of available counseling and treatment resources',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload treatment resources list',
    sortOrder: 4
  },
  {
    tempId: 'dfsa-biennial-review',
    parentTempId: null,
    title: 'Biennial Program Review',
    description: 'Conduct biennial review of drug prevention program effectiveness',
    recurringSchedule: 'biennial',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload biennial review report',
    sortOrder: 3
  }
];

/**
 * HIPAA Task Template (for institutions with health programs)
 */
const HIPAA_TASKS = [
  {
    tempId: 'hipaa-privacy-officer',
    parentTempId: null,
    title: 'HIPAA Privacy Officer Designation',
    description: 'Designate a Privacy Officer responsible for HIPAA compliance',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload Privacy Officer designation letter',
    sortOrder: 1
  },
  {
    tempId: 'hipaa-security-officer',
    parentTempId: null,
    title: 'HIPAA Security Officer Designation',
    description: 'Designate a Security Officer for electronic PHI',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload Security Officer designation letter',
    sortOrder: 2
  },
  {
    tempId: 'hipaa-privacy-policies',
    parentTempId: null,
    title: 'Privacy Policies and Procedures',
    description: 'Develop and maintain written privacy policies and procedures',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload HIPAA privacy policies',
    sortOrder: 3
  },
  {
    tempId: 'hipaa-npp',
    parentTempId: 'hipaa-privacy-policies',
    title: 'Notice of Privacy Practices',
    description: 'Publish and distribute Notice of Privacy Practices to patients',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload current Notice of Privacy Practices',
    sortOrder: 1
  },
  {
    tempId: 'hipaa-risk-assessment',
    parentTempId: null,
    title: 'Security Risk Assessment',
    description: 'Conduct periodic risk assessment of PHI security',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload risk assessment report',
    sortOrder: 4
  },
  {
    tempId: 'hipaa-safeguards',
    parentTempId: null,
    title: 'Administrative, Physical, and Technical Safeguards',
    description: 'Implement and document required HIPAA safeguards',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload safeguards documentation',
    sortOrder: 5
  },
  {
    tempId: 'hipaa-baa',
    parentTempId: null,
    title: 'Business Associate Agreements',
    description: 'Maintain executed BAAs with all business associates handling PHI',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload BAA inventory and sample agreements',
    sortOrder: 6
  },
  {
    tempId: 'hipaa-training',
    parentTempId: null,
    title: 'HIPAA Workforce Training',
    description: 'Train all workforce members who handle PHI on HIPAA requirements',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials and attendance records',
    sortOrder: 7
  },
  {
    tempId: 'hipaa-breach-procedures',
    parentTempId: null,
    title: 'Breach Notification Procedures',
    description: 'Establish procedures for breach identification, investigation, and notification',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload breach response plan',
    sortOrder: 8
  },
  {
    tempId: 'hipaa-minimum-necessary',
    parentTempId: null,
    title: 'Minimum Necessary Standard',
    description: 'Implement policies limiting PHI access to minimum necessary',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload minimum necessary policies',
    sortOrder: 9
  }
];

/**
 * GLBA Task Template (Gramm-Leach-Bliley Act)
 */
const GLBA_TASKS = [
  {
    tempId: 'glba-program',
    parentTempId: null,
    title: 'Information Security Program',
    description: 'Develop comprehensive written information security program',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload information security program document',
    sortOrder: 1
  },
  {
    tempId: 'glba-coordinator',
    parentTempId: 'glba-program',
    title: 'GLBA Coordinator Designation',
    description: 'Designate employee(s) to coordinate information security program',
    assignedRole: ROLES.PRESIDENT,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload coordinator designation',
    sortOrder: 1
  },
  {
    tempId: 'glba-risk-assessment',
    parentTempId: 'glba-program',
    title: 'Risk Assessment',
    description: 'Identify reasonably foreseeable risks to customer information',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload risk assessment report',
    sortOrder: 2
  },
  {
    tempId: 'glba-safeguards',
    parentTempId: null,
    title: 'Design and Implement Safeguards',
    description: 'Design and implement safeguards to control identified risks',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload safeguards documentation',
    sortOrder: 2
  },
  {
    tempId: 'glba-vendor-oversight',
    parentTempId: null,
    title: 'Service Provider Oversight',
    description: 'Oversee service providers handling customer information',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload vendor security requirements and contracts',
    sortOrder: 3
  },
  {
    tempId: 'glba-testing',
    parentTempId: null,
    title: 'Program Testing and Monitoring',
    description: 'Regularly test and monitor effectiveness of safeguards',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload testing and monitoring reports',
    sortOrder: 4
  },
  {
    tempId: 'glba-update',
    parentTempId: null,
    title: 'Program Updates',
    description: 'Evaluate and adjust security program based on testing and changes',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload program review and update documentation',
    sortOrder: 5
  },
  {
    tempId: 'glba-privacy-notice',
    parentTempId: null,
    title: 'Privacy Notice',
    description: 'Provide initial and annual privacy notices to students',
    recurringSchedule: 'annual',
    assignedRole: ROLES.FINANCIAL_AID,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload privacy notice and distribution evidence',
    sortOrder: 6
  },
  {
    tempId: 'glba-employee-training',
    parentTempId: null,
    title: 'Employee Security Training',
    description: 'Train employees on information security policies and procedures',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials and attendance records',
    sortOrder: 7
  }
];

/**
 * Campus SaVE Act Task Template
 */
const SAVE_ACT_TASKS = [
  {
    tempId: 'save-policy',
    parentTempId: null,
    title: 'Campus Sexual Assault Policy',
    description: 'Maintain comprehensive policy on sexual assault, dating violence, domestic violence, and stalking',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload campus sexual assault policy',
    sortOrder: 1
  },
  {
    tempId: 'save-primary-prevention',
    parentTempId: null,
    title: 'Primary Prevention and Awareness Programs',
    description: 'Implement primary prevention and awareness programs for incoming students and new employees',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload program descriptions and completion records',
    sortOrder: 2
  },
  {
    tempId: 'save-ongoing-prevention',
    parentTempId: null,
    title: 'Ongoing Prevention and Awareness Campaigns',
    description: 'Conduct ongoing prevention and awareness campaigns for students and employees',
    recurringSchedule: 'annual',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload campaign materials and participation data',
    sortOrder: 3
  },
  {
    tempId: 'save-bystander-training',
    parentTempId: 'save-primary-prevention',
    title: 'Bystander Intervention Training',
    description: 'Include bystander intervention strategies in prevention programs',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload bystander training materials',
    sortOrder: 1
  },
  {
    tempId: 'save-risk-reduction',
    parentTempId: 'save-primary-prevention',
    title: 'Risk Reduction Information',
    description: 'Provide information on recognizing warning signs and risk reduction',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload risk reduction materials',
    sortOrder: 2
  },
  {
    tempId: 'save-reporting-options',
    parentTempId: null,
    title: 'Reporting Options',
    description: 'Provide clear information on reporting options and procedures',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to reporting information',
    sortOrder: 4
  },
  {
    tempId: 'save-written-notification',
    parentTempId: null,
    title: 'Written Notification to Victims',
    description: 'Provide written notification of rights and options to victims',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload victim notification template',
    sortOrder: 5
  },
  {
    tempId: 'save-disciplinary-procedures',
    parentTempId: null,
    title: 'Disciplinary Procedures',
    description: 'Maintain prompt, fair, and impartial disciplinary procedures',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload disciplinary procedures document',
    sortOrder: 6
  },
  {
    tempId: 'save-training-officials',
    parentTempId: null,
    title: 'Training for Officials',
    description: 'Train officials who conduct disciplinary proceedings annually',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials and attendance records',
    sortOrder: 7
  }
];

/**
 * Solomon Amendment Task Template
 */
const SOLOMON_AMENDMENT_TASKS = [
  {
    tempId: 'solomon-policy',
    parentTempId: null,
    title: 'Military Recruiter Access Policy',
    description: 'Establish policy allowing military recruiter access equal to other employers',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload military recruiter access policy',
    sortOrder: 1
  },
  {
    tempId: 'solomon-directory-info',
    parentTempId: null,
    title: 'Student Directory Information for Military',
    description: 'Provide student directory information upon request to military recruiters',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload procedure for handling military requests',
    sortOrder: 2
  },
  {
    tempId: 'solomon-career-services',
    parentTempId: null,
    title: 'Career Services Access',
    description: 'Ensure military recruiters have access equal to other employers at career fairs',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest to equal access for military recruiters',
    sortOrder: 3
  },
  {
    tempId: 'solomon-rotc-access',
    parentTempId: null,
    title: 'ROTC Campus Access',
    description: 'Provide campus access for ROTC programs',
    assignedRole: ROLES.PRESIDENT,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest to ROTC access compliance',
    sortOrder: 4
  },
  {
    tempId: 'solomon-opt-out-notice',
    parentTempId: 'solomon-directory-info',
    title: 'Student Opt-Out Notification',
    description: 'Notify students of right to opt out of directory information release to military',
    recurringSchedule: 'annual',
    assignedRole: ROLES.REGISTRAR,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload opt-out notification',
    sortOrder: 1
  }
];

/**
 * HEOA Task Template (Higher Education Opportunity Act)
 */
const HEOA_TASKS = [
  {
    tempId: 'heoa-consumer-info',
    parentTempId: null,
    title: 'Consumer Information Web Page',
    description: 'Maintain comprehensive consumer information on institutional website',
    assignedRole: ROLES.REGISTRAR,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to consumer information page',
    sortOrder: 1
  },
  {
    tempId: 'heoa-textbook-info',
    parentTempId: null,
    title: 'Textbook Information Disclosure',
    description: 'Disclose textbook ISBN and pricing information during course registration',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL showing textbook information',
    sortOrder: 2
  },
  {
    tempId: 'heoa-transfer-credit',
    parentTempId: null,
    title: 'Transfer Credit Policy Disclosure',
    description: 'Publish transfer credit policies on website',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to transfer credit policy',
    sortOrder: 3
  },
  {
    tempId: 'heoa-fire-safety',
    parentTempId: null,
    title: 'Annual Fire Safety Report',
    description: 'Publish annual fire safety report for on-campus housing',
    dueDate: 'October 1',
    recurringSchedule: 'annual',
    assignedRole: ROLES.CAMPUS_SAFETY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload Annual Fire Safety Report',
    sortOrder: 4
  },
  {
    tempId: 'heoa-peer-to-peer',
    parentTempId: null,
    title: 'Peer-to-Peer File Sharing Plan',
    description: 'Develop plan to combat unauthorized file sharing on campus network',
    recurringSchedule: 'annual',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload P2P file sharing plan',
    sortOrder: 5
  },
  {
    tempId: 'heoa-constitution-day',
    parentTempId: null,
    title: 'Constitution Day Program',
    description: 'Hold educational program on Constitution for students on September 17',
    dueDate: 'September 17',
    recurringSchedule: 'annual',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload Constitution Day program materials',
    sortOrder: 6
  },
  {
    tempId: 'heoa-voter-registration',
    parentTempId: null,
    title: 'Voter Registration',
    description: 'Make voter registration forms available to students',
    assignedRole: ROLES.STUDENT_AFFAIRS,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest that voter registration forms are available',
    sortOrder: 7
  },
  {
    tempId: 'heoa-retention-rates',
    parentTempId: 'heoa-consumer-info',
    title: 'Retention and Graduation Rate Disclosure',
    description: 'Publish student retention and graduation rates on consumer info page',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to retention/graduation data',
    sortOrder: 1
  }
];

/**
 * VAWA Task Template (Violence Against Women Act)
 */
const VAWA_TASKS = [
  {
    tempId: 'vawa-definitions',
    parentTempId: null,
    title: 'VAWA Definitions in Policy',
    description: 'Include definitions of dating violence, domestic violence, sexual assault, and stalking in policy',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload policy with VAWA definitions',
    sortOrder: 1
  },
  {
    tempId: 'vawa-consent-definition',
    parentTempId: null,
    title: 'Consent Definition',
    description: 'Define consent in reference to sexual activity in institutional policy',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload consent definition in policy',
    sortOrder: 2
  },
  {
    tempId: 'vawa-prompt-proceedings',
    parentTempId: null,
    title: 'Prompt and Equitable Proceedings',
    description: 'Ensure prompt, fair, and impartial investigation and resolution',
    assignedRole: ROLES.TITLE_IX,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload investigation and resolution procedures',
    sortOrder: 3
  },
  {
    tempId: 'vawa-advisor-rights',
    parentTempId: null,
    title: 'Advisor Rights',
    description: 'Allow parties to have advisor of their choice in proceedings',
    assignedRole: ROLES.TITLE_IX,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload advisor policy',
    sortOrder: 4
  },
  {
    tempId: 'vawa-simultaneous-notification',
    parentTempId: null,
    title: 'Simultaneous Notification',
    description: 'Notify both parties simultaneously of proceeding outcomes',
    assignedRole: ROLES.TITLE_IX,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload notification procedures',
    sortOrder: 5
  },
  {
    tempId: 'vawa-protective-measures',
    parentTempId: null,
    title: 'Protective Measures',
    description: 'Provide information about protective measures available to victims',
    assignedRole: ROLES.TITLE_IX,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload protective measures information',
    sortOrder: 6
  },
  {
    tempId: 'vawa-training',
    parentTempId: null,
    title: 'Annual Training for Officials',
    description: 'Train all officials involved in proceedings on relevant issues',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training records',
    sortOrder: 7
  }
];

/**
 * FMLA Task Template (Family Medical Leave Act)
 */
const FMLA_TASKS = [
  {
    tempId: 'fmla-policy',
    parentTempId: null,
    title: 'FMLA Policy',
    description: 'Maintain written FMLA policy in employee handbook',
    assignedRole: ROLES.HR,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload FMLA policy',
    sortOrder: 1
  },
  {
    tempId: 'fmla-poster',
    parentTempId: null,
    title: 'FMLA Poster Display',
    description: 'Post FMLA notice in conspicuous location',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.SCREENSHOT,
    evidenceInstructions: 'Upload photo of posted FMLA notice',
    sortOrder: 2
  },
  {
    tempId: 'fmla-eligibility-notice',
    parentTempId: null,
    title: 'Eligibility Notice Process',
    description: 'Provide eligibility/rights notice within 5 business days of leave request',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload eligibility notice template',
    sortOrder: 3
  },
  {
    tempId: 'fmla-designation-notice',
    parentTempId: null,
    title: 'Designation Notice Process',
    description: 'Notify employee if leave is designated as FMLA leave',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload designation notice template',
    sortOrder: 4
  },
  {
    tempId: 'fmla-records',
    parentTempId: null,
    title: 'FMLA Recordkeeping',
    description: 'Maintain FMLA records for at least 3 years',
    assignedRole: ROLES.HR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.ATTESTATION,
    evidenceInstructions: 'Attest that FMLA records are maintained',
    sortOrder: 5
  },
  {
    tempId: 'fmla-training',
    parentTempId: null,
    title: 'FMLA Training for Supervisors',
    description: 'Train supervisors on FMLA requirements and employee rights',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials',
    sortOrder: 6
  }
];

/**
 * GDPR Task Template (General Data Protection Regulation)
 * For US Higher Education institutions processing EU resident data
 */
const GDPR_TASKS = [
  // Data Mapping & Inventory
  {
    tempId: 'gdpr-data-inventory',
    parentTempId: null,
    title: 'Data Mapping and Inventory',
    description: 'Create comprehensive inventory of all personal data processed, including EU resident data from students, applicants, and employees',
    instructions: 'Document: data categories, data subjects, purposes, legal basis, retention periods, recipients, and international transfers.',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload data inventory spreadsheet or ROPA documentation',
    sortOrder: 1
  },
  {
    tempId: 'gdpr-data-flows',
    parentTempId: 'gdpr-data-inventory',
    title: 'Document Data Flows',
    description: 'Map data flows showing how EU personal data moves through institutional systems',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload data flow diagrams',
    sortOrder: 1
  },
  {
    tempId: 'gdpr-lawful-basis',
    parentTempId: 'gdpr-data-inventory',
    title: 'Identify Lawful Basis for Processing',
    description: 'Document lawful basis for each processing activity (consent, contract, legal obligation, vital interests, public task, legitimate interests)',
    instructions: 'Student records typically use "public task" or "contract". Recruitment/marketing requires consent.',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload lawful basis assessment for each processing activity',
    sortOrder: 2
  },
  {
    tempId: 'gdpr-processor-contracts',
    parentTempId: 'gdpr-data-inventory',
    title: 'Review Data Processor Agreements',
    description: 'Ensure all vendors processing EU data have GDPR-compliant Data Processing Agreements (DPAs)',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload template DPA and list of compliant vendors',
    sortOrder: 3
  },

  // Legal Basis & Consent
  {
    tempId: 'gdpr-privacy-notice',
    parentTempId: null,
    title: 'GDPR-Compliant Privacy Notice',
    description: 'Update privacy notices to meet GDPR Article 13/14 requirements for EU data subjects',
    instructions: 'Must include: identity of controller, DPO contact, purposes, legal basis, recipients, retention, rights, right to complain, automated decision-making.',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to GDPR privacy notice',
    sortOrder: 2
  },
  {
    tempId: 'gdpr-consent-management',
    parentTempId: null,
    title: 'Consent Management System',
    description: 'Implement system to collect, record, and manage consent for EU data subjects',
    instructions: 'Consent must be freely given, specific, informed, and unambiguous. Must be easy to withdraw.',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.SCREENSHOT,
    evidenceInstructions: 'Upload screenshots of consent collection and management interface',
    sortOrder: 3
  },
  {
    tempId: 'gdpr-lia',
    parentTempId: null,
    title: 'Legitimate Interest Assessments',
    description: 'Document Legitimate Interest Assessments (LIAs) where legitimate interests is the lawful basis',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload completed LIA templates',
    sortOrder: 4
  },

  // Data Subject Rights
  {
    tempId: 'gdpr-dsar-process',
    parentTempId: null,
    title: 'Data Subject Access Request (DSAR) Process',
    description: 'Establish process to handle DSARs within 30-day deadline',
    instructions: 'Must verify identity, search all systems, provide data in portable format, respond within 30 days (extendable to 90 for complex requests).',
    assignedRole: ROLES.REGISTRAR,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload DSAR procedure document and response templates',
    sortOrder: 5
  },
  {
    tempId: 'gdpr-erasure',
    parentTempId: 'gdpr-dsar-process',
    title: 'Right to Erasure Procedures',
    description: 'Implement "right to be forgotten" request handling',
    instructions: 'Document exceptions (legal obligations, public interest archiving, legal claims).',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload erasure request procedure',
    sortOrder: 1
  },
  {
    tempId: 'gdpr-portability',
    parentTempId: 'gdpr-dsar-process',
    title: 'Data Portability Procedures',
    description: 'Enable data subjects to receive their data in machine-readable format',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload data export procedure and sample output format',
    sortOrder: 2
  },
  {
    tempId: 'gdpr-rectification',
    parentTempId: 'gdpr-dsar-process',
    title: 'Rectification Procedures',
    description: 'Process for correcting inaccurate personal data upon request',
    assignedRole: ROLES.REGISTRAR,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload rectification request procedure',
    sortOrder: 3
  },

  // Security & Breach Response
  {
    tempId: 'gdpr-security-measures',
    parentTempId: null,
    title: 'Technical and Organizational Security Measures',
    description: 'Implement appropriate security measures for EU personal data (encryption, access controls, pseudonymization)',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload security controls documentation',
    sortOrder: 6
  },
  {
    tempId: 'gdpr-breach-procedure',
    parentTempId: null,
    title: '72-Hour Breach Notification Procedure',
    description: 'Establish procedure to notify supervisory authority within 72 hours of becoming aware of a personal data breach',
    instructions: 'Must assess risk to data subjects, document all breaches, notify authority if risk exists, notify individuals if high risk.',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload breach response plan with 72-hour notification procedures',
    sortOrder: 7
  },
  {
    tempId: 'gdpr-breach-register',
    parentTempId: 'gdpr-breach-procedure',
    title: 'Maintain Breach Register',
    description: 'Document all personal data breaches, including facts, effects, and remedial action',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload breach register template',
    sortOrder: 1
  },

  // Governance
  {
    tempId: 'gdpr-dpo',
    parentTempId: null,
    title: 'Data Protection Officer (DPO) Appointment',
    description: 'Appoint DPO if required (public authority, large-scale processing, special categories)',
    instructions: 'DPO must be independent, report to highest management, have adequate resources.',
    assignedRole: ROLES.PRESIDENT,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload DPO appointment letter or determination that DPO not required',
    sortOrder: 8
  },
  {
    tempId: 'gdpr-dpia',
    parentTempId: null,
    title: 'Data Protection Impact Assessments (DPIA)',
    description: 'Conduct DPIAs for high-risk processing activities',
    instructions: 'Required for: systematic monitoring, large-scale special categories, new technologies, profiling.',
    recurringSchedule: 'as-needed',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload DPIA template and completed assessments',
    sortOrder: 9
  },
  {
    tempId: 'gdpr-ropa',
    parentTempId: null,
    title: 'Records of Processing Activities (ROPA)',
    description: 'Maintain Article 30 records of all processing activities',
    instructions: 'Must include: controller details, purposes, data categories, recipients, transfers, retention, security measures.',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload ROPA documentation',
    sortOrder: 10
  },
  {
    tempId: 'gdpr-privacy-by-design',
    parentTempId: null,
    title: 'Privacy by Design Implementation',
    description: 'Integrate data protection into system design and business processes',
    instructions: 'Consider privacy at project inception, default to privacy-protective settings.',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload privacy by design checklist for new projects',
    sortOrder: 11
  },

  // International Transfers
  {
    tempId: 'gdpr-transfer-mechanisms',
    parentTempId: null,
    title: 'International Transfer Safeguards',
    description: 'Implement lawful mechanisms for transferring EU data to US (SCCs, binding corporate rules)',
    instructions: 'Standard Contractual Clauses (SCCs) are primary mechanism post-Schrems II. Conduct Transfer Impact Assessments.',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload executed SCCs and Transfer Impact Assessments',
    sortOrder: 12
  },
  {
    tempId: 'gdpr-study-abroad',
    parentTempId: 'gdpr-transfer-mechanisms',
    title: 'Study Abroad Data Transfer Compliance',
    description: 'Ensure GDPR compliance for study abroad program data transfers',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload study abroad data handling procedures',
    sortOrder: 1
  },

  // Training
  {
    tempId: 'gdpr-training',
    parentTempId: null,
    title: 'Annual GDPR Training',
    description: 'Provide annual GDPR awareness training to all staff who handle EU personal data',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload training materials and completion records',
    sortOrder: 13
  },
  {
    tempId: 'gdpr-it-training',
    parentTempId: 'gdpr-training',
    title: 'Specialized IT GDPR Training',
    description: 'Provide specialized training to IT staff on technical GDPR requirements',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload IT-specific training materials',
    sortOrder: 1
  },

  // Higher Education Specific
  {
    tempId: 'gdpr-student-records',
    parentTempId: null,
    title: 'Student Records GDPR Compliance',
    description: 'Ensure student records processing complies with GDPR (lawful basis, retention, rights)',
    instructions: 'Primary lawful basis for academic records is typically "public task" or "contract performance".',
    assignedRole: ROLES.REGISTRAR,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload student records GDPR compliance assessment',
    sortOrder: 14
  },
  {
    tempId: 'gdpr-recruitment',
    parentTempId: null,
    title: 'International Recruitment Compliance',
    description: 'Ensure GDPR compliance for international student recruitment activities',
    instructions: 'Marketing to EU prospects requires explicit consent. Retention periods must be defined.',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload recruitment data handling procedures',
    sortOrder: 15
  },
  {
    tempId: 'gdpr-alumni',
    parentTempId: null,
    title: 'Alumni Data GDPR Compliance',
    description: 'Review alumni data retention and marketing consent under GDPR',
    instructions: 'Alumni marketing requires consent. Review retention periods for historical records.',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload alumni data policy and consent mechanisms',
    sortOrder: 16
  },
  {
    tempId: 'gdpr-research',
    parentTempId: null,
    title: 'Research Data GDPR Compliance',
    description: 'Ensure research involving EU subjects complies with GDPR special category rules',
    instructions: 'Research involving health data, genetics, biometrics requires explicit consent or public interest exemption.',
    assignedRole: ROLES.COMPLIANCE,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload research data handling procedures',
    sortOrder: 17
  }
];

/**
 * Copyright/DMCA Task Template
 */
const COPYRIGHT_DMCA_TASKS = [
  {
    tempId: 'dmca-agent',
    parentTempId: null,
    title: 'DMCA Agent Designation',
    description: 'Designate and register DMCA agent with Copyright Office',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload DMCA agent registration',
    sortOrder: 1
  },
  {
    tempId: 'dmca-policy',
    parentTempId: null,
    title: 'Copyright Policy',
    description: 'Publish copyright infringement policy and procedures',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to copyright policy',
    sortOrder: 2
  },
  {
    tempId: 'dmca-repeat-infringer',
    parentTempId: null,
    title: 'Repeat Infringer Policy',
    description: 'Implement policy for terminating repeat infringers',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload repeat infringer policy',
    sortOrder: 3
  },
  {
    tempId: 'dmca-notice-procedure',
    parentTempId: null,
    title: 'Takedown Notice Procedures',
    description: 'Establish procedures for handling DMCA takedown notices',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload takedown procedures',
    sortOrder: 4
  },
  {
    tempId: 'dmca-education',
    parentTempId: null,
    title: 'Copyright Education',
    description: 'Educate students and employees about copyright law',
    recurringSchedule: 'annual',
    assignedRole: ROLES.TRAINING,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload educational materials',
    sortOrder: 5
  },
  {
    tempId: 'dmca-legal-alternatives',
    parentTempId: null,
    title: 'Legal Alternatives Information',
    description: 'Inform community about legal alternatives to piracy',
    assignedRole: ROLES.IT_SECURITY,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to legal alternatives information',
    sortOrder: 6
  }
];

/**
 * Section 504 Task Template
 */
const SECTION_504_TASKS = [
  {
    tempId: '504-coordinator',
    parentTempId: null,
    title: 'Section 504 Coordinator Designation',
    description: 'Designate Section 504 coordinator (may be same as ADA coordinator)',
    assignedRole: ROLES.PRESIDENT,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload coordinator designation letter',
    sortOrder: 1
  },
  {
    tempId: '504-notice',
    parentTempId: null,
    title: 'Section 504 Notice',
    description: 'Publish notice of non-discrimination under Section 504',
    assignedRole: ROLES.GENERAL_COUNSEL,
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.LINK,
    evidenceInstructions: 'Provide URL to published notice',
    sortOrder: 2
  },
  {
    tempId: '504-grievance',
    parentTempId: null,
    title: 'Section 504 Grievance Procedures',
    description: 'Establish grievance procedures for disability discrimination complaints',
    assignedRole: ROLES.DISABILITY,
    priority: 'high',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload grievance procedures',
    sortOrder: 3
  },
  {
    tempId: '504-self-evaluation',
    parentTempId: null,
    title: 'Self-Evaluation and Transition Plan',
    description: 'Maintain current self-evaluation and transition plan for accessibility',
    assignedRole: ROLES.DISABILITY,
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: EVIDENCE_TYPES.DOCUMENT,
    evidenceInstructions: 'Upload self-evaluation and transition plan',
    sortOrder: 4
  }
];

/**
 * Task templates by regulation slug
 */
const TASK_TEMPLATES = {
  // Tier 1 - Critical
  'americans-with-disabilities-act-of-1990': ADA_TASKS,
  'ada': ADA_TASKS,
  'occupational-safety-and-health-act-of-1970': OSHA_TASKS,
  'osha': OSHA_TASKS,
  'higher-education-act-title-iv-student-financial-a': TITLE_IV_TASKS,
  'title-iv': TITLE_IV_TASKS,
  'health-insurance-portability-and-accountability-ac': HIPAA_TASKS,
  'hipaa': HIPAA_TASKS,
  'gramm-leach-bliley-act-glba': GLBA_TASKS,
  'glba': GLBA_TASKS,
  'solomon-amendment': SOLOMON_AMENDMENT_TASKS,
  'higher-education-opportunity-act': HEOA_TASKS,
  'heoa': HEOA_TASKS,
  'campus-sexual-violence-elimination-act': SAVE_ACT_TASKS,
  'save-act': SAVE_ACT_TASKS,
  
  // Tier 2 - High Priority
  'drug-free-schools-and-communities-act': DRUG_FREE_SCHOOLS_TASKS,
  'section-504-of-the-rehabilitation-act-of-1973': SECTION_504_TASKS,
  'section-504': SECTION_504_TASKS,
  'violence-against-women-reauthorization-act': VAWA_TASKS,
  'vawa': VAWA_TASKS,
  'family-medical-leave-act': FMLA_TASKS,
  'fmla': FMLA_TASKS,
  'copyright-dmca': COPYRIGHT_DMCA_TASKS,
  'digital-millennium-copyright-act': COPYRIGHT_DMCA_TASKS,
  'dmca': COPYRIGHT_DMCA_TASKS,
  
  // International
  'general-data-protection-regulation': GDPR_TASKS,
  'gdpr': GDPR_TASKS,
  'reg-gdpr-2016-679': GDPR_TASKS,
  'eu-gdpr': GDPR_TASKS
};

/**
 * Compliance Task Generator Service
 */
export class ComplianceTaskGenerator {
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /**
   * Check if regulation has an EdSteward template
   */
  hasEdStewardTemplate(regulationSlug) {
    const normalizedSlug = regulationSlug.toLowerCase();
    return normalizedSlug in TEMPLATE_REGULATIONS;
  }

  /**
   * Get template hint for EdSteward
   */
  getTemplateHint(regulationSlug) {
    const normalizedSlug = regulationSlug.toLowerCase();
    return TEMPLATE_REGULATIONS[normalizedSlug] || null;
  }

  /**
   * Check if regulation needs generated tasks
   */
  needsGeneratedTasks(regulationSlug) {
    const normalizedSlug = regulationSlug.toLowerCase();
    
    // Has EdSteward template - no need to generate
    if (this.hasEdStewardTemplate(normalizedSlug)) {
      return false;
    }
    
    // Check Tier 1 and Tier 2
    return TIER_1_REGULATIONS.includes(normalizedSlug) || 
           TIER_2_REGULATIONS.includes(normalizedSlug) ||
           normalizedSlug in TASK_TEMPLATES;
  }

  /**
   * Generate compliance tasks for a regulation
   */
  generateTasks(regulationSlug) {
    const normalizedSlug = regulationSlug.toLowerCase();
    
    // Check for template first
    if (this.hasEdStewardTemplate(normalizedSlug)) {
      this.logger.info(`${regulationSlug} has EdSteward template - returning templateHint`);
      return {
        hasTemplate: true,
        templateHint: this.getTemplateHint(normalizedSlug),
        tasks: null
      };
    }
    
    // Check for task template
    const tasks = TASK_TEMPLATES[normalizedSlug];
    if (tasks) {
      this.logger.info(`Generated ${tasks.length} tasks for ${regulationSlug}`);
      return {
        hasTemplate: false,
        templateHint: null,
        tasks: tasks
      };
    }
    
    // No tasks for this regulation
    this.logger.info(`No task template for ${regulationSlug} - simple attestation workflow`);
    return {
      hasTemplate: false,
      templateHint: null,
      tasks: null
    };
  }

  /**
   * Format tasks for EdSteward payload
   */
  formatForEdSteward(regulationSlug, tasks) {
    if (!tasks || tasks.length === 0) {
      return {
        complianceTasks: null,
        metadata: {
          tasksGenerated: false,
          taskCount: 0
        }
      };
    }

    return {
      complianceTasks: tasks,
      metadata: {
        tasksGenerated: true,
        taskCount: tasks.length,
        generatedAt: new Date().toISOString(),
        generator: 'MCP Engine Compliance Task Generator v1.0'
      }
    };
  }

  /**
   * Get regulation category based on complexity
   */
  getRegulationCategory(regulationSlug) {
    const normalizedSlug = regulationSlug.toLowerCase();
    
    if (this.hasEdStewardTemplate(normalizedSlug)) {
      return 'template';
    }
    
    if (TIER_1_REGULATIONS.includes(normalizedSlug)) {
      return 'tier1_complex';
    }
    
    if (TIER_2_REGULATIONS.includes(normalizedSlug)) {
      return 'tier2_reporting';
    }
    
    if (normalizedSlug in TASK_TEMPLATES) {
      return 'has_tasks';
    }
    
    return 'simple';
  }

  /**
   * Get all available task templates
   */
  getAvailableTemplates() {
    return {
      edstewardTemplates: Object.keys(TEMPLATE_REGULATIONS),
      mcpTaskTemplates: Object.keys(TASK_TEMPLATES),
      tier1Regulations: TIER_1_REGULATIONS,
      tier2Regulations: TIER_2_REGULATIONS
    };
  }
}

export default ComplianceTaskGenerator;
export { ROLES, EVIDENCE_TYPES, TEMPLATE_REGULATIONS, TASK_TEMPLATES };

