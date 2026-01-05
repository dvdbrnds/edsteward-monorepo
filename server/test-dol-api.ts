import { fetchRegulationFromAgency } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './syslog';
import axios from 'axios';
import { URL } from 'url';

async function testDOLAPI() {
  try {

    // Verify API key is available
    if (!process.env.DOL_API_KEY) {
      console.error('DOL_API_KEY environment variable is not set');
      process.exit(1);
    }

    const apiKey = process.env.DOL_API_KEY.trim();

    // First verify we can access the datasets endpoint
    const baseUrl = 'https://apiprod.dol.gov';

    const datasetsResponse = await axios.get(`${baseUrl}/v4/datasets`);

    // Display available datasets with filtering for labor/regulation related ones
    if (datasetsResponse.data?.datasets) {
      datasetsResponse.data.datasets.forEach((dataset, index) => {
      });

      const laborDatasets = datasetsResponse.data.datasets.filter(dataset =>
        dataset.name.toLowerCase().includes('labor') ||
        dataset.name.toLowerCase().includes('regulation') ||
        dataset.description.toLowerCase().includes('labor standards') ||
        dataset.description.toLowerCase().includes('regulations')
      );

      if (laborDatasets.length > 0) {
        laborDatasets.forEach(dataset => {
        });
      }
    }

    // Test with the example dataset from the guide first
    const exampleUrl = new URL(`${baseUrl}/v4/get/trng/training_dataset_industries/json`);
    exampleUrl.searchParams.append('X-API-KEY', apiKey);
    exampleUrl.searchParams.append('limit', '10');


    try {
      const exampleResponse = await axios.get(exampleUrl.toString());

      if (exampleResponse.data?.data && Array.isArray(exampleResponse.data.data)) {
      }

      // Now test fetching a regulation
      const regulationId = 'DOL-2024-001';

      const result = await fetchRegulationFromAgency(regulationId);
      if (result) {
      } else {
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

    // Test fetching a regulation
    const regulationId = 'DOL-2024-001';

    const results = await fetchRegulationFromAgency(regulationId);
    if (results && results.length > 0) {
      results.forEach((result, index) => {
      });
    } else {
    }

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

testDOLAPI().catch(console.error);
testDOLRegulationScraping().catch(console.error);