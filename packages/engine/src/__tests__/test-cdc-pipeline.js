/**
 * Test script for CDC pipeline
 * This script simulates CDC events without requiring the full infrastructure
 */
import dotenv from 'dotenv';
import { setupLogger } from './utils/logger.js';
import { addRefreshJob, initQueue, startRegulationWorker } from './queue/regulation-queue.js';
import { upsertRegulation } from './database/connection.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('test-cdc');

/**
 * Simulate a CDC event for a regulation
 * @param {Object} regulation - Regulation data
 * @param {string} tenantId - Tenant ID
 * @param {string} operation - Operation type (create, update, delete)
 */
async function simulateCdcEvent(regulation, tenantId, operation = 'create') {
  try {
    logger.info(`Simulating CDC ${operation} event`, {
      tenantId,
      regulationId: regulation.reg_id
    });
    
    // Create CDC event object
    const cdcEvent = {
      table: 'regulations',
      op: operation === 'create' ? 'c' : operation === 'update' ? 'u' : 'd',
      tenant_id: tenantId,
      reg_id: regulation.reg_id,
      title: regulation.title,
      revision: regulation.revision,
      payload: regulation.payload
    };
    
    // Log the simulated CDC event
    logger.info('Simulated CDC event:', cdcEvent);
    
    // Dynamically import CDC consumer to avoid circular dependencies
    const { processCdcEvent } = await import('./cdc/cdc-consumer.js');
    
    // Process the CDC event
    await processCdcEvent({
      key: Buffer.from(`${tenantId}:${regulation.reg_id}`),
      value: Buffer.from(JSON.stringify(cdcEvent))
    });
    
    logger.info('CDC event processed successfully');
  } catch (error) {
    logger.error('Error simulating CDC event:', error);
    throw error;
  }
}

/**
 * Run the CDC pipeline test
 */
async function runTest() {
  try {
    // Initialize queue
    logger.info('Initializing job queue...');
    await initQueue();
    
    // Start worker
    logger.info('Starting regulation worker...');
    const worker = await startRegulationWorker();
    
    // Test data
    const tenant1 = 'test-tenant-1';
    const tenant2 = 'test-tenant-2';
    
    const regulation1 = {
      reg_id: 'REG-2023-001',
      title: 'Test Regulation 1',
      revision: '2023-01',
      payload: { 
        summary: 'This is a test regulation',
        sections: ['Section 1', 'Section 2']
      }
    };
    
    const regulation2 = {
      reg_id: 'REG-2023-002',
      title: 'Test Regulation 2',
      revision: '2023-02',
      payload: { 
        summary: 'Another test regulation',
        sections: ['Section A', 'Section B']
      }
    };
    
    // Step 1: Insert regulations directly into database
    logger.info('Step 1: Inserting regulations into database...');
    await upsertRegulation(regulation1, tenant1);
    await upsertRegulation(regulation2, tenant2);
    
    // Step 2: Simulate CDC event for the first regulation
    logger.info('Step 2: Simulating CDC event for first regulation...');
    await simulateCdcEvent(regulation1, tenant1, 'create');
    
    // Step 3: Wait for job processing
    logger.info('Step 3: Waiting for job processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Update the second regulation
    logger.info('Step 4: Updating second regulation...');
    regulation2.title = 'Updated Test Regulation 2';
    regulation2.revision = '2023-02-REV1';
    await upsertRegulation(regulation2, tenant2);
    
    // Step 5: Simulate CDC event for the update
    logger.info('Step 5: Simulating CDC event for regulation update...');
    await simulateCdcEvent(regulation2, tenant2, 'update');
    
    // Step 6: Wait for job processing
    logger.info('Step 6: Waiting for job processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 7: Directly add a job to the queue
    logger.info('Step 7: Directly adding job to queue...');
    await addRefreshJob({
      regulationId: 'REG-2023-003',
      tenantId: 'test-tenant-3',
      priority: 'high',
      source: 'direct-test'
    });
    
    // Step 8: Wait for final job processing
    logger.info('Step 8: Waiting for final job processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test completed
    logger.info('CDC pipeline test completed successfully');
    
    // Clean up
    logger.info('Cleaning up resources...');
    await worker.close();
    const { closeQueues } = await import('./queue/regulation-queue.js');
    await closeQueues();
    const { closePool } = await import('./database/connection.js');
    await closePool();
    
    logger.info('All resources cleaned up');
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
runTest().then(() => {
  logger.info('Test script completed');
  process.exit(0);
}).catch(error => {
  logger.error('Unhandled error in test script:', error);
  process.exit(1);
}); 