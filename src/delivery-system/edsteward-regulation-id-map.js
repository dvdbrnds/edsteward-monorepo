/**
 * EdSteward Regulation ID Mapping
 * Maps MCP Engine regulation slugs to EdSteward database IDs
 * 
 * SOURCE: EdSteward team (December 1, 2025)
 * VERIFIED: Confirmed correct IDs for Friday demo
 * LAST UPDATED: December 1, 2025
 */

export const edstewardRegulationIds = {
  // ============================================================================
  // TOP 10 FRIDAY DEMO REGULATIONS - VERIFIED CORRECT
  // ============================================================================
  
  'family-educational-rights-and-privacy-act-ferpa': 223,
  'clery-act': 9,  // Jeanne Clery Disclosure Act (CORRECTED from 355)
  'title-ix-of-the-education-amendment-of-1972': 7,
  'higher-education-act-title-iv-student-financial-a': 3,  // NOTE: Was 48 (wrong reg), now 3
  'violence-against-women-reauthorization-act': 9,  // Shares ID with Clery (incorporated via Campus SAVE Act)
  'americans-with-disabilities-act-of-1990': 2,
  'section-504-of-the-rehabilitation-act-of-1973': 6,  // Separate from ADA
  'title-vi-of-the-civil-rights-act-of-1964': 8,
  'technology-education-and-copyright-harmonization-a': 55,  // TEACH Act
  'drug-free-schools-and-communities-act': 157,
  
  // ============================================================================
  // ADDITIONAL REGULATIONS (To be mapped from COMPLETE_REGULATION_ID_LIST.csv)
  // ============================================================================
  
  // TODO: Add remaining 285+ regulations when processing complete CSV
  // For now, top 10 demo regulations are ready for Friday
};

/**
 * Get EdSteward database ID for a given MCP Engine regulation slug
 * @param {string} mcpSlug - MCP Engine regulation identifier (slug format)
 * @returns {number|null} - EdSteward database ID or null if not found
 */
export function getEdStewardId(mcpSlug) {
  const id = edstewardRegulationIds[mcpSlug];
  
  if (!id) {
    console.warn(`⚠️  No EdSteward ID mapping found for: ${mcpSlug}`);
    console.warn(`   This regulation will NOT be delivered to EdSteward.`);
    return null;
  }
  
  return id;
}

/**
 * Get MCP Engine slug for a given EdSteward ID (reverse lookup)
 * @param {number} edstewardId - EdSteward database ID
 * @returns {string|null} - MCP Engine slug or null if not found
 */
export function getMCPSlug(edstewardId) {
  const entry = Object.entries(edstewardRegulationIds).find(([slug, id]) => id === edstewardId);
  return entry ? entry[0] : null;
}

/**
 * Check if a regulation has an EdSteward ID mapping
 * @param {string} mcpSlug - MCP Engine regulation identifier
 * @returns {boolean} - True if mapping exists
 */
export function hasEdStewardMapping(mcpSlug) {
  return mcpSlug in edstewardRegulationIds && edstewardRegulationIds[mcpSlug] !== null;
}

/**
 * Get all mapped regulation slugs (for validation/testing)
 * @returns {string[]} - Array of all MCP slugs with EdSteward mappings
 */
export function getAllMappedSlugs() {
  return Object.keys(edstewardRegulationIds).filter(slug => edstewardRegulationIds[slug] !== null);
}

/**
 * Validation: Check for duplicate EdSteward IDs (like VAWA/Clery both = 355)
 * @returns {Object} - Map of EdSteward IDs to array of MCP slugs using that ID
 */
export function getDuplicateIdMappings() {
  const idToSlugs = {};
  
  Object.entries(edstewardRegulationIds).forEach(([slug, id]) => {
    if (id === null) return;
    if (!idToSlugs[id]) idToSlugs[id] = [];
    idToSlugs[id].push(slug);
  });
  
  // Return only IDs used by multiple regulations
  return Object.fromEntries(
    Object.entries(idToSlugs).filter(([id, slugs]) => slugs.length > 1)
  );
}

// Log duplicate mappings on import (informational)
const duplicates = getDuplicateIdMappings();
if (Object.keys(duplicates).length > 0) {
  console.log('ℹ️  Multiple MCP regulations map to same EdSteward IDs:');
  Object.entries(duplicates).forEach(([id, slugs]) => {
    console.log(`   EdSteward ID ${id}: ${slugs.join(', ')}`);
  });
  console.log('   This is expected for VAWA/Clery (Campus SAVE Act integration)');
}

export default {
  getEdStewardId,
  getMCPSlug,
  hasEdStewardMapping,
  getAllMappedSlugs,
  getDuplicateIdMappings,
  edstewardRegulationIds
};

