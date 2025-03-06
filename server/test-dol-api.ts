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

    // First verify we can access the datasets endpoint
    const baseUrl = 'https://apiprod.dol.gov/v4';
    console.log('\nVerifying API access with datasets endpoint:', `${baseUrl}/datasets`);

    const datasetsResponse = await axios.get(`${baseUrl}/datasets`);
    console.log('Successfully accessed datasets endpoint:', datasetsResponse.status);
    console.log('Number of datasets:', datasetsResponse.data?.datasets?.length || 0);

    console.log('\nTesting regulation IDs:', testIds);

    for (const regulationId of testIds) {
      try {
        console.log(`\nTesting regulation ID: ${regulationId}`);

        // Get metadata with API key in both URL and header
        const metadataUrl = `${baseUrl}/get/OASAM/regulatory/statutes/json/metadata?X-API-KEY=${apiKey}`;

        console.log('\nFetching metadata from:', metadataUrl.replace(apiKey, '***'));
        console.log('API Key will be sent in both URL and header');

        const metadataResponse = await axios.get(metadataUrl, {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': apiKey
          }
        });

        console.log('\nMetadata Response:');
        console.log('Status:', metadataResponse.status);
        console.log('Headers:', JSON.stringify(metadataResponse.headers, null, 2));
        console.log('Data:', JSON.stringify(metadataResponse.data, null, 2));

        // Now attempt to fetch the regulation data
        console.log('\nFetching regulation data...');
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
          console.error('\nResponse Error Details:');
          console.error('Status:', error.response?.status);
          console.error('Status Text:', error.response?.statusText);
          console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
          console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));

          console.error('\nRequest Details:');
          console.error('URL:', error.config?.url?.replace(apiKey, '***'));
          console.error('Method:', error.config?.method);
          if (error.config?.headers) {
            const safeHeaders = { ...error.config.headers };
            if (safeHeaders['X-API-KEY']) safeHeaders['X-API-KEY'] = '***';
            console.error('Headers:', JSON.stringify(safeHeaders, null, 2));
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