import { syslog, LogLevel, LogFacility } from './services/syslog';
import * as crypto from 'crypto';

function generateTestSignature(method: string, path: string, apiKey: string): void {
  try {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0].replace(/-/g, '');
    const region = 'us-east-1';
    const service = 'execute-api';

    // Step 1: Create canonical request
    const canonicalHeaders = `host:api.dol.gov\nx-amz-date:${timestamp}\n`;
    const signedHeaders = 'host;x-amz-date';

    const canonicalRequest = [
      method,
      path,
      '', // Query string will be handled in actual implementation
      canonicalHeaders,
      signedHeaders,
      crypto.createHash('sha256').update('').digest('hex')
    ].join('\n');

    console.log('\nStep 1: Canonical Request:');
    console.log(canonicalRequest);

    // Step 2: Create string to sign
    const scope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp,
      scope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    console.log('\nStep 2: String to Sign:');
    console.log(stringToSign);

    // Step 3: Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${apiKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    console.log('\nStep 3: Signature:');
    console.log(signature);

    // Step 4: Create authorization header
    const authHeader = [
      'AWS4-HMAC-SHA256',
      `Credential=${apiKey}/${scope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');

    console.log('\nStep 4: Authorization Header:');
    console.log(authHeader);

    // Log for curl testing
    console.log('\nTest with curl:');
    console.log('curl -v \\');
    console.log(`  -H "Authorization: ${authHeader}" \\`);
    console.log(`  -H "x-amz-date: ${timestamp}" \\`);
    console.log('  -H "Accept: application/json" \\');
    console.log(`  "https://api.dol.gov${path}"`);

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

console.log('Testing AWS v4 Signature Generation');
console.log('===================================');
console.log('Test Parameters:');
console.log(`Method: GET`);
console.log(`Path: ${testPath}`);
console.log(`API Key: ${testApiKey.substring(0, 8)}...`);

generateTestSignature('GET', testPath, testApiKey);