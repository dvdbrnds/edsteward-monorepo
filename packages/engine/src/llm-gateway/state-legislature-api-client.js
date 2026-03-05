/**
 * State Legislature & Administrative Code API Client
 * 
 * Fetches REAL statute text from state government sources.
 * This is the state-level equivalent of ecfr-api-client.js
 * 
 * Source Priority:
 *   1. Enhanced regulation JSON (curated, always available)
 *   2. Open States API (structured, reliable, free tier)
 *   3. State legislature website (authoritative but often slow)
 *   4. State administrative code (implementing regulations)
 * 
 * Currently supported: Pennsylvania (PA)
 * Architecture: Extensible for any US state
 */

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const OPEN_STATES_API = 'https://v3.openstates.org';
const USER_AGENT = 'MCP-Engine-Compliance-Platform/2.0 (Educational Compliance; contact@mcp-engine.com)';

// ============================================================================
// STATE SOURCE REGISTRY
// Each state defines its authoritative sources for statute text
// ============================================================================
const STATE_SOURCES = {
  PA: {
    name: 'Pennsylvania',
    legislature: {
      baseUrl: 'https://www.legis.state.pa.us',
      statuteUrl: 'https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm',
      billInfoUrl: 'https://www.legis.state.pa.us/cfdocs/billInfo/billInfo.cfm',
      xmlDataUrl: 'https://www.legis.state.pa.us/Data/',
    },
    adminCode: {
      baseUrl: 'https://www.pacodeandbulletin.gov',
      displayUrl: 'https://www.pacodeandbulletin.gov/Display/pacode',
    },
    agencies: {
      education: {
        name: 'Pennsylvania Department of Education',
        url: 'https://www.education.pa.gov',
      },
    },
    openStatesJurisdiction: 'pa',
  },
};

// ============================================================================
// STATE STATUTE MAPPINGS (analogous to CFR_MAPPINGS for federal)
// Maps regulation slugs → state-specific source coordinates
// ============================================================================
const STATE_STATUTE_MAPPINGS = {
  'pennsylvania-act-55-of-2022-sexual-violence-higher-ed': {
    state: 'PA',
    actNumber: 55,
    actYear: 2022,
    sessionYear: 2021,
    sessionIndex: 0,
    billBody: 'H',
    billType: 'B',
    billNumber: 1642,
    consolidatedStatute: '24 P.S. § 20-2001-G et seq.',
    paCodeTitle: '22',
    paCodeChapter: null,
    searchTerms: ['sexual violence', 'higher education', 'memorandum of understanding', 'Act 55'],
    name: 'PA Act 55 of 2022 - Sexual Violence in Higher Ed',
    department: 'education',
    openStatesBillId: 'HB 1642',
    openStatesSession: '2021-2022',
  },
  'pennsylvania-sexual-violence-education-act': {
    state: 'PA',
    actNumber: 16,
    actYear: 2014,
    sessionYear: 2013,
    sessionIndex: 0,
    billBody: 'H',
    billType: 'B',
    billNumber: 1716,
    consolidatedStatute: '24 P.S. § 20-2001-F et seq.',
    paCodeTitle: '22',
    paCodeChapter: null,
    searchTerms: ['sexual violence education', 'K-12', 'Act 16'],
    name: 'PA Act 16 of 2014 - Sexual Violence Education',
    department: 'education',
    openStatesBillId: 'HB 1716',
    openStatesSession: '2013-2014',
  },
  'pennsylvania-english-fluency-in-higher-education-a': {
    state: 'PA',
    actNumber: 36,
    actYear: 1990,
    sessionYear: 1989,
    sessionIndex: 0,
    consolidatedStatute: '24 P.S. § 6803 et seq.',
    searchTerms: ['english fluency', 'higher education', 'faculty proficiency'],
    name: 'PA Act 36 of 1990 - English Fluency in Higher Ed',
    department: 'education',
    openStatesSession: '1989-1990',
  },
  'pennsylvania-uniform-crime-reporting-act': {
    state: 'PA',
    consolidatedStatute: '18 Pa.C.S. § 20',
    searchTerms: ['uniform crime reporting', 'crime statistics'],
    name: 'PA Uniform Crime Reporting Act',
    department: null,
  },
  'pennsylvania-higher-education-gift-disclosure-act': {
    state: 'PA',
    consolidatedStatute: '24 P.S. § 26-2601-E et seq.',
    searchTerms: ['gift disclosure', 'higher education', 'foreign gifts'],
    name: 'PA Higher Education Gift Disclosure Act',
    department: 'education',
  },
  'pennsylvania-student-consumer-protection': {
    state: 'PA',
    consolidatedStatute: '24 P.S. § 6510 et seq.',
    searchTerms: ['student consumer protection', 'proprietary schools'],
    name: 'PA Student Consumer Protection',
    department: 'education',
  },
  'pennsylvania-graduation-rates-reporting-act': {
    state: 'PA',
    consolidatedStatute: '24 P.S. § 6801 et seq.',
    searchTerms: ['graduation rates', 'reporting', 'higher education'],
    name: 'PA Graduation Rates Reporting Act',
    department: 'education',
  },
  'pennsylvania-higher-education-standards': {
    state: 'PA',
    paCodeTitle: '22',
    paCodeChapter: '31',
    searchTerms: ['higher education standards', 'institutional approval'],
    name: 'PA Higher Education Standards',
    department: 'education',
  },
  'pennsylvania-institutional-accreditation': {
    state: 'PA',
    paCodeTitle: '22',
    paCodeChapter: '33',
    searchTerms: ['institutional accreditation', 'degree-granting'],
    name: 'PA Institutional Accreditation Requirements',
    department: 'education',
  },
};


/**
 * Get state statute mapping for a regulation slug
 */
export function getStateMapping(slug) {
  const lowerSlug = slug.toLowerCase();

  for (const [key, mapping] of Object.entries(STATE_STATUTE_MAPPINGS)) {
    if (lowerSlug === key || lowerSlug.includes(key) || key.includes(lowerSlug.substring(0, 15))) {
      return mapping;
    }
  }

  return null;
}

/**
 * Detect if a regulation slug is a state regulation
 */
export function isStateRegulation(slug) {
  if (getStateMapping(slug)) return true;

  const statePatterns = [
    /^(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new-hampshire|new-jersey|new-mexico|new-york|north-carolina|north-dakota|ohio|oklahoma|oregon|pennsylvania|rhode-island|south-carolina|south-dakota|tennessee|texas|utah|vermont|virginia|washington|west-virginia|wisconsin|wyoming)-/i,
  ];
  return statePatterns.some(p => p.test(slug));
}

/**
 * Detect state code from slug
 */
export function detectStateCode(slug) {
  const stateMap = {
    'pennsylvania': 'PA', 'california': 'CA', 'new-york': 'NY', 'texas': 'TX',
    'florida': 'FL', 'illinois': 'IL', 'ohio': 'OH', 'michigan': 'MI',
    'georgia': 'GA', 'north-carolina': 'NC', 'new-jersey': 'NJ', 'virginia': 'VA',
    'washington': 'WA', 'arizona': 'AZ', 'massachusetts': 'MA', 'tennessee': 'TN',
    'indiana': 'IN', 'missouri': 'MO', 'maryland': 'MD', 'wisconsin': 'WI',
    'colorado': 'CO', 'minnesota': 'MN', 'south-carolina': 'SC', 'alabama': 'AL',
    'louisiana': 'LA', 'kentucky': 'KY', 'oregon': 'OR', 'oklahoma': 'OK',
    'connecticut': 'CT', 'utah': 'UT', 'iowa': 'IA', 'nevada': 'NV',
    'arkansas': 'AR', 'mississippi': 'MS', 'kansas': 'KS', 'new-mexico': 'NM',
    'nebraska': 'NE', 'idaho': 'ID', 'west-virginia': 'WV', 'hawaii': 'HI',
    'new-hampshire': 'NH', 'maine': 'ME', 'montana': 'MT', 'rhode-island': 'RI',
    'delaware': 'DE', 'south-dakota': 'SD', 'north-dakota': 'ND', 'alaska': 'AK',
    'vermont': 'VT', 'wyoming': 'WY',
  };

  for (const [name, code] of Object.entries(stateMap)) {
    if (slug.toLowerCase().startsWith(name)) return code;
  }
  return null;
}


// ============================================================================
// SOURCE 1: ENHANCED REGULATION JSON (fastest, always available)
// ============================================================================

/**
 * Fetch statute text from our curated enhanced regulation JSON files
 */
export async function fetchFromEnhancedRegulation(regulationSlug) {
  try {
    const filePath = resolve(PROJECT_ROOT, 'enhanced-regulations', `${regulationSlug}.json`);

    if (!existsSync(filePath)) {
      console.log(`   ⚠️  No enhanced regulation JSON found for: ${regulationSlug}`);
      return { success: false, source: 'enhanced-regulation-json', error: 'File not found' };
    }

    const rawData = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const fullText = data.enhanced?.fullText || '';
    const summary = data.enhanced?.summary || '';
    const requirements = data.enhanced?.requirements || '';
    const statute = data.jurisdiction?.actNumber || data.statute || '';
    const stateCode = data.jurisdiction?.stateCodes?.[0] || '';
    const regulatoryBody = data.jurisdiction?.regulatoryBody || '';

    if (!fullText && !requirements) {
      return { success: false, source: 'enhanced-regulation-json', error: 'No text content in JSON' };
    }

    console.log(`   ✅ Loaded from enhanced regulation JSON (${fullText.length} chars)`);

    return {
      success: true,
      source: 'enhanced-regulation-json',
      fullText,
      summary,
      requirements,
      statute,
      stateCode,
      regulatoryBody,
      deadlines: data.deadlines || [],
      penalties: data.penalties || [],
      lastModified: data.lastModified || null,
      citation: data.statute || statute,
      length: fullText.length,
    };
  } catch (error) {
    console.error(`   ❌ Failed to read enhanced regulation JSON: ${error.message}`);
    return { success: false, source: 'enhanced-regulation-json', error: error.message };
  }
}


// ============================================================================
// SOURCE 2: OPEN STATES API (structured, reliable)
// ============================================================================

/**
 * Fetch bill data from Open States API
 */
export async function fetchFromOpenStates(stateCode, mapping) {
  const apiKey = process.env.OPEN_STATES_API_KEY;
  if (!apiKey) {
    console.log(`   ⚠️  No OPEN_STATES_API_KEY configured — skipping Open States`);
    return { success: false, source: 'open-states', error: 'No API key configured' };
  }

  if (!mapping?.openStatesBillId || !mapping?.openStatesSession) {
    console.log(`   ⚠️  No Open States bill ID mapped for this regulation`);
    return { success: false, source: 'open-states', error: 'No bill ID mapped' };
  }

  const jurisdiction = STATE_SOURCES[stateCode]?.openStatesJurisdiction || stateCode.toLowerCase();

  try {
    const billUrl = `${OPEN_STATES_API}/bills/${jurisdiction}/${encodeURIComponent(mapping.openStatesSession)}/${encodeURIComponent(mapping.openStatesBillId)}?include=versions&include=documents&include=actions`;
    console.log(`   🌐 Open States: GET ${billUrl}`);

    const response = await fetch(billUrl, {
      headers: {
        'X-API-KEY': apiKey,
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`Open States API returned ${response.status}: ${response.statusText}`);
    }

    const billData = await response.json();

    let fullText = '';
    const latestVersion = billData.versions?.[billData.versions.length - 1];
    if (latestVersion?.links?.[0]?.url) {
      try {
        console.log(`   📄 Fetching bill text from: ${latestVersion.links[0].url}`);
        const textResponse = await fetch(latestVersion.links[0].url, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 20000,
        });
        if (textResponse.ok) {
          const rawHtml = await textResponse.text();
          fullText = rawHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch (textErr) {
        console.warn(`   ⚠️  Could not fetch bill text: ${textErr.message}`);
      }
    }

    const actions = (billData.actions || []).map(a => ({
      date: a.date,
      description: a.description,
      classification: a.classification,
      chamber: a.organization?.classification,
    }));

    console.log(`   ✅ Open States: Got bill data (${actions.length} actions, text: ${fullText.length} chars)`);

    return {
      success: true,
      source: 'open-states',
      billId: billData.identifier,
      title: billData.title,
      session: billData.session,
      chamber: billData.from_organization?.classification,
      actions,
      fullText,
      versions: (billData.versions || []).map(v => ({
        note: v.note,
        date: v.date,
        links: v.links,
      })),
      subjects: billData.subject || [],
      sponsors: (billData.sponsorships || []).map(s => s.name),
      lastAction: actions[actions.length - 1] || null,
      url: `https://openstates.org/${jurisdiction}/bills/${encodeURIComponent(mapping.openStatesSession)}/${encodeURIComponent(mapping.openStatesBillId)}/`,
    };
  } catch (error) {
    console.error(`   ❌ Open States fetch failed: ${error.message}`);
    return { success: false, source: 'open-states', error: error.message };
  }
}


// ============================================================================
// SOURCE 3: PA LEGISLATURE WEBSITE (authoritative, but slow)
// ============================================================================

/**
 * Fetch statute text from PA General Assembly website
 * Uses the unconsolidated statute check endpoint
 */
export async function fetchFromPALegislature(mapping) {
  if (!mapping?.actYear || !mapping?.actNumber) {
    return { success: false, source: 'pa-legislature', error: 'No act year/number in mapping' };
  }

  const url = `https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?yr=${mapping.actYear}&sessInd=${mapping.sessionIndex || 0}&act=${mapping.actNumber}`;

  try {
    console.log(`   🏛️  PA Legislature: GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`PA Legislature returned ${response.status}`);
    }

    const html = await response.text();

    // Extract statute text from HTML
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (textContent.length < 100) {
      return { success: false, source: 'pa-legislature', error: 'Retrieved content too short — likely error page' };
    }

    console.log(`   ✅ PA Legislature: Got statute text (${textContent.length} chars)`);

    return {
      success: true,
      source: 'pa-legislature',
      fullText: textContent,
      url,
      citation: `Act ${mapping.actNumber} of ${mapping.actYear}`,
      length: textContent.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`   ⚠️  PA Legislature timed out (12s) — site is often slow`);
      return { success: false, source: 'pa-legislature', error: 'Request timed out' };
    }
    console.error(`   ❌ PA Legislature fetch failed: ${error.message}`);
    return { success: false, source: 'pa-legislature', error: error.message };
  }
}


// ============================================================================
// SOURCE 4: PA CODE & BULLETIN (administrative regulations)
// ============================================================================

/**
 * Fetch administrative code sections from PA Code and Bulletin
 * PA Code is the state equivalent of the federal CFR
 */
export async function fetchFromPACode(mapping) {
  if (!mapping?.paCodeTitle) {
    return { success: false, source: 'pa-code', error: 'No PA Code title in mapping' };
  }

  const title = mapping.paCodeTitle;
  const chapter = mapping.paCodeChapter;
  const path = chapter
    ? `/secure/pacode/data/${title.padStart(3, '0')}/chapter${chapter}toc.html`
    : `/secure/pacode/data/${title.padStart(3, '0')}/${title.padStart(3, '0')}toc.html`;

  const url = `https://www.pacodeandbulletin.gov/Display/pacode?file=${encodeURIComponent(path)}`;

  try {
    console.log(`   📜 PA Code: GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`PA Code returned ${response.status}`);
    }

    const html = await response.text();
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const citation = chapter
      ? `${title} Pa. Code Ch. ${chapter}`
      : `${title} Pa. Code`;

    console.log(`   ✅ PA Code: Got administrative code (${textContent.length} chars)`);

    return {
      success: true,
      source: 'pa-code',
      fullText: textContent,
      url,
      citation,
      title,
      chapter,
      length: textContent.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`   ⚠️  PA Code timed out (12s)`);
      return { success: false, source: 'pa-code', error: 'Request timed out' };
    }
    console.error(`   ❌ PA Code fetch failed: ${error.message}`);
    return { success: false, source: 'pa-code', error: error.message };
  }
}


// ============================================================================
// MAIN ENTRY POINT: fetchStateStatute()
// Mirrors fetchCFRPart() from ecfr-api-client.js
// ============================================================================

/**
 * Fetch state statute text using all available sources
 * Tries sources in priority order and combines results
 * 
 * @param {string} regulationSlug - Regulation identifier
 * @param {object} mapping - State statute mapping (from STATE_STATUTE_MAPPINGS)
 * @returns {Promise<object>} - Combined statute data from all successful sources
 */
export async function fetchStateStatute(regulationSlug, mapping = null) {
  const effectiveMapping = mapping || getStateMapping(regulationSlug);

  if (!effectiveMapping) {
    console.warn(`⚠️  No state statute mapping for: ${regulationSlug}`);
    return {
      success: false,
      regulationSlug,
      error: 'No state statute mapping found',
      sources: {},
    };
  }

  const stateCode = effectiveMapping.state || detectStateCode(regulationSlug);
  const stateName = STATE_SOURCES[stateCode]?.name || stateCode;

  console.log(`\n🏛️  FETCHING STATE STATUTE: ${effectiveMapping.name || regulationSlug}`);
  console.log(`   State: ${stateName} (${stateCode})`);
  console.log(`   Citation: ${effectiveMapping.consolidatedStatute || 'N/A'}`);
  console.log(`   Source priority: Enhanced JSON → Open States → Legislature → Admin Code`);

  const sources = {};

  // SOURCE 1: Enhanced regulation JSON (always try first — fastest)
  sources.enhancedJson = await fetchFromEnhancedRegulation(regulationSlug);

  // SOURCE 2: Open States API (if API key configured)
  sources.openStates = await fetchFromOpenStates(stateCode, effectiveMapping);

  // SOURCE 3: State legislature website (try in parallel with admin code)
  const [legislatureResult, adminCodeResult] = await Promise.allSettled([
    stateCode === 'PA' ? fetchFromPALegislature(effectiveMapping) : Promise.resolve({ success: false, source: 'legislature', error: 'State not supported' }),
    stateCode === 'PA' && effectiveMapping.paCodeTitle ? fetchFromPACode(effectiveMapping) : Promise.resolve({ success: false, source: 'admin-code', error: 'No admin code mapping' }),
  ]);

  sources.legislature = legislatureResult.status === 'fulfilled' ? legislatureResult.value : { success: false, source: 'legislature', error: legislatureResult.reason?.message };
  sources.adminCode = adminCodeResult.status === 'fulfilled' ? adminCodeResult.value : { success: false, source: 'admin-code', error: adminCodeResult.reason?.message };

  // Determine primary text (best available)
  const primaryText = sources.enhancedJson?.fullText
    || sources.legislature?.fullText
    || sources.openStates?.fullText
    || sources.adminCode?.fullText
    || '';

  const successfulSources = Object.entries(sources).filter(([, v]) => v.success).map(([k]) => k);

  console.log(`\n   📊 State source results:`);
  console.log(`      - Enhanced JSON: ${sources.enhancedJson?.success ? '✅' : '❌'} ${sources.enhancedJson?.success ? `(${sources.enhancedJson.length} chars)` : sources.enhancedJson?.error}`);
  console.log(`      - Open States:   ${sources.openStates?.success ? '✅' : '⚠️ '} ${sources.openStates?.success ? `(${sources.openStates.fullText?.length || 0} chars, ${sources.openStates.actions?.length || 0} actions)` : sources.openStates?.error}`);
  console.log(`      - Legislature:   ${sources.legislature?.success ? '✅' : '⚠️ '} ${sources.legislature?.success ? `(${sources.legislature.length} chars)` : sources.legislature?.error}`);
  console.log(`      - Admin Code:    ${sources.adminCode?.success ? '✅' : '⚠️ '} ${sources.adminCode?.success ? `(${sources.adminCode.length} chars)` : sources.adminCode?.error}`);
  console.log(`      Total successful: ${successfulSources.length}/4`);

  return {
    success: successfulSources.length > 0,
    regulationSlug,
    stateCode,
    stateName,
    mapping: effectiveMapping,
    citation: effectiveMapping.consolidatedStatute || '',

    fullText: primaryText,
    length: primaryText.length,

    requirements: sources.enhancedJson?.requirements || '',
    summary: sources.enhancedJson?.summary || '',
    deadlines: sources.enhancedJson?.deadlines || [],
    penalties: sources.enhancedJson?.penalties || [],

    legislativeHistory: sources.openStates?.success ? {
      billId: sources.openStates.billId,
      title: sources.openStates.title,
      session: sources.openStates.session,
      actions: sources.openStates.actions,
      sponsors: sources.openStates.sponsors,
      lastAction: sources.openStates.lastAction,
    } : null,

    adminCode: sources.adminCode?.success ? {
      citation: sources.adminCode.citation,
      fullText: sources.adminCode.fullText,
      url: sources.adminCode.url,
    } : null,

    sources,
    successfulSources,

    sourceValidation: {
      enhancedJson: { status: sources.enhancedJson?.success ? 'verified' : 'unavailable' },
      openStates: { status: sources.openStates?.success ? 'verified' : sources.openStates?.error === 'No API key configured' ? 'unconfigured' : 'unavailable' },
      legislature: { status: sources.legislature?.success ? 'verified' : 'unavailable', url: sources.legislature?.url },
      adminCode: { status: sources.adminCode?.success ? 'verified' : 'unavailable', url: sources.adminCode?.url },
      lastChecked: new Date().toISOString(),
    },

    date: new Date().toISOString().split('T')[0],
    source: `${stateName} State Sources`,
  };
}


// ============================================================================
// HELPER: Get state source info for display
// ============================================================================

export function getStateSourceInfo(stateCode) {
  return STATE_SOURCES[stateCode] || null;
}

export function getAllStateMappings() {
  return STATE_STATUTE_MAPPINGS;
}

export function getStateMappingsForState(stateCode) {
  return Object.fromEntries(
    Object.entries(STATE_STATUTE_MAPPINGS).filter(([, m]) => m.state === stateCode)
  );
}


export default {
  fetchStateStatute,
  getStateMapping,
  isStateRegulation,
  detectStateCode,
  getStateSourceInfo,
  getAllStateMappings,
  getStateMappingsForState,
  fetchFromEnhancedRegulation,
  fetchFromOpenStates,
  fetchFromPALegislature,
  fetchFromPACode,
};
