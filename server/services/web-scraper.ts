import axios from 'axios';
import * as cheerio from 'cheerio';
import { syslog, LogLevel, LogFacility } from './syslog';
import * as puppeteer from 'puppeteer';

interface ScrapedRegulationData {
  content: string;
  links: string[];
  title?: string;
  lastUpdated?: string;
  downloadUrls?: string[];
}

const AGENCY_BASE_URLS = {
  'ED': 'https://www2.ed.gov',
  'DOL': 'https://www.dol.gov',
  'OSHA': 'https://www.osha.gov',
};

const CONTENT_SELECTORS = [
  'main', 
  '#content',
  '.content',
  'article',
  '[role="main"]',
  '.regulation-content',
  '.policy-content',
  '.compliance-content',
  '[data-content-type="regulation"]'
];

async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for content to load
    for (const selector of CONTENT_SELECTORS) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const content = await page.$eval(selector, el => el.textContent || '');
        if (content.length > 100) { // Basic validation that we got meaningful content
          return content;
        }
      } catch (e) {
        continue; // Try next selector
      }
    }

    // Fallback: get all text content if no selectors matched
    return await page.$eval('body', el => el.textContent || '');
  } finally {
    await browser.close();
  }
}

export async function scrapeAgencyWebsite(url: string): Promise<ScrapedRegulationData> {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Starting to scrape data from ${url}`);

    let content = '';
    let $: cheerio.CheerioAPI;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 ComplianceBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 30000
      });

      $ = cheerio.load(response.data);

      // Try each content selector
      for (const selector of CONTENT_SELECTORS) {
        const selectedContent = $(selector).text().trim();
        if (selectedContent.length > 100) {
          content = selectedContent;
          break;
        }
      }

      // If no content found with selectors, try Puppeteer
      if (!content) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `No content found with basic selectors, trying Puppeteer for ${url}`);
        content = await scrapeWithPuppeteer(url);
      }

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Failed to scrape with axios/cheerio, falling back to Puppeteer for ${url}`, {
          id: "SCRAPE_FALLBACK",
          parameters: {
            error: error instanceof Error ? error.message : String(error)
          }
        });
      content = await scrapeWithPuppeteer(url);
      $ = cheerio.load(content);
    }

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

    // Find regulation-specific download links
    const downloadUrls = links.filter(href => 
      href.toLowerCase().endsWith('.pdf') || 
      href.toLowerCase().endsWith('.doc') || 
      href.toLowerCase().endsWith('.docx')
    );

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
          hasTitle: !!title,
          hasDownloads: downloadUrls.length
        }
      });

    return {
      content: content.replace(/\s+/g, ' ').trim(),
      links,
      title,
      lastUpdated,
      downloadUrls
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
               lower.includes('requirement') ||
               lower.includes('policy') ||
               lower.includes('guidance');
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