/**
 * Generate Regulation Registry
 * 
 * This script generates a registry of all regulations from the compmat.csv file.
 * It creates a JSON file that can be used by the MCP Host Controller to manage
 * regulation servers.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAllRegulations } from '../protocol/regulation-data-loader.js';

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '../../regulation-servers-registry.json');

/**
 * Generate a registry of all regulations
 */
async function generateRegistry() {
  try {
    console.log('Loading regulations from CSV...');
    const regulations = await loadAllRegulations();
    
    if (!regulations || regulations.length === 0) {
      console.error('No regulations found in CSV file');
      process.exit(1);
    }
    
    console.log(`Found ${regulations.length} regulations`);
    
    // Create registry entries
    const registry = {};
    regulations.forEach(regulation => {
      registry[regulation.id] = {
        id: regulation.id,
        name: regulation.title || `Regulation ${regulation.id}`,
        category: regulation.category || 'Uncategorized',
        description: regulation.summary || `Regulation ${regulation.id}`,
        version: '1.0.0',
        year: regulation.year,
        statute: regulation.statuteCode,
        statuteReference: regulation.statuteReference,
        regulation: regulation.regulationCode,
        regulationReference: regulation.regulationReference,
        deadline: regulation.deadline,
        deadlineType: regulation.deadlineType,
        validationFrequency: regulation.validationFrequency,
        server: {
          port: null,
          running: false,
          lastStarted: null,
          url: null
        }
      };
    });
    
    // Write registry file
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
    
    console.log(`Registry generated with ${Object.keys(registry).length} regulations`);
    console.log(`Registry saved to ${REGISTRY_PATH}`);
    
    return registry;
  } catch (error) {
    console.error('Error generating registry:', error);
    throw error;
  }
}

// Run the generator if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateRegistry()
    .then(() => {
      console.log('Registry generation completed successfully');
    })
    .catch(error => {
      console.error('Registry generation failed:', error);
      process.exit(1);
    });
}

export { generateRegistry }; 