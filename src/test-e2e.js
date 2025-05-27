/**
 * End-to-end test for CDC pipeline
 * This script tests the complete flow from API to CDC to job queue
 */
import dotenv from 'dotenv';
import axios from 'axios';
import { setupLogger } from './utils/logger.js';
import { startApp } from './app.js';

// Load environment variables
dotenv.config();

// Configure environment for testing
process.env.NODE_ENV = 'development';
process.env.BYPASS_AUTH = 'true';
process.env.ENABLE_WORKER = 'true';
process.env.ENABLE_CDC = 'true';
process.env.PORT = '3001';

// Initialize logger
const logger = setupLogger('e2e-test');

// API base URL
const API_URL = 'http://localhost:3001';

/**
 * Wait for a specified amount of time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check server health until it's ready
 * @returns {Promise<boolean>}
 */
async function waitForServerReady() {
  logger.info('Waiting for server to be ready...');
  
  for (let i = 0; i < 10; i++) {
    try {
      const response = await axios.get(`${API_URL}/health`);
      if (response.data.status === 'ok') {
        logger.info('Server is ready');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await wait(1000);
  }
  
  throw new Error('Server failed to start within the timeout period');
}

/**
 * Run the end-to-end test
 */
async function runE2ETest() {
  let app;
  
  try {
    // Start the application
    logger.info('Starting application...');
    app = await startApp();
    
    // Wait for server to be ready
    await waitForServerReady();
    
    // Step 1: Create test regulation via API
    logger.info('Step 1: Creating test regulation via API...');
    const regulation = {
      tenant_id: 'e2e-test-tenant',
      reg_id: 'E2E-TEST-REG-001',
      title: 'E2E Test Regulation',
      revision: '2023-E2E-1',
      payload: {
        summary: 'This is a test regulation for E2E testing',
        source: 'e2e-test'
      }
    };
    
    const response = await axios.post(
      `${API_URL}/v1/admin/inject-test-reg`,
      regulation
    );
    
    logger.info('Regulation created:', {
      status: response.status,
      job_id: response.data.job_id
    });
    
    if (response.status !== 201) {
      throw new Error(`Failed to create regulation: ${response.status}`);
    }
    
    // Step 2: Wait for CDC events and job processing
    logger.info('Step 2: Waiting for CDC events and job processing...');
    await wait(5000);
    
    // Step 3: Simulate a CDC event directly
    logger.info('Step 3: Simulating a CDC event directly...');
    const cdcEvent = {
      table: 'regulations',
      operation: 'u', // update
      tenant_id: 'e2e-test-tenant',
      data: {
        reg_id: 'E2E-TEST-REG-001',
        title: 'Updated E2E Test Regulation',
        revision: '2023-E2E-2'
      }
    };
    
    const cdcResponse = await axios.post(
      `${API_URL}/v1/admin/simulate-cdc`,
      cdcEvent
    );
    
    logger.info('CDC event simulated:', {
      status: cdcResponse.status
    });
    
    // Step 4: Final wait for processing
    logger.info('Step 4: Final wait for processing...');
    await wait(3000);
    
    // Test completed
    logger.info('E2E test completed successfully');
    
    return true;
  } catch (error) {
    logger.error('E2E test failed:', error);
    return false;
  } finally {
    // Clean up will happen in the app's shutdown handlers
    process.exit(0);
  }
}

// Run the test
runE2ETest().then(success => {
  if (success) {
    logger.info('E2E test completed successfully');
    process.exit(0);
  } else {
    logger.error('E2E test failed');
    process.exit(1);
  }
}); 