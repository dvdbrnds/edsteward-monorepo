/**
 * Regulation Source Scanner
 *
 * Lightweight government API polling to detect upstream changes to tracked
 * regulations WITHOUT running the full LLM enrichment workflow.
 *
 * Three source strategies:
 *   1. Federal Register — date-filtered document search by CFR citation
 *   2. eCFR — content hash comparison against stored hashes
 *   3. State (Open States / PA legislature) — bill activity checks
 */

import { createHash } from 'crypto';
import { FederalRegisterAPIClient } from '../llm-gateway/federal-register-api-client.js';
import { checkCFRHash } from '../llm-gateway/ecfr-api-client.js';
import { query } from '../services/database.js';

const FR_CLIENT = new FederalRegisterAPIClient({ cacheDuration: 0 });

// Re-export from the workflow engine so we have a single authoritative list
const CFR_MAPPINGS = {
  'jeanne-clery-disclosure-of-campus-security-policy-': { title: '34', part: '668', section: '46', name: 'Clery Act' },
  'clery': { title: '34', part: '668', section: '46', name: 'Clery Act' },
  'ferpa': { title: '34', part: '99', name: 'FERPA' },
  'family-educational-rights-and-privacy-act-ferpa': { title: '34', part: '99', name: 'FERPA' },
  'title-ix': { title: '34', part: '106', name: 'Title IX' },
  'title-ix-of-the-education-amendment-of-1972': { title: '34', part: '106', name: 'Title IX' },
  'americans-with-disabilities-act': { title: '28', part: '35', name: 'ADA' },
  'ada': { title: '28', part: '35', name: 'ADA' },
  'section-504': { title: '34', part: '104', name: 'Section 504' },
  'hipaa': { title: '45', part: '164', name: 'HIPAA' },
  'teach-act': { title: '37', part: '201', name: 'TEACH Act' },
  'osha': { title: '29', part: '1910', name: 'OSHA' },
};

/**
 * Resolve a CFR mapping for a regulation, trying hardcoded map first then DB
 * fields (cfr column, statutory_citation, etc.).
 */
function resolveCFRMapping(regulation) {
  const slug = (regulation.slug || regulation.regulationId || '').toLowerCase();

  for (const [key, mapping] of Object.entries(CFR_MAPPINGS)) {
    if (slug.includes(key) || key.includes(slug.substring(0, 10))) {
      return mapping;
    }
  }

  // Fallback: try to parse from DB fields
  const cfrField = regulation.cfr || regulation.statutory_citation || '';
  const match = cfrField.match(/(\d+)\s*CFR\s*(\d+)(?:\.(\d+))?/i);
  if (match) {
    return { title: match[1], part: match[2], section: match[3] || null, name: regulation.name };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Federal Register Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check the Federal Register for recent documents affecting a specific CFR
 * citation. Returns an array of change signals.
 *
 * @param {object} cfrMapping - { title, part, section?, name? }
 * @param {string} sinceDate  - ISO date string (YYYY-MM-DD)
 * @returns {Promise<object[]>} - Array of FR document signals
 */
export async function scanFederalRegister(cfrMapping, sinceDate) {
  if (!cfrMapping) return [];

  try {
    const searchResults = await FR_CLIENT.searchByCFRCitation(
      `${cfrMapping.title} CFR ${cfrMapping.part}`,
      { limit: 20, startDate: sinceDate, endDate: new Date().toISOString().split('T')[0] }
    );

    if (!searchResults || searchResults.totalCount === 0) return [];

    return (searchResults.documents || []).map(doc => ({
      source: 'federal_register',
      documentNumber: doc.document_number,
      title: doc.title,
      type: doc.type,
      publicationDate: doc.publication_date,
      agencies: doc.agency_names,
      htmlUrl: doc.html_url,
      abstract: doc.abstract,
      cfrTitle: cfrMapping.title,
      cfrPart: cfrMapping.part,
    }));
  } catch (err) {
    console.error(`[Sentinel] FR scan failed for ${cfrMapping.title} CFR ${cfrMapping.part}: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// eCFR Hash Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare the current eCFR text hash with the stored hash for a regulation.
 *
 * @param {object} regulation - DB row with slug, content_hash, etc.
 * @param {object} cfrMapping - { title, part, section? }
 * @returns {Promise<{changed: boolean, oldHash: string|null, newHash: string|null, error?: string}>}
 */
export async function scanECFR(regulation, cfrMapping) {
  if (!cfrMapping) return { changed: false, oldHash: null, newHash: null, skipped: true };

  try {
    const result = await checkCFRHash(cfrMapping.title, cfrMapping.part, {
      section: cfrMapping.section,
      name: cfrMapping.name,
    });

    if (result.error) {
      return { changed: false, oldHash: null, newHash: null, error: result.error };
    }

    const storedHash = regulation.content_hash || regulation.version_hash || null;
    const changed = storedHash ? storedHash !== result.hash : false;

    return {
      changed,
      oldHash: storedHash,
      newHash: result.hash,
      length: result.length,
    };
  } catch (err) {
    console.error(`[Sentinel] eCFR scan failed for ${regulation.slug}: ${err.message}`);
    return { changed: false, oldHash: null, newHash: null, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State Source Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check Open States for recent legislative activity affecting a state regulation.
 * This is a lightweight metadata-only check (no full text fetch).
 *
 * @param {object} regulation - DB row
 * @returns {Promise<{hasActivity: boolean, bills: object[]}>}
 */
export async function scanStateSource(regulation) {
  const stateCode = regulation.state_code;
  if (!stateCode) return { hasActivity: false, bills: [] };

  const apiKey = process.env.OPEN_STATES_API_KEY;
  if (!apiKey) return { hasActivity: false, bills: [], skipped: true, reason: 'no_api_key' };

  try {
    const jurisdiction = stateCode.toLowerCase();
    const searchTerms = (regulation.name || '').split(/\s+/).slice(0, 3).join(' ');
    const url = `https://v3.openstates.org/bills?jurisdiction=${jurisdiction}&q=${encodeURIComponent(searchTerms)}&sort=updated_desc&per_page=5&apikey=${apiKey}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'MCP-Engine-Sentinel/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return { hasActivity: false, bills: [], error: `HTTP ${response.status}` };

    const data = await response.json();
    const recentBills = (data.results || []).filter(bill => {
      const updated = new Date(bill.updated_at || bill.latest_action_date || 0);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return updated > cutoff;
    });

    return {
      hasActivity: recentBills.length > 0,
      bills: recentBills.map(b => ({
        id: b.id,
        identifier: b.identifier,
        title: b.title,
        latestAction: b.latest_action_description,
        latestActionDate: b.latest_action_date,
        updatedAt: b.updated_at,
      })),
    };
  } catch (err) {
    console.error(`[Sentinel] State scan failed for ${regulation.slug}: ${err.message}`);
    return { hasActivity: false, bills: [], error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Scan Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all tracked regulations from the engine database.
 */
export async function loadTrackedRegulations() {
  const result = await query(`
    SELECT id, item_id AS slug, name, jurisdiction_source,
           state_code, cfr, statute AS statutory_citation,
           content_hash, version_hash, updated_at
    FROM regulations
    WHERE is_current = TRUE
    ORDER BY name
  `);
  return result.rows;
}

/**
 * Run a full scan across all tracked regulations.
 *
 * @param {object} options
 * @param {string} options.sinceDate - ISO date for FR lookback window
 * @param {number} options.concurrency - Max parallel scans (default 5)
 * @param {function} options.onSignal - Callback for each change signal
 * @returns {Promise<object>} - Scan summary
 */
export async function runFullScan(options = {}) {
  const sinceDate = options.sinceDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();

  const concurrency = options.concurrency || 5;
  const onSignal = options.onSignal || (() => {});

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🛰️  REGULATION SENTINEL — FULL SOURCE SCAN`);
  console.log(`  Looking back to: ${sinceDate}`);
  console.log(`${'═'.repeat(70)}\n`);

  const regulations = await loadTrackedRegulations();
  console.log(`[Sentinel] Scanning ${regulations.length} tracked regulations...`);

  const summary = {
    startedAt: new Date().toISOString(),
    regulationsScanned: regulations.length,
    frSignals: 0,
    ecfrChanges: 0,
    stateActivity: 0,
    errors: 0,
    signals: [],
  };

  // Process in batches
  for (let i = 0; i < regulations.length; i += concurrency) {
    const batch = regulations.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (reg) => {
        const cfrMapping = resolveCFRMapping(reg);
        const signal = {
          regulationId: reg.id,
          slug: reg.slug,
          name: reg.name,
          jurisdiction: reg.jurisdiction_source,
          stateCode: reg.state_code,
          fr: [],
          ecfr: null,
          state: null,
        };

        // Federal regulations: check FR + eCFR
        if (reg.jurisdiction_source === 'federal' || !reg.jurisdiction_source) {
          const [frDocs, ecfrResult] = await Promise.all([
            scanFederalRegister(cfrMapping, sinceDate),
            scanECFR(reg, cfrMapping),
          ]);
          signal.fr = frDocs;
          signal.ecfr = ecfrResult;
        }

        // State regulations: check state sources + optionally FR for cross-refs
        if (reg.jurisdiction_source === 'state') {
          signal.state = await scanStateSource(reg);
          if (cfrMapping) {
            signal.fr = await scanFederalRegister(cfrMapping, sinceDate);
          }
        }

        return signal;
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        summary.errors++;
        continue;
      }

      const signal = result.value;
      const hasChanges =
        signal.fr.length > 0 ||
        (signal.ecfr && signal.ecfr.changed) ||
        (signal.state && signal.state.hasActivity);

      if (hasChanges) {
        summary.signals.push(signal);
        summary.frSignals += signal.fr.length;
        if (signal.ecfr?.changed) summary.ecfrChanges++;
        if (signal.state?.hasActivity) summary.stateActivity++;

        onSignal(signal);
      }
    }

    if (i + concurrency < regulations.length) {
      console.log(`[Sentinel] Scanned ${Math.min(i + concurrency, regulations.length)}/${regulations.length}...`);
    }
  }

  summary.completedAt = new Date().toISOString();
  summary.durationMs = new Date(summary.completedAt) - new Date(summary.startedAt);

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  Scan complete in ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Regulations scanned: ${summary.regulationsScanned}`);
  console.log(`  Federal Register signals: ${summary.frSignals}`);
  console.log(`  eCFR content changes: ${summary.ecfrChanges}`);
  console.log(`  State activity: ${summary.stateActivity}`);
  console.log(`  Errors: ${summary.errors}`);
  console.log(`${'─'.repeat(70)}\n`);

  return summary;
}

export default {
  scanFederalRegister,
  scanECFR,
  scanStateSource,
  loadTrackedRegulations,
  runFullScan,
  resolveCFRMapping,
};
