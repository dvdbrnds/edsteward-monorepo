import axios from 'axios';
import * as cheerio from 'cheerio';
import { syslog, LogLevel, LogFacility } from './syslog';

interface ScrapedRegulationData {
  content: string;
  links: string[];
  title?: string;
  lastUpdated?: string;
}

const AGENCY_BASE_URLS = {
  'ED': 'https://www2.ed.gov',
  'DOL': 'https://www.dol.gov',
  'OSHA': 'https://www.osha.gov',
};

export async function scrapeAgencyWebsite(url: string): Promise<ScrapedRegulationData> {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Starting to scrape data from ${url}`);

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract main content, excluding navigation and footer
    const content = $('main, #content, .content, article')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    // Extract all relevant links
    const links = $('a')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'))
      .map(href => {
        try {
          return new URL(href, url).toString();
        } catch {
          return href;
        }
      });

    // Try to find the page title
    const title = $('h1').first().text().trim() || 
                 $('title').text().trim();

    // Try to find last updated date
    const lastUpdated = $('[data-last-updated], .last-updated, .modified, time')
      .first()
      .text()
      .trim();

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Successfully scraped data from ${url}`, {
        id: "SCRAPE_SUCCESS",
        parameters: {
          url,
          contentLength: content.length,
          linksCount: links.length,
          hasTitle: !!title
        }
      });

    return {
      content,
      links,
      title,
      lastUpdated
    };
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to scrape data from ${url}`, {
        id: "SCRAPE_ERROR",
        parameters: {
          url,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}

export async function findRegulationPages(baseUrl: string, searchTerm: string): Promise<string[]> {
  try {
    const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(searchUrl);
    const $ = cheerio.load(response.data);
    
    // Extract search results that look like regulation pages
    const regulationLinks = $('a')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter(href => {
        if (!href) return false;
        const lower = href.toLowerCase();
        return lower.includes('regulation') || 
               lower.includes('compliance') || 
               lower.includes('standard') ||
               lower.includes('requirement');
      })
      .map(href => {
        try {
          return new URL(href, baseUrl).toString();
        } catch {
          return href;
        }
      });

    return [...new Set(regulationLinks)]; // Remove duplicates
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to search for regulation pages at ${baseUrl}`, {
        id: "SEARCH_ERROR",
        parameters: {
          baseUrl,
          searchTerm,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    return [];
  }
}
