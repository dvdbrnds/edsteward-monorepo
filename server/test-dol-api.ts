import { fetchRegulationFromAgency } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './syslog';
import axios from 'axios';
import { URL } from 'url';

async function testDOLAPI() {
  try {
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
    const baseUrl = 'https://apiprod.dol.gov';
    console.log('\nVerifying API access with datasets endpoint:', `${baseUrl}/v4/datasets`);

    const datasetsResponse = await axios.get(`${baseUrl}/v4/datasets`);
    console.log('Successfully accessed datasets endpoint:', datasetsResponse.status);
    console.log('Number of datasets:', datasetsResponse.data?.datasets?.length || 0);

    // Display available datasets with filtering for labor/regulation related ones
    if (datasetsResponse.data?.datasets) {
      console.log('\nAll Available Datasets:');
      datasetsResponse.data.datasets.forEach((dataset, index) => {
        console.log(`\n${index + 1}. ${dataset.name}`);
        console.log(`   Agency: ${dataset.agency}`);
        console.log(`   API URL: ${dataset.api_url}`);
        console.log(`   Description: ${dataset.description}`);
      });

      console.log('\nSearching for Labor/Regulation Related Datasets:');
      const laborDatasets = datasetsResponse.data.datasets.filter(dataset =>
        dataset.name.toLowerCase().includes('labor') ||
        dataset.name.toLowerCase().includes('regulation') ||
        dataset.description.toLowerCase().includes('labor standards') ||
        dataset.description.toLowerCase().includes('regulations')
      );

      if (laborDatasets.length > 0) {
        console.log('\nFound Labor/Regulation Related Datasets:');
        laborDatasets.forEach(dataset => {
          console.log('\nDataset:', dataset.name);
          console.log('Details:', JSON.stringify(dataset, null, 2));
        });
      }
    }

    // Test with the example dataset from the guide first
    console.log('\nTesting example dataset from guide:');
    const exampleUrl = new URL(`${baseUrl}/v4/get/trng/training_dataset_industries/json`);
    exampleUrl.searchParams.append('X-API-KEY', apiKey);
    exampleUrl.searchParams.append('limit', '10');

    console.log('URL (masked):', exampleUrl.toString().replace(apiKey, '***'));

    try {
      const exampleResponse = await axios.get(exampleUrl.toString());
      console.log('\nExample Dataset Response Structure:');
      console.log('Response keys:', Object.keys(exampleResponse.data));

      if (exampleResponse.data?.data && Array.isArray(exampleResponse.data.data)) {
        console.log('\nExample Dataset (first 2 records):');
        console.log(JSON.stringify(exampleResponse.data.data.slice(0, 2), null, 2));
        console.log('\nTotal records:', exampleResponse.data.data.length);
      }

      // Now test fetching a regulation
      console.log('\nTesting regulation fetch:');
      const regulationId = 'DOL-2024-001';
      console.log('Fetching regulation:', regulationId);

      const result = await fetchRegulationFromAgency(regulationId);
      if (result) {
        console.log('\nRegulation Data:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('No regulation data found');
      }

    } catch (error) {
      console.error('\nError during test:', error.message);

      if (axios.isAxiosError(error) && error.response) {
        console.error('\nResponse Error Details:');
        console.error('Status:', error.response.status);
        console.error('Status Text:', error.response.statusText);
        console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

        console.error('\nRequest Details:');
        console.error('URL:', error.config?.url?.replace(apiKey, '***'));
        console.error('Method:', error.config?.method);
      }
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

async function testDOLRegulationScraping() {
  try {
    console.log('\nStarting DOL Web Scraping Test...');

    // Test fetching a regulation
    console.log('\nTesting regulation fetch:');
    const regulationId = 'DOL-2024-001';
    console.log('Fetching regulation:', regulationId);

    const results = await fetchRegulationFromAgency(regulationId);
    if (results && results.length > 0) {
      console.log('\nRegulation Data:');
      console.log(`Found ${results.length} regulations`);
      results.forEach((result, index) => {
        console.log(`\nRegulation ${index + 1}:`);
        console.log(JSON.stringify(result, null, 2));
      });
    } else {
      console.log('No regulation data found');
    }

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

testDOLAPI().catch(console.error);
testDOLRegulationScraping().catch(console.error);