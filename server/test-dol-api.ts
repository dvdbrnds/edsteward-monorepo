import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './syslog';
import axios from 'axios';
import { URL } from 'url';

async function testDOLAPI() {
  try {
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

    // First check datasets endpoint access
    const baseUrl = 'https://apiprod.dol.gov';
    console.log('\nChecking datasets endpoint access...');

    const datasetsResponse = await axios.get(`${baseUrl}/v4/datasets`);
    console.log('\nDatasets Response:');
    console.log('Status:', datasetsResponse.status);
    console.log('Number of datasets:', datasetsResponse.data?.datasets?.length || 0);

    // Log dataset names for reference
    if (datasetsResponse.data?.datasets) {
      console.log('\nAvailable Datasets:');
      datasetsResponse.data.datasets.forEach((dataset: any, index: number) => {
        console.log(`${index + 1}. ${dataset.name} (${dataset.id})`);
      });
    }

    console.log('\nTesting regulation IDs:', testIds);

    for (const regulationId of testIds) {
      try {
        console.log(`\nTesting regulation ID: ${regulationId}`);

        const regNumber = regulationId.split('-').slice(1).join('-');
        console.log('Regulation Number:', regNumber);

        // Show request details
        const requestUrl = new URL(`${baseUrl}/v4/regulations/search`);
        requestUrl.searchParams.append('X-API-KEY', apiKey);
        requestUrl.searchParams.append('format', 'json');
        requestUrl.searchParams.append('number', regNumber);

        console.log('\nRequest Details:');
        console.log('URL (masked):', requestUrl.toString().replace(apiKey, '***'));
        console.log('Parameters:', {
          format: 'json',
          number: regNumber
        });

        // Attempt to fetch the regulation data
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

        if (axios.isAxiosError(error) && error.response) {
          console.error('\nResponse Error Details:');
          console.error('Status:', error.response.status);
          console.error('Status Text:', error.response.statusText);
          console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

          console.error('\nRequest Details:');
          console.error('URL:', error.config.url?.replace(apiKey, '***'));
          console.error('Method:', error.config.method);
        }
      }
    }
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

testDOLAPI().catch(console.error);