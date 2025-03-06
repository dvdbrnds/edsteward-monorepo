import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';
import { URL } from 'url';

interface AgencyAPIConfig {
  baseUrl: string;
  agency: string;
  endpoint: string;
}

const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov',
    agency: 'OASAM',
    endpoint: 'regulatory/statutes'
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

    if (!process.env.DOL_API_KEY) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        'DOL API key not found in environment variables');
      throw new Error('DOL API key is required');
    }

    const config = AGENCY_APIS[agency];
    const apiKey = process.env.DOL_API_KEY.trim();

    try {
      // First verify we can access the datasets endpoint
      const datasetsUrl = `${config.baseUrl}/v4/datasets`;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Verifying API access with datasets endpoint');

      const datasetsResponse = await axios.get(datasetsUrl);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Successfully accessed datasets endpoint:', {
          status: datasetsResponse.status,
          dataCount: datasetsResponse.data?.datasets?.length || 0
        });

      // Now get metadata following DOL API guide format
      const metadataUrl = `${config.baseUrl}/v4/get/${config.agency}/${config.endpoint}/json/metadata`;

      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
        'Making metadata request:', {
          url: metadataUrl
        });

      const metadataResponse = await axios.get(metadataUrl, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey
        }
      });

      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      // Build filter object for regulation number
      const filterObject = {
        field: "regulation_number",
        operator: "eq",
        value: regulationNumber
      };

      // Now fetch the actual regulation data
      const dataUrl = `${config.baseUrl}/v4/get/${config.agency}/${config.endpoint}/json`;

      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
        'Making regulation data request:', {
          url: dataUrl,
          filterObject
        });

      const regulationResponse = await axios.get(dataUrl, {
        params: {
          filter_object: JSON.stringify(filterObject)
        },
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
        data: error.response?.data,
        request: {
          method: error.config?.method,
          url: error.config?.url,
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