import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';

interface AgencyAPIConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  endpoints: {
    regulations: string;
    requirements?: string;
    guidance?: string;
  };
}

// Map agency codes to their API configurations
const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://api.dol.gov/V1',
    endpoints: {
      regulations: '/regulations',
      requirements: '/compliance/requirements',
      guidance: '/compliance/guidance'
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

    const config = AGENCY_APIS[agency];

    // Check if we need an API key for this agency
    if (!process.env[`${agency}_API_KEY`]) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Missing API key for ${agency}`);
      return null;
    }

    const headers = {
      ...config.headers,
      'Authorization': `Bearer ${process.env[`${agency}_API_KEY`]}`
    };

    // DOL-specific API endpoints
    if (agency === 'DOL') {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Fetching regulation data from DOL API for ${regulationId}`);

      // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
      const regulationNumber = regulationId.split('-').slice(1).join('-');

      try {
        // First try to get the regulation details
        const regulationResponse = await axios.get(`${config.baseUrl}${config.endpoints.regulations}`, {
          headers,
          params: {
            regulationNumber,
            format: 'json'
          },
          timeout: 10000
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Successfully fetched regulation data from DOL API`, {
            id: "API_SUCCESS",
            parameters: {
              regulationId,
              dataSize: JSON.stringify(regulationResponse.data).length,
              endpoints: Object.keys(config.endpoints).join(', ')
            }
          });

        // If available, also fetch compliance requirements
        let requirementsData = null;
        if (config.endpoints.requirements) {
          try {
            const requirementsResponse = await axios.get(
              `${config.baseUrl}${config.endpoints.requirements}/${regulationNumber}`,
              { headers, timeout: 10000 }
            );
            requirementsData = requirementsResponse.data;
          } catch (reqError) {
            syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
              `Failed to fetch requirements data, continuing with regulation data only`, {
                id: "REQUIREMENTS_ERROR",
                parameters: {
                  error: reqError instanceof Error ? reqError.message : String(reqError)
                }
              });
          }
        }

        return {
          ...regulationResponse.data,
          requirements: requirementsData
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = axios.isAxiosError(error) ? {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        } : {};

        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
          `Failed to fetch regulation from DOL API`, {
            id: "API_ERROR",
            parameters: {
              regulationId,
              error: errorMessage,
              details: errorDetails
            }
          });
        return null;
      }
    }

    return null;
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Failed to fetch regulation from API`, {
        id: "API_ERROR",
        parameters: {
          regulationId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    return null;
  }
}