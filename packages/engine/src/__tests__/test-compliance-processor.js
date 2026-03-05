import { processComplianceQuery } from './llm-gateway/compliance-processor.js';
import { logger } from './utils/logger.js';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

async function testComplianceProcessor() {
  try {
    logger.info('Starting compliance processor test');
    
    // Test query
    const testQuery = 'What are the requirements for FERPA compliance?';
    logger.info(`Processing test query: "${testQuery}"`);
    
    // Process the query
    const result = await processComplianceQuery(testQuery);
    
    // Log the result
    logger.info('Query processing complete');
    console.log('\nQuery:', result.query);
    console.log('\nResponse:', result.response.fullResponse);
    console.log('\nRelevant Regulations:', result.response.relevantRegulations);
    console.log('\nTimestamp:', result.timestamp);
    
    logger.info('Test completed successfully');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    console.error('Error:', error);
  }
}

// Run the test
testComplianceProcessor(); 