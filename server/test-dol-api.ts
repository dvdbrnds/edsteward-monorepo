import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './syslog';
import axios from 'axios';

async function testDOLAPI() {
  try {
    // Test with a regulation ID
    const testIds = ['DOL-2024-001'];

    console.log('\nStarting DOL API Integration Test...');

    // Verify API key is available
    if (!process.env.DOL_API_KEY) {
      console.error('DOL_API_KEY environment variable is not set');
      process.exit(1);
    }

    const apiKey = process.env.DOL_API_KEY.trim();
    console.log('\nAPI Key Information:');
    console.log('Length:', apiKey.length);
    console.log('First few characters:', apiKey.substring(0, 4) + '...');
    console.log('Contains special characters:', /[^a-zA-Z0-9]/.test(apiKey));

    console.log('\nTesting regulation IDs:', testIds);

    for (const regulationId of testIds) {
      try {
        console.log(`\nTesting regulation ID: ${regulationId}`);

        // Construct the request URL exactly as per DOL API guide
        const baseUrl = 'https://apiprod.dol.gov/v4/get';
        const regulationNumber = regulationId.split('-').slice(1).join('-');
        const filterObject = {
          field: "regulation_number",
          operator: "eq",
          value: regulationNumber
        };

        const url = `${baseUrl}/OASAM/regulatory/statutes/json`;
        console.log('\nFetching regulation data from:', url);
        console.log('Filter object:', JSON.stringify(filterObject, null, 2));
        console.log('API Key will be sent in headers');

        const result = await fetchRegulationFromAPI(regulationId);

        console.log('\nAPI Response Data:');
        if (result) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('No data returned from API');
        }

      } catch (error) {
        console.error('\nError fetching regulation:', error.message);

        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.error('\nResponse Error Details:');
            console.error('Status:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
          }

          if (error.config) {
            console.error('\nRequest Details:');
            console.error('URL:', error.config.url?.replace(apiKey, '***'));
            console.error('Method:', error.config.method);
            console.error('Headers:', JSON.stringify({
              ...error.config.headers,
              'X-API-KEY': '***'  // Mask the API key in logs
            }, null, 2));
            console.error('Parameters:', JSON.stringify(error.config.params, null, 2));
          }

          console.error('\nDetailed Error Information:');
          console.error('Name:', error.name);
          console.error('Message:', error.message);
          console.error('Code:', error.code);
        }
      }
    }
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Run the test
testDOLAPI().catch(console.error);