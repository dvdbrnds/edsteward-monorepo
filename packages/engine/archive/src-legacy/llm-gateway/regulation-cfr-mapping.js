/**
 * Regulation to CFR/USC Citation Mapping
 * 
 * Maps regulation IDs to their official CFR (Code of Federal Regulations) 
 * and USC (United States Code) citations for dynamic government API fetching.
 * 
 * This enables the LLM Gateway to fetch ANY regulation from official sources,
 * not just the TEACH Act.
 */

export const REGULATION_CFR_MAPPING = {
  // ==================== TOP 10 DEMO REGULATIONS ====================
  
  // Clery Act - Campus Security
  'jeanne-clery-disclosure-of-campus-security-policy-': {
    name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act',
    cfrCitations: ['34 CFR 668.46'],
    uscCitations: ['20 USC 1092(f)'],
    deadlines: ['October 1 annually'],
    keywords: ['campus security', 'crime statistics', 'annual security report']
  },
  
  // FERPA - Student Privacy
  'family-educational-rights-and-privacy-act-ferpa': {
    name: 'Family Educational Rights and Privacy Act (FERPA)',
    cfrCitations: ['34 CFR 99'],
    uscCitations: ['20 USC 1232g'],
    deadlines: ['Annual notification to students'],
    keywords: ['education records', 'privacy', 'student information']
  },
  
  // Title IX - Sex Discrimination
  'title-ix-of-the-education-amendment-of-1972': {
    name: 'Title IX of the Education Amendment of 1972',
    cfrCitations: ['34 CFR 106'],
    uscCitations: ['20 USC 1681-1688'],
    deadlines: ['Ongoing compliance'],
    keywords: ['sex discrimination', 'sexual harassment', 'athletics']
  },
  
  // Title IV - Student Financial Aid (need to find correct regulation ID)
  'higher-education-act-title-iv': {
    name: 'Higher Education Act Title IV - Student Financial Aid',
    cfrCitations: ['34 CFR 668'],
    uscCitations: ['20 USC 1070'],
    deadlines: ['Multiple FAFSA and R2T4 deadlines'],
    keywords: ['financial aid', 'student loans', 'grants']
  },
  
  // VAWA - Violence Against Women
  'violence-against-women-reauthorization-act': {
    name: 'Violence Against Women Reauthorization Act (VAWA)',
    cfrCitations: ['34 CFR 668.46(j)'],
    uscCitations: ['42 USC 13925'],
    deadlines: ['October 1 annually with Clery'],
    keywords: ['dating violence', 'domestic violence', 'stalking', 'sexual assault']
  },
  
  // ADA - Disability Rights
  'americans-with-disabilities-act-of-1990': {
    name: 'Americans with Disabilities Act of 1990',
    cfrCitations: ['28 CFR 35', '28 CFR 36'],
    uscCitations: ['42 USC 12101-12213'],
    deadlines: ['Ongoing compliance'],
    keywords: ['disability', 'accommodations', 'accessibility']
  },
  
  // Section 504 - Rehabilitation Act
  'section-504-of-the-rehabilitation-act-of-1973': {
    name: 'Section 504 of the Rehabilitation Act of 1973',
    cfrCitations: ['34 CFR 104'],
    uscCitations: ['29 USC 794'],
    deadlines: ['Ongoing compliance'],
    keywords: ['disability discrimination', 'federal funding', 'accommodations']
  },
  
  // Title VI - Race Discrimination
  'title-vi-of-the-civil-rights-act-of-1964': {
    name: 'Title VI of the Civil Rights Act of 1964',
    cfrCitations: ['34 CFR 100'],
    uscCitations: ['42 USC 2000d'],
    deadlines: ['Ongoing compliance'],
    keywords: ['race discrimination', 'national origin', 'federal funding']
  },
  
  // TEACH Act - Copyright Education
  'technology-education-and-copyright-harmonization-a': {
    name: 'Technology Education and Copyright Harmonization Act (TEACH Act)',
    cfrCitations: ['37 CFR 201'],
    uscCitations: ['17 USC 110'],
    deadlines: ['Per-use compliance'],
    keywords: ['copyright', 'distance education', 'fair use']
  },
  
  // Drug-Free Schools
  'drug-free-schools-and-communities-act': {
    name: 'Drug-Free Schools and Communities Act',
    cfrCitations: ['34 CFR 86'],
    uscCitations: ['20 USC 1011i'],
    deadlines: ['Biennial review', 'Annual distribution'],
    keywords: ['alcohol', 'drugs', 'substance abuse prevention']
  },
  
  // HEOA - Higher Education Opportunity
  'higher-education-opportunity-act-sections-152-and-': {
    name: 'Higher Education Opportunity Act Sections 152 and 153',
    cfrCitations: ['34 CFR 668'],
    uscCitations: ['20 USC 1015b', '20 USC 1015c'],
    deadlines: ['September 1 annually'],
    keywords: ['institutional disclosure', 'textbook information', 'net price calculator']
  },
  
  // ==================== ADDITIONAL KEY REGULATIONS ====================
  
  // Age Discrimination
  'age-discrimination-act-of-1975': {
    name: 'Age Discrimination Act of 1975',
    cfrCitations: ['34 CFR 110'],
    uscCitations: ['42 USC 6101-6107'],
    deadlines: ['Ongoing compliance'],
    keywords: ['age discrimination', 'federal funding']
  },
  
  // OSHA - Workplace Safety
  'occupational-safety-and-health-act-of-1970': {
    name: 'Occupational Safety and Health Act of 1970',
    cfrCitations: ['29 CFR 1910'],
    uscCitations: ['29 USC 651'],
    deadlines: ['Ongoing compliance'],
    keywords: ['workplace safety', 'occupational health', 'emergency action plans']
  }
};

/**
 * Parse CFR citation string into components
 * @param {string} cfrString - e.g., "34 CFR 99" or "34 CFR 668.46"
 * @returns {object} - { title: '34', part: '99', section: null } or { title: '34', part: '668', section: '46' }
 */
export function parseCFRCitation(cfrString) {
  // Handle format: "34 CFR 99" or "34 CFR 668.46"
  const match = cfrString.match(/(\d+)\s+CFR\s+(\d+)(?:\.(\d+))?/);
  
  if (!match) {
    throw new Error(`Invalid CFR citation format: ${cfrString}`);
  }
  
  return {
    title: match[1],
    part: match[2],
    section: match[3] || null,
    fullCitation: cfrString
  };
}

/**
 * Parse USC citation string into components
 * @param {string} uscString - e.g., "20 USC 1092(f)" or "42 USC 12101-12213"
 * @returns {object} - { title: '20', section: '1092', subsection: 'f' }
 */
export function parseUSCCitation(uscString) {
  // Handle format: "20 USC 1092(f)" or "42 USC 12101-12213"
  const match = uscString.match(/(\d+)\s+USC\s+(\d+)(?:\(([a-z])\))?(?:-(\d+))?/);
  
  if (!match) {
    throw new Error(`Invalid USC citation format: ${uscString}`);
  }
  
  return {
    title: match[1],
    section: match[2],
    subsection: match[3] || null,
    endSection: match[4] || null,
    fullCitation: uscString
  };
}

/**
 * Get CFR citation info for a regulation
 * @param {string} regulationId - The regulation slug/ID
 * @returns {object|null} - Regulation citation info or null if not mapped
 */
export function getRegulationCitation(regulationId) {
  // Try exact match first
  if (REGULATION_CFR_MAPPING[regulationId]) {
    return REGULATION_CFR_MAPPING[regulationId];
  }
  
  // Try partial match (handle variations in regulation IDs)
  for (const [key, value] of Object.entries(REGULATION_CFR_MAPPING)) {
    if (regulationId.includes(key) || key.includes(regulationId)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Get all CFR citations for a regulation
 * @param {string} regulationId - The regulation slug/ID
 * @returns {Array} - Array of parsed CFR citation objects
 */
export function getCFRCitations(regulationId) {
  const citation = getRegulationCitation(regulationId);
  if (!citation || !citation.cfrCitations) {
    return [];
  }
  
  return citation.cfrCitations.map(parseCFRCitation);
}

/**
 * Get all USC citations for a regulation
 * @param {string} regulationId - The regulation slug/ID
 * @returns {Array} - Array of parsed USC citation objects
 */
export function getUSCCitations(regulationId) {
  const citation = getRegulationCitation(regulationId);
  if (!citation || !citation.uscCitations) {
    return [];
  }
  
  return citation.uscCitations.map(parseUSCCitation);
}

/**
 * Check if a regulation has CFR citations
 * @param {string} regulationId - The regulation slug/ID
 * @returns {boolean}
 */
export function hasCFRCitations(regulationId) {
  const citations = getCFRCitations(regulationId);
  return citations.length > 0;
}

/**
 * Check if a regulation has USC citations
 * @param {string} regulationId - The regulation slug/ID
 * @returns {boolean}
 */
export function hasUSCCitations(regulationId) {
  const citations = getUSCCitations(regulationId);
  return citations.length > 0;
}

export default {
  REGULATION_CFR_MAPPING,
  parseCFRCitation,
  parseUSCCitation,
  getRegulationCitation,
  getCFRCitations,
  getUSCCitations,
  hasCFRCitations,
  hasUSCCitations
};

