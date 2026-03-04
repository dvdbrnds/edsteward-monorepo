import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { setupLogger } from './logger.js';

const logger = setupLogger('data-loader');

// Cached compliance data to avoid reading the file on every request
let cachedComplianceData = null;
let lastLoadTime = null;
// Cache timeout in milliseconds (10 minutes)
const CACHE_TIMEOUT = 10 * 60 * 1000;

/**
 * Load compliance data from the CSV file
 * 
 * @returns {Promise<Array>} Array of compliance regulations
 */
export async function loadComplianceData() {
  try {
    // Check cache first
    const currentTime = Date.now();
    if (cachedComplianceData && lastLoadTime && (currentTime - lastLoadTime < CACHE_TIMEOUT)) {
      logger.debug('Using cached compliance data');
      return cachedComplianceData;
    }

    // Try different file paths - first in data dir, then in root
    const possiblePaths = [
      path.resolve(process.cwd(), 'data', 'compmat.csv'),
      path.resolve(process.cwd(), 'compmat.csv')
    ];
    
    let csvFilePath = null;
    let fileContent = null;
    
    // Find the first available file
    for (const filepath of possiblePaths) {
      try {
        await fs.promises.access(filepath, fs.constants.R_OK);
        csvFilePath = filepath;
        fileContent = await fs.promises.readFile(filepath, 'utf8');
        logger.info(`Loading compliance data from ${csvFilePath}`);
        break;
      } catch (err) {
        logger.debug(`File not accessible at ${filepath}`);
      }
    }
    
    if (!fileContent) {
      logger.error('Could not find or read compmat.csv file in any location');
      return [];
    }
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Transform data into a more usable format
    const transformedData = records.map((record, index) => ({
      id: record.ID || record['Item ID'] || `REG-${index + 1}`,
      title: record.Title || record['Statute Name'] || '',
      category: record.Category || record.Topic || '',
      statute: record['Statute IDs'] || record['Statute 1'] || '',
      regulation: record['Regulation 1'] || '',
      summary: record.Summary || record['Statutory Summary'] || '',
      reportingRequirements: record.reportingRequirements || record['Reporting Requirements'] || '',
      deadline: record.Deadline || record.Deadlines || '',
      contactOffice: record.contactOffice || ''
    }));

    // Update cache
    cachedComplianceData = transformedData;
    lastLoadTime = currentTime;
    
    logger.info(`Loaded ${transformedData.length} compliance regulations`);
    return transformedData;
  } catch (error) {
    logger.error(`Error loading compliance data: ${error.message}`);
    // Return empty array in case of error
    return [];
  }
}

/**
 * Reset the data cache
 */
export function resetDataCache() {
  cachedComplianceData = null;
  lastLoadTime = null;
  logger.info('Compliance data cache has been reset');
} 