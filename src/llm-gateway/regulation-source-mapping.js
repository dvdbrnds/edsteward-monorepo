/**
 * CRITICAL: Regulation-to-Government-Source Mapping
 * 
 * Maps each regulation to its specific government source
 * NO GENERIC SOURCES - Each regulation has its own specific API/URL
 */

export const REGULATION_SOURCE_MAPPING = {
  // EPA Environmental Regulations with SPECIFIC Federal Register documents
  'national-emission-standards-for-hazardous-air-poll': {
    agency: 'EPA',
    source: 'U.S. Environmental Protection Agency',
    apiUrl: 'https://www.epa.gov/stationary-sources-air-pollution/national-emission-standards-hazardous-air-pollutants-neshap',
    federalRegisterDoc: '2023-28678', // Specific NESHAP Federal Register document
    citation: '40 CFR Part 61',
    category: 'Environmental',
    subcategory: 'Air Quality Standards'
  },
  'clean-air-act': {
    agency: 'EPA',
    source: 'U.S. Environmental Protection Agency',
    apiUrl: 'https://www.epa.gov/clean-air-act-overview',
    federalRegisterDoc: '2021-28963', // Specific Clean Air Act Federal Register document
    citation: '42 USC 7401',
    category: 'Environmental',
    subcategory: 'Air Quality'
  },
  'clean-water-act': {
    agency: 'EPA',
    source: 'U.S. Environmental Protection Agency',
    apiUrl: 'https://www.epa.gov/laws-regulations/summary-clean-water-act',
    citation: '33 USC 1251',
    category: 'Environmental',
    subcategory: 'Water Quality'
  },
  'comprehensive-environmental-response-compensation-': {
    agency: 'EPA',
    source: 'U.S. Environmental Protection Agency',
    apiUrl: 'https://www.epa.gov/superfund/superfund-cercla-overview',
    citation: '42 USC 9601',
    category: 'Environmental',
    subcategory: 'Hazardous Waste'
  },

  // DOL/OSHA Workplace Safety Regulations
  'occupational-safety-and-health-act': {
    agency: 'DOL-OSHA',
    source: 'U.S. Department of Labor - OSHA',
    apiUrl: 'https://www.osha.gov/laws-regs/oshact/completeoshact',
    citation: '29 USC 651',
    category: 'Workplace Safety',
    subcategory: 'General Industry Standards'
  },
  'emergency-action-plan': {
    agency: 'DOL-OSHA',
    source: 'U.S. Department of Labor - OSHA',
    apiUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.38',
    citation: '29 CFR 1910.38',
    category: 'Workplace Safety',
    subcategory: 'Emergency Procedures'
  },
  'hazard-communication': {
    agency: 'DOL-OSHA',
    source: 'U.S. Department of Labor - OSHA',
    apiUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200',
    citation: '29 CFR 1910.1200',
    category: 'Workplace Safety',
    subcategory: 'Chemical Safety'
  },

  // DOL Employment Regulations
  'fair-labor-standards-act-flsa': {
    agency: 'DOL-WHD',
    source: 'U.S. Department of Labor - Wage and Hour Division',
    apiUrl: 'https://www.dol.gov/agencies/whd/flsa',
    citation: '29 USC 201',
    category: 'Employment',
    subcategory: 'Wages and Hours'
  },
  'family-and-medical-leave-act-fmla': {
    agency: 'DOL-WHD',
    source: 'U.S. Department of Labor - Wage and Hour Division',
    apiUrl: 'https://www.dol.gov/agencies/whd/fmla',
    citation: '29 USC 2601',
    category: 'Employment',
    subcategory: 'Family Leave'
  },

  // DOT Transportation Regulations
  'hazardous-materials-transportation-act': {
    agency: 'DOT',
    source: 'U.S. Department of Transportation',
    apiUrl: 'https://www.transportation.gov/mission/safety/hazmat',
    citation: '49 USC 5101',
    category: 'Transportation',
    subcategory: 'Hazardous Materials'
  },
  'motor-carrier-act-of-1980': {
    agency: 'DOT-FMCSA',
    source: 'U.S. Department of Transportation - FMCSA',
    apiUrl: 'https://www.fmcsa.dot.gov/regulations',
    citation: '49 USC 31101',
    category: 'Transportation',
    subcategory: 'Motor Carriers'
  },

  // HHS Health Regulations
  'hipaa': {
    agency: 'HHS-OCR',
    source: 'U.S. Department of Health & Human Services - OCR',
    apiUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html',
    federalRegisterDoc: '2013-01073',
    citation: '45 CFR 160',
    category: 'Healthcare',
    subcategory: 'Privacy and Security'
  },
  'health-insurance-portability-and-accountability-ac': {
    agency: 'HHS-OCR',
    source: 'U.S. Department of Health & Human Services - OCR',
    apiUrl: 'https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html',
    federalRegisterDoc: '2013-01073',
    citation: '45 CFR 160',
    category: 'Healthcare',
    subcategory: 'Privacy and Security'
  },
  'patient-protection-and-affordable-care-act': {
    agency: 'HHS',
    source: 'U.S. Department of Health & Human Services',
    apiUrl: 'https://www.hhs.gov/healthcare/about-the-aca/index.html',
    citation: '42 USC 18001',
    category: 'Healthcare',
    subcategory: 'Health Insurance'
  },

  // DOE Education Regulations with SPECIFIC Federal Register documents
  'family-educational-rights-and-privacy-act-ferpa': {
    agency: 'DOE',
    source: 'U.S. Department of Education',
    apiUrl: 'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html',
    federalRegisterDoc: '2011-30683', // Specific FERPA Federal Register document
    citation: '20 USC 1232g',
    category: 'Education',
    subcategory: 'Student Privacy'
  },
  'title-ix-of-the-education-amendment-of-1972': {
    agency: 'DOE-OCR',
    source: 'U.S. Department of Education - Office for Civil Rights',
    apiUrl: 'https://www.ed.gov/about/offices/list/ocr/title-ix', // Official DOE Title IX page
    citation: '20 USC 1681',
    category: 'Education',
    subcategory: 'Civil Rights'
  },

  // DOJ Civil Rights Regulations
  'americans-with-disabilities-act-of-1990': {
    agency: 'DOJ-CRT',
    source: 'U.S. Department of Justice - Civil Rights Division',
    apiUrl: 'https://www.ada.gov/law-and-regs/ada/',
    citation: '42 USC 12101',
    category: 'Civil Rights',
    subcategory: 'Disability Rights'
  },
  'age-discrimination-act-of-1975': {
    agency: 'HHS-OCR',
    source: 'U.S. Department of Health & Human Services - Office for Civil Rights',
    apiUrl: 'https://www.hhs.gov/civil-rights/for-individuals/age-discrimination/index.html',
    citation: '42 USC 6101',
    category: 'Civil Rights',
    subcategory: 'Age Discrimination'
  },
  'title-vii-of-the-civil-rights-act-of-1964': {
    agency: 'EEOC',
    source: 'U.S. Equal Employment Opportunity Commission',
    apiUrl: 'https://www.eeoc.gov/statutes/title-vii-civil-rights-act-1964',
    citation: '42 USC 2000e',
    category: 'Civil Rights',
    subcategory: 'Employment Discrimination'
  },

  // Treasury/IRS Financial Regulations
  'gramm-leach-bliley-act-glba': {
    agency: 'TREASURY-OCC',
    source: 'U.S. Treasury Department - Office of the Comptroller',
    apiUrl: 'https://www.occ.gov/topics/consumers-and-communities/consumer-protection/privacy/index-privacy.html',
    federalRegisterDoc: '2001-11478',
    citation: '15 USC 6801',
    category: 'Financial',
    subcategory: 'Privacy Protection'
  },

  // Additional Financial Regulations
  'fair-labor-standards-act-flsa': {
    agency: 'DOL-WHD',
    source: 'U.S. Department of Labor - Wage and Hour Division',
    apiUrl: 'https://www.dol.gov/agencies/whd/flsa',
    federalRegisterDoc: '2019-27704',
    citation: '29 USC 201',
    category: 'Employment',
    subcategory: 'Wages and Hours'
  },
  'federal-insurance-contributions-act-fica': {
    agency: 'IRS',
    source: 'Internal Revenue Service',
    apiUrl: 'https://www.irs.gov/taxtopics/tc751',
    citation: '26 USC 3101',
    category: 'Tax',
    subcategory: 'Payroll Tax'
  },
  'federal-unemployment-tax-act-futa': {
    agency: 'IRS',
    source: 'Internal Revenue Service',
    apiUrl: 'https://www.irs.gov/taxtopics/tc759',
    citation: '26 USC 3301',
    category: 'Tax',
    subcategory: 'Unemployment Tax'
  },

  // Higher Education Act Regulations
  'higher-education-act-institutional-and-financial-a': {
    agency: 'DOE',
    source: 'U.S. Department of Education',
    apiUrl: 'https://www2.ed.gov/policy/highered/leg/hea08/index.html',
    federalRegisterDoc: '2020-26643',
    citation: '20 USC 1001',
    category: 'Education',
    subcategory: 'Institutional Aid'
  },

  // DHS Security Regulations
  'homeland-security-act-of-2002': {
    agency: 'DHS',
    source: 'U.S. Department of Homeland Security',
    apiUrl: 'https://www.dhs.gov/homeland-security-act-2002',
    citation: '6 USC 101',
    category: 'Security',
    subcategory: 'National Security'
  },

  // DEA Drug Regulations
  'controlled-substances-act': {
    agency: 'DEA',
    source: 'U.S. Drug Enforcement Administration',
    apiUrl: 'https://www.dea.gov/drug-information/csa',
    citation: '21 USC 801',
    category: 'Drug Control',
    subcategory: 'Controlled Substances'
  },

  // FTC Consumer Protection
  'fair-credit-reporting-act-fcra': {
    agency: 'FTC',
    source: 'U.S. Federal Trade Commission',
    apiUrl: 'https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act',
    citation: '15 USC 1681',
    category: 'Consumer Protection',
    subcategory: 'Credit Reporting'
  }
};

/**
 * Get specific government source for a regulation
 */
export function getGovernmentSource(regulationSlug) {
  const mapping = REGULATION_SOURCE_MAPPING[regulationSlug];
  if (!mapping) {
    return null;
  }
  
  return {
    agency: mapping.agency,
    source: mapping.source,
    apiUrl: mapping.apiUrl,
    citation: mapping.citation,
    category: mapping.category,
    subcategory: mapping.subcategory,
    governmentSourceUrl: mapping.apiUrl
  };
}

/**
 * Get all regulations for a specific agency
 */
export function getRegulationsByAgency(agency) {
  return Object.entries(REGULATION_SOURCE_MAPPING)
    .filter(([slug, mapping]) => mapping.agency === agency)
    .map(([slug, mapping]) => ({ slug, ...mapping }));
}

/**
 * Get all available agencies
 */
export function getAllAgencies() {
  const agencies = new Set();
  Object.values(REGULATION_SOURCE_MAPPING).forEach(mapping => {
    agencies.add(mapping.agency);
  });
  return Array.from(agencies).sort();
}
