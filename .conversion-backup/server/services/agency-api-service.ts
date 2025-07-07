import { syslog, LogLevel, LogFacility } from './syslog';
import { scrapeAgencyWebsite } from './web-scraper';
import * as cheerio from 'cheerio';

interface RegulationRelation {
  id: string;
  relationshipType: 'reference' | 'amendment' | 'executive-order' | 'related-topic';
  sharedIdentifiers: string[];
  sharedTerms: string[];  // Add shared terms to the relation output
  relationshipStrength: number;
}

/**
 * Extracts key terms from text content
 */
function extractKeyTerms(text: string): Set<string> {
  // Normalize text and split into words
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);

  // Define important regulatory terms with categories for better matching
  const regulatoryTerms = {
    civilRights: new Set([
      'discrimination', 'rights', 'civil', 'equal', 'opportunity',
      'protection', 'enforcement', 'compliance'
    ]),
    administration: new Set([
      'federal', 'amendment', 'requirements', 'regulations',
      'policy', 'standards', 'provisions', 'employment'
    ])
  };

  // Return unique terms that are either in our regulatory terms list
  // or appear multiple times in the text
  const termFrequency = new Map<string, number>();
  words.forEach(word => {
    termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
  });

  const terms = new Set<string>();
  words.forEach(word => {
    if (regulatoryTerms.civilRights.has(word) || 
        regulatoryTerms.administration.has(word) || 
        (termFrequency.get(word) || 0) > 1) {
      terms.add(word);
    }
  });

  return terms;
}

/**
 * Normalizes an identifier string for comparison
 */
function normalizeIdentifier(identifier: string): string {
  return identifier.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates relationship strength based on shared terms and context
 */
function calculateRelationshipStrength(
  shared: string[],
  sharedTerms: string[],
  totalIdentifiers: number
): number {
  // Base score from shared identifiers
  const identifierScore = shared.length / Math.max(totalIdentifiers, 1);

  // Additional score from shared key terms
  const termScore = Math.min(sharedTerms.length / 8, 0.6);  // Increased weight for shared terms

  // Enhanced bonuses for specific types of matches
  const specificityBonus = shared.reduce((score, id) => {
    // Higher bonus for discrimination/rights related terms
    if (id.includes('discrimination') || id.includes('rights')) return score + 0.15;
    if (id.includes('section') || id.includes('order')) return score + 0.12;
    if (id.includes('of 19') || id.includes('of 20')) return score + 0.1;
    return score;
  }, 0);

  const finalScore = Math.min(identifierScore + termScore + specificityBonus, 1);

  syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
    `Relationship strength calculation:`, {
      identifierScore,
      termScore,
      specificityBonus,
      finalScore
    });

  return finalScore;
}

/**
 * Analyzes regulation content to find relationships between regulations
 */
function findRelatedRegulations(
  currentRegulation: any,
  allRegulations: any[]
): RegulationRelation[] {
  const relations: RegulationRelation[] = [];

  // Extract terms from both identifiers and full text
  const currentIdentifiers = (currentRegulation.identifiers || []).map(normalizeIdentifier);
  const currentTerms = extractKeyTerms(
    currentRegulation.fullText + '\n' + currentIdentifiers.join(' ')
  );

  syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
    `Processing regulation ${currentRegulation.id}:`, {
      title: currentRegulation.name,
      identifiersCount: currentIdentifiers.length,
      terms: Array.from(currentTerms)
    });

  for (const otherRegulation of allRegulations) {
    if (otherRegulation.id === currentRegulation.id) continue;

    const otherIdentifiers = (otherRegulation.identifiers || []).map(normalizeIdentifier);
    const otherTerms = extractKeyTerms(
      otherRegulation.fullText + '\n' + otherIdentifiers.join(' ')
    );

    // Find shared identifiers using flexible matching
    const sharedIdentifiers = currentIdentifiers.filter(current => 
      otherIdentifiers.some(other => {
        if (other === current) return true;
        if (other.includes(current) || current.includes(other)) return true;
        return false;
      })
    );

    // Find shared terms
    const sharedTerms = [...currentTerms].filter(term => otherTerms.has(term));

    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
      `Comparing with ${otherRegulation.id}:`, {
        sharedIdentifiers,
        sharedTermsCount: sharedTerms.length,
        sharedTerms: Array.from(sharedTerms)
      });

    // Only consider relationships with sufficient shared content
    if (sharedIdentifiers.length > 0 || sharedTerms.length >= 3) {
      // Determine relationship type
      let relationshipType: RegulationRelation['relationshipType'] = 'reference';

      if (currentRegulation.name.toLowerCase().includes('executive order') ||
          otherRegulation.name.toLowerCase().includes('executive order')) {
        relationshipType = 'executive-order';
      } else if (currentIdentifiers.some(id => id.includes('as amended')) ||
                 otherIdentifiers.some(id => id.includes('as amended'))) {
        relationshipType = 'amendment';
      } else if (sharedIdentifiers.length === 0 && sharedTerms.length > 0) {
        relationshipType = 'related-topic';
      }

      const relationshipStrength = calculateRelationshipStrength(
        sharedIdentifiers,
        sharedTerms,
        Math.max(currentIdentifiers.length, otherIdentifiers.length)
      );

      relations.push({
        id: otherRegulation.id,
        relationshipType,
        sharedIdentifiers,
        sharedTerms,
        relationshipStrength
      });

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Found relationship between ${currentRegulation.id} and ${otherRegulation.id}:`, {
          type: relationshipType,
          strength: relationshipStrength,
          sharedIdentifiers,
          sharedTerms
        });
    }
  }

  return relations.sort((a, b) => b.relationshipStrength - a.relationshipStrength);
}

/**
 * Fetches regulation data using web scraping
 * Returns an array of regulation records since one ID may map to multiple regulations
 */
export async function fetchRegulationFromAgency(regulationId: string): Promise<any[]> {
  try {
    const agency = regulationId.split('-')[0];

    if (agency !== 'DOL') {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Unsupported agency: ${agency}`);
      return [];
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Fetching regulation data for ${regulationId}`);

    // Extract regulation number and determine URL
    const regulationNumber = regulationId.split('-').slice(1).join('-');
    const baseUrl = 'https://www.dol.gov/agencies/oasam/regulatory/statutes';

    try {
      const scrapedData = await scrapeAgencyWebsite(baseUrl);

      if (scrapedData && scrapedData.sections) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Found ${scrapedData.sections.length} regulation sections`);

        // Map sections to regulation format
        const regulations = scrapedData.sections.map((section, index) => ({
          id: `${regulationId}-${index + 1}`,
          source: 'web-scraper',
          name: section.title,
          description: section.content.substring(0, 500) + '...',
          fullText: section.content,
          url: baseUrl,
          identifiers: section.identifiers,
          timestamp: new Date().toISOString()
        }));

        // Find relationships between regulations
        const regulationsWithRelations = regulations.map(regulation => ({
          ...regulation,
          relatedRegulations: findRelatedRegulations(regulation, regulations)
        }));

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Processed ${regulations.length} regulations with relationships`);

        return regulationsWithRelations;
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `No HTML content found for regulation ${regulationId}`);
      return [];

    } catch (scrapeError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        'Web scraping failed:', {
          error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
        });
      throw scrapeError;
    }

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      'Failed to fetch regulation data:', {
        id: "FETCH_ERROR",
        parameters: {
          regulationId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}