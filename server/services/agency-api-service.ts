import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';

interface AgencyAPIConfig {
  baseUrl: string;
  endpoints: {
    metadata: string;
    data: string;
  };
  headers?: Record<string, string>;
}

const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov/v4',
    endpoints: {
      metadata: '/get/regulations/json/metadata',
      data: '/get/regulations/json'
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
};

export async function fetchRegulationFromAPI(regulationId: string): Promise<any> {
  try {
    // Extract agency from regulation ID (e.g., "DOL" from "DOL-2024-001")
    const agency = regulationId.split('-')[0];

    if (!AGENCY_APIS[agency]) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `No API configuration found for agency: ${agency}`);
      return null;
    }

    if (!process.env.DOL_API_KEY) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        'DOL API key not found in environment variables');
      throw new Error('DOL API key is required');
    }

    const config = AGENCY_APIS[agency];

    try {
      // First fetch metadata to understand the structure
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Fetching regulation metadata');

      const metadataResponse = await axios.get(
        `${config.baseUrl}${config.endpoints.metadata}`,
        {
          params: {
            'X-API-KEY': process.env.DOL_API_KEY
          },
          headers: {
            ...config.headers,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Received metadata response:', {
          id: "METADATA_RESPONSE",
          parameters: {
            status: metadataResponse.status,
            contentType: metadataResponse.headers['content-type'],
            data: metadataResponse.data
          }
        });

      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      // Now fetch the actual regulation data
      const regulationResponse = await axios.get(
        `${config.baseUrl}${config.endpoints.data}`,
        {
          params: {
            'X-API-KEY': process.env.DOL_API_KEY,
            'regulation_number': regulationNumber
          },
          headers: config.headers,
          timeout: 10000
        }
      );

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Received regulation data response:', {
          id: "REGULATION_RESPONSE",
          parameters: {
            status: regulationResponse.status,
            contentType: regulationResponse.headers['content-type'],
            data: regulationResponse.data
          }
        });

      return regulationResponse.data;

    } catch (error) {
      const errorDetails = axios.isAxiosError(error) ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        request: {
          method: error.config?.method,
          url: error.config?.url,
          headers: error.config?.headers
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
      'Failed to process regulation request:', {
        id: "REQUEST_ERROR",
        parameters: {
          regulationId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}