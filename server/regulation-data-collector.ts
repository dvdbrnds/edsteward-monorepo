import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { storage } from './storage';
import type { Regulation } from '@shared/schema';
import { parse as parseDate } from 'date-fns';

/**
 * Configuration for different government agencies
 */
const AGENCY_CONFIGS = {
  'Department of Labor': {
    baseUrl: 'https://www.dol.gov',
    paths: [
      '/agencies/oasam/regulatory/statutes',
      '/agencies/whd/laws-and-regulations',
      '/agencies/eta/regulations'
    ],
    selectors: {
      title: 'h1, .page-title',
      content: '.field-items, .regulation-content',
      date: '.regulation-date, .effective-date',
      requirements: '.requirements, .compliance-requirements'
    }
  },
  'Department of Education': {
    baseUrl: 'https://www2.ed.gov',
    paths: [
      '/policy/highered/reg/hearulemaking',
      '/about/offices/list/ope/policy.html'
    ],
    selectors: {
      title: 'h1, .page-title',
      content: '.contentText',
      date: '.date-display',
      requirements: '.requirements'
    }
  }
};

/**
 * Rate limiting configuration
 */
const RATE_LIMIT = {
  requestsPerMinute: 20,
  delayBetweenRequests: 3000 // 3 seconds
};

/**
 * Extracts structured data from HTML content
 */
async function extractStructuredData(html: string, url: string, config: any) {
  console.log(`\nExtracting data from ${url}`);
  const $ = cheerio.load(html);

  // Extract basic information
  const title = $(config.selectors.title).first().text().trim();
  const content = $(config.selectors.content).text().trim();
  const dateText = $(config.selectors.date).first().text().trim();
  const requirements = $(config.selectors.requirements).text().trim();

  console.log('Extracted data:');
  console.log('- Title:', title?.substring(0, 100) || 'Not found');
  console.log('- Content length:', content?.length || 0, 'characters');
  console.log('- Date text:', dateText || 'Not found');
  console.log('- Requirements length:', requirements?.length || 0, 'characters');

  // Extract all links for further analysis
  const links = $('a[href]')
    .map((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      return { href, text };
    })
    .get()
    .filter(link => link.href && (link.href.startsWith('http') || link.href.startsWith('/')));

  // Look for PDF links that might contain important documents
  const pdfLinks = links.filter(link => 
    link.href.toLowerCase().endsWith('.pdf') || 
    link.text.toLowerCase().includes('guidance') ||
    link.text.toLowerCase().includes('requirements')
  );

  console.log('Found links:');
  console.log('- Total links:', links.length);
  console.log('- PDF/Guidance documents:', pdfLinks.length);

  return {
    title,
    content,
    dateText,
    requirements,
    links,
    pdfLinks,
    sourceUrl: url
  };
}

/**
 * Updates a regulation with data from its source
 */
async function updateRegulationFromSource(regulation: Regulation) {
  try {
    console.log(`\n========================================`);
    console.log(`Processing regulation: ${regulation.itemId} - ${regulation.name}`);
    console.log(`Current agency info:`);
    console.log(`- Agency name: ${regulation.agency_name || 'Not set'}`);
    console.log(`- Agency URL: ${regulation.agency_url || 'Not set'}`);

    if (!regulation.agency_name) {
      console.log(`No agency name for regulation ${regulation.itemId}, skipping update`);
      return;
    }

    const agencyConfig = AGENCY_CONFIGS[regulation.agency_name];
    if (!agencyConfig) {
      console.log(`No config for agency: ${regulation.agency_name}`);
      return;
    }

    // If we have a specific URL, use it, otherwise search through agency paths
    const urlsToCheck = regulation.agency_url ? 
      [regulation.agency_url] : 
      agencyConfig.paths.map(path => new URL(path, agencyConfig.baseUrl).toString());

    console.log(`URLs to check:`, urlsToCheck);

    let bestMatch = null;

    for (const url of urlsToCheck) {
      try {
        console.log(`\nFetching ${url}`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'RegulationComplianceBot/1.0 (Moravian University Compliance System)',
            'Accept': 'text/html,application/xhtml+xml'
          },
          timeout: 15000
        });

        console.log(`Successfully fetched page (${response.status})`);

        const data = await extractStructuredData(response.data, url, agencyConfig);

        // Check if this page is relevant to our regulation
        const relevanceScore = calculateRelevanceScore(regulation, data);
        console.log(`Relevance score for ${url}: ${relevanceScore}`);

        if (!bestMatch || relevanceScore > bestMatch.score) {
          bestMatch = {
            score: relevanceScore,
            data
          };
        }

        // Add delay for rate limiting
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.delayBetweenRequests));

      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        continue;
      }
    }

    if (bestMatch && bestMatch.score > 0.5) {
      console.log(`\nFound best matching content with score ${bestMatch.score}`);
      const updates: Partial<Regulation> = {
        regulationUrl: bestMatch.data.sourceUrl,
        regulationText: bestMatch.data.content,
        submissionGuidelines: bestMatch.data.requirements || regulation.submissionGuidelines,
        lastUpdated: new Date()
      };

      // Update PDF links if found
      if (bestMatch.data.pdfLinks.length > 0) {
        updates.requirementsUrl = bestMatch.data.pdfLinks[0].href;
      }

      console.log('Updating regulation with new data:');
      console.log('- Regulation URL:', updates.regulationUrl);
      console.log('- Requirements URL:', updates.requirementsUrl || 'Not found');
      console.log('- Content length:', updates.regulationText?.length || 0, 'characters');
      console.log('- Guidelines length:', updates.submissionGuidelines?.length || 0, 'characters');

      await storage.updateRegulation(regulation.id, updates);
      console.log(`Updated regulation ${regulation.itemId} with source data`);
    } else {
      console.log(`No relevant content found for regulation ${regulation.itemId}`);
    }

  } catch (error) {
    console.error(`Error updating regulation ${regulation.itemId}:`, error);
  }
}

/**
 * Calculates relevance score between regulation and scraped data
 */
function calculateRelevanceScore(regulation: Regulation, data: any): number {
  const regulationKeywords = [
    ...regulation.name.toLowerCase().split(' '),
    ...regulation.topic.toLowerCase().split(' '),
    ...(regulation.statute?.toLowerCase().split(' ') || [])
  ].filter(k => k.length > 3);

  const contentWords = [
    ...(data.title?.toLowerCase().split(' ') || []),
    ...(data.content?.toLowerCase().split(' ') || [])
  ];

  let matchCount = 0;
  for (const keyword of regulationKeywords) {
    if (contentWords.some(word => word.includes(keyword))) {
      matchCount++;
    }
  }

  return matchCount / regulationKeywords.length;
}

/**
 * Main function to update all regulations
 */
export async function updateRegulationsFromSources() {
  try {
    console.log('Starting regulation data update from sources...');

    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations to process`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const regulation of regulations) {
      try {
        await updateRegulationFromSource(regulation);
        updatedCount++;

        // Add delay between regulations for rate limiting
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.delayBetweenRequests));

      } catch (error) {
        console.error(`Error processing regulation ${regulation.itemId}:`, error);
        errorCount++;
      }
    }

    console.log(`
Regulation update complete:
- Total processed: ${regulations.length}
- Successfully updated: ${updatedCount}
- Errors: ${errorCount}
    `);

  } catch (error) {
    console.error('Failed to update regulations:', error);
    throw error;
  }
}

// Export individual functions for testing and selective use
export {
  updateRegulationFromSource,
  extractStructuredData,
  calculateRelevanceScore
};