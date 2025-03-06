import { fetchRegulationFromAPI } from './services/agency-api-service';
import { syslog, LogLevel, LogFacility } from './services/syslog';

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
        const result = await fetchRegulationFromAPI(regulationId);

        if (result) {
          console.log('API Response Success:');
          console.log('Response Data:', JSON.stringify(result, null, 2));
        } else {
          console.log('No data returned from API');
        }
      } catch (error) {
        console.error('Error fetching regulation:', error);
        if (error.response) {
          console.error('Response Error Details:');
          console.error('Status:', error.response.status);
          console.error('Headers:', error.response.headers);
          console.error('Data:', error.response.data);
        }
      }
    }
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

testDOLAPI().catch(console.error);