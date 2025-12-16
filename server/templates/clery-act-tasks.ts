/**
 * Clery Act Compliance Task Template
 * 
 * The Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act
 * (20 U.S.C. § 1092(f)) requires colleges and universities to:
 * 
 * 1. Publish an Annual Security Report (ASR) by October 1
 * 2. Disclose crime statistics for the campus and surrounding areas
 * 3. Issue timely warnings about crimes that pose a threat
 * 4. Implement emergency notification procedures
 * 5. Maintain a public crime log
 * 6. Disclose missing student notification procedures
 * 7. Disclose fire safety information (for residential facilities)
 * 
 * This template creates a comprehensive checklist for Clery Act compliance.
 */

export interface CleryTaskTemplate {
  tempId: string;
  parentTempId?: string;
  title: string;
  description: string;
  instructions?: string;
  assignedRole: string;
  dueDate?: string; // Relative date like "October 1" or null for ongoing
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidenceRequired: boolean;
  evidenceType: 'none' | 'document' | 'link' | 'screenshot' | 'attestation' | 'form';
  evidenceInstructions?: string;
  sortOrder: number;
}

export const CLERY_ACT_TASKS: CleryTaskTemplate[] = [
  // ===== SECTION 1: ANNUAL SECURITY REPORT (ASR) =====
  {
    tempId: 'asr-main',
    title: 'Annual Security Report (ASR)',
    description: 'Prepare and publish the Annual Security Report containing campus security policies and crime statistics.',
    assignedRole: 'Director of Campus Safety',
    dueDate: 'October 1',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload the final published ASR document (PDF)',
    sortOrder: 1,
  },
  {
    tempId: 'asr-draft',
    parentTempId: 'asr-main',
    title: 'Draft ASR Content',
    description: 'Compile all required policy statements and crime statistics into draft format.',
    instructions: 'Include: security policies, crime prevention programs, drug/alcohol policies, sexual assault policies, and three years of crime statistics.',
    assignedRole: 'Campus Safety Administrator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload draft ASR for review',
    sortOrder: 1,
  },
  {
    tempId: 'asr-legal-review',
    parentTempId: 'asr-main',
    title: 'Legal/Compliance Review of ASR',
    description: 'Have the ASR reviewed by legal counsel and compliance office.',
    assignedRole: 'General Counsel',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that legal review is complete',
    sortOrder: 2,
  },
  {
    tempId: 'asr-publish-website',
    parentTempId: 'asr-main',
    title: 'Publish ASR to Website',
    description: 'Post the final ASR to the institution\'s public website.',
    instructions: 'Must be easily accessible and prominently displayed.',
    assignedRole: 'Web Communications',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Provide URL to published ASR',
    sortOrder: 3,
  },
  {
    tempId: 'asr-notify-community',
    parentTempId: 'asr-main',
    title: 'Notify Campus Community',
    description: 'Send notification to all students, faculty, and staff about ASR availability.',
    instructions: 'Email must include: brief description of ASR, URL to access it, and information on obtaining a paper copy.',
    assignedRole: 'Campus Communications',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload copy of notification email sent',
    sortOrder: 4,
  },
  {
    tempId: 'asr-prospective-students',
    parentTempId: 'asr-main',
    title: 'Notify Prospective Students/Employees',
    description: 'Ensure prospective students and employees are informed about ASR availability.',
    assignedRole: 'Admissions / Human Resources',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 5,
  },

  // ===== SECTION 2: CRIME STATISTICS =====
  {
    tempId: 'crime-stats-main',
    title: 'Crime Statistics Collection & Reporting',
    description: 'Collect, compile, and report campus crime statistics to the Department of Education.',
    assignedRole: 'Campus Safety Director',
    dueDate: 'October 1',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload DOE submission confirmation',
    sortOrder: 2,
  },
  {
    tempId: 'crime-stats-collect',
    parentTempId: 'crime-stats-main',
    title: 'Collect Crime Data from All Sources',
    description: 'Gather crime reports from campus security, local police, and Campus Security Authorities (CSAs).',
    instructions: 'Include: on-campus, non-campus, public property, and residential facility crimes.',
    assignedRole: 'Campus Safety Administrator',
    priority: 'high',
    evidenceRequired: false,
    evidenceType: 'none',
    sortOrder: 1,
  },
  {
    tempId: 'crime-stats-csa-training',
    parentTempId: 'crime-stats-main',
    title: 'CSA Training Verification',
    description: 'Verify all Campus Security Authorities have received required training.',
    instructions: 'CSAs include: student affairs, athletics, residential life, faculty advisors, etc.',
    assignedRole: 'Training Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload CSA training completion records',
    sortOrder: 2,
  },
  {
    tempId: 'crime-stats-submit-doe',
    parentTempId: 'crime-stats-main',
    title: 'Submit Statistics to DOE',
    description: 'Submit crime statistics to the Department of Education via the Campus Safety and Security Survey.',
    assignedRole: 'Campus Safety Director',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'screenshot',
    evidenceInstructions: 'Screenshot of DOE submission confirmation',
    sortOrder: 3,
  },

  // ===== SECTION 3: DAILY CRIME LOG =====
  {
    tempId: 'crime-log-main',
    title: 'Daily Crime Log Maintenance',
    description: 'Maintain a daily crime log of all crimes reported to campus security.',
    instructions: 'Log must be publicly available and updated within 2 business days of a report.',
    assignedRole: 'Campus Safety',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that crime log is current and publicly accessible',
    sortOrder: 3,
  },
  {
    tempId: 'crime-log-accessibility',
    parentTempId: 'crime-log-main',
    title: 'Verify Crime Log Public Accessibility',
    description: 'Ensure the crime log is available for public inspection during normal business hours.',
    assignedRole: 'Campus Safety',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Provide location/URL where crime log can be accessed',
    sortOrder: 1,
  },

  // ===== SECTION 4: TIMELY WARNINGS =====
  {
    tempId: 'timely-warnings-main',
    title: 'Timely Warning Procedures',
    description: 'Maintain and test timely warning procedures for Clery Act crimes that pose a serious or ongoing threat.',
    assignedRole: 'Campus Safety Director',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload current timely warning policy document',
    sortOrder: 4,
  },
  {
    tempId: 'timely-warnings-policy',
    parentTempId: 'timely-warnings-main',
    title: 'Review Timely Warning Policy',
    description: 'Annually review and update timely warning procedures.',
    assignedRole: 'Campus Safety Director',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 1,
  },
  {
    tempId: 'timely-warnings-distribution',
    parentTempId: 'timely-warnings-main',
    title: 'Verify Distribution Methods',
    description: 'Confirm timely warnings can be distributed campus-wide via email, text, and other methods.',
    assignedRole: 'IT / Communications',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 2,
  },

  // ===== SECTION 5: EMERGENCY NOTIFICATION =====
  {
    tempId: 'emergency-main',
    title: 'Emergency Notification System',
    description: 'Maintain and test emergency notification procedures for immediate threats to campus.',
    assignedRole: 'Emergency Management',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload emergency notification test results',
    sortOrder: 5,
  },
  {
    tempId: 'emergency-test',
    parentTempId: 'emergency-main',
    title: 'Annual Emergency Notification Test',
    description: 'Conduct at least one announced or unannounced test of emergency notification system.',
    instructions: 'Document the test, including description, date, time, and whether announced or unannounced.',
    assignedRole: 'Emergency Management',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload test documentation and results',
    sortOrder: 1,
  },
  {
    tempId: 'emergency-procedures',
    parentTempId: 'emergency-main',
    title: 'Review Emergency Procedures',
    description: 'Annually review emergency response and evacuation procedures.',
    assignedRole: 'Emergency Management',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 2,
  },
  {
    tempId: 'emergency-publicize',
    parentTempId: 'emergency-main',
    title: 'Publicize Emergency Procedures',
    description: 'Ensure emergency procedures are publicized to campus community.',
    assignedRole: 'Communications',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to published emergency procedures',
    sortOrder: 3,
  },

  // ===== SECTION 6: MISSING STUDENT NOTIFICATION =====
  {
    tempId: 'missing-student-main',
    title: 'Missing Student Notification Procedures',
    description: 'Maintain procedures for missing student notification for residential students.',
    assignedRole: 'Student Affairs / Residential Life',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload current missing student policy',
    sortOrder: 6,
  },
  {
    tempId: 'missing-student-contacts',
    parentTempId: 'missing-student-main',
    title: 'Emergency Contact Registration',
    description: 'Ensure residential students can register a confidential emergency contact.',
    instructions: 'Contact is separate from general emergency contact and only for missing person cases.',
    assignedRole: 'Residential Life',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 1,
  },
  {
    tempId: 'missing-student-policy',
    parentTempId: 'missing-student-main',
    title: 'Review Missing Student Policy',
    description: 'Annually review missing student notification procedures.',
    assignedRole: 'Student Affairs',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 2,
  },

  // ===== SECTION 7: FIRE SAFETY (Residential) =====
  {
    tempId: 'fire-safety-main',
    title: 'Fire Safety Report & Compliance',
    description: 'Maintain fire safety records and publish annual fire safety report for residential facilities.',
    assignedRole: 'Facilities / Fire Safety',
    dueDate: 'October 1',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload Annual Fire Safety Report',
    sortOrder: 7,
  },
  {
    tempId: 'fire-safety-log',
    parentTempId: 'fire-safety-main',
    title: 'Maintain Fire Log',
    description: 'Maintain a fire log for each residential facility recording all fires.',
    assignedRole: 'Facilities',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 1,
  },
  {
    tempId: 'fire-safety-drills',
    parentTempId: 'fire-safety-main',
    title: 'Fire Drill Documentation',
    description: 'Document fire drills conducted in residential facilities.',
    assignedRole: 'Residential Life',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload fire drill records',
    sortOrder: 2,
  },
  {
    tempId: 'fire-safety-equipment',
    parentTempId: 'fire-safety-main',
    title: 'Fire Safety Equipment Inspection',
    description: 'Verify all fire safety equipment is inspected and functional.',
    instructions: 'Includes: fire extinguishers, smoke detectors, sprinkler systems, alarms.',
    assignedRole: 'Facilities',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload inspection records',
    sortOrder: 3,
  },

  // ===== SECTION 8: POLICY DISCLOSURES =====
  {
    tempId: 'policies-main',
    title: 'Required Policy Disclosures',
    description: 'Ensure all required policies are documented and disclosed in the ASR.',
    assignedRole: 'Compliance Officer',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 8,
  },
  {
    tempId: 'policies-drugs-alcohol',
    parentTempId: 'policies-main',
    title: 'Drug and Alcohol Policy',
    description: 'Review and document drug and alcohol abuse prevention policies.',
    assignedRole: 'Student Affairs',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    sortOrder: 1,
  },
  {
    tempId: 'policies-sexual-assault',
    parentTempId: 'policies-main',
    title: 'Sexual Assault Prevention Policy',
    description: 'Review sexual assault, domestic violence, dating violence, and stalking policies.',
    instructions: 'Must include: prevention programs, procedures for reporting, victim resources.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    sortOrder: 2,
  },
  {
    tempId: 'policies-security-awareness',
    parentTempId: 'policies-main',
    title: 'Security Awareness Programs',
    description: 'Document crime prevention and security awareness programs offered.',
    assignedRole: 'Campus Safety',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    sortOrder: 3,
  },
  {
    tempId: 'policies-access',
    parentTempId: 'policies-main',
    title: 'Campus Access and Security Policy',
    description: 'Review policies on campus facility access and security.',
    assignedRole: 'Campus Safety',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 4,
  },

  // ===== SECTION 9: VAWA COMPLIANCE =====
  {
    tempId: 'vawa-main',
    title: 'VAWA Compliance Requirements',
    description: 'Ensure compliance with Violence Against Women Act requirements in Clery.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    sortOrder: 9,
  },
  {
    tempId: 'vawa-training',
    parentTempId: 'vawa-main',
    title: 'VAWA Training for Officials',
    description: 'Verify training for officials involved in conduct proceedings.',
    instructions: 'Training must cover: domestic violence, dating violence, sexual assault, stalking.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training completion records',
    sortOrder: 1,
  },
  {
    tempId: 'vawa-prevention',
    parentTempId: 'vawa-main',
    title: 'Primary Prevention Programs',
    description: 'Document primary prevention and awareness programs for incoming students/employees.',
    assignedRole: 'Student Affairs / HR',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    sortOrder: 2,
  },
  {
    tempId: 'vawa-procedures',
    parentTempId: 'vawa-main',
    title: 'Written Notification Procedures',
    description: 'Verify written notification of rights and options for victims is in place.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    sortOrder: 3,
  },
];

/**
 * Get tasks with calculated due dates for the current year
 */
export function getCleryTasksWithDates(year: number = new Date().getFullYear()): CleryTaskTemplate[] {
  return CLERY_ACT_TASKS.map(task => {
    if (task.dueDate === 'October 1') {
      return {
        ...task,
        dueDate: `${year}-10-01`,
      };
    }
    return task;
  });
}

/**
 * Get the total count of tasks
 */
export function getCleryTaskCount(): { total: number; critical: number; high: number } {
  const total = CLERY_ACT_TASKS.length;
  const critical = CLERY_ACT_TASKS.filter(t => t.priority === 'critical').length;
  const high = CLERY_ACT_TASKS.filter(t => t.priority === 'high').length;
  return { total, critical, high };
}

