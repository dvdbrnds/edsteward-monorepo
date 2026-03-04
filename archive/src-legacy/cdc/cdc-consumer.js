/**
 * CDC Consumer for Kafka
 * Listens to database changes and triggers appropriate actions
 */
import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import { setupLogger } from '../utils/logger.js';
import { addRefreshJob } from '../queue/regulation-queue.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger('cdc-consumer');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'regulation-cdc-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Create consumer
const consumer = kafka.consumer({ groupId: 'regulation-cdc-group' });

/**
 * Process a CDC event
 * @param {Object} message The Kafka message containing CDC data
 */
const processCdcEvent = async (message) => {
  try {
    // Parse message value as JSON
    const cdcEvent = JSON.parse(message.value.toString());
    logger.info('CDC event received', { 
      messageKey: message.key.toString(),
      table: cdcEvent.table,
      operation: cdcEvent.op
    });
    
    // Extract operation type (c = create, u = update, d = delete)
    const opType = cdcEvent.op;
    
    // Only process regulations table events
    if (cdcEvent.table !== 'regulations') {
      return;
    }
    
    // Handle different operation types
    switch (opType) {
      case 'c': // Create
      case 'u': // Update
        await handleRegulationChange(cdcEvent);
        break;
      case 'd': // Delete
        await handleRegulationDelete(cdcEvent);
        break;
      default:
        logger.warn('Unknown CDC operation type', { opType });
    }
  } catch (error) {
    logger.error('Error processing CDC event:', error);
  }
};

/**
 * Handle regulation create/update events
 * @param {Object} cdcEvent The CDC event data
 */
const handleRegulationChange = async (cdcEvent) => {
  try {
    const regulationId = cdcEvent.reg_id;
    const tenantId = cdcEvent.tenant_id;
    
    if (!regulationId || !tenantId) {
      logger.warn('Missing required fields in CDC event', { cdcEvent });
      return;
    }
    
    logger.info('Adding regulation refresh job from CDC event', { regulationId, tenantId });
    
    // Add to job queue with high priority since it's from a CDC event
    await addRefreshJob({
      regulationId,
      tenantId,
      priority: 'high',
      source: 'cdc'
    });
  } catch (error) {
    logger.error('Error handling regulation change:', error);
  }
};

/**
 * Handle regulation delete events
 * @param {Object} cdcEvent The CDC event data
 */
const handleRegulationDelete = async (cdcEvent) => {
  try {
    // For deletions, the data is in the 'before' field
    const regulationId = cdcEvent.before?.reg_id;
    const tenantId = cdcEvent.before?.tenant_id;
    
    if (!regulationId || !tenantId) {
      logger.warn('Missing required fields in CDC deletion event', { cdcEvent });
      return;
    }
    
    logger.info('Processing regulation deletion from CDC event', { regulationId, tenantId });
    
    // Implement deletion logic here
    // This could notify connected clients about the deletion
  } catch (error) {
    logger.error('Error handling regulation deletion:', error);
  }
};

/**
 * Start the CDC consumer
 */
export const startCdcConsumer = async () => {
  try {
    // Connect to Kafka
    await consumer.connect();
    
    // Subscribe to regulations topic
    const topic = `${process.env.KAFKA_TOPIC_PREFIX || 'postgres-db-server'}.public.regulations`;
    await consumer.subscribe({ topic, fromBeginning: false });
    
    logger.info(`CDC consumer subscribed to topic: ${topic}`);
    
    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        logger.debug('CDC message received', { 
          topic, 
          partition,
          offset: message.offset
        });
        await processCdcEvent(message);
      }
    });
    
    logger.info('CDC consumer started successfully');
    
    // Handle process termination
    process.on('SIGTERM', stopCdcConsumer);
    process.on('SIGINT', stopCdcConsumer);
    
    return consumer;
  } catch (error) {
    logger.error('Failed to start CDC consumer:', error);
    throw error;
  }
};

/**
 * Stop the CDC consumer
 */
export const stopCdcConsumer = async () => {
  try {
    logger.info('Stopping CDC consumer...');
    await consumer.disconnect();
    logger.info('CDC consumer stopped');
  } catch (error) {
    logger.error('Error stopping CDC consumer:', error);
  }
}; 