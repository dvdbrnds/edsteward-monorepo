/**
 * Institution Assessment Service
 * 
 * Uses the College Scorecard API (data.ed.gov) to look up any US higher education
 * institution and automatically classify it using EdSteward's two-tier taxonomy.
 * 
 * Data source: https://collegescorecard.ed.gov/data/documentation/
 */

const SCORECARD_API = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY || 'DEMO_KEY';

const SCORECARD_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.zip',
  'school.school_url',
  'school.ownership',
  'school.carnegie_basic',
  'school.carnegie_size_setting',
  'school.religious_affiliation',
  'school.degrees_awarded.predominant',
  'school.degrees_awarded.highest',
  'school.online_only',
  'school.main_campus',
  'school.branches',
  'school.accreditor',
  'school.title_iv.approval_date',
  'latest.student.size',
  'latest.student.enrollment.all',
  'latest.admissions.admission_rate.overall',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.aid.pell_grant_rate',
].join(',');

// College Scorecard ownership codes
const OWNERSHIP = {
  1: 'Public',
  2: 'Private nonprofit',
  3: 'Private for-profit',
};

// Carnegie Basic Classification codes -> labels (subset relevant to mapping)
const CARNEGIE_BASIC = {
  15: 'Doctoral Universities: Very High Research Activity',
  16: 'Doctoral Universities: High Research Activity',
  17: 'Doctoral/Professional Universities',
  18: "Master's Colleges & Universities: Larger Programs",
  19: "Master's Colleges & Universities: Medium Programs",
  20: "Master's Colleges & Universities: Smaller Programs",
  21: "Baccalaureate Colleges: Arts & Sciences Focus",
  22: "Baccalaureate Colleges: Diverse Fields",
  23: "Baccalaureate/Associate's Colleges",
  24: "Associate's Colleges: High Transfer-High Traditional",
  25: "Associate's Colleges: High Transfer-Mixed Traditional",
  26: "Associate's Colleges: High Transfer-High Nontraditional",
  27: "Associate's Colleges: Mixed Transfer/Career-High Traditional",
  28: "Associate's Colleges: Mixed Transfer/Career-Mixed Traditional",
  29: "Associate's Colleges: Mixed Transfer/Career-High Nontraditional",
  30: "Associate's Colleges: High Career-High Traditional",
  31: "Associate's Colleges: High Career-Mixed Traditional",
  32: "Associate's Colleges: High Career-High Nontraditional",
  33: 'Special Focus: Theological Seminaries',
  34: 'Special Focus: Medical Schools & Centers',
  35: 'Special Focus: Health Professions Schools',
  36: 'Special Focus: Engineering Schools',
  37: 'Special Focus: Technology-Related Schools',
  38: 'Special Focus: Business & Management Schools',
  39: 'Special Focus: Arts, Music & Design Schools',
  40: 'Special Focus: Law Schools',
  41: 'Special Focus: Other',
  -2: 'Not applicable / Not classified',
};

// Religious affiliation codes (partial)
const RELIGIOUS_AFFILIATIONS = {
  22: 'American Baptist',
  24: 'American Lutheran',
  27: 'Baptist',
  28: 'Brethren Church',
  30: 'Church of Christ',
  33: 'Church of God',
  34: 'Churches of Christ',
  35: 'Cumberland Presbyterian',
  36: 'Christian Church (Disciples of Christ)',
  37: 'Evangelical Christian',
  38: 'Evangelical Covenant',
  39: 'Evangelical Free Church of America',
  40: 'Evangelical Lutheran Church',
  41: 'Free Methodist',
  42: 'Free Will Baptist',
  43: 'General Baptist',
  44: 'Moravian Church',
  45: 'Mennonite Brethren Church',
  47: 'Mennonite Church',
  48: 'Methodist',
  49: 'Missionary Church',
  51: 'North American Baptist',
  52: 'Pentecostal Holiness Church',
  54: 'Presbyterian Church (USA)',
  55: 'Protestant Episcopal',
  57: 'Reformed Presbyterian Church',
  58: 'Religious Society of Friends',
  59: 'Reformed Church in America',
  60: 'Roman Catholic',
  61: 'Seventh Day Adventist',
  64: 'United Brethren Church',
  65: 'United Methodist',
  66: 'United Church of Christ',
  67: 'Wesleyan',
  68: 'African Methodist Episcopal',
  69: 'American Evangelical Lutheran',
  71: 'Assemblies of God',
  73: 'Christian Reformed',
  74: 'Church of the Brethren',
  75: 'Church of the Nazarene',
  76: 'Cumberland Presbyterian',
  78: 'Greek Orthodox',
  79: 'Jewish',
  80: 'Latter Day Saints',
  81: 'Lutheran Church - Missouri Synod',
  84: 'Other Protestant',
  87: 'Presbyterian Church in America',
  88: 'Undenominational',
  89: 'Unitarian Universalist',
  91: 'Not applicable',
  92: 'Southern Baptist',
  93: 'Other',
  94: 'Multiple',
  95: 'Non-denominational',
  97: 'Christian',
  99: 'Other (non-religious)',
  100: 'Interdenominational',
  101: 'Muslim',
  102: 'Plymouth Brethren',
  103: 'Original Free Will Baptist',
  105: 'Ecumenical Christian',
  106: 'Evangelical Church of North America',
};

/**
 * Map College Scorecard data to EdSteward institution type taxonomy.
 * Returns { primaryType, characteristics }.
 */
function classifyInstitution(data) {
  const ownership = data['school.ownership'];
  const carnegie = data['school.carnegie_basic'];
  const religiousAffiliation = data['school.religious_affiliation'];
  const predominantDegree = data['school.degrees_awarded.predominant'];
  const highestDegree = data['school.degrees_awarded.highest'];
  const onlineOnly = data['school.online_only'];
  const titleIvDate = data['school.title_iv.approval_date'];
  const studentSize = data['latest.student.size'];

  // Tier 1: Primary classification
  let primaryType;
  if (ownership === 3) {
    primaryType = 'private-for-profit';
  } else if (ownership === 1) {
    if (predominantDegree <= 2 || carnegie >= 24 && carnegie <= 32) {
      primaryType = 'public-2year';
    } else {
      primaryType = 'public-4year';
    }
  } else {
    // Private nonprofit
    if (predominantDegree <= 2 || carnegie >= 24 && carnegie <= 32) {
      primaryType = 'private-nonprofit-2year';
    } else {
      primaryType = 'private-nonprofit-4year';
    }
  }

  // Tier 2: Characteristics
  const characteristics = [];

  // Religious affiliation
  if (religiousAffiliation && religiousAffiliation !== 91 && religiousAffiliation !== 99) {
    characteristics.push('religious-affiliation');
  }

  // Research intensive (R1/R2)
  if (carnegie === 15 || carnegie === 16) {
    characteristics.push('research-intensive');
  }

  // Graduate/professional programs
  if (highestDegree >= 4 || carnegie === 17 || (carnegie >= 18 && carnegie <= 20)) {
    characteristics.push('graduate-professional');
  }

  // Medical/health programs
  if (carnegie === 34 || carnegie === 35) {
    characteristics.push('medical-health-programs');
  }

  // Online/distance education
  if (onlineOnly === 1) {
    characteristics.push('online-distance-ed');
  }

  // Title IV participant
  if (titleIvDate) {
    characteristics.push('title-iv-participant');
  }

  // Residential campus: heuristic - most 4-year institutions with 500+ students are residential
  // The Scorecard doesn't have a direct housing field, so we infer
  if (studentSize >= 500 && predominantDegree >= 3 && !onlineOnly) {
    characteristics.push('residential-campus');
  }

  // Intercollegiate athletics: not in Scorecard data, but most 4-year schools with 1000+ students have it
  // Will be flagged as "likely" and can be confirmed by user
  // We don't auto-add this since it's not confirmable from the data

  return { primaryType, characteristics };
}

/**
 * Search for institutions by name using the College Scorecard API.
 */
export async function searchInstitutions(query, limit = 10) {
  const url = `${SCORECARD_API}?school.name=${encodeURIComponent(query)}&fields=${SCORECARD_FIELDS}&api_key=${API_KEY}&per_page=${limit}&sort=latest.student.size:desc`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scorecard API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    total: data.metadata.total,
    results: data.results.map(mapScorecardResult),
  };
}

/**
 * Get a specific institution by its IPEDS Unit ID.
 */
export async function getInstitution(unitId) {
  const url = `${SCORECARD_API}?id=${unitId}&fields=${SCORECARD_FIELDS}&api_key=${API_KEY}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scorecard API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.results.length === 0) return null;
  
  return mapScorecardResult(data.results[0]);
}

function mapScorecardResult(result) {
  const classification = classifyInstitution(result);
  
  return {
    id: result.id,
    name: result['school.name'],
    city: result['school.city'],
    state: result['school.state'],
    zip: result['school.zip'],
    website: result['school.school_url'],
    ownership: OWNERSHIP[result['school.ownership']] || 'Unknown',
    ownershipCode: result['school.ownership'],
    carnegieClassification: CARNEGIE_BASIC[result['school.carnegie_basic']] || 'Not classified',
    carnegieCode: result['school.carnegie_basic'],
    religiousAffiliation: RELIGIOUS_AFFILIATIONS[result['school.religious_affiliation']] || null,
    religiousAffiliationCode: result['school.religious_affiliation'],
    predominantDegree: result['school.degrees_awarded.predominant'],
    highestDegree: result['school.degrees_awarded.highest'],
    accreditor: result['school.accreditor'],
    titleIvApprovalDate: result['school.title_iv.approval_date'],
    onlineOnly: result['school.online_only'] === 1,
    mainCampus: result['school.main_campus'] === 1,
    branches: result['school.branches'],
    studentSize: result['latest.student.size'],
    admissionRate: result['latest.admissions.admission_rate.overall'],
    tuitionInState: result['latest.cost.tuition.in_state'],
    tuitionOutOfState: result['latest.cost.tuition.out_of_state'],
    pellGrantRate: result['latest.aid.pell_grant_rate'],
    // EdSteward classification
    classification,
    allTypes: [classification.primaryType, ...classification.characteristics],
  };
}

/**
 * Get applicable regulations count for given institution types.
 * Queries the engine's regulation database.
 */
export async function getApplicableRegulationCount(types) {
  // This would query the engine DB or the enhanced regulations directory
  // For now, we'll count from the JSON files
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const regDir = path.join(__dirname, '..', '..', 'enhanced-regulations');
  
  const files = fs.readdirSync(regDir).filter(f => f.endsWith('.json'));
  let applicable = 0;
  
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(regDir, file), 'utf-8'));
    const regTypes = content.applicableInstitutions || ['all-institutions'];
    
    if (regTypes.includes('all-institutions')) {
      applicable++;
    } else if (types.some(t => regTypes.includes(t))) {
      applicable++;
    }
  }
  
  return { total: files.length, applicable };
}
