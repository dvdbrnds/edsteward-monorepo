import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { storage } from './storage';
import type { Regulation } from '@shared/schema';

const AGENCY_CONFIG = {
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
};

/**
 * Enhanced URL analyzer for Department of Labor regulations
 */
async function analyzeDolUrl(url: string, regulation?: Regulation) {
  try {
    console.log(`Analyzing DOL URL: ${url}`);

    // Basic URL validation and parsing
    let urlObj: URL;
    try {
      urlObj = new URL(url);
      if (!urlObj.hostname.includes('dol.gov')) {
        throw new Error('Not a DOL URL');
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
      return null;
    }

    // Fetch with proper headers and timeout
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'RegulationComplianceBot/1.0 (Moravian University Compliance System)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: 15000
      });

      console.log(`Successfully fetched page (${response.status})`);

      // Parse the HTML
      const $ = cheerio.load(response.data);

      // Extract structured data
      const extractedData = {
        title: $(AGENCY_CONFIG.selectors.title).first().text().trim(),
        content: $(AGENCY_CONFIG.selectors.content).text().trim(),
        dateText: $(AGENCY_CONFIG.selectors.date).first().text().trim(),
        requirements: $(AGENCY_CONFIG.selectors.requirements).text().trim(),

        // Find all relevant links
        links: $('a[href]')
          .map(function() {
            const href = $(this).attr('href');
            const text = $(this).text().trim();
            return { href, text };
          })
          .get()
          .filter(link => link.href && (link.href.startsWith('http') || link.href.startsWith('/')))
      };

      // Find regulation-specific links
      const regulationLinks = extractedData.links.filter(link => {
        const href = link.href.toLowerCase();
        return (
          href.includes('/statutes/') || 
          href.includes('/regulations/') || 
          href.includes('/regulatory/') ||
          href.includes('/laws/') ||
          href.includes('act') ||
          href.includes('statute')
        );
      });

      // If we have a regulation, update its data
      if (regulation && regulation.id) {
        const updates: Partial<Regulation> = {
          regulationUrl: url,
          regulationText: extractedData.content,
          agency_name: 'Department of Labor',
          agency_url: AGENCY_CONFIG.baseUrl,
          requirements: extractedData.requirements || regulation.requirements,
          lastUpdated: new Date()
        };

        // Update requirement URLs if found
        const requirementLinks = regulationLinks.filter(link => 
          link.text.toLowerCase().includes('requirement') ||
          link.text.toLowerCase().includes('guidance')
        );

        if (requirementLinks.length > 0) {
          updates.requirementsUrl = new URL(requirementLinks[0].href, url).toString();
        }

        await storage.updateRegulation(regulation.id, updates);
        console.log(`Updated regulation ${regulation.itemId} with DOL data`);
      }

      return {
        extractedData,
        regulationLinks
      };

    } catch (error) {
      console.error('Error fetching or parsing page:', error);
      return null;
    }
  } catch (error) {
    console.error('Top-level error:', error);
    return null;
  }
}

export { analyzeDolUrl, AGENCY_CONFIG };

// Run the analyzer
const url = "https://www.dol.gov/agencies/oasam/regulatory/statutes/age-discrimination-act";
analyzeDolUrl(url).catch(error => {
  console.error('Fatal error running analyzer:', error);
});