/**
 * Source Data Validator v2.0 - Robust Validation
 * 
 * Replaces keyword-based validation with:
 * 1. CFR Citation Validation - Verify fetched data contains correct CFR citation
 * 2. Source URL Validation - Check eCFR URL matches expected regulation
 * 3. Database-Driven - Use regulation's own metadata as source of truth
 * 4. Semantic Similarity - Compare incoming text to existing regulation text
 * 
 * No more fragile keyword lists!
 */

import { pool } from './database.js';

/**
 * Calculate similarity between two strings (Jaccard similarity on words)
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Extract CFR citation from text
 * Returns: { title: "34", part: "106", section: "8" } or null
 */
function extractCFRCitation(text) {
  if (!text) return null;
  
  // Match patterns like "34 CFR 106", "34 CFR Part 106", "34 CFR 106.8", "34 C.F.R. § 106"
  const patterns = [
    /(\d+)\s*C\.?F\.?R\.?\s*(?:Part\s*)?(\d+)(?:\.(\d+))?/gi,
    /(\d+)\s*C\.?F\.?R\.?\s*§\s*(\d+)(?:\.(\d+))?/gi,
    /Title\s*(\d+).*?Part\s*(\d+)/gi
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return {
        title: match[1],
        part: match[2],
        section: match[3] || null,
        full: match[0]
      };
    }
  }
  return null;
}

/**
 * Extract USC citation from text
 * Returns: { title: "20", section: "1681" } or null
 */
function extractUSCCitation(text) {
  if (!text) return null;
  
  // Match patterns like "20 U.S.C. § 1681", "20 USC 1681"
  const patterns = [
    /(\d+)\s*U\.?S\.?C\.?\s*§?\s*(\d+)/gi,
    /United States Code.*?Title\s*(\d+).*?Section\s*(\d+)/gi
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return {
        title: match[1],
        section: match[2],
        full: match[0]
      };
    }
  }
  return null;
}

/**
 * Validate source data using robust methods
 * 
 * @param {string} regulationSlug - The regulation being updated
 * @param {object} fetchedData - Data fetched from government sources
 * @param {object} existingData - Current data in database (optional, will fetch if not provided)
 * @returns {object} - Validation result
 */
export async function validateSourceData(regulationSlug, fetchedData, existingData = null) {
  const result = {
    isValid: true,
    confidence: 100,
    checks: [],
    warnings: [],
    errors: [],
    recommendation: 'ALLOW'
  };

  // Debug: Log what we received
  console.log(`[VALIDATOR] Received existingData: ${existingData ? 'YES' : 'NO'}`);
  if (existingData) {
    console.log(`[VALIDATOR]   - name: ${existingData.name}`);
    console.log(`[VALIDATOR]   - cfr: ${existingData.cfr || 'NOT SET'}`);
    console.log(`[VALIDATOR]   - statute: ${existingData.statute || 'NOT SET'}`);
  }

  // Get existing regulation data from database if not provided
  if (!existingData) {
    try {
      // Extract key words from slug for fuzzy matching
      // e.g., "title-ix-of-the-education-amendment-of-1972" -> "title%ix%education"
      // Keep short important words like "ix", "vi", "ii" (Roman numerals)
      const stopWords = ['of', 'the', 'and', 'for', 'to', 'in', 'on', 'at', 'by'];
      const slugParts = regulationSlug.split('-').filter(p => !stopWords.includes(p.toLowerCase()));
      // Use wildcards between words for flexible matching
      const keyWordsPattern = '%' + slugParts.slice(0, 3).join('%') + '%';
      
      console.log(`[VALIDATOR] Looking up regulation with pattern: "${keyWordsPattern}"`);
      
      const dbResult = await pool.query(`
        SELECT 
          id, name, statute, cfr, regulation_text, summary
        FROM regulations 
        WHERE 
          LOWER(name) LIKE LOWER($1)
        LIMIT 1
      `, [keyWordsPattern]);
      
      if (dbResult.rows.length > 0) {
        existingData = dbResult.rows[0];
        console.log(`[VALIDATOR] Found existing data: ${existingData.name}`);
        console.log(`[VALIDATOR]   CFR: ${existingData.cfr || 'N/A'}`);
        console.log(`[VALIDATOR]   Statute: ${existingData.statute || 'N/A'}`);
      } else {
        console.warn(`[VALIDATOR] Could not find regulation in database for: ${regulationSlug}`);
      }
    } catch (error) {
      console.warn(`[VALIDATOR] Could not fetch existing data: ${error.message}`);
    }
  }

  const fetchedText = fetchedData?.fullText || fetchedData?.regulation_text || fetchedData?.content || '';
  const fetchedName = fetchedData?.name || fetchedData?.title || '';
  const fetchedUrl = fetchedData?.url || fetchedData?.source_url || '';
  const fetchedCitation = fetchedData?.citation || '';

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 1: CFR Citation Validation
  // Verify the fetched data contains the correct CFR citation
  // Uses the `cfr` column from database as source of truth
  // ═══════════════════════════════════════════════════════════════════════════
  const expectedCFR = existingData?.cfr ? extractCFRCitation(existingData.cfr) : null;
  const fetchedCFR = extractCFRCitation(fetchedText) || extractCFRCitation(fetchedCitation);
  
  if (expectedCFR) {
    console.log(`[VALIDATOR] Expected CFR: ${expectedCFR.title} CFR ${expectedCFR.part}`);
    console.log(`[VALIDATOR] Fetched CFR: ${fetchedCFR ? `${fetchedCFR.title} CFR ${fetchedCFR.part}` : 'NOT FOUND'}`);
    
    if (fetchedCFR) {
      if (expectedCFR.title === fetchedCFR.title && expectedCFR.part === fetchedCFR.part) {
        result.checks.push({
          check: 'CFR_CITATION',
          passed: true,
          message: `CFR citation matches: ${fetchedCFR.full}`
        });
      } else {
        result.errors.push({
          check: 'CFR_CITATION',
          severity: 'CRITICAL',
          message: `CFR citation mismatch! Expected: ${expectedCFR.title} CFR ${expectedCFR.part}, Got: ${fetchedCFR.title} CFR ${fetchedCFR.part}`
        });
        result.confidence -= 50;
      }
    } else {
      result.warnings.push({
        check: 'CFR_CITATION',
        severity: 'MEDIUM',
        message: `Could not find CFR citation in fetched data (expected ${expectedCFR.title} CFR ${expectedCFR.part})`
      });
      result.confidence -= 15;
    }
  } else {
    result.warnings.push({
      check: 'CFR_CITATION',
      severity: 'LOW',
      message: `No CFR citation in database for this regulation - cannot validate CFR`
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 2: Source URL Validation
  // Verify the eCFR URL matches expected regulation
  // ═══════════════════════════════════════════════════════════════════════════
  if (fetchedUrl && expectedCFR) {
    const expectedUrlPart = `/title-${expectedCFR.title}/part-${expectedCFR.part}`;
    const altExpectedUrlPart = `title=${expectedCFR.title}.*part=${expectedCFR.part}`;
    
    if (fetchedUrl.includes(expectedUrlPart) || new RegExp(altExpectedUrlPart).test(fetchedUrl)) {
      result.checks.push({
        check: 'SOURCE_URL',
        passed: true,
        message: `Source URL contains correct CFR path: ${expectedUrlPart}`
      });
    } else {
      result.errors.push({
        check: 'SOURCE_URL',
        severity: 'HIGH',
        message: `Source URL doesn't match expected CFR. Expected path containing: ${expectedUrlPart}, Got: ${fetchedUrl}`
      });
      result.confidence -= 30;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 3: Database-Driven Name Validation
  // Use regulation's own name as source of truth
  // ═══════════════════════════════════════════════════════════════════════════
  if (existingData?.name && fetchedName) {
    const existingNameLower = existingData.name.toLowerCase();
    const fetchedNameLower = fetchedName.toLowerCase();
    
    // Check if names are similar (at least 50% word overlap)
    const nameSimilarity = calculateSimilarity(existingNameLower, fetchedNameLower);
    
    if (nameSimilarity > 0.3) {
      result.checks.push({
        check: 'NAME_MATCH',
        passed: true,
        message: `Name similarity: ${Math.round(nameSimilarity * 100)}%`
      });
    } else if (nameSimilarity > 0.1) {
      result.warnings.push({
        check: 'NAME_MATCH',
        severity: 'MEDIUM',
        message: `Low name similarity: ${Math.round(nameSimilarity * 100)}% (expected: ${existingData.name.substring(0, 40)}...)`
      });
      result.confidence -= 15;
    } else {
      result.errors.push({
        check: 'NAME_MATCH',
        severity: 'HIGH',
        message: `Name mismatch! Expected: "${existingData.name.substring(0, 50)}...", Got: "${fetchedName.substring(0, 50)}..."`
      });
      result.confidence -= 25;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 4: Semantic Similarity
  // Compare incoming text to existing regulation text
  // ═══════════════════════════════════════════════════════════════════════════
  if (existingData?.regulation_text && fetchedText && existingData.regulation_text.length > 100) {
    const similarity = calculateSimilarity(existingData.regulation_text, fetchedText);
    
    if (similarity > 0.3) {
      result.checks.push({
        check: 'SEMANTIC_SIMILARITY',
        passed: true,
        message: `Content similarity: ${Math.round(similarity * 100)}% (good match)`
      });
    } else if (similarity > 0.1) {
      result.warnings.push({
        check: 'SEMANTIC_SIMILARITY',
        severity: 'MEDIUM',
        message: `Low content similarity: ${Math.round(similarity * 100)}% - content may have changed significantly`
      });
      result.confidence -= 10;
    } else if (similarity < 0.05 && existingData.regulation_text.length > 500) {
      result.errors.push({
        check: 'SEMANTIC_SIMILARITY',
        severity: 'HIGH',
        message: `Very low content similarity: ${Math.round(similarity * 100)}% - this appears to be different content`
      });
      result.confidence -= 30;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECK 5: Content Length (basic sanity check)
  // ═══════════════════════════════════════════════════════════════════════════
  if (fetchedText.length < 100) {
    result.errors.push({
      check: 'CONTENT_LENGTH',
      severity: 'HIGH',
      message: `Content too short: ${fetchedText.length} chars (minimum: 100)`
    });
    result.confidence -= 30;
  } else if (fetchedText.length < 500) {
    result.warnings.push({
      check: 'CONTENT_LENGTH',
      severity: 'LOW',
      message: `Content is short: ${fetchedText.length} chars (recommended: 500+)`
    });
    result.confidence -= 10;
  } else {
    result.checks.push({
      check: 'CONTENT_LENGTH',
      passed: true,
      message: `Content length OK: ${fetchedText.length} chars`
    });
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

  console.log(`\n🛡️ SOURCE DATA VALIDATION v2.0 for ${regulationSlug}`);
  console.log(`   Confidence: ${result.confidence}%`);
  console.log(`   Recommendation: ${result.recommendation}`);
  console.log(`   Checks passed: ${result.checks.length}`);
  if (result.errors.length > 0) {
    console.log(`   ❌ Errors: ${result.errors.map(e => e.message).join('; ')}`);
  }
  if (result.warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${result.warnings.map(w => w.message).join('; ')}`);
  }

  return result;
}

export default {
  validateSourceData,
  calculateSimilarity,
  extractCFRCitation,
  extractUSCCitation
};
