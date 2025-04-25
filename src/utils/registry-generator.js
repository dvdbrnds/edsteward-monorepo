/**
 * Regulation Registry Generator
 * 
 * Processes CSV compliance data into a structured registry for use with MCP servers.
 * The registry organizes regulations by category and provides metadata for each regulation.
 */

import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { setupLogger, formatError } from './logger.js';

// Initialize logger
const logger = setupLogger('registry-generator');

/**
 * Generate a regulation registry from CSV data
 * @param {string} csvPath - Path to the CSV file
 * @param {string} outputPath - Path to write the registry file
 * @returns {Promise<Object>} The generated registry
 */
export async function generateRegistryFromCSV(csvPath, outputPath) {
  logger.info('Generating regulation registry from CSV', { csvPath, outputPath });
  
  try {
    // Initialize registry structure
    const registry = {
      metadata: {
        generatedAt: new Date().toISOString(),
        source: path.basename(csvPath),
        version: '1.0'
      },
      categories: {},
      regulations: {}
    };
    
    // Read and parse CSV
    const records = await readCSV(csvPath);
    logger.info(`Read ${records.length} records from CSV`);
    
    // Process records into registry
    for (const record of records) {
      try {
        processRecord(record, registry);
      } catch (err) {
        logger.warn(`Error processing record: ${err.message}`, { record });
      }
    }
    
    // Write registry to file
    await fs.writeFile(outputPath, JSON.stringify(registry, null, 2));
    logger.info(`Registry written to ${outputPath}`);
    
    // Log registry statistics
    const categoryCount = Object.keys(registry.categories).length;
    const regulationCount = Object.keys(registry.regulations).length;
    logger.info(`Registry contains ${categoryCount} categories and ${regulationCount} regulations`);
    
    return registry;
  } catch (error) {
    logger.error('Failed to generate registry', formatError(error));
    throw new Error(`Registry generation failed: ${error.message}`);
  }
}

/**
 * Read and parse a CSV file
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} Array of records
 */
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    
    // Create CSV parser
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Handle parsed records
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });
    
    // Handle errors
    parser.on('error', (err) => {
      reject(err);
    });
    
    // Create read stream and pipe to parser
    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      reject(err);
    });
    
    // When done, resolve with records
    parser.on('end', () => {
      resolve(records);
    });
    
    // Pipe stream to parser
    stream.pipe(parser);
  });
}

/**
 * Process a CSV record into the registry
 * @param {Object} record - CSV record
 * @param {Object} registry - Registry object to update
 */
function processRecord(record, registry) {
  // Extract record details with proper fallbacks
  const id = record.ID || generateId(record);
  const category = normalizeCategory(record.Category || 'uncategorized');
  const title = record.Title || record.Statute_Regulation || 'Untitled Regulation';
  const description = record.Summary || '';
  const statutes = record.Statute_Regulation || '';
  const reporting = record.Reporting_Requirements || '';
  const deadline = record.Deadline || '';
  
  // Create regulation object
  const regulation = {
    id,
    category,
    title,
    description,
    statutes,
    reporting,
    deadline,
    metadata: {
      source: 'compmat.csv'
    }
  };
  
  // Add extra fields that might be present
  for (const [key, value] of Object.entries(record)) {
    if (value && !regulation[key.toLowerCase()] && key !== 'ID' && key !== 'Category') {
      regulation[key.toLowerCase()] = value;
    }
  }
  
  // Add regulation to registry
  registry.regulations[id] = regulation;
  
  // Update categories
  if (!registry.categories[category]) {
    registry.categories[category] = [];
  }
  
  // Add regulation to category if not already present
  if (!registry.categories[category].includes(id)) {
    registry.categories[category].push(id);
  }
}

/**
 * Generate a unique ID for a regulation
 * @param {Object} record - The regulation record
 * @returns {string} Generated ID
 */
function generateId(record) {
  // Use title or statute to generate ID
  const sourceText = record.Title || record.Statute_Regulation || record.Summary || '';
  
  // Generate a slug from the source text
  let slug = sourceText
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  // If slug is empty, generate a random one
  if (!slug) {
    slug = `reg-${Math.random().toString(36).substring(2, 10)}`;
  }
  
  // Add a timestamp to ensure uniqueness
  return `${slug}-${Date.now().toString(36)}`;
}

/**
 * Normalize a category name
 * @param {string} category - Raw category name
 * @returns {string} Normalized category
 */
function normalizeCategory(category) {
  // Handle empty category
  if (!category || category.trim() === '') {
    return 'uncategorized';
  }
  
  // Clean and normalize
  return category
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_');
}

/**
 * Check if text is likely a deadline description
 * @param {string} text - Text to check
 * @returns {boolean} True if likely a deadline
 */
function isLikelyDeadline(text) {
  const deadlineTerms = [
    'due', 'deadline', 'by', 'before', 'annual', 'annually',
    'quarterly', 'monthly', 'year', 'date', 'submit', 'submission'
  ];
  
  const loweredText = text.toLowerCase();
  return deadlineTerms.some(term => loweredText.includes(term));
}

/**
 * Generate a registry from a directory of regulation files
 * @param {string} dirPath - Directory containing regulations
 * @param {string} outputPath - Path to write registry
 * @returns {Promise<Object>} The generated registry
 */
export async function generateRegistryFromDirectory(dirPath, outputPath) {
  logger.info('Generating registry from directory', { dirPath, outputPath });
  
  try {
    // Initialize registry structure
    const registry = {
      metadata: {
        generatedAt: new Date().toISOString(),
        source: path.basename(dirPath),
        version: '1.0'
      },
      categories: {},
      regulations: {}
    };
    
    // List files in directory
    const files = await fs.readdir(dirPath);
    logger.info(`Found ${files.length} files in directory`);
    
    // Process each file as a regulation
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(dirPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const regulation = JSON.parse(content);
          
          // Ensure regulation has an ID
          if (!regulation.id) {
            regulation.id = path.basename(file, '.json');
          }
          
          // Ensure regulation has a category
          const category = normalizeCategory(regulation.category || 'uncategorized');
          regulation.category = category;
          
          // Add regulation to registry
          registry.regulations[regulation.id] = regulation;
          
          // Update categories
          if (!registry.categories[category]) {
            registry.categories[category] = [];
          }
          
          if (!registry.categories[category].includes(regulation.id)) {
            registry.categories[category].push(regulation.id);
          }
        } catch (err) {
          logger.warn(`Error processing file ${file}: ${err.message}`);
        }
      }
    }
    
    // Write registry to file
    await fs.writeFile(outputPath, JSON.stringify(registry, null, 2));
    logger.info(`Registry written to ${outputPath}`);
    
    return registry;
  } catch (error) {
    logger.error('Failed to generate registry from directory', formatError(error));
    throw new Error(`Registry generation failed: ${error.message}`);
  }
}

/**
 * Load an existing registry from a file
 * @param {string} registryPath - Path to registry file
 * @returns {Promise<Object>} The loaded registry
 */
export async function loadRegistry(registryPath) {
  try {
    logger.info(`Loading registry from ${registryPath}`);
    const data = await fs.readFile(registryPath, 'utf8');
    const registry = JSON.parse(data);
    
    const categoryCount = Object.keys(registry.categories || {}).length;
    const regulationCount = Object.keys(registry.regulations || {}).length;
    logger.info(`Loaded registry with ${categoryCount} categories and ${regulationCount} regulations`);
    
    return registry;
  } catch (error) {
    logger.error(`Failed to load registry from ${registryPath}`, formatError(error));
    throw new Error(`Registry loading failed: ${error.message}`);
  }
}

/**
 * Check if registry needs regeneration based on file modification times
 * @param {string} csvPath - Path to source CSV
 * @param {string} registryPath - Path to registry file
 * @returns {Promise<boolean>} True if regeneration needed
 */
export async function registryNeedsRegeneration(csvPath, registryPath) {
  try {
    // Check if registry exists
    try {
      await fs.access(registryPath);
    } catch (err) {
      logger.info('Registry does not exist, regeneration needed');
      return true;
    }
    
    // Get file stats
    const csvStats = await fs.stat(csvPath);
    const registryStats = await fs.stat(registryPath);
    
    // Compare modification times
    const csvTime = csvStats.mtime.getTime();
    const registryTime = registryStats.mtime.getTime();
    
    // Registry is older than CSV
    if (csvTime > registryTime) {
      logger.info('CSV is newer than registry, regeneration needed');
      return true;
    }
    
    logger.info('Registry is up to date, regeneration not needed');
    return false;
  } catch (error) {
    logger.error('Error checking if registry needs regeneration', formatError(error));
    // In case of error, regenerate to be safe
    return true;
  }
} 