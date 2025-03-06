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
    agency: 'WHD',
    endpoint: 'regulations'  // Updated to match guide format
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
      // First verify datasets endpoint access
      const datasetsUrl = new URL(`${config.baseUrl}/v4/datasets`);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Verifying datasets endpoint access');

      const datasetsResponse = await axios.get(datasetsUrl.toString());

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Successfully accessed datasets endpoint:', {
          status: datasetsResponse.status,
          dataCount: datasetsResponse.data?.datasets?.length || 0
        });

      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      // Try regulations endpoint with format from guide
      const regUrl = new URL(`${config.baseUrl}/v4/${config.endpoint}/search`);
      regUrl.searchParams.append('X-API-KEY', apiKey);
      regUrl.searchParams.append('format', 'json');
      regUrl.searchParams.append('number', regulationNumber);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Fetching regulation data:', {
          url: regUrl.toString().replace(apiKey, '***'),
          regulationNumber
        });

      const response = await axios.get(regUrl.toString());
      return response.data;

    } catch (error) {
      const errorDetails = axios.isAxiosError(error) ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        request: {
          method: error.config?.method,
          url: error.config?.url?.replace(apiKey, '***')
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