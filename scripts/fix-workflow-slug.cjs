#!/usr/bin/env node
/**
 * Fix workflow slug in all console HTML files
 * 
 * The issue: The workflow call was hardcoding a string instead of using REGULATION_SLUG
 * This script fixes all consoles to use the REGULATION_SLUG variable
 */

const fs = require('fs');
const path = require('path');

const CONSOLES_DIR = path.join(__dirname, '..', 'src', 'client', 'public', 'regulations');

// Pattern to match the hardcoded regulation string in workflow calls
// Matches: regulation: 'any-string-here',
const HARDCODED_PATTERN = /regulation:\s*'[^']+',\s*\n\s*quick:/g;
const CORRECT_PATTERN = "regulation: REGULATION_SLUG,\n                        quick:";

let fixedCount = 0;
let alreadyCorrectCount = 0;
let errorCount = 0;

// Get all HTML files
const files = fs.readdirSync(CONSOLES_DIR).filter(f => f.endsWith('-console.html'));

console.log(`\n🔧 Fixing workflow slug in ${files.length} console files...\n`);

for (const file of files) {
    const filePath = path.join(CONSOLES_DIR, file);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if it already uses REGULATION_SLUG
        if (content.includes("regulation: REGULATION_SLUG,")) {
            alreadyCorrectCount++;
            continue;
        }
        
        // Check if it has the hardcoded pattern
        if (HARDCODED_PATTERN.test(content)) {
            // Reset regex state
            HARDCODED_PATTERN.lastIndex = 0;
            
            // Replace
            const newContent = content.replace(HARDCODED_PATTERN, CORRECT_PATTERN);
            
            if (newContent !== content) {
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`✅ Fixed: ${file}`);
                fixedCount++;
            }
        }
    } catch (err) {
        console.error(`❌ Error processing ${file}: ${err.message}`);
        errorCount++;
    }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`📊 Summary:`);
console.log(`   ✅ Fixed: ${fixedCount}`);
console.log(`   ✓ Already correct: ${alreadyCorrectCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log(`${'═'.repeat(60)}\n`);
