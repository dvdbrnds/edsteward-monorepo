import { syslog, LogLevel, LogFacility } from './services/syslog';
import * as crypto from 'crypto';
import { URL } from 'url';

function generateTestSignature(method: string, path: string, apiKey: string): void {
  try {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0].replace(/-/g, '');
    const region = 'us-east-1';
    const service = 'execute-api';

    // Clean the API key to remove any whitespace
    const cleanApiKey = apiKey.trim();

    // Step 1: Create canonical request
    // Split path and query string
    const [urlPath, queryString = ''] = path.split('?');

    // Sort and encode query parameters
    const queryParams = queryString
      .split('&')
      .filter(p => p)
      .map(param => {
        const [key, value] = param.split('=');
        return {
          key: decodeURIComponent(key),
          value: decodeURIComponent(value || '')
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const canonicalHeaders = [
      'content-type:application/json',
      'host:api.dol.gov',
      `x-amz-date:${timestamp}`
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-amz-date';

    const canonicalRequest = [
      method,
      urlPath,
      queryParams,
      canonicalHeaders,
      signedHeaders,
      crypto.createHash('sha256').update('').digest('hex')
    ].join('\n');


    // Step 2: Create string to sign
    const scope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp,
      scope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');


    // Step 3: Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${cleanApiKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');


    // Step 4: Create authorization header
    const authHeader = `AWS4-HMAC-SHA256 Credential=${cleanApiKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;


    // Log for curl testing

  } catch (error) {
    console.error('Error generating test signature:', error);
  }
}

// Test with a sample request
const testPath = '/V1/regulations/search?regulationNumber=2024-001&format=json';
const testApiKey = process.env.DOL_API_KEY || '';

if (!testApiKey) {
  console.error('DOL_API_KEY environment variable is required');
  process.exit(1);
}


generateTestSignature('GET', testPath, testApiKey);