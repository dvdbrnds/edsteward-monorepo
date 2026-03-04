/**
 * Script to register Debezium connector with Kafka Connect
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = setupLogger('debezium-setup');

/**
 * Set up Debezium connector for PostgreSQL CDC
 */
export async function setupDebeziumConnector() {
  try {
    // Load connector configuration
    const configPath = path.join(process.cwd(), 'config/debezium-connector.json');
    logger.info(`Loading connector configuration from ${configPath}`);
    
    const connectorConfig = JSON.parse(
      fs.readFileSync(configPath, 'utf8')
    );
    
    // Connector API URL
    const connectUrl = process.env.KAFKA_CONNECT_URL || 'http://localhost:8083';
    
    try {
      // Check if connector already exists
      logger.info(`Checking if connector ${connectorConfig.name} already exists`);
      const checkRes = await axios.get(`${connectUrl}/connectors/${connectorConfig.name}`);
      
      if (checkRes.status === 200) {
        logger.info(`Connector ${connectorConfig.name} already exists`, {
          config: checkRes.data.config
        });
        return checkRes.data;
      }
    } catch (error) {
      // Connector doesn't exist, create it
      if (error.response && error.response.status === 404) {
        logger.info(`Creating connector ${connectorConfig.name}`);
        
        try {
          const response = await axios.post(
            `${connectUrl}/connectors`,
            connectorConfig,
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          logger.info(`Connector ${connectorConfig.name} created successfully`, {
            name: response.data.name,
            tasks: response.data.tasks
          });
          
          return response.data;
        } catch (postError) {
          logger.error(`Failed to create connector ${connectorConfig.name}`, {
            error: postError.message,
            response: postError.response?.data
          });
          
          throw new Error(`Failed to create connector: ${postError.message}`);
        }
      } else {
        logger.error(`Error checking connector status:`, {
          error: error.message
        });
        
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error setting up Debezium connector:', error);
    throw error;
  }
}

// Run setup if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDebeziumConnector()
    .then(() => {
      logger.info('Debezium connector setup complete');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Failed to set up Debezium connector:', error);
      process.exit(1);
    });
} 