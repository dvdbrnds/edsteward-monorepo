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
  'technology-education-and-copyright-harmonization-a',
  'teach-act',
  'reg-66',
  'section-504-of-the-rehabilitation-act-of-1973',
  'violence-against-women-reauthorization-act'
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
  'americans-with-disabilities-act-of-1990': ADA_TASKS,
  'ada': ADA_TASKS,
  'occupational-safety-and-health-act-of-1970': OSHA_TASKS,
  'osha': OSHA_TASKS,
  'higher-education-act-title-iv-student-financial-a': TITLE_IV_TASKS,
  'drug-free-schools-and-communities-act': DRUG_FREE_SCHOOLS_TASKS,
  'section-504-of-the-rehabilitation-act-of-1973': SECTION_504_TASKS,
  'section-504': SECTION_504_TASKS
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

