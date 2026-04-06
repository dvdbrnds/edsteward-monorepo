/**
 * Change Classifier
 *
 * Triages raw change signals from the Source Scanner into actionable
 * classifications. This determines whether the Sentinel should run a full
 * LLM workflow and how the result should be delivered.
 *
 * Classifications:
 *   major         — New final rule or signed state law → full workflow + CCO review
 *   routine       — eCFR text drift with no FR rule → full workflow + auto-deliver
 *   informational — Proposed rule / notice → log only, no push
 *   watch         — State bill introduced → log, re-check next cycle
 *   none          — No upstream activity detected
 */

// FR document types that indicate a binding regulatory change
const FINAL_RULE_TYPES = new Set([
  'Rule',
  'Final Rule',
  'Interim Final Rule',
  'Direct Final Rule',
  'Correcting Amendment',
]);

const PROPOSED_TYPES = new Set([
  'Proposed Rule',
  'Advance Notice of Proposed Rulemaking',
]);

const NOTICE_TYPES = new Set([
  'Notice',
  'Presidential Document',
  'Sunshine Act Document',
]);

// State action keywords that indicate a bill has become law
const SIGNED_INTO_LAW_KEYWORDS = [
  'signed by governor',
  'enacted',
  'became law',
  'approved by governor',
  'signed into law',
  'chaptered',
];

const INTRODUCED_KEYWORDS = [
  'introduced',
  'referred to committee',
  'first reading',
  'prefiled',
];

/**
 * Classify a single change signal from the source scanner.
 *
 * @param {object} signal — output of runFullScan per-regulation
 * @returns {object} — { classification, reason, priority, frDocuments, details }
 */
export function classifySignal(signal) {
  const result = {
    regulationId: signal.regulationId,
    slug: signal.slug,
    name: signal.name,
    classification: 'none',
    reason: '',
    priority: 0,          // 0 = skip, 1 = low, 2 = medium, 3 = high, 4 = critical
    needsWorkflow: false,
    deliveryMode: null,    // 'direct_sync' | 'pending_review' | null
    frDocuments: [],
    details: {},
  };

  // ── 1. Check Federal Register signals ──────────────────────────────────

  if (signal.fr && signal.fr.length > 0) {
    const finalRules = signal.fr.filter(d => FINAL_RULE_TYPES.has(d.type));
    const proposedRules = signal.fr.filter(d => PROPOSED_TYPES.has(d.type));
    const notices = signal.fr.filter(d => NOTICE_TYPES.has(d.type));

    if (finalRules.length > 0) {
      result.classification = 'major';
      result.reason = `${finalRules.length} new final rule(s) in Federal Register`;
      result.priority = 4;
      result.needsWorkflow = true;
      result.deliveryMode = 'pending_review';
      result.frDocuments = finalRules;
      result.details.finalRules = finalRules;
      return result;
    }

    if (proposedRules.length > 0) {
      result.classification = 'informational';
      result.reason = `${proposedRules.length} proposed rule(s) in Federal Register`;
      result.priority = 1;
      result.needsWorkflow = false;
      result.deliveryMode = null;
      result.frDocuments = proposedRules;
      result.details.proposedRules = proposedRules;
      // Don't return yet — eCFR might also have changed
    }

    if (notices.length > 0 && result.classification === 'none') {
      result.classification = 'informational';
      result.reason = `${notices.length} notice(s) in Federal Register`;
      result.priority = 1;
      result.needsWorkflow = false;
      result.deliveryMode = null;
      result.frDocuments = notices;
      result.details.notices = notices;
    }
  }

  // ── 2. Check eCFR hash changes ─────────────────────────────────────────

  if (signal.ecfr && signal.ecfr.changed) {
    // eCFR text changed. If we already classified as informational (proposed rule),
    // upgrade to routine since the actual text is different.
    if (result.classification !== 'major') {
      result.classification = 'routine';
      result.reason = result.reason
        ? `${result.reason}; eCFR text hash changed`
        : 'eCFR text content hash changed (no accompanying FR rule)';
      result.priority = Math.max(result.priority, 2);
      result.needsWorkflow = true;
      result.deliveryMode = 'direct_sync';
      result.details.ecfr = {
        oldHash: signal.ecfr.oldHash,
        newHash: signal.ecfr.newHash,
        length: signal.ecfr.length,
      };
    }
  }

  // ── 3. Check state legislative activity ────────────────────────────────

  if (signal.state && signal.state.hasActivity && signal.state.bills.length > 0) {
    for (const bill of signal.state.bills) {
      const action = (bill.latestAction || '').toLowerCase();

      const isSignedIntoLaw = SIGNED_INTO_LAW_KEYWORDS.some(kw => action.includes(kw));
      if (isSignedIntoLaw) {
        result.classification = 'major';
        result.reason = `State bill ${bill.identifier} signed into law`;
        result.priority = 4;
        result.needsWorkflow = true;
        result.deliveryMode = 'pending_review';
        result.details.stateBill = bill;
        return result;
      }

      const isIntroduced = INTRODUCED_KEYWORDS.some(kw => action.includes(kw));
      if (isIntroduced && result.classification === 'none') {
        result.classification = 'watch';
        result.reason = `State bill ${bill.identifier} introduced/in committee`;
        result.priority = 1;
        result.needsWorkflow = false;
        result.deliveryMode = null;
        result.details.stateBill = bill;
      }
    }
  }

  return result;
}

/**
 * Classify all signals from a full scan and sort by priority.
 *
 * @param {object[]} signals - Array of per-regulation signals
 * @returns {object} - { actionable, informational, watching, unchanged, all }
 */
export function classifyAll(signals) {
  const classified = signals.map(classifySignal);

  classified.sort((a, b) => b.priority - a.priority);

  return {
    all: classified,
    actionable: classified.filter(c => c.needsWorkflow),
    informational: classified.filter(c => c.classification === 'informational'),
    watching: classified.filter(c => c.classification === 'watch'),
    unchanged: classified.filter(c => c.classification === 'none'),
  };
}

export default { classifySignal, classifyAll };
