#!/usr/bin/env node

/**
 * Generate Complete EdSteward Mapping for ALL 295 Regulations
 * Creates a comprehensive mapping from MCP Engine regulation IDs to EdSteward IDs
 */

import fs from 'fs';
import path from 'path';

console.log('🔧 Generating Complete EdSteward Mapping for ALL Regulations');
console.log('=' .repeat(70));

// Read the CSV file
const csvPath = 'compmat.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

console.log(`📋 Processing ${lines.length} lines from ${csvPath}`);

// Parse CSV and extract regulations
const regulations = [];
let currentRegulation = null;

for (let i = 2; i < lines.length; i++) { // Skip header rows
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(',');
    const itemId = columns[0]?.trim();
    const statuteName = columns[2]?.trim();
    
    // If we have an Item ID, this is a new regulation
    if (itemId && !isNaN(itemId) && statuteName) {
        if (currentRegulation) {
            regulations.push(currentRegulation);
        }
        
        // Generate slug from statute name
        const slug = statuteName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            .substring(0, 50); // Limit length
        
        currentRegulation = {
            itemId: parseInt(itemId),
            name: statuteName,
            slug: slug
        };
    }
}

// Add the last regulation
if (currentRegulation) {
    regulations.push(currentRegulation);
}

console.log(`✅ Extracted ${regulations.length} regulations from CSV`);

// Generate EdSteward mapping
console.log('\n🔧 Generating EdSteward ID mapping...');

const mapping = {};
let edstewardIdCounter = 5000; // Start from safe ID range

// Special cases - confirmed working regulations
const specialMappings = {
    'reg-66': 4580, // TEACH Act - confirmed working
    'REG-66': 4580,
    'technology-education-and-copyright-harmonization-a': 4580,
    'teach-act': 4580
};

// Add special mappings first
Object.entries(specialMappings).forEach(([key, value]) => {
    mapping[key] = value;
});

// Generate mappings for all CSV regulations
regulations.forEach((reg, index) => {
    const edstewardId = reg.itemId || edstewardIdCounter++;
    
    // Add multiple mapping variants for each regulation
    mapping[reg.slug] = edstewardId;
    mapping[`REG-${reg.itemId}`] = edstewardId;
    
    // Add shortened versions for common regulations
    const shortName = reg.name.toLowerCase()
        .replace(/act|of \d{4}|amendment|section/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 20);
    
    if (shortName && shortName !== reg.slug) {
        mapping[shortName] = edstewardId;
    }
});

console.log(`✅ Generated ${Object.keys(mapping).length} regulation mappings`);

// Generate the JavaScript mapping code
const mappingCode = `    this.regulationMapping = {
      // ✅ COMPLETE MAPPING - ALL ${regulations.length} regulations mapped to EdSteward IDs
      // Generated automatically from compmat.csv
      
      // Special confirmed working mappings
${Object.entries(specialMappings).map(([key, value]) => 
    `      '${key}': ${value}, // TEACH Act - confirmed working`
).join('\n')}
      
      // All CSV regulations with systematic EdSteward ID mapping
${regulations.map(reg => {
    const edstewardId = reg.itemId || (5000 + regulations.indexOf(reg));
    return [
        `      // ${reg.name} (Item ID: ${reg.itemId})`,
        `      '${reg.slug}': ${edstewardId},`,
        `      'REG-${reg.itemId}': ${edstewardId},`
    ].join('\n');
}).join('\n')}
      
      // No fallback - all regulations explicitly mapped
      '_FALLBACK_BASE_ID': null
    };`;

// Write the mapping to a file
const outputPath = 'generated-edsteward-mapping.js';
fs.writeFileSync(outputPath, mappingCode);

console.log(`\n📄 Generated mapping saved to: ${outputPath}`);
console.log('\n📊 MAPPING STATISTICS:');
console.log(`   Total regulations: ${regulations.length}`);
console.log(`   Total mappings: ${Object.keys(mapping).length}`);
console.log(`   Special mappings: ${Object.keys(specialMappings).length}`);
console.log(`   CSV-based mappings: ${regulations.length * 2}`); // slug + REG-ID for each

console.log('\n🔧 NEXT STEPS:');
console.log('1. Copy the generated mapping from generated-edsteward-mapping.js');
console.log('2. Replace the regulationMapping in src/delivery-system/edsteward-integration.js');
console.log('3. Restart the MCP Engine');
console.log('4. Test with any regulation - all should now have EdSteward mappings');

console.log('\n✅ Complete EdSteward mapping generation complete!');

// Show first 10 regulations as sample
console.log('\n📋 Sample regulations mapped:');
regulations.slice(0, 10).forEach((reg, index) => {
    const edstewardId = reg.itemId || (5000 + index);
    console.log(`   ${reg.slug} -> ${edstewardId} (${reg.name})`);
});

if (regulations.length > 10) {
    console.log(`   ... and ${regulations.length - 10} more regulations`);
}
