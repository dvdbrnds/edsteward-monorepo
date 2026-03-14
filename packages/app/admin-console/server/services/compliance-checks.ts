/**
 * Per-regulation website compliance check definitions.
 * Maps each regulation that requires website_publish to:
 *   - keywords / URL paths a crawler should look for
 *   - specific requirements the LLM should verify
 *   - weight for scoring
 */

export interface ComplianceRequirement {
  id: string;
  description: string;
  critical: boolean;
}

export interface RegulationCheck {
  regulationId: string;
  name: string;
  shortName: string;
  searchPaths: string[];
  searchKeywords: string[];
  requirements: ComplianceRequirement[];
  weight: number;
}

export const REGULATION_CHECKS: RegulationCheck[] = [
  {
    regulationId: 'clery-act',
    name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
    shortName: 'Clery Act',
    searchPaths: [
      '/annual-security-report', '/asr', '/clery', '/campus-safety',
      '/campus-security', '/security-report', '/public-safety',
      '/crime-statistics', '/safety-report', '/campuspolice',
      '/campus-police', '/police', '/university-police',
      '/publicsafety', '/public-safety-report', '/safety',
    ],
    searchKeywords: [
      'annual security report', 'clery', 'campus crime statistics',
      'crime log', 'campus safety', 'timely warning', 'emergency notification',
      'campus police', 'public safety', 'security and fire safety',
      'fire safety report', 'daily crime log',
    ],
    requirements: [
      { id: 'asr-published', description: 'Annual Security Report (ASR) is published on the website, typically as a downloadable PDF', critical: true },
      { id: 'asr-accessible', description: 'ASR is accessible without requiring login or authentication', critical: true },
      { id: 'crime-stats', description: 'Campus crime statistics are disclosed (may be within the ASR)', critical: true },
      { id: 'emergency-procedures', description: 'Emergency response and evacuation procedures are publicized', critical: false },
      { id: 'timely-warning', description: 'Policy on timely warnings and emergency notifications is described', critical: false },
    ],
    weight: 10,
  },
  {
    regulationId: 'ferpa',
    name: 'Family Educational Rights and Privacy Act',
    shortName: 'FERPA',
    searchPaths: [
      '/ferpa', '/student-privacy', '/student-records',
      '/registrar', '/directory-information', '/privacy-rights',
    ],
    searchKeywords: [
      'ferpa', 'family educational rights', 'student records',
      'directory information', 'education records', 'student privacy',
    ],
    requirements: [
      { id: 'ferpa-notice', description: 'Annual FERPA rights notification is published on the website', critical: true },
      { id: 'directory-info-policy', description: 'Directory information policy is posted, explaining what the institution considers directory information', critical: true },
      { id: 'opt-out-instructions', description: 'Instructions for students to opt out of directory information disclosure are provided', critical: true },
      { id: 'complaint-process', description: 'Information on how to file a FERPA complaint is available', critical: false },
    ],
    weight: 8,
  },
  {
    regulationId: 'title-ix',
    name: 'Title IX of the Education Amendments of 1972',
    shortName: 'Title IX',
    searchPaths: [
      '/title-ix', '/titleix', '/title9', '/sexual-misconduct',
      '/sex-discrimination', '/non-discrimination', '/equity',
      '/titleixcoordinator', '/title-ix-coordinator', '/nondiscrimination',
    ],
    searchKeywords: [
      'title ix', 'title nine', 'sex discrimination', 'sexual harassment',
      'title ix coordinator', 'non-discrimination', 'sexual misconduct',
      'grievance procedure',
    ],
    requirements: [
      { id: 'coordinator-info', description: 'Title IX Coordinator name, office address, email, and phone number are published', critical: true },
      { id: 'nondiscrimination-statement', description: 'Non-discrimination statement on the basis of sex is posted', critical: true },
      { id: 'grievance-procedures', description: 'Title IX grievance procedures for filing and resolving complaints are published', critical: true },
      { id: 'reporting-options', description: 'Information on how to report sex discrimination or harassment is clearly provided', critical: true },
      { id: 'policy-document', description: 'Full Title IX policy document is accessible', critical: false },
    ],
    weight: 10,
  },
  {
    regulationId: 'americans-with-disabilities-act-of-1990',
    name: 'Americans with Disabilities Act',
    shortName: 'ADA',
    searchPaths: [
      '/ada', '/accessibility', '/disability-services',
      '/accommodations', '/disability-resources', '/accessible',
      '/disabilityservices', '/disability', '/accessibilityservices',
    ],
    searchKeywords: [
      'americans with disabilities', 'ada', 'accessibility',
      'disability services', 'accommodations', 'ada coordinator',
      'reasonable accommodation',
    ],
    requirements: [
      { id: 'ada-policy', description: 'ADA/accessibility policy statement is published', critical: true },
      { id: 'coordinator-contact', description: 'ADA/Disability Services coordinator contact information is provided', critical: true },
      { id: 'grievance-procedure', description: 'ADA grievance procedure is posted', critical: true },
      { id: 'accommodation-process', description: 'Process for requesting accommodations is described', critical: false },
    ],
    weight: 8,
  },
  {
    regulationId: 'higher-education-act-title-iv-student-financial-a',
    name: 'Title IV — Student Financial Assistance (HEA)',
    shortName: 'Title IV / HEA',
    searchPaths: [
      '/consumer-information', '/financial-aid', '/student-consumer',
      '/net-price-calculator', '/cost-attendance', '/student-right-to-know',
      '/financial-aid-information', '/tuition-fees', '/consumerinformation',
      '/financialaid', '/tuition', '/cost-aid', '/affordability',
    ],
    searchKeywords: [
      'consumer information', 'net price calculator', 'financial aid',
      'cost of attendance', 'student right to know', 'graduation rate',
      'retention rate', 'gainful employment',
    ],
    requirements: [
      { id: 'consumer-info-page', description: 'Central consumer information page exists with required disclosures', critical: true },
      { id: 'net-price-calculator', description: 'Net Price Calculator is available and accessible', critical: true },
      { id: 'cost-attendance', description: 'Cost of attendance information is published', critical: true },
      { id: 'grad-retention-rates', description: 'Graduation and retention rates are disclosed', critical: false },
      { id: 'financial-aid-info', description: 'Types of financial aid available and application process are described', critical: false },
    ],
    weight: 9,
  },
  {
    regulationId: 'health-insurance-portability-and-accountability-ac',
    name: 'Health Insurance Portability and Accountability Act',
    shortName: 'HIPAA',
    searchPaths: [
      '/hipaa', '/privacy-practices', '/health-services',
      '/student-health', '/counseling-center', '/health-center',
    ],
    searchKeywords: [
      'hipaa', 'notice of privacy practices', 'health information',
      'protected health information', 'privacy practices',
    ],
    requirements: [
      { id: 'npp-published', description: 'Notice of Privacy Practices is published for health services', critical: true },
      { id: 'health-info-rights', description: 'Patient rights regarding health information are described', critical: false },
    ],
    weight: 5,
  },
  {
    regulationId: 'drug-free-schools-and-communities-act',
    name: 'Drug-Free Schools and Communities Act',
    shortName: 'Drug-Free Schools',
    searchPaths: [
      '/drug-free', '/alcohol-policy', '/drug-policy',
      '/substance-abuse', '/student-conduct', '/community-standards',
    ],
    searchKeywords: [
      'drug-free', 'alcohol policy', 'drug policy', 'substance abuse',
      'drug prevention', 'biennial review', 'controlled substance',
    ],
    requirements: [
      { id: 'drug-alcohol-policy', description: 'Drug and alcohol policy or prevention program information is publicly accessible', critical: true },
      { id: 'standards-of-conduct', description: 'Standards of conduct prohibiting drug/alcohol use are stated', critical: true },
      { id: 'sanctions', description: 'Sanctions for violations are described', critical: false },
      { id: 'health-risks', description: 'Health risks associated with drug/alcohol use are listed', critical: false },
    ],
    weight: 6,
  },
  {
    regulationId: 'campus-sexual-violence-elimination-act',
    name: 'Campus Sexual Violence Elimination Act (Campus SaVE)',
    shortName: 'Campus SaVE',
    searchPaths: [
      '/campus-save', '/sexual-violence', '/sexual-assault',
      '/dating-violence', '/domestic-violence', '/stalking',
      '/title-ix', '/student-conduct', '/conduct',
      '/community-standards', '/reporting',
    ],
    searchKeywords: [
      'campus save', 'sexual violence', 'sexual assault',
      'dating violence', 'domestic violence', 'stalking',
      'bystander intervention', 'risk reduction',
      'reporting options', 'confidential resource',
      'responsible employee', 'mandatory reporter',
    ],
    requirements: [
      { id: 'policy-published', description: 'Sexual violence prevention policy and procedures are published', critical: true },
      { id: 'reporting-options', description: 'Reporting options for sexual violence, dating violence, domestic violence, and stalking are clearly provided', critical: true },
      { id: 'prevention-programs', description: 'Information about primary prevention and awareness programs is available', critical: false },
    ],
    weight: 7,
  },
  {
    regulationId: 'violence-against-women-reauthorization-act',
    name: 'Violence Against Women Act (VAWA)',
    shortName: 'VAWA',
    searchPaths: [
      '/vawa', '/title-ix', '/sexual-misconduct',
      '/violence-prevention', '/student-conduct', '/conduct',
      '/community-standards', '/code-of-conduct', '/student-handbook',
      '/judicial-affairs', '/dean-of-students', '/studentconduct',
      '/communitystandards', '/handbook', '/policies',
    ],
    searchKeywords: [
      'vawa', 'violence against women', 'protective measures',
      'no-contact order', 'interim measures', 'disciplinary',
      'dating violence', 'domestic violence', 'sexual assault', 'stalking',
      'student conduct', 'code of conduct', 'community standards',
      'judicial', 'adjudication', 'hearing', 'sanctions',
      'student handbook', 'conduct process', 'grievance process',
    ],
    requirements: [
      { id: 'vawa-definitions', description: 'VAWA-specific definitions (dating violence, domestic violence, sexual assault, stalking) are included in policy', critical: true },
      { id: 'procedures-published', description: 'Procedures for institutional disciplinary proceedings are accessible online', critical: true },
    ],
    weight: 6,
  },
  {
    regulationId: 'higher-education-opportunity-act',
    name: 'Higher Education Opportunity Act (HEOA)',
    shortName: 'HEOA',
    searchPaths: [
      '/consumer-information', '/heoa', '/student-outcomes',
      '/campus-safety', '/fire-safety-report', '/voter-registration',
    ],
    searchKeywords: [
      'consumer information', 'heoa', 'textbook information',
      'fire safety report', 'voter registration', 'student outcomes',
      'transfer credit', 'copyright',
    ],
    requirements: [
      { id: 'consumer-info-page', description: 'Central consumer information page with required HEOA disclosures', critical: true },
      { id: 'fire-safety-report', description: 'Annual Fire Safety Report is published (for institutions with on-campus housing)', critical: true },
      { id: 'textbook-info', description: 'Textbook information or ISBN policy is available', critical: false },
    ],
    weight: 7,
  },
  {
    regulationId: 'copyright-dmca',
    name: 'Digital Millennium Copyright Act (DMCA)',
    shortName: 'DMCA',
    searchPaths: [
      '/copyright', '/dmca', '/intellectual-property',
      '/it-policy', '/acceptable-use', '/technology-policy',
    ],
    searchKeywords: [
      'dmca', 'copyright', 'digital millennium', 'copyright infringement',
      'peer-to-peer', 'file sharing', 'dmca agent', 'legal alternatives',
    ],
    requirements: [
      { id: 'copyright-policy', description: 'Copyright and acceptable use policy is published', critical: true },
      { id: 'legal-alternatives', description: 'Information about legal alternatives to unauthorized downloading is provided', critical: false },
      { id: 'dmca-agent', description: 'Designated DMCA agent information is available', critical: false },
    ],
    weight: 4,
  },
  {
    regulationId: 'section-504-of-the-rehabilitation-act-of-1973',
    name: 'Section 504 of the Rehabilitation Act',
    shortName: 'Section 504',
    searchPaths: [
      '/section-504', '/504', '/disability-services',
      '/accessibility', '/non-discrimination',
    ],
    searchKeywords: [
      'section 504', 'rehabilitation act', 'disability discrimination',
      '504 coordinator', 'non-discrimination',
    ],
    requirements: [
      { id: 'nondiscrimination-notice', description: 'Section 504 non-discrimination notice is published', critical: true },
      { id: 'coordinator-info', description: 'Section 504 coordinator contact information is provided', critical: true },
      { id: 'grievance-procedure', description: 'Section 504 grievance procedure is available', critical: false },
    ],
    weight: 6,
  },
  {
    regulationId: 'general-data-protection-regulation',
    name: 'General Data Protection Regulation (GDPR)',
    shortName: 'GDPR',
    searchPaths: [
      '/privacy', '/privacy-policy', '/gdpr', '/data-protection',
      '/cookie-policy',
    ],
    searchKeywords: [
      'gdpr', 'general data protection', 'data protection',
      'privacy policy', 'cookie', 'data subject rights',
      'data controller', 'personal data',
    ],
    requirements: [
      { id: 'privacy-notice', description: 'GDPR-compliant privacy notice is published (Articles 13/14)', critical: true },
      { id: 'data-subject-rights', description: 'Data subject rights (access, erasure, portability, etc.) are described', critical: true },
      { id: 'cookie-notice', description: 'Cookie/tracking notice or consent mechanism is present', critical: false },
    ],
    weight: 5,
  },
  {
    regulationId: 'pennsylvania-act-55-of-2022',
    name: 'Pennsylvania Act 55 of 2022',
    shortName: 'PA Act 55',
    searchPaths: [
      '/act-55', '/pa-act-55', '/pregnant-parenting',
      '/title-ix', '/student-accommodations',
    ],
    searchKeywords: [
      'act 55', 'pregnant', 'parenting students', 'lactation',
      'pregnancy accommodations', 'pennsylvania act 55',
    ],
    requirements: [
      { id: 'rights-notification', description: 'Notification of rights and accommodations for pregnant/parenting students is published on the website', critical: true },
      { id: 'accommodations-listed', description: 'Specific accommodations available are listed (excused absences, lactation space, etc.)', critical: false },
    ],
    weight: 4,
  },
];

export function getChecksForInstitutionTypes(types: string[]): RegulationCheck[] {
  return REGULATION_CHECKS.filter(check => {
    if (check.regulationId === 'health-insurance-portability-and-accountability-ac') {
      return types.includes('medical-health-programs');
    }
    if (check.regulationId === 'general-data-protection-regulation') {
      return true; // Most institutions have international students
    }
    if (check.regulationId === 'pennsylvania-act-55-of-2022') {
      return true; // State-specific, but we check it if the institution is in PA
    }
    return true;
  });
}

export function getAllSearchPaths(): string[] {
  const paths = new Set<string>();
  for (const check of REGULATION_CHECKS) {
    for (const p of check.searchPaths) paths.add(p);
  }
  return Array.from(paths);
}

export function getAllSearchKeywords(): string[] {
  const kw = new Set<string>();
  for (const check of REGULATION_CHECKS) {
    for (const k of check.searchKeywords) kw.add(k);
  }
  return Array.from(kw);
}
