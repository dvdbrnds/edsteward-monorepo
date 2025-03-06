import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDOLAPI() {
  try {
    // Test with known regulation IDs
    const testIds = [
      'DOL-2024-001',
      'DOL-2024-002'
    ];

    console.log('Starting DOL API Integration Test...');
    console.log('Testing regulation IDs:', testIds);

    for (const regulationId of testIds) {
      console.log(`\nTesting regulation ID: ${regulationId}`);

      try {
        // Make a direct API request first to test authorization
        const timestamp = new Date().toISOString();
        const baseUrl = 'https://api.dol.gov';
        const path = '/V1/regulations/search';
        const regulationNumber = regulationId.split('-').slice(1).join('-');

        console.log('\nMaking test request with following parameters:');
        console.log('URL:', `${baseUrl}${path}`);
        console.log('Regulation Number:', regulationNumber);
        console.log('Timestamp:', timestamp);

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

        // Log the complete error for troubleshooting
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

// Execute curl test command to verify AWS signature directly
async function testWithCurl() {
  try {
    console.log('\nTesting AWS signature with curl...');
    const testUrl = 'https://api.dol.gov/V1/regulations/search?regulationNumber=2024-001&format=json';
    const timestamp = new Date().toISOString();

    // Use the DOL API key from environment
    const apiKey = process.env.DOL_API_KEY;
    if (!apiKey) {
      throw new Error('DOL_API_KEY not found in environment');
    }

    const date = timestamp.split('T')[0].replace(/-/g, '');
    const scope = `${date}/us-east-1/execute-api/aws4_request`;
    const authHeader = `AWS4-HMAC-SHA256 Credential=${apiKey}/${scope}`;

    const curlCmd = `curl -v -X GET "${testUrl}" \
      -H "Host: api.dol.gov" \
      -H "x-amz-date: ${timestamp}" \
      -H "Authorization: ${authHeader}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json"`;

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

// Run both tests
async function runTests() {
  await testWithCurl();
  await testDOLAPI();
}

runTests().catch(console.error);