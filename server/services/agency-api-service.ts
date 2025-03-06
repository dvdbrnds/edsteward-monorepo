import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';
import { URL } from 'url';

interface AgencyAPIConfig {
  baseUrl: string;
  agency: string;
  endpoint: string;
}

// Initialize with the base URL, agency and endpoint will be set dynamically
const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://apiprod.dol.gov',
    agency: '',  // Will be set based on datasets response
    endpoint: '' // Will be set based on datasets response
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

    // First verify we can access the datasets endpoint
    const datasetsUrl = `${config.baseUrl}/v4/datasets`;

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      'Querying available datasets');

    const datasetsResponse = await axios.get(datasetsUrl);

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
      'Found datasets:', {
        count: datasetsResponse.data?.datasets?.length || 0
      });

    // Look for labor regulations related dataset
    let regulationsDataset = null;
    if (datasetsResponse.data?.datasets) {
      regulationsDataset = datasetsResponse.data.datasets.find(dataset => 
        dataset.name.toLowerCase().includes('labor standards') ||
        dataset.name.toLowerCase().includes('regulations') ||
        dataset.description.toLowerCase().includes('labor standards') ||
        dataset.description.toLowerCase().includes('regulations')
      );

      if (regulationsDataset) {
        config.agency = regulationsDataset.agency;
        config.endpoint = regulationsDataset.api_url;

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          'Found relevant dataset:', {
            name: regulationsDataset.name,
            agency: config.agency,
            endpoint: config.endpoint
          });
      } else {
        // Use the example dataset for testing
        config.agency = 'trng';
        config.endpoint = 'training_dataset_industries';

        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          'No regulation dataset found, using example dataset for testing');
      }
    }

    // Build data request URL following the guide format
    const dataUrl = new URL(`${config.baseUrl}/v4/get/${config.agency}/${config.endpoint}/json`);
    dataUrl.searchParams.append('X-API-KEY', apiKey);
    dataUrl.searchParams.append('limit', '10');

    // Extract regulation ID components
    const regulationNumber = regulationId.split('-').slice(1).join('-');

    // Build filter object using lowercase keywords as required by API
    const filterObject = {
      "field": "regulation_number",
      "operator": "eq",
      "value": regulationNumber.toLowerCase()
    };

    dataUrl.searchParams.append('filter_object', JSON.stringify(filterObject));

    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG,
      'Making API request:', {
        url: dataUrl.toString().replace(apiKey, '***'),
        filterObject
      });

    const response = await axios.get(dataUrl.toString());

    // Handle nested data structure
    if (response.data?.data) {
      return response.data.data;
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
      'No data found in API response');
    return null;

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
}