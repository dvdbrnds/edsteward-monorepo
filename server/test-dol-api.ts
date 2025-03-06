import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

async function calculateSignature(method: string, path: string, queryParams: Record<string, string>, apiKey: string, timestamp: string): Promise<string> {
  const date = timestamp.split('T')[0].replace(/-/g, '');
  const region = 'us-east-1';
  const service = 'execute-api';
  const cleanApiKey = apiKey.trim();

  // Sort and encode query parameters
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const canonicalHeaders = [
    'content-type:application/json',
    'host:api.dol.gov',
    `x-amz-date:${timestamp}`,
    `x-amz-security-token:${cleanApiKey}`
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

  console.log('\nCanonical Request:');
  console.log(canonicalRequest);

  // Create string to sign
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  console.log('\nString to Sign:');
  console.log(stringToSign);

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${cleanApiKey}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  console.log('\nSignature:', signature);
  return signature;
}

async function testWithCurl() {
  try {
    console.log('\nTesting AWS signature with curl...');
    const path = '/V1/regulations/search';
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0].replace(/-/g, '');

    // Use the DOL API key from environment
    const apiKey = process.env.DOL_API_KEY;
    if (!apiKey) {
      throw new Error('DOL_API_KEY not found in environment');
    }

    const queryParams = {
      regulationNumber: '2024-001',
      format: 'json'
    };

    console.log('\nCalculating signature for:');
    console.log('Path:', path);
    console.log('Query Parameters:', queryParams);
    console.log('Timestamp:', timestamp);

    const signature = await calculateSignature(
      'GET',
      path,
      queryParams,
      apiKey,
      timestamp
    );

    const region = 'us-east-1';
    const service = 'execute-api';
    const scope = `${date}/${region}/${service}/aws4_request`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-security-token';

    // Create authorization header according to AWS v4 spec
    const authHeader = `AWS4-HMAC-SHA256 Credential=${apiKey.trim()}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const queryString = Object.entries(queryParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const curlCmd = `curl -v -X GET "https://api.dol.gov${path}?${queryString}" \
      -H "Host: api.dol.gov" \
      -H "Content-Type: application/json" \
      -H "x-amz-date: ${timestamp}" \
      -H "x-amz-security-token: ${apiKey.trim()}" \
      -H 'Authorization: ${authHeader}' \
      -H "Accept: application/json"`;

    console.log('\nExecuting curl command:');
    console.log(curlCmd.replace(apiKey, '***'));

    const { stdout, stderr } = await execAsync(curlCmd);
    console.log('\nCurl Response:');
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  } catch (error) {
    console.error('Curl test error:', error);
  }
}

async function testDOLAPI() {
  try {
    // Test with a single regulation ID
    const testIds = ['DOL-2024-001'];

    console.log('Starting DOL API Integration Test...');
    console.log('Testing regulation IDs:', testIds);

    for (const regulationId of testIds) {
      try {
        // Attempt to fetch regulation data
        const result = await fetchRegulationFromAPI(regulationId);

        if (result) {
          console.log('\nAPI Response Success:');
          console.log('Response Data:', JSON.stringify(result, null, 2));
        } else {
          console.log('\nNo data returned from API');
        }
      } catch (error) {
        console.error('\nError fetching regulation:', error.message);

        if (error.response) {
          console.error('\nResponse Error Details:');
          console.error('Status:', error.response.status);
          console.error('Status Text:', error.response.statusText);
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        }

        if (error.config) {
          console.error('\nRequest Details:');
          console.error('URL:', error.config.url);
          console.error('Method:', error.config.method);
          console.error('Headers:', JSON.stringify(error.config.headers, null, 2));
          console.error('Query Parameters:', error.config.params);
        }

        if (axios.isAxiosError(error)) {
          console.error('\nDetailed Error Information:');
          console.error('Name:', error.name);
          console.error('Message:', error.message);
          console.error('Code:', error.code);
          console.error('Stack:', error.stack);
        }
      }
    }
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Run both tests
async function runTests() {
  await testWithCurl();
  await testDOLAPI();
}

runTests().catch(console.error);