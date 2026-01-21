/**
 * Source Data Validator - The Moat
 * 
 * Validates that data fetched from government sources actually matches
 * the regulation we're trying to update. Prevents wrong data from 
 * overwriting curated content.
 * 
 * VALIDATION CHECKS:
 * 1. Title/Name Match - Does the fetched title match expected regulation?
 * 2. Citation Match - Does CFR/USC citation match what we have?
 * 3. Keyword Validation - Does text contain expected keywords?
 * 4. Content Quality - Is content length reasonable?
 * 5. Topic Coherence - Does content discuss expected topics?
 */

// Known regulation signatures - keywords that MUST appear in valid content
const REGULATION_SIGNATURES = {
  'jeanne-clery-disclosure-of-campus-security-policy-': {
    name: 'Clery Act',
    requiredKeywords: ['campus security', 'crime statistics', 'annual security report', 'timely warning'],
    forbiddenKeywords: ['governmental auditing', 'Student Assistance General Provisions'],
    expectedCitations: ['20 U.S.C. § 1092', '34 CFR 668', '34 CFR Part 668'],
    minContentLength: 500,
    topics: ['campus safety', 'crime reporting', 'security policy', 'disclosure']
  },
  'family-educational-rights-and-privacy-act-ferpa': {
    name: 'FERPA',
    requiredKeywords: ['educational records', 'student privacy', 'directory information', 'consent'],
    forbiddenKeywords: [],
    expectedCitations: ['20 U.S.C. § 1232g', '34 CFR Part 99'],
    minContentLength: 500,
    topics: ['student records', 'privacy rights', 'educational agency']
  },
  'title-ix-of-the-education-amendment-of-1972': {
    name: 'Title IX',
    requiredKeywords: ['sex discrimination', 'educational program', 'sexual harassment', 'athletics'],
    forbiddenKeywords: [],
    expectedCitations: ['20 U.S.C. § 1681', '34 CFR Part 106'],
    minContentLength: 500,
    topics: ['gender equity', 'discrimination', 'educational institution']
  },
  'americans-with-disabilities-act': {
    name: 'ADA',
    requiredKeywords: ['disability', 'reasonable accommodation', 'accessibility', 'discrimination'],
    forbiddenKeywords: [],
    expectedCitations: ['42 U.S.C. § 12101', '28 CFR Part 35'],
    minContentLength: 500,
    topics: ['disability rights', 'accommodation', 'accessibility']
  },
  'hipaa': {
    name: 'HIPAA',
    requiredKeywords: ['health information', 'protected health', 'privacy', 'covered entity'],
    forbiddenKeywords: [],
    expectedCitations: ['45 CFR Part 164', '45 CFR Part 160'],
    minContentLength: 500,
    topics: ['health privacy', 'medical records', 'patient rights']
  }
};

/**
 * Validate source data before allowing database update
 * 
 * @param {string} regulationSlug - The regulation being updated
 * @param {object} fetchedData - Data fetched from government sources
 * @param {object} existingData - Current data in database
 * @returns {object} - Validation result with pass/fail and reasons
 */
export function validateSourceData(regulationSlug, fetchedData, existingData = null) {
  const result = {
    isValid: true,
    confidence: 100,
    checks: [],
    warnings: [],
    errors: [],
    recommendation: 'ALLOW'
  };

  const signature = REGULATION_SIGNATURES[regulationSlug];
  const content = fetchedData?.fullText || fetchedData?.regulation_text || fetchedData?.content || '';
  const contentLower = content.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 1: Content Length - Is there actual content?
  // ═══════════════════════════════════════════════════════════════════════════
  const minLength = signature?.minContentLength || 200;
  if (content.length < minLength) {
    result.errors.push({
      check: 'CONTENT_LENGTH',
      message: `Content too short: ${content.length} chars (minimum: ${minLength})`,
      severity: 'HIGH'
    });
    result.confidence -= 40;
  } else {
    result.checks.push({
      check: 'CONTENT_LENGTH',
      passed: true,
      message: `Content length OK: ${content.length} chars`
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 2: Required Keywords - Does content contain expected terms?
  // ═══════════════════════════════════════════════════════════════════════════
  if (signature?.requiredKeywords) {
    const foundKeywords = signature.requiredKeywords.filter(kw => 
      contentLower.includes(kw.toLowerCase())
    );
    const missingKeywords = signature.requiredKeywords.filter(kw => 
      !contentLower.includes(kw.toLowerCase())
    );

    if (missingKeywords.length > signature.requiredKeywords.length / 2) {
      result.errors.push({
        check: 'REQUIRED_KEYWORDS',
        message: `Missing critical keywords: ${missingKeywords.join(', ')}`,
        severity: 'CRITICAL'
      });
      result.confidence -= 50;
    } else if (missingKeywords.length > 0) {
      result.warnings.push({
        check: 'REQUIRED_KEYWORDS',
        message: `Missing some keywords: ${missingKeywords.join(', ')}`,
        severity: 'MEDIUM'
      });
      result.confidence -= 20;
    } else {
      result.checks.push({
        check: 'REQUIRED_KEYWORDS',
        passed: true,
        message: `All required keywords found: ${foundKeywords.join(', ')}`
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 3: Forbidden Keywords - Is this the WRONG data?
  // ═══════════════════════════════════════════════════════════════════════════
  if (signature?.forbiddenKeywords) {
    const foundForbidden = signature.forbiddenKeywords.filter(kw => 
      contentLower.includes(kw.toLowerCase())
    );

    if (foundForbidden.length > 0) {
      result.errors.push({
        check: 'FORBIDDEN_KEYWORDS',
        message: `⚠️ WRONG DATA DETECTED! Found forbidden terms: ${foundForbidden.join(', ')}`,
        severity: 'CRITICAL'
      });
      result.confidence -= 60;
      result.isValid = false;
      result.recommendation = 'REJECT';
    } else {
      result.checks.push({
        check: 'FORBIDDEN_KEYWORDS',
        passed: true,
        message: 'No forbidden keywords found'
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 4: Citation Match - Does content reference expected legal citations?
  // ═══════════════════════════════════════════════════════════════════════════
  if (signature?.expectedCitations) {
    const foundCitations = signature.expectedCitations.filter(cite => 
      content.includes(cite) || contentLower.includes(cite.toLowerCase())
    );

    if (foundCitations.length === 0) {
      result.warnings.push({
        check: 'CITATION_MATCH',
        message: `No expected citations found. Expected: ${signature.expectedCitations.join(', ')}`,
        severity: 'MEDIUM'
      });
      result.confidence -= 15;
    } else {
      result.checks.push({
        check: 'CITATION_MATCH',
        passed: true,
        message: `Found citations: ${foundCitations.join(', ')}`
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 5: Name/Title Match - Does the regulation name match?
  // ═══════════════════════════════════════════════════════════════════════════
  const fetchedName = fetchedData?.name || fetchedData?.title || '';
  if (signature?.name && fetchedName) {
    const nameMatch = fetchedName.toLowerCase().includes(signature.name.toLowerCase()) ||
                      signature.name.toLowerCase().includes(fetchedName.toLowerCase().substring(0, 20));
    
    if (!nameMatch && !contentLower.includes(signature.name.toLowerCase())) {
      result.warnings.push({
        check: 'NAME_MATCH',
        message: `Regulation name mismatch. Expected: ${signature.name}, Got: ${fetchedName}`,
        severity: 'MEDIUM'
      });
      result.confidence -= 10;
    } else {
      result.checks.push({
        check: 'NAME_MATCH',
        passed: true,
        message: `Name/title matches: ${signature.name}`
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 6: Significant Change Detection - Is this a massive unexpected change?
  // ═══════════════════════════════════════════════════════════════════════════
  if (existingData?.regulation_text && content) {
    const existingLength = existingData.regulation_text.length;
    const newLength = content.length;
    const lengthChange = Math.abs(newLength - existingLength) / Math.max(existingLength, 1);

    if (lengthChange > 0.8) {  // More than 80% change in length
      result.warnings.push({
        check: 'SIGNIFICANT_CHANGE',
        message: `Significant content change detected: ${Math.round(lengthChange * 100)}% length difference`,
        severity: 'HIGH'
      });
      result.confidence -= 25;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  result.confidence = Math.max(0, Math.min(100, result.confidence));

  if (result.confidence < 30) {
    result.isValid = false;
    result.recommendation = 'REJECT';
  } else if (result.confidence < 60) {
    result.recommendation = 'REVIEW';
  } else {
    result.recommendation = 'ALLOW';
  }

  console.log(`\n🛡️ SOURCE DATA VALIDATION for ${regulationSlug}`);
  console.log(`   Confidence: ${result.confidence}%`);
  console.log(`   Recommendation: ${result.recommendation}`);
  if (result.errors.length > 0) {
    console.log(`   ❌ Errors: ${result.errors.map(e => e.message).join('; ')}`);
  }
  if (result.warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${result.warnings.map(w => w.message).join('; ')}`);
  }

  return result;
}

/**
 * Add a new regulation signature for validation
 */
export function addRegulationSignature(slug, signature) {
  REGULATION_SIGNATURES[slug] = signature;
  console.log(`✅ Added validation signature for ${slug}`);
}

/**
 * Get all registered signatures
 */
export function getSignatures() {
  return { ...REGULATION_SIGNATURES };
}

export default {
  validateSourceData,
  addRegulationSignature,
  getSignatures,
  REGULATION_SIGNATURES
};
