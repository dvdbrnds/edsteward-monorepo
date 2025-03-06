import axios from 'axios';
import { syslog, LogLevel, LogFacility } from './syslog';
import * as crypto from 'crypto';

interface AgencyAPIConfig {
  baseUrl: string;
  endpoints: {
    regulations: string;
    requirements?: string;
    guidance?: string;
  };
  headers?: Record<string, string>;
}

const AGENCY_APIS = {
  'DOL': {
    baseUrl: 'https://api.dol.gov/V1',
    endpoints: {
      regulations: '/regulations/search',
      requirements: '/compliance/requirements',
      guidance: '/compliance/guidance'
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
};

function signDOLRequest(method: string, path: string, queryParams: Record<string, string>, apiKey: string): { headers: Record<string, string> } {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0].replace(/-/g, '');
  const region = 'us-east-1';
  const service = 'execute-api';
  const cleanApiKey = apiKey.trim();

  // Sort and encode query parameters according to AWS v4 specs
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  // Ensure headers are lowercase and trimmed per AWS v4 specs
  const canonicalHeaders = [
    'content-type:application/json',
    'host:api.dol.gov',
    `x-amz-date:${timestamp}`,
    `x-amz-security-token:${cleanApiKey}`  // Add security token header
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-date;x-amz-security-token';

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update('').digest('hex')
  ].join('\n');

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
    'Generated canonical request', {
      id: "CANONICAL_REQUEST",
      parameters: {
        method,
        path,
        queryString: canonicalQueryString,
        headers: canonicalHeaders,
        signedHeaders,
        canonicalRequest: canonicalRequest.replace(/\n/g, '\\n')
      }
    });

  // Create string to sign
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${cleanApiKey}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
    'Generated AWS v4 signature', {
      id: "AUTH_SIGNATURE",
      parameters: {
        timestamp,
        scope,
        signedHeaders,
        signature
      }
    });

  // Construct authorization header exactly according to AWS v4 spec
  const authHeader = [
    'AWS4-HMAC-SHA256',
    `Credential=${cleanApiKey}/${scope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(' ');

  return {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Host': 'api.dol.gov',
      'x-amz-date': timestamp,
      'x-amz-security-token': cleanApiKey,
      'Accept': 'application/json'
    }
  };
}

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

    if (!process.env[`${agency}_API_KEY`]) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Missing API key for ${agency}`);
      return null;
    }

    const apiKey = process.env[`${agency}_API_KEY`];

    // Extract regulation number from ID (e.g., "2024-001" from "DOL-2024-001")
    const regulationNumber = regulationId.split('-').slice(1).join('-');

    try {
      const path = '/V1/regulations/search';
      const queryParams = {
        regulationNumber,
        format: 'json'
      };

      const { headers: authHeaders } = signDOLRequest('GET', path, queryParams, apiKey);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Making DOL API request`, {
          id: "API_REQUEST",
          parameters: {
            method: 'GET',
            path,
            queryParams,
            headers: authHeaders
          }
        });

      // Make the API request
      const regulationResponse = await axios.get(
        `${config.baseUrl}${path}`,
        {
          headers: authHeaders,
          params: queryParams,
          timeout: 10000,
          validateStatus: null
        }
      );

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        `Received response from DOL API`, {
          id: "API_RESPONSE",
          parameters: {
            status: regulationResponse.status,
            statusText: regulationResponse.statusText,
            contentType: regulationResponse.headers['content-type'],
            dataSize: regulationResponse.data ? JSON.stringify(regulationResponse.data).length : 0,
            headers: regulationResponse.headers,
            data: regulationResponse.data
          }
        });

      if (regulationResponse.status !== 200) {
        throw new Error(`API returned status ${regulationResponse.status}: ${regulationResponse.statusText}`);
      }

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
        `Failed to fetch regulation from DOL API`, {
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
      `Failed to fetch regulation from API`, {
        id: "API_ERROR",
        parameters: {
          regulationId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    throw error;
  }
}