import { syslog, LogLevel, LogFacility } from './syslog';
import { scrapeAgencyWebsite } from './web-scraper';

/**
 * Fetches regulation data using web scraping
 */
export async function fetchRegulationFromAgency(regulationId: string): Promise<any> {
  try {
    const agency = regulationId.split('-')[0];

    if (agency !== 'DOL') {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Unsupported agency: ${agency}`);
      return null;
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      `Fetching regulation data for ${regulationId}`);

    // Extract regulation number and determine URL
    const regulationNumber = regulationId.split('-').slice(1).join('-');
    const baseUrl = 'https://www.dol.gov/agencies/oasam/regulatory/statutes';

    try {
      const scrapedData = await scrapeAgencyWebsite(baseUrl);

      if (scrapedData) {
        return {
          id: regulationId,
          source: 'web-scraper',
          data: scrapedData,
          timestamp: new Date().toISOString()
        };
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `No data found for regulation ${regulationId}`);
      return null;

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