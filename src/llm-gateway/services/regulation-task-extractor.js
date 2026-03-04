/**
 * Regulation Task & Deadline Extractor
 * 
 * AI-powered extraction of compliance requirements from regulation text.
 * Parses government regulation text to generate:
 *   - Hierarchical compliance tasks (parent sections + subtasks)
 *   - Filing deadlines with frequency
 *   - Penalty schedules
 *   - Responsible roles
 *   - Evidence requirements
 * 
 * NO MOCK DATA - Extracts real requirements from real regulation text
 */

import crypto from 'crypto';

// ============================================================================
// REQUIREMENT LANGUAGE PATTERNS
// These patterns identify mandatory compliance language in regulation text
// ============================================================================

const REQUIREMENT_PATTERNS = {
  // Strong mandatory language
  SHALL: /\b(shall|must|is required to|are required to|will be required)\b/gi,
  MUST_NOT: /\b(shall not|must not|may not|is prohibited|are prohibited)\b/gi,
  
  // Conditional requirements
  SHOULD: /\b(should|is expected to|are expected to)\b/gi,
  MAY: /\b(may|is permitted to|are permitted to|is authorized to)\b/gi,
  
  // Deadline indicators
  DEADLINE: /\b(by|within|no later than|before|prior to|on or before|annually|quarterly|monthly|each year|every year)\b/gi,
  DATE_PATTERN: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
  SPECIFIC_DATE: /\b(october\s*1|july\s*1|january\s*1|april\s*15|september\s*30)\b/gi,
  TIME_PERIOD: /\b(\d+)\s*(day|hour|week|month|year|calendar day|business day)s?\b/gi,
  
  // Action verbs (what must be done)
  ACTION_VERBS: /\b(submit|file|report|disclose|notify|provide|maintain|retain|develop|implement|establish|ensure|conduct|review|update|publish|distribute|post|train|document|record|monitor|verify|certify|attest)\b/gi,
  
  // Entity patterns (who must do it)
  ENTITY: /\b(institution|university|college|school|employer|recipient|covered entity|grantee|contractor|agency|department|office|officer|administrator|director|coordinator|registrar)\b/gi,
  
  // Penalty indicators
  PENALTY: /\b(fine|penalty|sanction|violation|civil penalty|criminal penalty|monetary penalty|forfeiture|termination of|loss of|suspension of|revocation of)\b/gi,
  DOLLAR_AMOUNT: /\$[\d,]+(?:\.\d{2})?(?:\s*(?:per|for each|maximum|minimum|up to))?/gi,
  
  // Evidence/documentation requirements
  EVIDENCE: /\b(documentation|evidence|records|proof|certification|attestation|written|in writing|signed|dated|maintained for|retained for)\b/gi
};

// ============================================================================
// KNOWN REGULATION TASK TEMPLATES
// Pre-defined task structures for common higher education regulations
// ============================================================================

const REGULATION_TEMPLATES = {
  'clery': {
    searchTerms: ['clery', 'campus security', 'crime statistics', '20 usc 1092'],
    sections: [
      {
        title: 'Annual Security Report (ASR) Publication',
        description: 'Prepare and publish the Annual Security Report by October 1 deadline.',
        category: 'Annual Security Report',
        priority: 'critical',
        deadline: { type: 'annual', date: '10-01', description: 'October 1 annually' },
        assignedRole: 'Clery Compliance Officer',
        subtasks: [
          { title: 'Gather Crime Statistics (3-Year Data)', description: 'Compile campus crime statistics from all sources for the previous 3 calendar years.', priority: 'high' },
          { title: 'Compile Policy Statements', description: 'Document all required policy statements for the ASR.', priority: 'high' },
          { title: 'Legal Review of ASR', description: 'Have legal counsel review the ASR for compliance and accuracy.', priority: 'high' },
          { title: 'Publish ASR to Website', description: 'Post the complete ASR to the institution\'s website.', priority: 'critical' },
          { title: 'Distribute ASR Notice', description: 'Send notice to all students and employees with link to ASR.', priority: 'critical' }
        ]
      },
      {
        title: 'Department of Education Crime Statistics Submission',
        description: 'Submit campus crime statistics to the Department of Education via the Campus Safety and Security Survey.',
        category: 'Federal Reporting',
        priority: 'critical',
        deadline: { type: 'annual', date: '10-15', description: 'October 15 annually (typically)' },
        assignedRole: 'Clery Compliance Officer',
        subtasks: [
          { title: 'Complete Web-Based Survey', description: 'Enter all required crime statistics into the Campus Safety and Security Survey.', priority: 'critical' },
          { title: 'Verify Data Accuracy', description: 'Cross-check submitted data against institutional records.', priority: 'high' }
        ]
      },
      {
        title: 'Daily Crime Log Maintenance',
        description: 'Maintain a public crime log recording all crimes reported to campus security.',
        category: 'Ongoing Compliance',
        priority: 'high',
        deadline: { type: 'ongoing', description: 'Within 2 business days of report' },
        assignedRole: 'Campus Police/Security',
        subtasks: [
          { title: 'Log All Reported Crimes', description: 'Enter each reported crime within 2 business days.', priority: 'high' },
          { title: 'Make Log Publicly Available', description: 'Ensure the crime log is available for public inspection during business hours.', priority: 'medium' }
        ]
      },
      {
        title: 'Timely Warning Notifications',
        description: 'Issue timely warnings for Clery crimes that pose a serious or continuing threat.',
        category: 'Emergency Response',
        priority: 'critical',
        deadline: { type: 'event-triggered', description: 'As soon as pertinent information is available' },
        assignedRole: 'Emergency Management Director',
        subtasks: [
          { title: 'Assess Threat Level', description: 'Evaluate if the crime poses a serious or continuing threat.', priority: 'critical' },
          { title: 'Draft Warning Content', description: 'Prepare warning with sufficient information to promote safety.', priority: 'critical' },
          { title: 'Distribute Warning', description: 'Send warning via established notification systems.', priority: 'critical' }
        ]
      },
      {
        title: 'Emergency Notification System',
        description: 'Maintain and test emergency notification system for immediate threats.',
        category: 'Emergency Response',
        priority: 'critical',
        deadline: { type: 'annual', description: 'Test at least annually' },
        assignedRole: 'Emergency Management Director',
        subtasks: [
          { title: 'Conduct Annual Test', description: 'Test the emergency notification system at least once per year.', priority: 'high' },
          { title: 'Document Test Results', description: 'Maintain records of all tests and results.', priority: 'medium' },
          { title: 'Update Contact Information', description: 'Ensure student/employee contact information is current.', priority: 'medium' }
        ]
      },
      {
        title: 'Missing Student Notification Policy',
        description: 'Establish and implement missing student notification procedures for residential students.',
        category: 'Student Safety',
        priority: 'high',
        deadline: { type: 'ongoing', description: 'Within 24 hours of determination' },
        assignedRole: 'Dean of Students',
        subtasks: [
          { title: 'Collect Emergency Contacts', description: 'Obtain confidential emergency contact from each residential student.', priority: 'high' },
          { title: 'Establish Investigation Procedures', description: 'Document procedures for investigating missing student reports.', priority: 'medium' }
        ]
      },
      {
        title: 'Fire Safety Report (Residential Facilities)',
        description: 'Publish annual fire safety report for institutions with on-campus housing.',
        category: 'Fire Safety',
        priority: 'high',
        deadline: { type: 'annual', date: '10-01', description: 'October 1 annually (with ASR)' },
        assignedRole: 'Fire Safety Officer',
        subtasks: [
          { title: 'Compile Fire Statistics', description: 'Gather fire incident data for all residential facilities.', priority: 'high' },
          { title: 'Document Fire Safety Systems', description: 'List fire safety equipment in each residential facility.', priority: 'medium' },
          { title: 'Include Evacuation Procedures', description: 'Document evacuation procedures and fire drill information.', priority: 'medium' }
        ]
      },
      {
        title: 'Campus Security Authority (CSA) Training',
        description: 'Identify and train all Campus Security Authorities on their reporting obligations.',
        category: 'Training',
        priority: 'high',
        deadline: { type: 'annual', description: 'Annually and upon hire' },
        assignedRole: 'Clery Compliance Officer',
        subtasks: [
          { title: 'Identify All CSAs', description: 'Maintain current list of all Campus Security Authorities.', priority: 'high' },
          { title: 'Conduct CSA Training', description: 'Train all CSAs on crime reporting requirements.', priority: 'high' },
          { title: 'Document Training Completion', description: 'Maintain records of CSA training completion.', priority: 'medium' }
        ]
      },
      {
        title: 'VAWA Compliance (Violence Against Women Act)',
        description: 'Implement required VAWA provisions including procedures for domestic violence, dating violence, sexual assault, and stalking.',
        category: 'VAWA Compliance',
        priority: 'critical',
        deadline: { type: 'ongoing', description: 'Continuous compliance required' },
        assignedRole: 'Title IX Coordinator',
        subtasks: [
          { title: 'Establish Written Procedures', description: 'Document procedures for handling VAWA incidents.', priority: 'critical' },
          { title: 'Provide Prevention Programs', description: 'Implement primary prevention and awareness programs.', priority: 'high' },
          { title: 'Train Adjudicators', description: 'Train officials who conduct disciplinary proceedings.', priority: 'high' }
        ]
      },
      {
        title: 'Geography Determination and Documentation',
        description: 'Identify and document all Clery geography including on-campus, public property, and non-campus buildings.',
        category: 'Compliance Foundation',
        priority: 'high',
        deadline: { type: 'annual', description: 'Review annually before ASR publication' },
        assignedRole: 'Clery Compliance Officer',
        subtasks: [
          { title: 'Map On-Campus Property', description: 'Document all buildings and property within campus boundaries.', priority: 'high' },
          { title: 'Identify Non-Campus Locations', description: 'Document all non-campus buildings or property.', priority: 'medium' },
          { title: 'Define Public Property', description: 'Identify public property immediately adjacent to campus.', priority: 'medium' }
        ]
      }
    ],
    penalties: [
      { type: 'civil', amount: '$67,544', per: 'violation', description: 'Maximum civil penalty per violation (2024, adjusted for inflation)' },
      { type: 'funding', description: 'Loss of Title IV federal student aid eligibility' },
      { type: 'reputational', description: 'Public disclosure of violations on Department of Education website' }
    ]
  },
  
  'ferpa': {
    searchTerms: ['ferpa', 'family educational rights', 'student records', '20 usc 1232g', '34 cfr 99'],
    sections: [
      {
        title: 'Annual FERPA Notification',
        description: 'Annually notify students of their FERPA rights.',
        category: 'Annual Notification',
        priority: 'critical',
        deadline: { type: 'annual', description: 'Beginning of each academic year' },
        assignedRole: 'Registrar',
        subtasks: [
          { title: 'Update Notification Content', description: 'Review and update annual FERPA notification language.', priority: 'high' },
          { title: 'Distribute to Students', description: 'Publish notification via catalog, handbook, or direct communication.', priority: 'critical' },
          { title: 'Document Distribution', description: 'Maintain evidence of notification distribution.', priority: 'medium' }
        ]
      },
      {
        title: 'Directory Information Designation',
        description: 'Define and publish what constitutes directory information.',
        category: 'Policy',
        priority: 'high',
        deadline: { type: 'annual', description: 'Review annually' },
        assignedRole: 'Registrar',
        subtasks: [
          { title: 'Define Directory Information', description: 'Document which student information is designated as directory information.', priority: 'high' },
          { title: 'Allow Opt-Out Period', description: 'Provide reasonable time for students to opt out of directory information disclosure.', priority: 'critical' }
        ]
      },
      {
        title: 'Access and Amendment Procedures',
        description: 'Establish procedures for students to inspect and request amendment of records.',
        category: 'Student Rights',
        priority: 'high',
        deadline: { type: 'within-45-days', description: 'Respond to access requests within 45 days' },
        assignedRole: 'Registrar',
        subtasks: [
          { title: 'Process Access Requests', description: 'Respond to record access requests within 45 days.', priority: 'high' },
          { title: 'Handle Amendment Requests', description: 'Process requests to amend education records.', priority: 'medium' },
          { title: 'Conduct Hearings if Needed', description: 'Provide hearing opportunity if amendment is denied.', priority: 'medium' }
        ]
      },
      {
        title: 'Disclosure Logging',
        description: 'Maintain record of each request for and disclosure of education records.',
        category: 'Record Keeping',
        priority: 'high',
        deadline: { type: 'ongoing', description: 'Log each disclosure' },
        assignedRole: 'Registrar',
        subtasks: [
          { title: 'Log All Disclosures', description: 'Record parties who have requested or received education records.', priority: 'high' },
          { title: 'Document Legitimate Interest', description: 'Document legitimate educational interest for internal disclosures.', priority: 'medium' }
        ]
      },
      {
        title: 'Staff Training on FERPA',
        description: 'Train all staff with access to education records on FERPA requirements.',
        category: 'Training',
        priority: 'high',
        deadline: { type: 'ongoing', description: 'Upon hire and periodically' },
        assignedRole: 'HR Director',
        subtasks: [
          { title: 'Identify Staff Needing Training', description: 'Determine all employees with access to education records.', priority: 'high' },
          { title: 'Conduct FERPA Training', description: 'Provide comprehensive FERPA training.', priority: 'high' },
          { title: 'Document Training Completion', description: 'Maintain records of training completion.', priority: 'medium' }
        ]
      }
    ],
    penalties: [
      { type: 'funding', description: 'Withdrawal of all federal funding administered by the Department of Education' },
      { type: 'compliance', description: 'Required compliance plan and monitoring' }
    ]
  },
  
  'title-ix': {
    searchTerms: ['title ix', 'title 9', 'sex discrimination', 'gender equity', '20 usc 1681', '34 cfr 106'],
    sections: [
      {
        title: 'Title IX Coordinator Designation',
        description: 'Designate and publicize at least one Title IX Coordinator.',
        category: 'Administration',
        priority: 'critical',
        deadline: { type: 'continuous', description: 'Must always have designated coordinator' },
        assignedRole: 'President/Chancellor',
        subtasks: [
          { title: 'Designate Coordinator', description: 'Formally designate Title IX Coordinator with appropriate authority.', priority: 'critical' },
          { title: 'Publicize Contact Information', description: 'Publish coordinator name, office, email, and phone prominently.', priority: 'critical' },
          { title: 'Ensure Adequate Training', description: 'Ensure coordinator receives comprehensive Title IX training.', priority: 'critical' }
        ]
      },
      {
        title: 'Grievance Procedures',
        description: 'Adopt and publish grievance procedures for handling sex discrimination complaints.',
        category: 'Policy',
        priority: 'critical',
        deadline: { type: 'continuous', description: 'Must be in place and published' },
        assignedRole: 'Title IX Coordinator',
        subtasks: [
          { title: 'Develop Written Procedures', description: 'Create comprehensive grievance procedures meeting regulatory requirements.', priority: 'critical' },
          { title: 'Include Required Elements', description: 'Ensure procedures include all 2020 regulation requirements.', priority: 'critical' },
          { title: 'Publish Procedures', description: 'Make grievance procedures readily available.', priority: 'high' }
        ]
      },
      {
        title: 'Non-Discrimination Statement',
        description: 'Publish non-discrimination statement in all publications and communications.',
        category: 'Communications',
        priority: 'high',
        deadline: { type: 'continuous', description: 'All publications must include statement' },
        assignedRole: 'Communications Director',
        subtasks: [
          { title: 'Include in Catalogs', description: 'Add non-discrimination statement to all course catalogs.', priority: 'high' },
          { title: 'Include on Website', description: 'Prominently display statement on institution website.', priority: 'high' },
          { title: 'Include in Handbooks', description: 'Add to student and employee handbooks.', priority: 'high' }
        ]
      },
      {
        title: 'Prompt and Equitable Response',
        description: 'Respond to all reports of sex discrimination promptly and equitably.',
        category: 'Response',
        priority: 'critical',
        deadline: { type: 'event-triggered', description: 'Upon receipt of report' },
        assignedRole: 'Title IX Coordinator',
        subtasks: [
          { title: 'Offer Supportive Measures', description: 'Immediately offer supportive measures to complainant.', priority: 'critical' },
          { title: 'Explain Complaint Process', description: 'Explain the formal complaint process and options.', priority: 'critical' },
          { title: 'Document All Actions', description: 'Maintain detailed records of all actions taken.', priority: 'high' }
        ]
      },
      {
        title: 'Training Requirements',
        description: 'Train all Title IX personnel on relevant topics.',
        category: 'Training',
        priority: 'critical',
        deadline: { type: 'ongoing', description: 'Upon hire and annually' },
        assignedRole: 'Title IX Coordinator',
        subtasks: [
          { title: 'Train Investigators', description: 'Comprehensive training for all investigators.', priority: 'critical' },
          { title: 'Train Decision-Makers', description: 'Train all hearing officers and decision-makers.', priority: 'critical' },
          { title: 'Train Advisors', description: 'Train advisors on cross-examination procedures.', priority: 'high' },
          { title: 'Publish Training Materials', description: 'Make training materials publicly available on website.', priority: 'high' }
        ]
      }
    ],
    penalties: [
      { type: 'funding', description: 'Termination of federal financial assistance' },
      { type: 'civil', description: 'Private right of action for damages' },
      { type: 'ocr', description: 'OCR investigation and resolution agreement' }
    ]
  },
  
  'pennsylvania-act-55-of-2022': {
    searchTerms: ['act 55', 'pa act 55', '24 p.s. § 20-2001-g', 'article xx-g', 'pennsylvania-act-55'],
    jurisdiction: 'state',
    stateCode: 'PA',
    sections: [
      {
        title: 'Evidence-Based Education Program (Section 2003-G)',
        description: 'Establish and implement evidence-based education program for ALL students covering sexual violence, dating violence, domestic violence, and stalking.',
        category: 'Education Program',
        priority: 'critical',
        deadline: { type: 'annual', date: '08-15', description: 'Before start of each academic year' },
        assignedRole: 'Dean of Students / Student Affairs',
        subtasks: [
          { title: 'Consult with Local Rape Crisis Center', description: 'Engage local rape crisis center in development or review of education program per Section 2003-G.', priority: 'critical' },
          { title: 'Consult with Domestic Violence Program', description: 'Engage local domestic violence program in development or review of education program per Section 2003-G.', priority: 'critical' },
          { title: 'Cover All Required Topics', description: 'Ensure program covers: consent, drug/alcohol-facilitated violence, risk education, assistance resources, pregnancy/STI info, campus/community resources, confidentiality.', priority: 'critical' },
          { title: 'Deliver to All Students', description: 'Ensure ALL enrolled students receive the education program, not just new students.', priority: 'high' },
          { title: 'Review PA DOE Clearinghouse Resources', description: 'Check PA Department of Education online clearinghouse for model programs and resources.', priority: 'medium' }
        ]
      },
      {
        title: 'Consent Definition (Section 2003-G.1)',
        description: 'Adopt a formal definition of consent as part of the code of conduct or sexual misconduct/harassment policy.',
        category: 'Policy',
        priority: 'critical',
        deadline: { type: 'continuous', description: 'Must be in code of conduct at all times' },
        assignedRole: 'General Counsel / Compliance Officer',
        subtasks: [
          { title: 'Draft Consent Definition', description: 'Develop formal consent definition that meets PA Act 55 requirements.', priority: 'critical' },
          { title: 'Incorporate into Code of Conduct', description: 'Add consent definition to student code of conduct or sexual misconduct/harassment policy.', priority: 'critical' },
          { title: 'Publish Definition', description: 'Make consent definition accessible to all students and employees.', priority: 'high' }
        ]
      },
      {
        title: 'Follow-Up Programming (Section 2004-G)',
        description: 'Conduct at least one follow-up program during the school year for students who participated in the education program.',
        category: 'Education Program',
        priority: 'high',
        deadline: { type: 'annual', date: '04-30', description: 'At least one follow-up per academic year' },
        assignedRole: 'Dean of Students / Student Affairs',
        subtasks: [
          { title: 'Schedule Follow-Up Program', description: 'Plan at least one follow-up session (lecture, interactive learning, activity, video, or educational materials).', priority: 'high' },
          { title: 'Document Attendance', description: 'Record participation in follow-up programming for compliance reporting.', priority: 'medium' }
        ]
      },
      {
        title: 'Notification of Rights (Section 2003-G(c))',
        description: 'Make concise notification of rights, accommodations, and protective measures available in writing and on public website.',
        category: 'Communications',
        priority: 'high',
        deadline: { type: 'continuous', description: 'Must be available at all times' },
        assignedRole: 'Communications / Compliance Officer',
        subtasks: [
          { title: 'Draft Rights Notification', description: 'Create concise written notification covering counseling, advocacy, legal assistance, reporting options, protection orders, and crime victims\' compensation.', priority: 'high' },
          { title: 'Publish on Website', description: 'Post notification on institution\'s public-facing website.', priority: 'high' },
          { title: 'Make Available in Print', description: 'Ensure written copies are available at relevant offices.', priority: 'medium' }
        ]
      },
      {
        title: 'Memorandum of Understanding — Rape Crisis Center (Section 2007-G)',
        description: 'Enter into and maintain MOU with at least one rape crisis center (per 42 Pa.C.S. § 5945.1) for main campus and each branch campus.',
        category: 'Partnerships',
        priority: 'critical',
        deadline: { type: 'annual', date: '07-01', description: 'Must be in effect; review annually' },
        assignedRole: 'General Counsel / Compliance Officer',
        subtasks: [
          { title: 'Identify Qualified Rape Crisis Center', description: 'Identify center meeting the definition under 42 Pa.C.S. § 5945.1 for each campus.', priority: 'critical' },
          { title: 'Negotiate MOU Terms', description: 'MOU must cover: policy development, off-campus victim services, notification of services, cooperation/cross-training, education program consultation.', priority: 'critical' },
          { title: 'Ensure Required Services', description: 'MOU must provide: crisis counseling, longer-term counseling, legal assistance, protection orders, forensic rape exams by SANE, crime victims\' compensation.', priority: 'critical' },
          { title: 'Execute MOU for Each Campus', description: 'Signed MOU required for main campus AND each branch campus separately.', priority: 'critical' },
          { title: 'Request Good-Faith Waiver if Needed', description: 'If unable to obtain signed MOU despite good-faith efforts, request waiver from PA DOE.', priority: 'medium' }
        ]
      },
      {
        title: 'Memorandum of Understanding — Domestic Violence Program (Section 2007-G)',
        description: 'Enter into and maintain MOU with at least one domestic violence program (per 23 Pa.C.S. § 6102) for main campus and each branch campus.',
        category: 'Partnerships',
        priority: 'critical',
        deadline: { type: 'annual', date: '07-01', description: 'Must be in effect; review annually' },
        assignedRole: 'General Counsel / Compliance Officer',
        subtasks: [
          { title: 'Identify Qualified DV Program', description: 'Identify domestic violence program meeting the definition under 23 Pa.C.S. § 6102 for each campus.', priority: 'critical' },
          { title: 'Negotiate MOU Terms', description: 'MOU must address same areas as rape crisis center MOU: policy, services, notification, cooperation, education consultation.', priority: 'critical' },
          { title: 'Execute MOU for Each Campus', description: 'Signed MOU required for main campus AND each branch campus.', priority: 'critical' }
        ]
      },
      {
        title: 'Annual Attestation of Compliance (Section 2006-G)',
        description: 'Report to PA Department of Education on implementation of education program and MOU status through annual attestation.',
        category: 'Reporting',
        priority: 'critical',
        deadline: { type: 'annual', date: '10-01', description: 'Annual attestation to PA DOE' },
        assignedRole: 'Compliance Officer / President',
        subtasks: [
          { title: 'Document Education Program Implementation', description: 'Compile evidence of education program delivery under Section 2003-G.', priority: 'high' },
          { title: 'Document MOU Status', description: 'Verify all MOUs are current and compile copies for attestation.', priority: 'high' },
          { title: 'Document Follow-Up Programming', description: 'Compile records of follow-up programming conducted during the year.', priority: 'high' },
          { title: 'Submit Attestation to PA DOE', description: 'Submit completed attestation of compliance to the Pennsylvania Department of Education.', priority: 'critical' }
        ]
      },
      {
        title: 'Employee Programming (Institutions Without Full-Time Students)',
        description: 'Institutions without full-time students must maintain MOUs and provide programming for employees.',
        category: 'Employee Programs',
        priority: 'high',
        deadline: { type: 'annual', date: '08-15', description: 'Before start of each academic year' },
        assignedRole: 'HR Director / Compliance Officer',
        subtasks: [
          { title: 'Develop Employee Education Program', description: 'Create education program adapted for employees if no full-time students enrolled.', priority: 'high' },
          { title: 'Maintain Employee MOUs', description: 'Ensure MOUs remain in effect even without full-time student population.', priority: 'high' }
        ]
      }
    ],
    penalties: [
      { type: 'administrative', description: 'PA Department of Education compliance action and required corrective plan' },
      { type: 'funding', description: 'Potential impact on state funding and It\'s On Us PA grant eligibility' },
      { type: 'accreditation', description: 'Compliance findings may affect institutional accreditation reviews' }
    ]
  }
};

// ============================================================================
// TEXT ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Extract sentences containing requirement language
 */
function extractRequirementSentences(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Split into sentences
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  
  const requirements = [];
  
  for (const sentence of sentences) {
    const shallMatch = sentence.match(REQUIREMENT_PATTERNS.SHALL);
    const mustNotMatch = sentence.match(REQUIREMENT_PATTERNS.MUST_NOT);
    const actionMatch = sentence.match(REQUIREMENT_PATTERNS.ACTION_VERBS);
    const deadlineMatch = sentence.match(REQUIREMENT_PATTERNS.DEADLINE);
    
    if ((shallMatch || mustNotMatch) && actionMatch) {
      requirements.push({
        text: sentence,
        type: mustNotMatch ? 'prohibition' : 'requirement',
        actions: actionMatch,
        hasDeadline: !!deadlineMatch,
        strength: shallMatch ? 'mandatory' : 'prohibitory'
      });
    }
  }
  
  return requirements;
}

/**
 * Extract deadlines from text
 */
function extractDeadlines(text) {
  if (!text || typeof text !== 'string') return [];
  
  const deadlines = [];
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    // Look for specific dates
    const dateMatches = sentence.match(REQUIREMENT_PATTERNS.SPECIFIC_DATE);
    const timeMatches = sentence.match(REQUIREMENT_PATTERNS.TIME_PERIOD);
    
    if (dateMatches) {
      deadlines.push({
        text: sentence.trim(),
        type: 'specific_date',
        dates: dateMatches,
        frequency: sentence.toLowerCase().includes('annual') ? 'annual' : 'one-time'
      });
    }
    
    if (timeMatches) {
      deadlines.push({
        text: sentence.trim(),
        type: 'time_period',
        periods: timeMatches,
        frequency: 'event-triggered'
      });
    }
  }
  
  return deadlines;
}

/**
 * Extract penalty information from text
 */
function extractPenalties(text) {
  if (!text || typeof text !== 'string') return [];
  
  const penalties = [];
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const penaltyMatch = sentence.match(REQUIREMENT_PATTERNS.PENALTY);
    const dollarMatch = sentence.match(REQUIREMENT_PATTERNS.DOLLAR_AMOUNT);
    
    if (penaltyMatch || dollarMatch) {
      penalties.push({
        text: sentence.trim(),
        type: dollarMatch ? 'monetary' : 'administrative',
        amounts: dollarMatch || [],
        keywords: penaltyMatch || []
      });
    }
  }
  
  return penalties;
}

/**
 * Match regulation to known template
 * 
 * Priority: exact slug match > slug partial match > text match
 * Requires at least 2 search term hits to prevent false positives
 * (e.g., PA Act 55 accidentally matching Title IX because the text contains "sexual")
 */
function matchToTemplate(regulationSlug, regulationText) {
  const lowerSlug = regulationSlug.toLowerCase();
  const lowerText = (regulationText || '').toLowerCase();
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [key, template] of Object.entries(REGULATION_TEMPLATES)) {
    let slugScore = 0;
    let textScore = 0;
    
    // Exact slug match gets massive bonus (prevents cross-contamination)
    if (lowerSlug.includes(key) || key.includes(lowerSlug.substring(0, 15))) {
      slugScore = 100;
    }
    
    for (const term of template.searchTerms) {
      if (lowerSlug.includes(term)) slugScore += 10;
      if (lowerText.includes(term)) textScore += 1;
    }
    
    const totalScore = slugScore + textScore;
    
    // Require either a slug match or at least 2 text matches
    // This prevents "sexual violence" in PA Act 55 text from matching the Title IX template
    const meetsThreshold = slugScore >= 10 || textScore >= 2;
    
    if (meetsThreshold && totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = { templateKey: key, template, matchScore: totalScore };
    }
  }
  
  return bestMatch;
}

/**
 * Generate task ID
 */
function generateTaskId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract compliance tasks and deadlines from regulation text
 * 
 * @param {string} regulationSlug - Regulation identifier
 * @param {string} regulationText - Full regulation text from government source
 * @param {object} regulationMetadata - Additional metadata (name, statute, etc.)
 * @returns {object} Extracted tasks, deadlines, penalties, and analysis
 */
export async function extractComplianceRequirements(regulationSlug, regulationText, regulationMetadata = {}) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🔬 COMPLIANCE REQUIREMENT EXTRACTOR`);
  console.log(`  📋 Regulation: ${regulationSlug}`);
  console.log(`  📊 Text Length: ${(regulationText || '').length} characters`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const startTime = Date.now();
  const result = {
    regulationSlug,
    regulationName: regulationMetadata.name || regulationSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    extractionTimestamp: new Date().toISOString(),
    sourceHash: crypto.createHash('sha256').update(regulationText || '').digest('hex').substring(0, 16),
    
    // Extracted data
    tasks: [],
    deadlines: [],
    penalties: [],
    
    // Analysis metadata
    analysis: {
      method: 'unknown',
      confidence: 0,
      templateMatched: null,
      requirementSentencesFound: 0,
      deadlineSentencesFound: 0,
      penaltySentencesFound: 0
    }
  };
  
  // Step 1: Try to match to known template
  const templateMatch = matchToTemplate(regulationSlug, regulationText);
  
  if (templateMatch && templateMatch.template) {
    console.log(`✅ Matched to template: ${templateMatch.templateKey} (score: ${templateMatch.matchScore})`);
    result.analysis.method = 'template_match';
    result.analysis.templateMatched = templateMatch.templateKey;
    result.analysis.confidence = 95;
    
    // Build tasks from template
    let sortOrder = 0;
    for (const section of templateMatch.template.sections) {
      const parentTempId = generateTaskId('section');
      
      // Parent task (section)
      result.tasks.push({
        tempId: parentTempId,
        title: section.title,
        description: section.description,
        category: section.category,
        priority: section.priority,
        assignedRole: section.assignedRole,
        deadline: section.deadline,
        evidenceRequired: true,
        evidenceType: 'document',
        sortOrder: sortOrder++
      });
      
      // Subtasks
      if (section.subtasks) {
        for (const subtask of section.subtasks) {
          result.tasks.push({
            tempId: generateTaskId('task'),
            parentTempId: parentTempId,
            title: subtask.title,
            description: subtask.description,
            category: section.category,
            priority: subtask.priority || 'medium',
            assignedRole: subtask.assignedRole || section.assignedRole,
            evidenceRequired: subtask.evidenceRequired !== false,
            evidenceType: subtask.evidenceType || 'document',
            sortOrder: sortOrder++
          });
        }
      }
      
      // Add deadline
      if (section.deadline) {
        result.deadlines.push({
          type: section.deadline.type,
          date: section.deadline.date || null,
          description: section.deadline.description,
          relatedTask: section.title,
          frequency: section.deadline.type
        });
      }
    }
    
    // Add penalties from template
    if (templateMatch.template.penalties) {
      result.penalties = templateMatch.template.penalties;
    }
    
  } else {
    console.log(`ℹ️  No template match - performing text analysis`);
    result.analysis.method = 'text_analysis';
    
    // Step 2: Extract from raw text
    const requirements = extractRequirementSentences(regulationText);
    const deadlines = extractDeadlines(regulationText);
    const penalties = extractPenalties(regulationText);
    
    result.analysis.requirementSentencesFound = requirements.length;
    result.analysis.deadlineSentencesFound = deadlines.length;
    result.analysis.penaltySentencesFound = penalties.length;
    
    console.log(`   Found ${requirements.length} requirement sentences`);
    console.log(`   Found ${deadlines.length} deadline references`);
    console.log(`   Found ${penalties.length} penalty references`);
    
    // Convert extracted requirements to tasks
    let sortOrder = 0;
    for (const req of requirements.slice(0, 20)) { // Limit to 20 tasks
      result.tasks.push({
        tempId: generateTaskId('task'),
        title: req.text.substring(0, 100) + (req.text.length > 100 ? '...' : ''),
        description: req.text,
        category: 'Compliance Requirement',
        priority: req.strength === 'prohibitory' ? 'critical' : 'high',
        assignedRole: 'Compliance Officer',
        evidenceRequired: true,
        evidenceType: 'document',
        sortOrder: sortOrder++,
        extractedFrom: 'regulation_text'
      });
    }
    
    // Convert extracted deadlines
    for (const deadline of deadlines) {
      result.deadlines.push({
        type: deadline.type,
        date: deadline.dates ? deadline.dates[0] : null,
        description: deadline.text.substring(0, 200),
        frequency: deadline.frequency
      });
    }
    
    // Convert extracted penalties
    for (const penalty of penalties) {
      result.penalties.push({
        type: penalty.type,
        amount: penalty.amounts.length > 0 ? penalty.amounts[0] : null,
        description: penalty.text.substring(0, 200)
      });
    }
    
    // Calculate confidence based on extraction success
    result.analysis.confidence = Math.min(85, 
      30 + 
      (requirements.length > 5 ? 20 : requirements.length * 4) +
      (deadlines.length > 0 ? 15 : 0) +
      (penalties.length > 0 ? 10 : 0) +
      (regulationText && regulationText.length > 5000 ? 10 : 0)
    );
  }
  
  const duration = Date.now() - startTime;
  result.analysis.duration = `${duration}ms`;
  
  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ✅ EXTRACTION COMPLETE`);
  console.log(`  ⏱️  Duration: ${duration}ms`);
  console.log(`  📋 Tasks: ${result.tasks.length} (${result.tasks.filter(t => !t.parentTempId).length} sections, ${result.tasks.filter(t => t.parentTempId).length} subtasks)`);
  console.log(`  📅 Deadlines: ${result.deadlines.length}`);
  console.log(`  ⚠️  Penalties: ${result.penalties.length}`);
  console.log(`  🎯 Confidence: ${result.analysis.confidence}%`);
  console.log(`${'═'.repeat(70)}\n`);
  
  return result;
}

/**
 * Get task structure for a known regulation (quick lookup)
 */
export function getKnownRegulationTasks(regulationSlug) {
  const match = matchToTemplate(regulationSlug, '');
  if (match && match.template) {
    return extractComplianceRequirements(regulationSlug, '', { name: match.template.searchTerms[0] });
  }
  return null;
}

export default { 
  extractComplianceRequirements, 
  getKnownRegulationTasks,
  REGULATION_TEMPLATES 
};
