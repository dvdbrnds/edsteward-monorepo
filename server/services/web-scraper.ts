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
  source?: string;
}

// Map regulation IDs to their authoritative source URLs
const REGULATION_URLS = {
  'TITLE-IX-2024': [
    'https://www2.ed.gov/about/offices/list/ocr/docs/t9interp.html',
    'https://www2.ed.gov/about/offices/list/ocr/titleix.html', // Main Title IX page
    'https://www2.ed.gov/about/offices/list/ocr/docs/tix_dis.html' // Title IX guidance
  ],
  'CLERY-ACT-2024': [
    'https://www2.ed.gov/admins/lead/safety/campus.html',
    'https://www2.ed.gov/admins/lead/safety/clery.html'
  ],
  'FERPA-2024-UPDATE': [
    'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html',
    'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/students.html',
    'https://www2.ed.gov/policy/gen/reg/ferpa/index.html'
  ],
  'ADA-2024-001': [
    'https://www.ada.gov/education/higher-ed-guidance/',
    'https://www.ada.gov/education/higher-ed-requirements/',
    'https://www.ada.gov/resources/higher-education-guidance/'
  ]
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
  '[data-content-type="regulation"]',
  '.regulation-text',
  '.requirement-details',
  '.policy-requirements',
  '[data-type="regulation"]',
  '[data-content="policy"]',
  '.law-content',
  '.statute-text',
  '#regulationText',
  '.requirements-list',
  // Additional selectors for regulation-specific content
  '.compliance-requirements',
  '.legal-requirements',
  '.reporting-requirements',
  '.deadlines',
  '.submission-guidelines',
  // Broader fallback selectors
  '.container',
  '#main-content',
  '.page-content',
  '.entry-content'
];

async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 45000 // Increased timeout for slower pages
    });

    // Wait for content to load
    for (const selector of CONTENT_SELECTORS) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        const content = await page.$eval(selector, el => el.textContent || '');
        if (content.length > 100) {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Found content using Puppeteer with selector: ${selector}`);
          return content;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: get all visible text content
    return await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            if (!node.parentElement) return NodeFilter.FILTER_REJECT;
            const style = window.getComputedStyle(node.parentElement);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let text = '';
      let node;
      while (node = walker.nextNode()) {
        text += node.textContent + ' ';
      }
      return text.trim();
    });
  } finally {
    await browser.close();
  }
}

export async function scrapeRegulationUrls(regulationId: string): Promise<ScrapedRegulationData[]> {
  const urls = REGULATION_URLS[regulationId] || [];
  if (!urls.length) {
    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      `No predefined URLs found for regulation ${regulationId}`);
    return [];
  }

  const results: ScrapedRegulationData[] = [];
  for (const url of urls) {
    try {
      const data = await scrapeAgencyWebsite(url);
      if (data.content) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Successfully scraped content from ${url}`, {
            id: "SCRAPE_SUCCESS",
            parameters: {
              url,
              contentLength: data.content.length,
              title: data.title || 'Untitled',
              preview: data.content.substring(0, 100) + '...'
            }
          });
        results.push({
          ...data,
          source: 'HTML'
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Failed to scrape URL ${url} for regulation ${regulationId}`, {
          id: "SCRAPE_ERROR",
          parameters: {
            url,
            regulationId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
    }
  }

  // Log summary of scraped content
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
    `Scraped ${results.length} sources for regulation ${regulationId}`, {
      id: "SCRAPE_SUMMARY",
      parameters: {
        regulationId,
        totalSources: results.length,
        htmlSources: results.filter(r => r.source === 'HTML').length,
        totalContentLength: results.reduce((sum, r) => sum + r.content.length, 0)
      }
    });

  return results;
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
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Found content using selector: ${selector}`);
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
      href.toLowerCase().includes('/pdf/') ||
      href.toLowerCase().includes('/docs/') ||
      href.toLowerCase().includes('/regs/') ||
      href.toLowerCase().includes('/guidance/')
    );

    // Try to find the page title
    const title = $('h1').first().text().trim() || 
                 $('title').text().trim();

    // Try to find last updated date
    const lastUpdated = $('[data-last-updated], .last-updated, .modified, time')
      .first()
      .text()
      .trim();

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