import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';

interface AgencyAPIConfig {
  baseUrl: string;
  agency: string;
  endpoint: string;
}

const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov/v4',
    agency: 'OASAM',
    endpoint: 'regulatory/statutes'
  }
};

export async function fetchRegulationFromAPI(regulationId: string): Promise<any> {
  try {
    // Extract agency from regulation ID (e.g., "DOL" from "DOL-2024-001")
    const agency = regulationId.split('-')[0];

    if (!AGENCY_APIS[agency]) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `No API configuration found for agency: ${agency}`);
      return null;
    }

    if (!process.env.DOL_API_KEY) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        'DOL API key not found in environment variables');
      throw new Error('DOL API key is required');
    }

    const config = AGENCY_APIS[agency];
    const apiKey = process.env.DOL_API_KEY.trim();

    try {
      // First verify we can access the datasets endpoint
      const datasetsUrl = `${config.baseUrl}/datasets`;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Verifying API access with datasets endpoint');

      const datasetsResponse = await axios.get(datasetsUrl);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Successfully accessed datasets endpoint:', {
          status: datasetsResponse.status,
          dataCount: datasetsResponse.data?.datasets?.length || 0
        });

      // Now try to get metadata using both header and URL parameter
      const metadataUrl = `${config.baseUrl}/get/${config.agency}/${config.endpoint}/json/metadata?X-API-KEY=${apiKey}`;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Fetching metadata with API key in URL and header');

      const metadataResponse = await axios.get(metadataUrl, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey
        }
      });

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Metadata response:', {
          status: metadataResponse.status,
          data: metadataResponse.data
        });

      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      // Build filter object according to DOL API guide format
      const filterObject = {
        field: "regulation_number",
        operator: "eq",
        value: regulationNumber
      };

      // Now fetch the actual regulation data using the same authentication approach
      const dataUrl = `${config.baseUrl}/get/${config.agency}/${config.endpoint}/json?X-API-KEY=${apiKey}&filter_object=${encodeURIComponent(JSON.stringify(filterObject))}`;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Fetching regulation data');

      const regulationResponse = await axios.get(dataUrl, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey
        }
      });

      return regulationResponse.data;

    } catch (error) {
      const errorDetails = axios.isAxiosError(error) ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        data: error.response?.data,
        request: {
          method: error.config?.method,
          url: error.config?.url?.replace(apiKey, '***'),
          headers: {
            ...error.config?.headers,
            'X-API-KEY': '***'
          }
        }
      } : {};

      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        'Failed to fetch regulation data:', {
          id: "API_ERROR",
          parameters: {
            regulationId,
            error: error instanceof Error ? error.message : String(error),
            details: errorDetails
          }
        });
      throw error;
    }
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      'Failed to process regulation request:', error);
    throw error;
  }
}