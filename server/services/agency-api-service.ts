import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';
import { URL } from 'url';
import { scrapeAgencyWebsite } from './web-scraper';

interface AgencyAPIConfig {
  baseUrl: string;
  agency: string;
  endpoint: string;
  useWebScraper: boolean;
}

// Initialize configurations
const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov',
    agency: '',
    endpoint: '',
    useWebScraper: true // Default to web scraping for DOL
  }
};

export async function fetchRegulationFromAPI(regulationId: string): Promise<any> {
  try {
    const agency = regulationId.split('-')[0];

    if (!AGENCY_APIS[agency]) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `No API configuration found for agency: ${agency}`);
      return null;
    }

    const config = AGENCY_APIS[agency];

    // If web scraping is enabled for this agency, use that approach
    if (config.useWebScraper) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Using web scraper for ${agency} regulation data`);

      // Extract regulation number and determine URL
      const regulationNumber = regulationId.split('-').slice(1).join('-');
      const baseUrl = 'https://www.dol.gov/agencies/oasam/regulatory/statutes';

      try {
        const scrapedData = await scrapeAgencyWebsite(baseUrl);

        // Process and format the scraped data
        if (scrapedData) {
          return {
            id: regulationId,
            source: 'web-scraper',
            data: scrapedData,
            timestamp: new Date().toISOString()
          };
        }
      } catch (scrapeError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          'Web scraping failed:', {
            error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
          });
      }
    }

    // Fallback to API if available and web scraping failed or is disabled
    if (process.env.DOL_API_KEY) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Attempting API fallback for regulation data');

      const apiKey = process.env.DOL_API_KEY.trim();
      const datasetsUrl = `${config.baseUrl}/v4/datasets`;

      const datasetsResponse = await axios.get(datasetsUrl);

      if (datasetsResponse.data?.datasets) {
        // Log available datasets for debugging
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
          'Available datasets:', {
            count: datasetsResponse.data.datasets.length,
            names: datasetsResponse.data.datasets.map(d => d.name)
          });
      }

      return {
        id: regulationId,
        source: 'api',
        status: 'limited_data',
        message: 'Full regulation data not available via API',
        timestamp: new Date().toISOString()
      };
    }

    return null;

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