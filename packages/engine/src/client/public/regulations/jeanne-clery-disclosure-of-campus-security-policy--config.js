/**
 * BESPOKE CONFIG: Clery Act (34 CFR § 668.46)
 * 
 * Source: eCFR versioner API — 34 CFR Part 668, Section 668.46
 * Full text: 42,408 chars of authoritative regulatory language
 * Last verified: 2025-01-01
 * 
 * AUDIT STANDARD: Every task cites a specific subsection of § 668.46.
 * Verify at: https://www.ecfr.gov/current/title-34/part-668/section-668.46
 */

// ============================================
// BESPOKE GLOBALS
// ============================================
window.REGULATION_SLUG = 'jeanne-clery-disclosure-of-campus-security-policy-';
window.REG_KEY = 'REG-001';
window.JURISDICTION_SOURCE = 'federal';
window.STATE_CODE = '';
window.ENFORCING_AGENCY = '';
window.REGULATION_NAME = 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act';

// ============================================
// FULL BESPOKE CONFIG
// ============================================
window.REGULATION_CONFIG = {
  id: 'jeanne-clery-disclosure-of-campus-security-policy-',
  name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (Clery Act)',
  shortName: 'Clery Act',
  statute: '20 U.S.C. § 1092(f)',
  cfr: '34 CFR § 668.46',
  publicLaw: 'Public Law 101-542',
  jurisdiction: 'federal',

  sources: {
    primary: {
      type: 'ecfr',
      url: 'https://www.ecfr.gov/api/versioner/v1/full/2025-01-01/title-34.xml?part=668&section=668.46',
      citation: '34 CFR § 668.46',
      humanUrl: 'https://www.ecfr.gov/current/title-34/part-668/section-668.46'
    }
  },

  tasks: [
    // ================================================================
    // SECTION (b): ANNUAL SECURITY REPORT
    // ================================================================
    {
      title: 'Prepare and Publish Annual Security Report (ASR)',
      description: 'Prepare an annual security report reflecting current policies containing all elements required by § 668.46(b)(1)-(14).',
      statutoryCitation: '§ 668.46(b)',
      statutoryLanguage: 'An institution must prepare an annual security report reflecting its current policies that contains, at a minimum, the following information...',
      category: 'Annual Security Report',
      priority: 'critical',
      assignedRole: 'Clery Compliance Officer',
      deadline: { type: 'annual', date: '10-01', description: 'Published by October 1 annually per 20 U.S.C. § 1092(f)(1)' },
      evidenceRequired: 'Complete ASR document, distribution records, website publication proof',
      subtasks: [
        {
          title: 'Include 3-year crime statistics',
          description: 'Include statistics for the three most recent calendar years for crimes listed in § 668.46(c)(1).',
          statutoryCitation: '§ 668.46(b)(1), (c)(1)',
          priority: 'critical'
        },
        {
          title: 'Include crime reporting procedures policy',
          description: 'Statement of policies regarding procedures for students and others to report criminal actions or other emergencies, including timely warning policies, annual disclosure procedures, and confidential reporting options.',
          statutoryCitation: '§ 668.46(b)(2)(i)-(iv)',
          priority: 'critical'
        },
        {
          title: 'Include campus facility security and access policies',
          description: 'Statement of policies concerning security of and access to campus facilities, including campus residences, and security considerations used in maintenance.',
          statutoryCitation: '§ 668.46(b)(3)',
          priority: 'high'
        },
        {
          title: 'Include campus law enforcement policies',
          description: 'Statement addressing enforcement authority, jurisdiction of security personnel, working relationship with State and local police agencies, including arrest authority and MOUs.',
          statutoryCitation: '§ 668.46(b)(4)(i)-(iv)',
          priority: 'high'
        },
        {
          title: 'Include security awareness program descriptions',
          description: 'Description of type and frequency of programs designed to inform students and employees about campus security procedures and practices.',
          statutoryCitation: '§ 668.46(b)(5)',
          priority: 'medium'
        },
        {
          title: 'Include crime prevention program descriptions',
          description: 'Description of programs designed to inform students and employees about the prevention of crimes.',
          statutoryCitation: '§ 668.46(b)(6)',
          priority: 'medium'
        },
        {
          title: 'Include noncampus student organization monitoring policy',
          description: 'Statement of policy concerning the monitoring and recording through local police agencies of criminal activity by students at noncampus locations of officially recognized student organizations.',
          statutoryCitation: '§ 668.46(b)(7)',
          priority: 'medium'
        },
        {
          title: 'Include alcohol policy',
          description: 'Statement of policy regarding the possession, use, and sale of alcoholic beverages and enforcement of State underage drinking laws.',
          statutoryCitation: '§ 668.46(b)(8)',
          priority: 'high'
        },
        {
          title: 'Include drug policy',
          description: 'Statement of policy regarding the possession, use, and sale of illegal drugs and enforcement of Federal and State drug laws.',
          statutoryCitation: '§ 668.46(b)(9)',
          priority: 'high'
        },
        {
          title: 'Include drug/alcohol abuse education programs',
          description: 'Description of drug or alcohol-abuse education programs as required under the Drug-Free Schools and Communities Act of 1989.',
          statutoryCitation: '§ 668.46(b)(10)',
          priority: 'medium'
        },
        {
          title: 'Include VAWA prevention programs and procedures',
          description: 'Statement of policy addressing programs to prevent dating violence, domestic violence, sexual assault, and stalking, and procedures when one of these crimes is reported.',
          statutoryCitation: '§ 668.46(b)(11)(i)-(vii)',
          priority: 'critical'
        },
        {
          title: 'Include sex offender registry notice',
          description: 'Statement advising where law enforcement information concerning registered sex offenders may be obtained.',
          statutoryCitation: '§ 668.46(b)(12)',
          priority: 'medium'
        },
        {
          title: 'Include emergency response and evacuation procedures policy',
          description: 'Statement of policy regarding emergency response and evacuation procedures as required by paragraph (g).',
          statutoryCitation: '§ 668.46(b)(13)',
          priority: 'critical'
        },
        {
          title: 'Include missing student notification procedures',
          description: 'Statement of policy regarding missing student notification procedures for residential students as required by paragraph (h).',
          statutoryCitation: '§ 668.46(b)(14)',
          priority: 'high'
        }
      ]
    },

    // ================================================================
    // SECTION (c): CRIME STATISTICS REPORTING
    // ================================================================
    {
      title: 'Compile and Report Crime Statistics to Department of Education',
      description: 'Report to the Department and disclose statistics for the three most recent calendar years for all crimes in § 668.46(c)(1) that occurred on or within Clery geography.',
      statutoryCitation: '§ 668.46(c)(1)',
      statutoryLanguage: 'An institution must report to the Department and disclose in its annual security report statistics for the three most recent calendar years...',
      category: 'Crime Statistics',
      priority: 'critical',
      assignedRole: 'Clery Compliance Officer',
      deadline: { type: 'annual', date: '10-15', description: 'Department of Education submission via Campus Safety and Security Survey' },
      evidenceRequired: 'Completed CSS Survey submission confirmation, crime statistics compilation records',
      subtasks: [
        {
          title: 'Report primary crimes (homicide, sex offenses, robbery, assault, burglary, vehicle theft, arson)',
          description: 'Compile statistics for all primary crimes using FBI UCR program definitions as provided in Appendix A.',
          statutoryCitation: '§ 668.46(c)(1)(i)(A)-(G), (c)(9)',
          priority: 'critical'
        },
        {
          title: 'Report arrests and disciplinary referrals (liquor, drugs, weapons)',
          description: 'Compile arrest statistics and referrals for campus disciplinary action for liquor law violations, drug law violations, and illegal weapons possession.',
          statutoryCitation: '§ 668.46(c)(1)(ii)(A)-(B)',
          priority: 'critical'
        },
        {
          title: 'Report hate crimes by category of bias',
          description: 'Identify the category of bias (race, gender, gender identity, religion, sexual orientation, ethnicity, national origin, disability) for each hate crime.',
          statutoryCitation: '§ 668.46(c)(1)(iii), (c)(4)(i)-(viii)',
          priority: 'high'
        },
        {
          title: 'Report VAWA crimes (dating violence, domestic violence, stalking)',
          description: 'Compile statistics for dating violence, domestic violence, and stalking using definitions in paragraph (a).',
          statutoryCitation: '§ 668.46(c)(1)(iv), (c)(9)(iv)',
          priority: 'critical'
        },
        {
          title: 'Record all crimes by location (on campus, noncampus, public property)',
          description: 'Specify whether each crime occurred on campus, in noncampus building/property, or on public property. Identify dormitory/residential facility crimes separately.',
          statutoryCitation: '§ 668.46(c)(5)(i)-(iii)',
          priority: 'high'
        },
        {
          title: 'Obtain statistics from local police agencies',
          description: 'Make a reasonable, good-faith effort to obtain statistics for crimes within Clery geography from local or State police agencies.',
          statutoryCitation: '§ 668.46(c)(11)(i)-(ii)',
          priority: 'high'
        }
      ]
    },

    // ================================================================
    // SECTION (e): TIMELY WARNING
    // ================================================================
    {
      title: 'Issue Timely Warnings for Clery Crimes',
      description: 'Report to the campus community in a manner that is timely, withholds victim identifying information, and will aid in prevention of similar crimes for crimes that represent a threat.',
      statutoryCitation: '§ 668.46(e)(1)',
      statutoryLanguage: 'An institution must, in a manner that is timely and that withholds as confidential the names and other identifying information of victims... report to the campus community on crimes...',
      category: 'Timely Warning',
      priority: 'critical',
      assignedRole: 'Campus Police Chief / Emergency Management Director',
      deadline: { type: 'event-triggered', date: null, description: 'As soon as pertinent information is available per § 668.46(e)(1)' },
      evidenceRequired: 'Timely warning notifications sent, distribution records, assessment documentation',
      subtasks: [
        {
          title: 'Assess whether crime represents ongoing threat',
          description: 'Determine if reported crime is considered by the institution to represent a threat to students and employees.',
          statutoryCitation: '§ 668.46(e)(1)(iii)',
          priority: 'critical'
        },
        {
          title: 'Issue warning withholding victim identity',
          description: 'Withhold as confidential the names and other identifying information of victims as defined in 42 U.S.C. 13925(a)(20).',
          statutoryCitation: '§ 668.46(e)(1)',
          priority: 'critical'
        }
      ]
    },

    // ================================================================
    // SECTION (f): DAILY CRIME LOG
    // ================================================================
    {
      title: 'Maintain Daily Crime Log',
      description: 'Maintain a written, easily understood daily crime log recording by date reported any crime within Clery geography reported to campus police or security.',
      statutoryCitation: '§ 668.46(f)(1)',
      statutoryLanguage: 'An institution that maintains a campus police or a campus security department must maintain a written, easily understood daily crime log...',
      category: 'Crime Log',
      priority: 'critical',
      assignedRole: 'Campus Police / Campus Security Department',
      deadline: { type: 'ongoing', date: null, description: 'Entries within 2 business days of report per § 668.46(f)(2)' },
      evidenceRequired: 'Daily crime log records, public inspection availability documentation',
      subtasks: [
        {
          title: 'Record nature, date, time, and general location of each crime',
          description: 'Each log entry must include the nature, date, time, and general location of each crime and the disposition if known.',
          statutoryCitation: '§ 668.46(f)(1)(i)-(ii)',
          priority: 'critical'
        },
        {
          title: 'Make entries within 2 business days',
          description: 'Make an entry or addition to the log within two business days of the report unless prohibited by law or would jeopardize victim confidentiality.',
          statutoryCitation: '§ 668.46(f)(2)',
          priority: 'critical'
        },
        {
          title: 'Make most recent 60-day log publicly available',
          description: 'Make the crime log for the most recent 60-day period open to public inspection during normal business hours. Older portions available within 2 business days of request.',
          statutoryCitation: '§ 668.46(f)(5)',
          priority: 'high'
        }
      ]
    },

    // ================================================================
    // SECTION (g): EMERGENCY RESPONSE AND EVACUATION
    // ================================================================
    {
      title: 'Maintain Emergency Response and Evacuation Procedures',
      description: 'Include statement of policy regarding emergency response and evacuation procedures in the ASR, including immediate notification procedures for significant emergencies.',
      statutoryCitation: '§ 668.46(g)',
      statutoryLanguage: 'An institution must include a statement of policy regarding its emergency response and evacuation procedures in the annual security report.',
      category: 'Emergency Response',
      priority: 'critical',
      assignedRole: 'Emergency Management Director',
      deadline: { type: 'annual', date: null, description: 'Test at least annually per § 668.46(g)(6)' },
      evidenceRequired: 'Emergency notification procedures, test documentation, drill records',
      subtasks: [
        {
          title: 'Document immediate notification procedures',
          description: 'Document procedures to immediately notify campus community upon confirmation of significant emergency or dangerous situation.',
          statutoryCitation: '§ 668.46(g)(1)',
          priority: 'critical'
        },
        {
          title: 'Document process for confirming emergencies and initiating notifications',
          description: 'Describe process to confirm emergency, determine audience segments, determine notification content, and initiate the notification system.',
          statutoryCitation: '§ 668.46(g)(2)(i)-(iv)',
          priority: 'high'
        },
        {
          title: 'Test emergency response procedures at least annually',
          description: 'Test emergency response and evacuation procedures at least annually, including announced or unannounced tests, publicizing procedures, and documenting each test.',
          statutoryCitation: '§ 668.46(g)(6)(i)-(iii)',
          priority: 'high'
        }
      ]
    },

    // ================================================================
    // SECTION (h): MISSING STUDENT NOTIFICATION
    // ================================================================
    {
      title: 'Implement Missing Student Notification Procedures',
      description: 'For institutions with on-campus housing: include missing student notification policy in ASR and follow notification procedures when students are missing for 24 hours.',
      statutoryCitation: '§ 668.46(h)(1)-(2)',
      statutoryLanguage: 'An institution that provides any on-campus student housing facility must include a statement of policy regarding missing student notification procedures...',
      category: 'Student Safety',
      priority: 'high',
      assignedRole: 'Dean of Students / Student Affairs',
      deadline: { type: 'event-triggered', date: null, description: 'Within 24 hours of determination student is missing per § 668.46(h)(2)' },
      evidenceRequired: 'Emergency contact collection records, notification policy, investigation procedures',
      subtasks: [
        {
          title: 'Collect confidential emergency contacts from residential students',
          description: 'Provide option for each student to identify a contact person. Advise that information will be registered confidentially and accessible only to authorized officials.',
          statutoryCitation: '§ 668.46(h)(1)(iii)-(iv)',
          priority: 'high'
        },
        {
          title: 'Notify designated contacts within 24 hours',
          description: 'If student has designated a contact person, notify within 24 hours. For students under 18, also notify custodial parent/guardian.',
          statutoryCitation: '§ 668.46(h)(2)(i)-(ii)',
          priority: 'critical'
        },
        {
          title: 'Notify local law enforcement within 24 hours',
          description: 'Regardless of student age or contact designation, inform local law enforcement within 24 hours that student is missing.',
          statutoryCitation: '§ 668.46(h)(2)(iii)',
          priority: 'critical'
        }
      ]
    },

    // ================================================================
    // SECTION (j): VAWA PREVENTION PROGRAMS
    // ================================================================
    {
      title: 'Implement VAWA Prevention Programs',
      description: 'Provide primary prevention and awareness programs for incoming students/new employees and ongoing prevention campaigns for all students/employees addressing dating violence, domestic violence, sexual assault, and stalking.',
      statutoryCitation: '§ 668.46(j)(1)',
      statutoryLanguage: 'The statement must include a description of the institution\'s primary prevention and awareness programs for all incoming students and new employees...',
      category: 'VAWA Prevention',
      priority: 'critical',
      assignedRole: 'Title IX Coordinator / Student Affairs',
      deadline: { type: 'ongoing', date: null, description: 'Primary programs for all incoming students/new employees; ongoing campaigns per § 668.46(j)(1)(i)-(ii)' },
      evidenceRequired: 'Program curriculum, attendance records, training materials, campaign documentation',
      subtasks: [
        {
          title: 'Provide prohibition statement and definitions',
          description: 'Include statement that institution prohibits dating violence, domestic violence, sexual assault, and stalking, plus applicable jurisdiction definitions and consent definition.',
          statutoryCitation: '§ 668.46(j)(1)(i)(A)-(C)',
          priority: 'critical'
        },
        {
          title: 'Include bystander intervention and risk reduction information',
          description: 'Provide description of safe and positive bystander intervention options and information on risk reduction.',
          statutoryCitation: '§ 668.46(j)(1)(i)(D)-(E)',
          priority: 'high'
        },
        {
          title: 'Maintain ongoing prevention campaigns',
          description: 'Provide ongoing prevention and awareness campaigns for students and employees with all information from § 668.46(j)(1)(i)(A)-(F).',
          statutoryCitation: '§ 668.46(j)(1)(ii)',
          priority: 'high'
        }
      ]
    },

    // ================================================================
    // SECTION (k): DISCIPLINARY PROCEEDINGS
    // ================================================================
    {
      title: 'Establish VAWA Disciplinary Proceedings',
      description: 'Include clear statement of policy addressing institutional disciplinary action procedures in cases of alleged dating violence, domestic violence, sexual assault, or stalking.',
      statutoryCitation: '§ 668.46(k)',
      statutoryLanguage: 'An institution must include in its annual security report a clear statement of policy that addresses the procedures for institutional disciplinary action...',
      category: 'Disciplinary Proceedings',
      priority: 'critical',
      assignedRole: 'Title IX Coordinator / General Counsel',
      deadline: { type: 'ongoing', date: null, description: 'Policy must be current and included in ASR per § 668.46(k)' },
      evidenceRequired: 'Published disciplinary procedures, training records for officials, hearing documentation templates',
      subtasks: [
        {
          title: 'Document disciplinary proceeding types, steps, and timelines',
          description: 'Describe each type of proceeding, steps, anticipated timelines, decision-making process, how to file a complaint, and how the institution determines which proceeding type to use.',
          statutoryCitation: '§ 668.46(k)(1)(i)',
          priority: 'critical'
        },
        {
          title: 'Describe standard of evidence',
          description: 'Describe the standard of evidence used during any disciplinary proceeding arising from VAWA allegations.',
          statutoryCitation: '§ 668.46(k)(1)(ii)',
          priority: 'critical'
        },
        {
          title: 'List all possible sanctions',
          description: 'List all possible sanctions the institution may impose following disciplinary proceedings for VAWA allegations.',
          statutoryCitation: '§ 668.46(k)(1)(iii)',
          priority: 'high'
        },
        {
          title: 'Ensure prompt, fair, and impartial process',
          description: 'Proceedings must include a prompt, fair, and impartial process conducted by annually trained officials.',
          statutoryCitation: '§ 668.46(k)(2)(i)-(ii)',
          priority: 'critical'
        },
        {
          title: 'Provide equal advisor access',
          description: 'Provide accuser and accused same opportunities to have advisor present. May not limit choice of advisor.',
          statutoryCitation: '§ 668.46(k)(2)(iii)-(iv)',
          priority: 'high'
        },
        {
          title: 'Provide simultaneous written notification of results',
          description: 'Simultaneously notify both accuser and accused in writing of the result, appeal procedures, any changes, and when results become final.',
          statutoryCitation: '§ 668.46(k)(2)(v)(A)-(D)',
          priority: 'critical'
        }
      ]
    },

    // ================================================================
    // SECTION (d): SEPARATE CAMPUS COMPLIANCE
    // ================================================================
    {
      title: 'Comply for Each Separate Campus',
      description: 'Institution must comply with all requirements of § 668.46 for each separate campus.',
      statutoryCitation: '§ 668.46(d)',
      statutoryLanguage: 'An institution must comply with the requirements of this section for each separate campus.',
      category: 'Multi-Campus',
      priority: 'high',
      assignedRole: 'Clery Compliance Officer',
      deadline: { type: 'ongoing', date: null, description: 'Continuous compliance per § 668.46(d)' },
      evidenceRequired: 'Separate campus identification records, per-campus ASR components, per-campus crime statistics',
      subtasks: []
    },

    // ================================================================
    // SECTION (m): NON-RETALIATION
    // ================================================================
    {
      title: 'Enforce Non-Retaliation Policy',
      description: 'Institution may not retaliate, intimidate, threaten, coerce, or otherwise discriminate against any individual for exercising their rights or responsibilities under § 668.46.',
      statutoryCitation: '§ 668.46(m)',
      statutoryLanguage: 'An institution, or an officer, employee, or agent of an institution, may not retaliate, intimidate, threaten, coerce, or otherwise discriminate against any individual...',
      category: 'Anti-Retaliation',
      priority: 'critical',
      assignedRole: 'General Counsel / Title IX Coordinator',
      deadline: { type: 'ongoing', date: null, description: 'Continuous obligation per § 668.46(m)' },
      evidenceRequired: 'Anti-retaliation policy, training records, complaint investigation records',
      subtasks: []
    }
  ],

  deadlines: [
    {
      name: 'Annual Security Report Publication',
      description: 'Publish the Annual Security Report by October 1',
      statutoryCitation: '20 U.S.C. § 1092(f)(1)',
      frequency: 'annual',
      recurringMonth: 10,
      recurringDay: 1,
    },
    {
      name: 'Department of Education Crime Statistics Submission',
      description: 'Submit campus crime statistics to the Department of Education via Campus Safety and Security Survey',
      statutoryCitation: '§ 668.46(c)(1)',
      frequency: 'annual',
      recurringMonth: 10,
      recurringDay: 15,
    },
    {
      name: 'Crime Log Entry Deadline',
      description: 'Make an entry or addition to the crime log within two business days of the report',
      statutoryCitation: '§ 668.46(f)(2)',
      frequency: 'event-triggered',
      recurringMonth: null,
      recurringDay: null,
    },
    {
      name: 'Emergency Response Test',
      description: 'Test emergency response and evacuation procedures at least annually',
      statutoryCitation: '§ 668.46(g)(6)',
      frequency: 'annual',
      recurringMonth: null,
      recurringDay: null,
    },
    {
      name: 'Missing Student Notification',
      description: 'Notify contacts and law enforcement within 24 hours of determining a student is missing',
      statutoryCitation: '§ 668.46(h)(2)',
      frequency: 'event-triggered',
      recurringMonth: null,
      recurringDay: null,
    },
  ],

  penalties: [
    {
      type: 'funding',
      description: 'Loss of eligibility for Title IV federal student financial aid programs',
      statutoryCitation: '20 U.S.C. § 1092(f)(13)',
      statutoryLanguage: 'The Secretary shall impose a civil penalty on any institution of higher education that the Secretary determines has substantially misrepresented the number, location, or nature of the crimes required to be reported.',
      severity: 'critical',
      amount: 'Up to $69,733 per violation (adjusted annually for inflation)',
      enforcingAgency: 'U.S. Department of Education',
    },
    {
      type: 'monetary',
      description: 'Civil monetary penalty for substantial misrepresentation of crime statistics',
      statutoryCitation: '20 U.S.C. § 1092(f)(13)',
      statutoryLanguage: 'The Secretary shall impose a civil penalty on any institution...',
      severity: 'critical',
      amount: 'Up to $69,733 per violation',
      enforcingAgency: 'U.S. Department of Education',
    },
    {
      type: 'administrative',
      description: 'Federal compliance review, program review, or limitation/suspension/termination proceedings',
      statutoryCitation: '34 CFR § 668.86',
      statutoryLanguage: 'If the Department determines that an institution has violated the requirements of this subpart, the Department may initiate a proceeding to fine, limit, suspend, or terminate the institution.',
      severity: 'high',
      amount: null,
      enforcingAgency: 'U.S. Department of Education',
    },
  ],

  responsibleRoles: [
    {
      role: 'Clery Compliance Officer',
      statutoryCitation: '§ 668.46(b)-(c)',
      responsibilities: 'Prepares ASR, compiles crime statistics, ensures all 14 required policy statements are included, submits to Department of Education',
    },
    {
      role: 'Campus Security Authorities (CSAs)',
      statutoryCitation: '§ 668.46(a) (definition)',
      responsibilities: 'Campus police, individuals with campus security responsibility, officials designated for crime reporting, officials with significant responsibility for student/campus activities',
    },
    {
      role: 'Campus Police / Security Department',
      statutoryCitation: '§ 668.46(f)(1)',
      responsibilities: 'Maintains daily crime log, records all reported crimes, makes log available for public inspection',
    },
    {
      role: 'Emergency Management Director',
      statutoryCitation: '§ 668.46(g)(1)-(6)',
      responsibilities: 'Emergency notification procedures, annual testing of emergency response system, documentation of tests',
    },
    {
      role: 'Title IX Coordinator',
      statutoryCitation: '§ 668.46(j)-(k)',
      responsibilities: 'VAWA prevention programs, disciplinary proceedings for dating violence, domestic violence, sexual assault, and stalking',
    },
  ],

  relatedRegulations: [
    { id: 'title-ix-of-the-education-amendments-of-1972', relationship: 'Title IX and Clery Act both address sexual assault; disciplinary proceedings under § 668.46(k) may overlap with Title IX grievance processes', type: 'overlap' },
    { id: 'family-educational-rights-and-privacy-act-ferpa', relationship: 'FERPA generally protects education records, but § 668.46(l) explicitly states Clery compliance does not violate FERPA', type: 'overlap' },
    { id: 'higher-education-act-drug-and-alcohol-abuse-preven', relationship: 'Drug-Free Schools and Communities Act referenced in § 668.46(b)(10) for drug/alcohol education programs', type: 'dependency' },
  ],
};
