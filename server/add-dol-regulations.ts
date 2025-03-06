import { scrapeAgencyWebsite } from './services/web-scraper';
import { storage } from './storage';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import * as cheerio from 'cheerio';
import * as puppeteer from 'puppeteer';
import axios from 'axios';

/**
 * Extract regulations from the DOL website using web scraping
 */
async function addDOLRegulations() {
  try {
    const baseUrl = "https://www.dol.gov/agencies/oasam/regulatory/statutes";
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Starting DOL regulations collection from ${baseUrl}`);

    let content: string;
    let links: Array<{ href: string; text: string }> = [];

    try {
      // First try with Puppeteer
      const browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        content = await page.content();

        // Extract links using Puppeteer
        links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(link => ({
            href: link.href,
            text: link.textContent?.trim() || ''
          }));
        });

        await browser.close();
      } catch (error) {
        await browser.close();
        throw error;
      }
    } catch (puppeteerError) {
      // Fall back to basic axios request if Puppeteer fails
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Puppeteer failed, falling back to basic HTTP request: ${puppeteerError.message}`);

      const response = await axios.get(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 RegulationComplianceBot',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 30000
      });

      content = response.data;
      const $ = cheerio.load(content);

      links = $('a').map((_, el) => ({
        href: $(el).attr('href') || '',
        text: $(el).text().trim()
      })).get();
    }

    // Log the content length and preview
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Retrieved page content (${content.length} bytes)`);
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
      `Content preview:\n${content.substring(0, 500)}`);

    // Process and filter links
    const validLinks = links.filter(link => {
      if (!link.href || !link.text || link.text.length <= 5) return false;

      const isRelevant = 
        link.href.includes('/statutes/') ||
        link.href.includes('/regulatory/') ||
        link.href.includes('/laws/') ||
        (link.text.toLowerCase().includes('act') && !link.text.toLowerCase().includes('contact'));

      if (isRelevant) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Found regulation link: ${link.text} (${link.href})`);
      }

      return isRelevant;
    });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Found ${validLinks.length} potential regulation links`);

    // Process each regulation
    for (const link of validLinks) {
      try {
        // Normalize URL if it's relative
        const url = link.href.startsWith('http') 
          ? link.href 
          : `https://www.dol.gov${link.href.startsWith('/') ? '' : '/'}${link.href}`;

        // Check if regulation already exists
        const existingRegulations = await storage.searchRegulations(link.text);
        if (existingRegulations.length > 0) {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Regulation "${link.text}" already exists, skipping`);
          continue;
        }

        // Fetch regulation page content
        const regulationData = await scrapeAgencyWebsite(url);
        const $ = cheerio.load(regulationData.content);

        // Extract description using multiple selectors
        const description = 
          $('meta[name="description"]').attr('content') ||
          $('.regulation-summary').text().trim() ||
          $('.statute-description').text().trim() ||
          $('p').first().text().trim() ||
          `Department of Labor statute: ${link.text}`;

        // Create new regulation entry
        const regulation = {
          name: link.text,
          description,
          agency_url: url,
          category: "Labor",
          agencyName: "Department of Labor",
          jurisdiction: "federal",
          isApplicable: true,
          itemId: `DOL-${Date.now()}`,
          regulationType: "Statute",
          lastUpdated: new Date(),
          lastVerified: new Date(),
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          regulationUrl: url,
          regulationText: regulationData.content
        };

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Adding regulation: ${regulation.name}`);
        await storage.createRegulation(regulation);

      } catch (error) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Error processing regulation ${link.text}:`, {
            id: "REGULATION_PROCESSING_ERROR",
            parameters: {
              title: link.text,
              url: link.href,
              error: error instanceof Error ? error.message : String(error)
            }
          });
      }
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      'DOL regulations import complete');

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      'Error collecting DOL regulations:', {
        id: "COLLECTION_ERROR",
        parameters: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}

// Export for use in other modules
export { addDOLRegulations };

// Only run if called directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  addDOLRegulations().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}