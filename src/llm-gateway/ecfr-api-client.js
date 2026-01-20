/**
 * eCFR.gov API Client
 * 
 * Fetches regulation text from the official Electronic Code of Federal Regulations
 * https://www.ecfr.gov/api/
 * 
 * This provides REAL, AUTHORITATIVE regulation text from the U.S. Government
 */

import fetch from 'node-fetch';

const ECFR_API_BASE = 'https://www.ecfr.gov/api/versioner/v1';

/**
 * Fetch full text for a CFR part
 * @param {string} title - CFR title (e.g., "34")
 * @param {string} part - CFR part (e.g., "99")
 * @param {string} date - ISO date (default: current)
 * @returns {Promise<object>} - Full CFR text and metadata
 */
export async function fetchCFRPart(title, part, date = null) {
  try {
    // Use the search API which is more reliable than the full text endpoint
    // The search API returns section metadata and excerpts which is what we need
    const searchUrl = `https://www.ecfr.gov/api/search/v1/results?query=part+${part}&per_page=20`;
    
    console.log(`📖 Fetching CFR ${title} Part ${part} from eCFR.gov...`);
    console.log(`   URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MCP-Engine-Compliance-Platform/1.0'
      },
      timeout: 15000
    });
    
    if (!response.ok) {
      throw new Error(`eCFR API returned ${response.status}: ${response.statusText}`);
    }
    
    const searchData = await response.json();
    
    // Filter results to only those matching our title and part
    const matchingResults = (searchData.results || []).filter(r => 
      r.hierarchy?.title === title && r.hierarchy?.part === part
    );
    
    if (matchingResults.length === 0) {
      console.warn(`⚠️  Part ${part} not found in CFR Title ${title}`);
      return {
        success: false,
        title,
        part,
        fullText: `CFR ${title} Part ${part} not found`,
        error: 'Part not found in search results'
      };
    }
    
    // Build full text from search results (excerpts)
    const fullText = matchingResults.map(r => {
      const heading = r.headings?.section || r.headings?.part || '';
      const excerpt = r.full_text_excerpt?.replace(/<[^>]+>/g, '') || '';
      return `${heading}\n${excerpt}`;
    }).join('\n\n---\n\n');
    
    console.log(`✅ Successfully fetched CFR ${title} Part ${part} (${matchingResults.length} sections, ${fullText.length} chars)`);
    
    return {
      success: true,
      title,
      part,
      fullText: fullText,
      sections: matchingResults.map(r => r.hierarchy?.section).filter(Boolean),
      date: new Date().toISOString().split('T')[0],
      source: 'ecfr.gov',
      citation: `${title} CFR Part ${part}`,
      url: `https://www.ecfr.gov/current/title-${title}/part-${part}`,
      length: fullText.length,
      sectionCount: matchingResults.length,
      meta: searchData.meta || {}
    };
    
  } catch (error) {
    console.error(`❌ Failed to fetch CFR ${title} Part ${part}:`, error.message);
    return {
      success: false,
      title,
      part,
      error: error.message,
      fullText: `Error fetching CFR ${title} Part ${part}: ${error.message}`
    };
  }
}

/**
 * Fetch specific CFR section
 * @param {string} title - CFR title (e.g., "34")
 * @param {string} part - CFR part (e.g., "668")
 * @param {string} section - CFR section (e.g., "46")
 * @returns {Promise<object>} - Section text and metadata
 */
export async function fetchCFRSection(title, part, section) {
  try {
    // First fetch the whole part
    const partData = await fetchCFRPart(title, part);
    
    if (!partData.success) {
      return partData;
    }
    
    // Extract the specific section from the part
    const sectionText = extractSectionFromText(partData.fullText, section);
    
    if (!sectionText) {
      console.warn(`⚠️  Section ${section} not found in CFR ${title} Part ${part}`);
      return {
        success: false,
        title,
        part,
        section,
        fullText: `CFR ${title} Part ${part} Section ${section} not found`,
        error: 'Section not found'
      };
    }
    
    console.log(`✅ Successfully fetched CFR ${title}.${part}.${section} (${sectionText.length} chars)`);
    
    return {
      success: true,
      title,
      part,
      section,
      fullText: sectionText,
      citation: `${title} CFR ${part}.${section}`,
      source: 'ecfr.gov',
      length: sectionText.length
    };
    
  } catch (error) {
    console.error(`❌ Failed to fetch CFR ${title}.${part}.${section}:`, error.message);
    return {
      success: false,
      title,
      part,
      section,
      error: error.message,
      fullText: `Error fetching CFR ${title}.${part}.${section}: ${error.message}`
    };
  }
}

/**
 * Extract a specific part from CFR XML
 * Simple regex-based extraction (production should use XML parser)
 * @param {string} xmlText - Full CFR XML
 * @param {string} partNumber - Part number to extract
 * @returns {string|null} - Extracted part text or null
 */
function extractPartFromXML(xmlText, partNumber) {
  // Look for PART tags with the matching number
  const partRegex = new RegExp(
    `<PART>\\s*<PTHD>PART ${partNumber}[^<]*</PTHD>([\\s\\S]*?)</PART>`,
    'i'
  );
  
  const match = xmlText.match(partRegex);
  
  if (match && match[1]) {
    // Strip XML tags and clean up
    let text = match[1];
    text = text.replace(/<[^>]+>/g, ''); // Remove XML tags
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); // Decode entities
    text = text.trim();
    return text;
  }
  
  return null;
}

/**
 * Extract a specific section from part text
 * @param {string} partText - Full part text
 * @param {string} sectionNumber - Section number to extract
 * @returns {string|null} - Extracted section text or null
 */
function extractSectionFromText(partText, sectionNumber) {
  // Look for section markers like "§ 668.46" or "Sec. 668.46"
  const sectionRegex = new RegExp(
    `(?:§|Sec\\.)\\s*\\d+\\.${sectionNumber}\\b([\\s\\S]*?)(?=(?:§|Sec\\.)\\s*\\d+\\.\\d+|$)`,
    'i'
  );
  
  const match = partText.match(sectionRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Fetch CFR by citation object
 * @param {object} citation - Citation from regulation-cfr-mapping
 * @returns {Promise<object>} - CFR text and metadata
 */
export async function fetchByCitation(citation) {
  if (citation.section) {
    return fetchCFRSection(citation.title, citation.part, citation.section);
  } else {
    return fetchCFRPart(citation.title, citation.part);
  }
}

/**
 * Fetch multiple CFR citations and combine
 * @param {Array} citations - Array of parsed CFR citations
 * @returns {Promise<object>} - Combined CFR text
 */
export async function fetchMultipleCitations(citations) {
  try {
    console.log(`📚 Fetching ${citations.length} CFR citations...`);
    
    const results = await Promise.all(
      citations.map(citation => fetchByCitation(citation))
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (failed.length > 0) {
      console.warn(`⚠️  ${failed.length} of ${citations.length} citations failed to fetch`);
    }
    
    // Combine all successful texts
    const combinedText = successful
      .map(r => `═══ ${r.citation} ═══\n\n${r.fullText}`)
      .join('\n\n');
    
    return {
      success: successful.length > 0,
      citations: citations.map(c => c.fullCitation),
      fullText: combinedText || 'No CFR text could be fetched',
      successCount: successful.length,
      failureCount: failed.length,
      length: combinedText.length,
      source: 'ecfr.gov'
    };
    
  } catch (error) {
    console.error(`❌ Failed to fetch multiple citations:`, error.message);
    return {
      success: false,
      error: error.message,
      fullText: `Error fetching CFR citations: ${error.message}`
    };
  }
}

export default {
  fetchCFRPart,
  fetchCFRSection,
  fetchByCitation,
  fetchMultipleCitations
};

