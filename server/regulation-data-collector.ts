import axios, { AxiosError } from 'axios';
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
 * Rate limiting configuration with exponential backoff
 */
const RATE_LIMIT = {
  requestsPerMinute: 20,
  initialDelay: 3000,
  maxRetries: 3,
  backoffMultiplier: 2
};

/**
 * Sleep function for rate limiting
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom axios instance with retry logic
 */
const axiosWithRetry = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'RegulationComplianceBot/1.0 (Moravian University Compliance System)',
    'Accept': 'text/html,application/xhtml+xml'
  }
});

// Add retry interceptor
axiosWithRetry.interceptors.response.use(null, async (error: AxiosError) => {
  const config = error.config;
  if (!config || !config.retryCount) {
    config.retryCount = 0;
  }

  // If we haven't maxed out retries and it's a retryable error
  if (config.retryCount < RATE_LIMIT.maxRetries && 
      (error.response?.status === 429 || error.response?.status === 503)) {
    config.retryCount += 1;

    // Calculate delay with exponential backoff
    const delay = RATE_LIMIT.initialDelay * Math.pow(RATE_LIMIT.backoffMultiplier, config.retryCount - 1);
    console.log(`Rate limited, retrying in ${delay}ms (attempt ${config.retryCount} of ${RATE_LIMIT.maxRetries})`);

    await sleep(delay);
    return axiosWithRetry(config);
  }

  return Promise.reject(error);
});

/**
 * Extracts structured data from HTML content
 */
async function extractStructuredData(html: string, url: string, config: any) {
  const $ = cheerio.load(html);

  // Extract basic information
  const title = $(config.selectors.title).first().text().trim();
  const content = $(config.selectors.content).text().trim();
  const dateText = $(config.selectors.date).first().text().trim();
  const requirements = $(config.selectors.requirements).text().trim();

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

    let bestMatch = null;

    for (const url of urlsToCheck) {
      try {
        console.log(`Fetching ${url}`);
        const response = await axiosWithRetry.get(url);
        console.log(`Successfully fetched ${url}`);

        const data = await extractStructuredData(response.data, url, agencyConfig);

        // Check if this page is relevant to our regulation
        const relevanceScore = calculateRelevanceScore(regulation, data);

        if (!bestMatch || relevanceScore > bestMatch.score) {
          bestMatch = {
            score: relevanceScore,
            data
          };
        }

        // Add delay for rate limiting
        await sleep(RATE_LIMIT.initialDelay);

      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        if (error.response?.status === 429) {
          console.log('Rate limit hit, waiting before next request...');
          await sleep(RATE_LIMIT.initialDelay * 2);
        }
        continue;
      }
    }

    if (bestMatch && bestMatch.score > 0.5) {
      const updates: Partial<Regulation> = {
        regulationUrl: bestMatch.data.sourceUrl,
        regulationText: bestMatch.data.content,
        submissionGuidelines: bestMatch.data.requirements || regulation.submissionGuidelines,
        lastUpdated: new Date()
      };

      if (bestMatch.data.pdfLinks.length > 0) {
        updates.requirementsUrl = bestMatch.data.pdfLinks[0].href;
      }

      await storage.updateRegulation(regulation.id, updates);
      console.log(`Updated regulation ${regulation.itemId} with source data`);
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

    // Process regulations with rate limiting
    for (const regulation of regulations) {
      try {
        await updateRegulationFromSource(regulation);
        updatedCount++;

        // Add delay between regulations for rate limiting
        await sleep(RATE_LIMIT.initialDelay);

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