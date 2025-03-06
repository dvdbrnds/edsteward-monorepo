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
  sections?: Array<{
    title: string;
    content: string;
    identifiers?: string[];
  }>;
}

// Pattern matching helper function
function findRegulationIdentifiers(text: string): string[] {
  const patterns = [
    // USC citations
    /\b\d{2}\s*U\.?S\.?C\.?\s*[§\s]?\s*\d+/i,
    // Public Law citations
    /\bPub(?:lic)?\s*\.?\s*L(?:aw)?\.?\s*\d+[-–]\d+/i,
    // CFR citations
    /\b\d+\s*CFR\s*(?:Part\s*)?\d+/i,
    // Executive Orders
    /\bExecutive\s*Order\s*\d+/i,
    // Section numbers
    /\b(?:Section|§)\s*\d+(?:\.\d+)*\b/i,
    // Title references in Acts
    /\bTitle\s+[IVX]+(?:\s+of\s+(?:the\s+)?[A-Za-z\s]+(?:Act|Amendment))?/i,
    // Act names with dates
    /\b[A-Za-z\s]+Act\s+of\s+\d{4}/i,
    // Section references with context
    /\bSection\s+\d+(?:\s+of\s+(?:the\s+)?[A-Za-z\s]+(?:Act|Amendment))?/i
  ];

  const identifiers = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches) {
      matches.forEach(match => identifiers.add(match.trim()));
    }
  }

  return Array.from(identifiers);
}

async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 45000
    });

    await page.waitForSelector('body');
    const content = await page.content();

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Successfully fetched content with Puppeteer (${content.length} bytes)`);

    return content;

  } finally {
    await browser.close();
  }
}

export async function scrapeAgencyWebsite(url: string): Promise<ScrapedRegulationData> {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Starting to scrape data from ${url}`);

    let content: string;
    let $: cheerio.CheerioAPI;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 ComplianceBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 30000
      });

      content = response.data;
      $ = cheerio.load(content);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Successfully fetched content with axios (${content.length} bytes)`);

    } catch (axiosError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Axios request failed, falling back to Puppeteer: ${axiosError.message}`);

      content = await scrapeWithPuppeteer(url);
      $ = cheerio.load(content);
    }

    // Extract regulation sections
    const sections: Array<{title: string; content: string; identifiers: string[]}> = [];

    // Try multiple selectors to find regulation content
    const mainContent = $('.usa-prose, main, #main-content, article').first();

    if (mainContent.length) {
      // Find all regulation sections using headers
      mainContent.find('h1, h2, h3').each((_, header) => {
        const $header = $(header);
        const title = $header.text().trim();

        // Get content up to the next header
        const contentElements = $header.nextUntil('h1, h2, h3').filter('p, ul, ol');
        const content = contentElements.map((_, elem) => $(elem).text().trim()).get().join('\n\n');

        // Only include sections with substantial content
        if (content.length > 50) {
          const combinedText = `${title}\n${content}`;
          const identifiers = findRegulationIdentifiers(combinedText);

          sections.push({
            title,
            content,
            identifiers
          });

          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
            `Found regulation section: ${title} (${content.length} chars, ${identifiers.length} identifiers)`);
        }
      });
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

    // Log what we found
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Scraped content details:`, {
        title,
        contentLength: content.length,
        sectionsFound: sections.length,
        linksFound: links.length,
        downloadUrls: downloadUrls.length
      });

    return {
      content,
      links,
      title,
      lastUpdated,
      downloadUrls,
      source: 'HTML',
      sections
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

// Map regulation IDs to their authoritative source URLs
const REGULATION_URLS = {
  'TITLE-IX-2024': [
    'https://www2.ed.gov/about/offices/list/ocr/docs/t9interp.html',
    'https://www2.ed.gov/about/offices/list/ocr/titleix.html'
  ],
  'FERPA-2024-UPDATE': [
    'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html',
    'https://www2.ed.gov/policy/gen/guid/fpco/ferpa/students.html'
  ],
  'ADA-2024-001': [
    'https://www.ada.gov/education/higher-ed-guidance/',
    'https://www.ada.gov/education/higher-ed-requirements/'
  ]
};

// Content selectors in order of preference
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
  '.compliance-requirements',
  '.legal-requirements',
  '.reporting-requirements',
  '.deadlines',
  '.submission-guidelines',
  '.container',
  '#main-content',
  '.page-content',
  '.entry-content'
];

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