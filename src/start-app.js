/**
 * Application starter script
 * This simplified version bypasses non-essential components for testing
 */
import dotenv from 'dotenv';
import { setupLogger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.BYPASS_AUTH = 'true';
process.env.ENABLE_WORKER = 'false';
process.env.ENABLE_CDC = 'false';
process.env.ENABLE_RATE_LIMIT = 'false';

// Initialize logger
const logger = setupLogger('app-starter');

// Import app dynamically to avoid initialization errors
const startServer = async () => {
  try {
    logger.info('Starting application in simplified mode...');
    
    // Import the app module
    try {
      const { startApp } = await import('./app.js');
      
      // Start the application
      await startApp();
      
      logger.info('Application started successfully');
    } catch (importError) {
      console.error('Error importing app.js:', importError);
      logger.error(`Error importing app.js: ${importError.message}`);
      
      if (importError.code === 'ERR_MODULE_NOT_FOUND') {
        console.error('Module not found:', importError.requireStack || importError.message);
        
        // Check if it's the redis module that's missing
        if (importError.message && importError.message.includes('redis')) {
          console.error('\nMissing redis module. Try installing it with:');
          console.error('npm install redis rate-limit-redis\n');
        }
      }
      
      throw importError;
    }
  } catch (error) {
    console.error('Detailed error information:', error);
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
};

// Start the server
startServer(); 