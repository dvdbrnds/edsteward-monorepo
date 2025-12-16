/**
 * FERPA Compliance Task Template
 * 
 * The Family Educational Rights and Privacy Act (FERPA) (20 U.S.C. § 1232g)
 * protects the privacy of student education records and gives parents/eligible
 * students rights to access and amend records.
 * 
 * Key requirements:
 * 1. Annual notification of rights to students/parents
 * 2. Procedures for record access requests
 * 3. Amendment procedures for disputed records
 * 4. Disclosure policies and consent requirements
 * 5. Directory information policies
 * 6. Staff training on FERPA requirements
 */

export interface FerpaTaskTemplate {
  tempId: string;
  parentTempId?: string;
  title: string;
  description: string;
  instructions?: string;
  assignedRole: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidenceRequired: boolean;
  evidenceType: 'none' | 'document' | 'link' | 'screenshot' | 'attestation' | 'form';
  evidenceInstructions?: string;
  sortOrder: number;
}

export const FERPA_TASKS: FerpaTaskTemplate[] = [
  // ===== SECTION 1: ANNUAL NOTIFICATION =====
  {
    tempId: 'ferpa-notification-main',
    title: 'Annual FERPA Rights Notification',
    description: 'Provide annual notification to students and parents of their FERPA rights.',
    assignedRole: 'Registrar',
    dueDate: 'Start of Fall Semester',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload copy of notification sent to students',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-notification-content',
    parentTempId: 'ferpa-notification-main',
    title: 'Draft Notification Content',
    description: 'Prepare notification content including all required FERPA rights information.',
    instructions: 'Include: right to inspect records, right to amend, consent requirements, directory information opt-out, and complaint procedures.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload draft notification for review',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-notification-legal',
    parentTempId: 'ferpa-notification-main',
    title: 'Legal Review of Notification',
    description: 'Have notification reviewed by legal counsel for compliance.',
    assignedRole: 'General Counsel',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that legal review is complete',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-notification-distribute',
    parentTempId: 'ferpa-notification-main',
    title: 'Distribute Annual Notification',
    description: 'Send notification via email and post on institutional website.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'screenshot',
    evidenceInstructions: 'Screenshot of email sent and website posting',
    sortOrder: 3,
  },

  // ===== SECTION 2: DIRECTORY INFORMATION =====
  {
    tempId: 'ferpa-directory-main',
    title: 'Directory Information Policy',
    description: 'Maintain and communicate directory information policies.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload current directory information policy',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-directory-define',
    parentTempId: 'ferpa-directory-main',
    title: 'Define Directory Information Categories',
    description: 'Document what information is designated as directory information.',
    instructions: 'Common categories: name, address, email, phone, major, enrollment status, degrees, honors, participation in activities/sports.',
    assignedRole: 'Registrar',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload list of directory information categories',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-directory-optout',
    parentTempId: 'ferpa-directory-main',
    title: 'Implement Opt-Out Process',
    description: 'Provide students a way to opt out of directory information disclosure.',
    instructions: 'Process must be clearly communicated and easily accessible.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to opt-out form or process',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-directory-track',
    parentTempId: 'ferpa-directory-main',
    title: 'Track Opt-Out Requests',
    description: 'Maintain system to track students who have opted out.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that tracking system is in place and functioning',
    sortOrder: 3,
  },

  // ===== SECTION 3: RECORD ACCESS PROCEDURES =====
  {
    tempId: 'ferpa-access-main',
    title: 'Record Access Procedures',
    description: 'Maintain procedures for students/parents to access education records.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload record access procedure documentation',
    sortOrder: 3,
  },
  {
    tempId: 'ferpa-access-request',
    parentTempId: 'ferpa-access-main',
    title: 'Record Request Process',
    description: 'Document process for students to request access to their records.',
    instructions: 'Must respond within 45 days of request. Include any fees charged for copies.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload request form and process documentation',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-access-identity',
    parentTempId: 'ferpa-access-main',
    title: 'Identity Verification Procedures',
    description: 'Establish procedures to verify identity before releasing records.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload identity verification procedures',
    sortOrder: 2,
  },

  // ===== SECTION 4: AMENDMENT PROCEDURES =====
  {
    tempId: 'ferpa-amend-main',
    title: 'Record Amendment Procedures',
    description: 'Maintain procedures for students to request amendments to records.',
    assignedRole: 'Registrar',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload amendment request procedures',
    sortOrder: 4,
  },
  {
    tempId: 'ferpa-amend-request',
    parentTempId: 'ferpa-amend-main',
    title: 'Amendment Request Form',
    description: 'Provide form for students to request record amendments.',
    assignedRole: 'Registrar',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload amendment request form',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-amend-hearing',
    parentTempId: 'ferpa-amend-main',
    title: 'Hearing Procedures',
    description: 'Document hearing procedures if amendment is denied.',
    instructions: 'Student has right to a hearing if initial request is denied.',
    assignedRole: 'General Counsel',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload hearing procedure documentation',
    sortOrder: 2,
  },

  // ===== SECTION 5: CONSENT & DISCLOSURE =====
  {
    tempId: 'ferpa-consent-main',
    title: 'Consent and Disclosure Procedures',
    description: 'Maintain procedures for obtaining consent and documenting disclosures.',
    assignedRole: 'Registrar',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload consent and disclosure policy',
    sortOrder: 5,
  },
  {
    tempId: 'ferpa-consent-form',
    parentTempId: 'ferpa-consent-main',
    title: 'Written Consent Form',
    description: 'Provide form for students to authorize disclosure of records.',
    instructions: 'Must specify records to be disclosed, purpose, and to whom.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload consent form',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-consent-log',
    parentTempId: 'ferpa-consent-main',
    title: 'Disclosure Log Maintenance',
    description: 'Maintain log of all disclosures made from student records.',
    instructions: 'Log must include date, recipient, and legitimate interest.',
    assignedRole: 'Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that disclosure log is maintained',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-consent-exceptions',
    parentTempId: 'ferpa-consent-main',
    title: 'Document Consent Exceptions',
    description: 'Document situations where disclosure is permitted without consent.',
    instructions: 'Exceptions include: school officials, other schools, auditors, financial aid, accreditation, legal compliance, health/safety emergencies.',
    assignedRole: 'General Counsel',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload list of consent exceptions with legal basis',
    sortOrder: 3,
  },

  // ===== SECTION 6: TRAINING =====
  {
    tempId: 'ferpa-training-main',
    title: 'FERPA Staff Training',
    description: 'Provide annual FERPA training to all staff with access to student records.',
    assignedRole: 'HR / Compliance Officer',
    dueDate: 'Start of Academic Year',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training materials and completion records',
    sortOrder: 6,
  },
  {
    tempId: 'ferpa-training-develop',
    parentTempId: 'ferpa-training-main',
    title: 'Develop Training Materials',
    description: 'Create or update FERPA training content.',
    assignedRole: 'Compliance Officer',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training presentation/materials',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-training-conduct',
    parentTempId: 'ferpa-training-main',
    title: 'Conduct Training Sessions',
    description: 'Deliver FERPA training to all relevant staff.',
    assignedRole: 'HR / Compliance Officer',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload attendance records',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-training-track',
    parentTempId: 'ferpa-training-main',
    title: 'Track Training Completion',
    description: 'Maintain records of staff who have completed FERPA training.',
    assignedRole: 'HR',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training completion report',
    sortOrder: 3,
  },

  // ===== SECTION 7: SECURITY =====
  {
    tempId: 'ferpa-security-main',
    title: 'Record Security Measures',
    description: 'Implement appropriate security measures for education records.',
    assignedRole: 'IT Security / Registrar',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload security policy documentation',
    sortOrder: 7,
  },
  {
    tempId: 'ferpa-security-access',
    parentTempId: 'ferpa-security-main',
    title: 'Access Controls',
    description: 'Implement role-based access controls for student information systems.',
    assignedRole: 'IT Security',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that access controls are in place',
    sortOrder: 1,
  },
  {
    tempId: 'ferpa-security-audit',
    parentTempId: 'ferpa-security-main',
    title: 'Access Audit',
    description: 'Conduct periodic audit of who has access to student records.',
    assignedRole: 'IT Security',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload access audit report',
    sortOrder: 2,
  },
  {
    tempId: 'ferpa-security-physical',
    parentTempId: 'ferpa-security-main',
    title: 'Physical Record Security',
    description: 'Ensure physical records are stored securely.',
    instructions: 'Locked cabinets, restricted areas, proper disposal procedures.',
    assignedRole: 'Registrar',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that physical security measures are in place',
    sortOrder: 3,
  },
];

/**
 * Get FERPA tasks with calculated due dates for a specific year
 */
export function getFerpaTasksWithDates(regulationId: number, year: number = new Date().getFullYear()) {
  const startOfFall = new Date(year, 7, 15); // August 15 as approximate fall start
  
  return FERPA_TASKS.map((task, index) => {
    let dueDate: Date | null = null;
    
    if (task.dueDate === 'Start of Fall Semester') {
      dueDate = startOfFall;
    } else if (task.dueDate === 'Start of Academic Year') {
      dueDate = startOfFall;
    }
    
    return {
      ...task,
      id: index + 1,
      regulationId,
      parentId: task.parentTempId 
        ? FERPA_TASKS.findIndex(t => t.tempId === task.parentTempId) + 1
        : null,
      dueDate: dueDate ? dueDate.toISOString() : null,
    };
  });
}

export function getFerpaTaskCount() {
  const parentTasks = FERPA_TASKS.filter(t => !t.parentTempId).length;
  const subTasks = FERPA_TASKS.filter(t => t.parentTempId).length;
  return { total: FERPA_TASKS.length, parents: parentTasks, subTasks };
}

