import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';

interface AgencyAPIConfig {
  baseUrl: string;
  agency: string;
  endpoint: string;
}

const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov/v4/get',
    agency: 'OASAM',
    endpoint: 'regulatory/statutes'
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
    const apiKey = process.env.DOL_API_KEY.trim();

    try {
      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      // Build filter object according to DOL API guide format
      const filterObject = {
        field: "regulation_number",
        operator: "eq",
        value: regulationNumber
      };

      // Construct URL according to DOL API guide template
      const dataUrl = `${config.baseUrl}/${config.agency}/${config.endpoint}/json`;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        'Fetching regulation data:', {
          url: dataUrl.replace(apiKey, '***'),
          filterObject
        });

      const regulationResponse = await axios.get(dataUrl, {
        params: {
          'filter_object': JSON.stringify(filterObject)
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
        headers: error.response?.headers,
        data: error.response?.data,
        request: {
          method: error.config?.method,
          url: error.config?.url?.replace(apiKey, '***'),
          headers: error.config?.headers,
          params: error.config?.params
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