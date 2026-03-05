/**
 * Title IX Compliance Task Template
 * 
 * Title IX of the Education Amendments of 1972 (20 U.S.C. § 1681 et seq.)
 * prohibits discrimination on the basis of sex in education programs and
 * activities receiving federal financial assistance.
 * 
 * Key requirements:
 * 1. Designate Title IX Coordinator
 * 2. Publish non-discrimination policy
 * 3. Establish grievance procedures for sex discrimination complaints
 * 4. Provide training to Title IX personnel
 * 5. Maintain records of complaints and resolutions
 * 6. Address sexual harassment and assault
 * 7. Ensure equal opportunity in athletics
 */

export interface TitleIXTaskTemplate {
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

export const TITLE_IX_TASKS: TitleIXTaskTemplate[] = [
  // ===== SECTION 1: TITLE IX COORDINATOR =====
  {
    tempId: 'tix-coordinator-main',
    title: 'Title IX Coordinator Designation',
    description: 'Designate and publicize a Title IX Coordinator.',
    assignedRole: 'President / Provost',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload official designation letter',
    sortOrder: 1,
  },
  {
    tempId: 'tix-coordinator-appoint',
    parentTempId: 'tix-coordinator-main',
    title: 'Appoint Title IX Coordinator',
    description: 'Formally appoint a qualified Title IX Coordinator.',
    instructions: 'Coordinator should have appropriate training and authority to oversee compliance.',
    assignedRole: 'President / Provost',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload appointment letter',
    sortOrder: 1,
  },
  {
    tempId: 'tix-coordinator-publish',
    parentTempId: 'tix-coordinator-main',
    title: 'Publish Coordinator Contact Information',
    description: 'Make coordinator name, title, office, phone, and email publicly available.',
    instructions: 'Must be published on website, in student/employee handbooks, and in policy documents.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'screenshot',
    evidenceInstructions: 'Screenshot of website with coordinator information',
    sortOrder: 2,
  },
  {
    tempId: 'tix-coordinator-deputies',
    parentTempId: 'tix-coordinator-main',
    title: 'Designate Deputy Coordinators (if applicable)',
    description: 'Consider designating deputy coordinators for different areas.',
    instructions: 'Common areas: Athletics, Student Affairs, Human Resources.',
    assignedRole: 'Title IX Coordinator',
    priority: 'medium',
    evidenceRequired: false,
    evidenceType: 'none',
    sortOrder: 3,
  },

  // ===== SECTION 2: NON-DISCRIMINATION POLICY =====
  {
    tempId: 'tix-policy-main',
    title: 'Non-Discrimination Policy',
    description: 'Adopt and publish policy prohibiting sex discrimination.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload current non-discrimination policy',
    sortOrder: 2,
  },
  {
    tempId: 'tix-policy-draft',
    parentTempId: 'tix-policy-main',
    title: 'Draft/Update Policy',
    description: 'Create or update non-discrimination policy covering sex-based discrimination.',
    instructions: 'Include: prohibition of discrimination, scope, definitions, reporting procedures, coordinator contact.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload draft policy',
    sortOrder: 1,
  },
  {
    tempId: 'tix-policy-legal',
    parentTempId: 'tix-policy-main',
    title: 'Legal Review of Policy',
    description: 'Have policy reviewed by legal counsel.',
    assignedRole: 'General Counsel',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that legal review is complete',
    sortOrder: 2,
  },
  {
    tempId: 'tix-policy-publish',
    parentTempId: 'tix-policy-main',
    title: 'Publish Policy',
    description: 'Make policy publicly available in required locations.',
    instructions: 'Website, student handbook, employee handbook, admission materials, HR materials.',
    assignedRole: 'Communications',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to published policy',
    sortOrder: 3,
  },

  // ===== SECTION 3: GRIEVANCE PROCEDURES =====
  {
    tempId: 'tix-grievance-main',
    title: 'Grievance Procedures',
    description: 'Establish and publish grievance procedures for sex discrimination complaints.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload grievance procedures document',
    sortOrder: 3,
  },
  {
    tempId: 'tix-grievance-draft',
    parentTempId: 'tix-grievance-main',
    title: 'Draft Grievance Procedures',
    description: 'Create comprehensive grievance procedures compliant with Title IX regulations.',
    instructions: 'Include: reporting options, supportive measures, investigation process, hearings, appeals, timeframes.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload draft procedures',
    sortOrder: 1,
  },
  {
    tempId: 'tix-grievance-legal',
    parentTempId: 'tix-grievance-main',
    title: 'Legal Review of Procedures',
    description: 'Have grievance procedures reviewed for legal compliance.',
    assignedRole: 'General Counsel',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that legal review is complete',
    sortOrder: 2,
  },
  {
    tempId: 'tix-grievance-publish',
    parentTempId: 'tix-grievance-main',
    title: 'Publish Grievance Procedures',
    description: 'Make procedures publicly available.',
    assignedRole: 'Communications',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to published procedures',
    sortOrder: 3,
  },
  {
    tempId: 'tix-grievance-forms',
    parentTempId: 'tix-grievance-main',
    title: 'Create Complaint Forms',
    description: 'Develop intake forms for filing complaints.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload complaint form',
    sortOrder: 4,
  },

  // ===== SECTION 4: TRAINING =====
  {
    tempId: 'tix-training-main',
    title: 'Title IX Training Program',
    description: 'Provide required training to Title IX personnel and campus community.',
    assignedRole: 'Title IX Coordinator',
    dueDate: 'Start of Academic Year',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training materials and completion records',
    sortOrder: 4,
  },
  {
    tempId: 'tix-training-coordinator',
    parentTempId: 'tix-training-main',
    title: 'Coordinator Training',
    description: 'Ensure Title IX Coordinator receives comprehensive training.',
    instructions: 'Training must cover: Title IX, relevant regulations, grievance process, investigations, hearings, appeals.',
    assignedRole: 'HR / Compliance',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training certificate',
    sortOrder: 1,
  },
  {
    tempId: 'tix-training-investigators',
    parentTempId: 'tix-training-main',
    title: 'Investigator Training',
    description: 'Train all investigators on Title IX requirements.',
    instructions: 'Must cover: investigation techniques, evidence gathering, interviewing, impartiality, trauma-informed approaches.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload investigator training records',
    sortOrder: 2,
  },
  {
    tempId: 'tix-training-decision-makers',
    parentTempId: 'tix-training-main',
    title: 'Decision-Maker Training',
    description: 'Train hearing officers and decision-makers.',
    instructions: 'Must cover: hearing procedures, relevance determinations, credibility assessments, sanctions.',
    assignedRole: 'Title IX Coordinator',
    priority: 'critical',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload decision-maker training records',
    sortOrder: 3,
  },
  {
    tempId: 'tix-training-employees',
    parentTempId: 'tix-training-main',
    title: 'Employee Awareness Training',
    description: 'Provide Title IX awareness training to all employees.',
    instructions: 'Cover: reporting obligations, recognizing discrimination, resources available.',
    assignedRole: 'HR',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training completion report',
    sortOrder: 4,
  },
  {
    tempId: 'tix-training-students',
    parentTempId: 'tix-training-main',
    title: 'Student Awareness Education',
    description: 'Provide Title IX education to students.',
    instructions: 'Include in orientation and make resources available year-round.',
    assignedRole: 'Student Affairs',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload student education materials/records',
    sortOrder: 5,
  },
  {
    tempId: 'tix-training-publish',
    parentTempId: 'tix-training-main',
    title: 'Publish Training Materials',
    description: 'Make training materials available on website as required.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to published training materials',
    sortOrder: 6,
  },

  // ===== SECTION 5: RECORDKEEPING =====
  {
    tempId: 'tix-records-main',
    title: 'Title IX Recordkeeping',
    description: 'Maintain required records of Title IX matters.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that recordkeeping system is in place',
    sortOrder: 5,
  },
  {
    tempId: 'tix-records-complaints',
    parentTempId: 'tix-records-main',
    title: 'Complaint Records',
    description: 'Maintain records of all complaints, investigations, and resolutions.',
    instructions: 'Records must be maintained for 7 years.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that complaint records are being maintained',
    sortOrder: 1,
  },
  {
    tempId: 'tix-records-supportive',
    parentTempId: 'tix-records-main',
    title: 'Supportive Measures Records',
    description: 'Document supportive measures offered and implemented.',
    assignedRole: 'Title IX Coordinator',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'attestation',
    evidenceInstructions: 'Attest that supportive measures are documented',
    sortOrder: 2,
  },
  {
    tempId: 'tix-records-training',
    parentTempId: 'tix-records-main',
    title: 'Training Records',
    description: 'Maintain records of all Title IX training.',
    assignedRole: 'Title IX Coordinator',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload training records summary',
    sortOrder: 3,
  },

  // ===== SECTION 6: ATHLETICS EQUITY (if applicable) =====
  {
    tempId: 'tix-athletics-main',
    title: 'Athletics Equity Review',
    description: 'Ensure equal opportunity in intercollegiate athletics.',
    assignedRole: 'Athletic Director',
    dueDate: 'Annual Review',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload athletics equity assessment',
    sortOrder: 6,
  },
  {
    tempId: 'tix-athletics-participation',
    parentTempId: 'tix-athletics-main',
    title: 'Participation Opportunities',
    description: 'Assess and document athletic participation opportunities by sex.',
    instructions: 'Review roster sizes, sports offered, recruiting.',
    assignedRole: 'Athletic Director',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload participation data',
    sortOrder: 1,
  },
  {
    tempId: 'tix-athletics-scholarships',
    parentTempId: 'tix-athletics-main',
    title: 'Scholarship Distribution',
    description: 'Ensure athletic scholarships are proportionally distributed.',
    assignedRole: 'Athletic Director',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload scholarship distribution data',
    sortOrder: 2,
  },
  {
    tempId: 'tix-athletics-benefits',
    parentTempId: 'tix-athletics-main',
    title: 'Equal Treatment Assessment',
    description: 'Review equality of equipment, facilities, travel, coaching, etc.',
    instructions: 'Compare treatment across men\'s and women\'s programs.',
    assignedRole: 'Athletic Director',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload equal treatment assessment',
    sortOrder: 3,
  },

  // ===== SECTION 7: PREGNANT/PARENTING STUDENTS =====
  {
    tempId: 'tix-pregnancy-main',
    title: 'Pregnant and Parenting Student Support',
    description: 'Ensure non-discrimination for pregnant and parenting students.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload pregnancy accommodation policy',
    sortOrder: 7,
  },
  {
    tempId: 'tix-pregnancy-policy',
    parentTempId: 'tix-pregnancy-main',
    title: 'Pregnancy Accommodation Policy',
    description: 'Establish policy for accommodating pregnant students.',
    instructions: 'Include: excused absences, medical leave, academic adjustments.',
    assignedRole: 'Title IX Coordinator',
    priority: 'high',
    evidenceRequired: true,
    evidenceType: 'document',
    evidenceInstructions: 'Upload policy document',
    sortOrder: 1,
  },
  {
    tempId: 'tix-pregnancy-communicate',
    parentTempId: 'tix-pregnancy-main',
    title: 'Communicate Support Services',
    description: 'Inform students of pregnancy-related support and accommodations.',
    assignedRole: 'Student Services',
    priority: 'medium',
    evidenceRequired: true,
    evidenceType: 'link',
    evidenceInstructions: 'Link to pregnancy resources webpage',
    sortOrder: 2,
  },
];

/**
 * Get Title IX tasks with calculated due dates for a specific year
 */
export function getTitleIXTasksWithDates(regulationId: number, year: number = new Date().getFullYear()) {
  const startOfAcademicYear = new Date(year, 7, 15); // August 15
  const annualReview = new Date(year, 5, 30); // June 30
  
  return TITLE_IX_TASKS.map((task, index) => {
    let dueDate: Date | null = null;
    
    if (task.dueDate === 'Start of Academic Year') {
      dueDate = startOfAcademicYear;
    } else if (task.dueDate === 'Annual Review') {
      dueDate = annualReview;
    }
    
    return {
      ...task,
      id: index + 1,
      regulationId,
      parentId: task.parentTempId 
        ? TITLE_IX_TASKS.findIndex(t => t.tempId === task.parentTempId) + 1
        : null,
      dueDate: dueDate ? dueDate.toISOString() : null,
    };
  });
}

export function getTitleIXTaskCount() {
  const parentTasks = TITLE_IX_TASKS.filter(t => !t.parentTempId).length;
  const subTasks = TITLE_IX_TASKS.filter(t => t.parentTempId).length;
  return { total: TITLE_IX_TASKS.length, parents: parentTasks, subTasks };
}


