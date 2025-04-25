/**
 * Regulation Data Loader
 * 
 * This module loads regulation data from the compmat.csv file.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../../compmat.csv');

// Cache for loaded regulations
const regulationCache = new Map();

/**
 * Load all regulations from CSV file
 * 
 * @returns {Promise<Array>} Array of regulation objects
 */
export async function loadAllRegulations() {
  try {
    // Read the CSV file
    const data = await fs.readFile(CSV_PATH, 'utf8');
    
    // Parse CSV
    const records = parse(data, {
      columns: true,
      skip_empty_lines: true
    });
    
    // Transform to a more usable format
    const regulations = records.map(record => {
      // Map CSV columns to our expected fields
      const year = record['Last Updated'] ? record['Last Updated'].split(',')[1]?.trim().split(' ')[1] : new Date().getFullYear().toString();
      const category = record['Topic'] || 'Uncategorized';
      const statuteRef = record['Statute IDs'] || record['Statute 1'] || '';
      const id = generateRegulationId(year, category, statuteRef, record['Item ID']);
      
      return {
        id,
        year,
        category: category,
        title: record['Statute Name'],
        statuteCode: record['Statute IDs'] || record['Statute 1'],
        statuteReference: [record['Statute 1'], record['Statute 2'], record['Statute 3'], record['Statute 4']].filter(Boolean).join(', '),
        regulationCode: record['Regulation 1'],
        regulationReference: [record['Regulation 1'], record['Regulation 2'], record['Regulation 3'], record['Regulation 4'], record['Regulation 5']].filter(Boolean).join(', '),
        summary: record['Statutory Summary'],
        reportingRequirement: record['Reporting Requirements'],
        deadline: record['Deadlines'],
        deadlineType: record['Sortable Month'],
        deadlineMonth: record['Sortable Month'] ? record['Sortable Month'].split('-')[0] : null,
        lastUpdated: record['Last Updated'] || new Date().toISOString().split('T')[0],
        hasChanged: false, // Default to false for now
        validationFrequency: getValidationFrequency(record['Sortable Month'])
      };
    });
    
    // Cache all regulations
    regulations.forEach(reg => {
      regulationCache.set(reg.id, reg);
    });
    
    return regulations;
  } catch (error) {
    console.error('Error loading regulations from CSV:', error);
    return [];
  }
}

/**
 * Load data for a specific regulation
 * 
 * @param {string} regulationId - ID of the regulation to load
 * @returns {Promise<Object|null>} Regulation data object or null if not found
 */
export async function loadRegulationData(regulationId) {
  // Check cache first
  if (regulationCache.has(regulationId)) {
    return regulationCache.get(regulationId);
  }
  
  // If not in cache, load all regulations
  await loadAllRegulations();
  
  // Try to get from cache again
  return regulationCache.get(regulationId) || null;
}

/**
 * Generate a consistent regulation ID
 * 
 * @param {string} year - Regulation year
 * @param {string} category - Regulation category
 * @param {string} statuteRef - Statute reference
 * @param {string} recordId - Record ID from CSV
 * @returns {string} Generated regulation ID
 */
function generateRegulationId(year, category, statuteRef, recordId) {
  // Remove special characters and spaces
  const cleanCategory = (category || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanStatute = (statuteRef || '').replace(/[^a-zA-Z0-9]/g, '');
  
  // If we have good data, create a meaningful ID
  if (cleanCategory && cleanStatute) {
    return `${cleanCategory.substring(0, 5)}-${cleanStatute.substring(0, 8)}-${year || 'XXXX'}`;
  }
  
  // Fallback to record ID with prefix
  return `REG-${recordId}`;
}

/**
 * Determine validation frequency based on deadline type
 * 
 * @param {string} deadlineType - Deadline type from CSV
 * @returns {string} Validation frequency
 */
function getValidationFrequency(deadlineType) {
  const type = (deadlineType || '').trim();
  
  switch (type) {
    case '1-Jan':
    case '2-Feb':
    case '3-Mar':
    case '4-Apr':
    case '5-May':
    case '6-Jun':
    case '7-Jul':
    case '8-Aug':
    case '9-Sep':
    case '10-Oct':
    case '11-Nov':
    case '12-Dec':
      return 'annual';
      
    case '13-Multiple Deadlines':
      return 'quarterly';
      
    default:
      return 'asNeeded';
  }
} 