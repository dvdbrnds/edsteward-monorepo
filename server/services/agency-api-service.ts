import { syslog, LogLevel, LogFacility } from './syslog';
import { scrapeAgencyWebsite } from './web-scraper';
import * as cheerio from 'cheerio';

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

      if (scrapedData && scrapedData.content) {
        const $ = cheerio.load(scrapedData.content);

        // Log the page structure and content preview
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
          `Page title: ${$('title').text()}\n` +
          `Content preview: ${scrapedData.content.substring(0, 500)}`);

        // Try multiple selectors to find regulation content
        const contentSelectors = [
          '.usa-prose',
          'main',
          '#main-content',
          '.l-content',
          'article',
          'section'
        ];

        let foundContent = false;
        let regulationElements = [];

        for (const selector of contentSelectors) {
          const container = $(selector);
          if (container.length) {
            syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
              `Found content container using selector: ${selector}`);

            // Find all regulation sections
            const sections = container.find('h2, h3').map((_, el) => {
              const $el = $(el);
              const title = $el.text().trim();
              const contentElements = $el.nextUntil('h2, h3').filter('p, ul, ol');
              const content = contentElements.map((_, elem) => $(elem).text().trim()).get().join('\n');

              if (content.length > 50) { // Only include sections with substantial content
                syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
                  `Found regulation section: ${title} (${content.length} chars)`);
                return {
                  title,
                  content,
                  url: baseUrl
                };
              }
            }).get();

            if (sections.length > 0) {
              regulationElements = sections;
              foundContent = true;
              syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
                `Found ${sections.length} regulation sections using ${selector}`);
              break;
            }
          }
        }

        if (!foundContent) {
          // Fallback: try to find any substantial text blocks
          const textBlocks = $('p').filter((_, el) => {
            const text = $(el).text().trim();
            return text.length > 100; // Only substantial paragraphs
          }).map((_, el) => ({
            title: 'DOL Statute Section',
            content: $(el).text().trim(),
            url: baseUrl
          })).get();

          if (textBlocks.length > 0) {
            regulationElements = textBlocks;
            syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
              `Found ${textBlocks.length} text blocks as fallback`);
          }
        }

        if (regulationElements.length > 0) {
          // Map the found elements to our regulation format
          return regulationElements.map((item, index) => ({
            id: `${regulationId}-${index + 1}`,
            source: 'web-scraper',
            name: item.title,
            description: item.content.substring(0, 500) + '...',
            fullText: item.content,
            url: item.url,
            timestamp: new Date().toISOString()
          }));
        }
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `No regulation content found for ${regulationId}`);
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