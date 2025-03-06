import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import axios from 'axios';

async function testDOLAPI() {
  try {
    // Test with a regulation ID
    const testIds = ['DOL-2024-001']; // Regulation ID format based on DOL standards

    console.log('\nStarting DOL API Integration Test...');
    console.log('Testing regulation IDs:', testIds);

    for (const regulationId of testIds) {
      try {
        console.log(`\nTesting regulation ID: ${regulationId}`);

        // First try to fetch metadata to understand the API structure
        const baseUrl = 'https://apiprod.dol.gov/v4';
        const metadataUrl = `${baseUrl}/get/regulations/json/metadata`;

        console.log('\nFetching metadata from:', metadataUrl);
        const metadataResponse = await axios.get(metadataUrl, {
          params: {
            'X-API-KEY': process.env.DOL_API_KEY
          },
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        console.log('\nMetadata Response:');
        console.log('Status:', metadataResponse.status);
        console.log('Headers:', metadataResponse.headers);
        console.log('Data:', JSON.stringify(metadataResponse.data, null, 2));

        // Now attempt to fetch the regulation data
        console.log('\nFetching regulation data...');
        const result = await fetchRegulationFromAPI(regulationId);

        console.log('\nRegulation Data Response:');
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
            console.error('URL:', error.config.url);
            console.error('Method:', error.config.method);
            console.error('Headers:', JSON.stringify(error.config.headers, null, 2));
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