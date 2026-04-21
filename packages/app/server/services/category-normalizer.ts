/**
 * Category Normalization Service
 * 
 * Smart mapping of incoming categories to canonical categories.
 * Preserves original category while normalizing for consistent filtering/reporting.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// Cache for category mappings (refreshed periodically)
let mappingCache: Map<string, { canonicalId: number; canonicalName: string }> = new Map();
let canonicalCache: Map<number, string> = new Map();
let cacheLastUpdated = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Refresh the mapping cache from database
 */
async function refreshCache() {
  const now = Date.now();
  if (now - cacheLastUpdated < CACHE_TTL && mappingCache.size > 0) {
    return; // Cache still valid
  }
  
  try {
    // Load canonical categories
    const canonicals = await db.execute(sql`
      SELECT id, name FROM canonical_categories WHERE is_active = true
    `);
    
    canonicalCache.clear();
    for (const row of canonicals.rows as any[]) {
      canonicalCache.set(row.id, row.name);
    }
    
    // Load mappings
    const mappings = await db.execute(sql`
      SELECT cm.incoming_category, cm.canonical_category_id, cc.name as canonical_name
      FROM category_mappings cm
      JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
    `);
    
    mappingCache.clear();
    for (const row of mappings.rows as any[]) {
      mappingCache.set(row.incoming_category.toLowerCase(), {
        canonicalId: row.canonical_category_id,
        canonicalName: row.canonical_name,
      });
    }
    
    cacheLastUpdated = now;
    console.log(`[CategoryNormalizer] Cache refreshed: ${mappingCache.size} mappings, ${canonicalCache.size} canonicals`);
  } catch (error) {
    console.error('[CategoryNormalizer] Failed to refresh cache:', error);
  }
}

/**
 * Fuzzy match an incoming category to canonical categories
 * Returns the best match with confidence score
 */
function fuzzyMatch(incoming: string): { canonicalId: number; canonicalName: string; confidence: number } | null {
  const normalized = incoming.toLowerCase().trim();
  
  // Keywords to canonical category mapping (names must match canonical_categories.name)
  const keywordMap: Record<string, string[]> = {
    'Academic Programs': ['academic', 'curriculum', 'accreditation', 'degree', 'program', 'textbook', 'credit hour', 'gainful employment', 'state authorization'],
    'Human Resources': ['hr', 'human resources', 'employment', 'hiring', 'termination', 'benefits', 'wages', 'salary', 'labor', 'union', 'immigration', 'employee', 'erisa', 'cobra', 'fmla', 'pension', 'annuit'],
    'Finance': ['finance', 'accounting', 'tax', 'budget', 'fiscal', 'treasury', 'antitrust', 'sarbanes', 'sox', 'irs', 'telemarketing'],
    'Campus Safety': ['campus safety', 'security', 'police', 'clery', 'emergency', 'crime', 'drug-free school', 'homeland security'],
    'Information Technology': ['information technology', 'cyber', 'data privacy', 'computer', 'network', 'ferpa', 'glba', 'hipaa', 'gdpr', 'hitech', 'fisma', 'electronic communication'],
    'Research': ['research', 'grant', 'sponsored', 'export control', 'irb', 'iacuc', 'scientific', 'bayh-dole', 'animal welfare', 'clinical trial', 'misconduct'],
    'Environmental Health & Safety': ['environmental', 'ehs', 'hazard', 'osha', 'chemical', 'radiation', 'biosafety', 'clean air', 'clean water', 'toxic', 'asbestos', 'lead', 'pollution', 'waste'],
    'Financial Aid': ['financial aid', 'title iv', 'student aid', 'pell', 'loan', 'scholarship', 'fafsa', 'cohort default', 'borrower defense', 'work study', 'perkins', 'plus loan'],
    'Civil Rights': ['civil rights', 'title ix', 'discrimination', 'ada', 'disability', 'diversity', 'affirmative', 'sexual violence', 'harassment', 'equal opportunity', 'rehabilitation act', 'section 504'],
    'Contracts & Procurement': ['contract', 'procurement', 'purchasing', 'vendor', 'bid', 'rfp'],
    'Intellectual Property': ['intellectual property', 'copyright', 'trademark', 'patent', 'technology transfer', 'licensing', 'dmca', 'lanham'],
    'Ethics & Governance': ['ethics', 'governance', 'board', 'lobbying', 'political', 'conflict of interest', 'foreign gift', 'foreign agent', 'foia', 'freedom of information', 'sentencing guideline', 'fcpa', 'audit', 'record retention'],
    'Fundraising & Development': ['fundraising', 'development', 'donor', 'gift annuity', 'advancement', 'charitable'],
    'Athletics': ['athletic', 'ncaa', 'sports', 'varsity', 'intercollegiate', 'eada'],
    'Student Services': ['student service', 'student affairs', 'housing', 'residence', 'auxiliary', 'dining', 'international student', 'sevis', 'servicemember readmission'],
  };
  
  let bestMatch: { canonicalName: string; score: number } | null = null;
  
  for (const [canonical, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        const score = keyword.length / normalized.length; // Longer match = higher confidence
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { canonicalName: canonical, score: Math.min(score * 1.5, 0.95) };
        }
      }
    }
  }
  
  if (bestMatch) {
    // Find canonical ID
    for (const [id, name] of Array.from(canonicalCache.entries())) {
      if (name === bestMatch.canonicalName) {
        return { canonicalId: id, canonicalName: bestMatch.canonicalName, confidence: bestMatch.score };
      }
    }
  }
  
  return null;
}

/**
 * Normalize a category - returns canonical category info
 * If no mapping exists, attempts fuzzy match and optionally creates mapping
 */
export async function normalizeCategory(
  incomingCategory: string,
  options: { source?: string; autoCreate?: boolean } = {}
): Promise<{
  canonicalId: number | null;
  canonicalName: string | null;
  originalCategory: string;
  isNewMapping: boolean;
  confidence: number;
}> {
  const { source = 'auto', autoCreate = true } = options;
  
  await refreshCache();
  
  const originalCategory = incomingCategory.trim();
  const lookupKey = originalCategory.toLowerCase();
  
  // Check cache first
  const cached = mappingCache.get(lookupKey);
  if (cached) {
    return {
      canonicalId: cached.canonicalId,
      canonicalName: cached.canonicalName,
      originalCategory,
      isNewMapping: false,
      confidence: 1.0,
    };
  }
  
  // Try fuzzy matching
  const fuzzyResult = fuzzyMatch(originalCategory);
  
  if (fuzzyResult && autoCreate) {
    // Create new mapping
    try {
      await db.execute(sql`
        INSERT INTO category_mappings (incoming_category, canonical_category_id, source, confidence, is_verified)
        VALUES (${originalCategory}, ${fuzzyResult.canonicalId}, ${source}, ${fuzzyResult.confidence.toFixed(2)}, false)
        ON CONFLICT (incoming_category) DO NOTHING
      `);
      
      // Update cache
      mappingCache.set(lookupKey, {
        canonicalId: fuzzyResult.canonicalId,
        canonicalName: fuzzyResult.canonicalName,
      });
      
      console.log(`[CategoryNormalizer] Auto-mapped "${originalCategory}" → "${fuzzyResult.canonicalName}" (confidence: ${(fuzzyResult.confidence * 100).toFixed(0)}%)`);
      
      return {
        canonicalId: fuzzyResult.canonicalId,
        canonicalName: fuzzyResult.canonicalName,
        originalCategory,
        isNewMapping: true,
        confidence: fuzzyResult.confidence,
      };
    } catch (error) {
      console.error('[CategoryNormalizer] Failed to create mapping:', error);
    }
  }
  
  // No mapping found
  return {
    canonicalId: fuzzyResult?.canonicalId || null,
    canonicalName: fuzzyResult?.canonicalName || null,
    originalCategory,
    isNewMapping: false,
    confidence: fuzzyResult?.confidence || 0,
  };
}

/**
 * Get all canonical categories
 */
export async function getCanonicalCategories(): Promise<Array<{ id: number; name: string; description: string; color: string; icon: string }>> {
  await refreshCache();
  
  const result = await db.execute(sql`
    SELECT id, name, description, color, icon 
    FROM canonical_categories 
    WHERE is_active = true 
    ORDER BY sort_order
  `);
  
  return result.rows as any[];
}

/**
 * Get unmapped or low-confidence mappings for review
 */
export async function getUnverifiedMappings(): Promise<Array<{
  id: number;
  incomingCategory: string;
  canonicalName: string;
  source: string;
  confidence: number;
}>> {
  const result = await db.execute(sql`
    SELECT cm.id, cm.incoming_category, cc.name as canonical_name, cm.source, cm.confidence
    FROM category_mappings cm
    LEFT JOIN canonical_categories cc ON cc.id = cm.canonical_category_id
    WHERE cm.is_verified = false
    ORDER BY cm.confidence ASC, cm.created_at DESC
  `);
  
  return result.rows as any[];
}

/**
 * Verify/update a mapping (for admin review)
 */
export async function verifyMapping(mappingId: number, canonicalCategoryId: number): Promise<void> {
  await db.execute(sql`
    UPDATE category_mappings 
    SET canonical_category_id = ${canonicalCategoryId}, 
        is_verified = true, 
        confidence = 1.00,
        updated_at = NOW()
    WHERE id = ${mappingId}
  `);
  
  // Invalidate cache
  cacheLastUpdated = 0;
}
