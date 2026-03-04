#!/usr/bin/env node

/**
 * Enhanced Console Pages Fix - Phase 2
 * Removes remaining TEACH Act references that weren't caught in the first pass
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Enhanced Console Pages Fix - Phase 2...');
console.log('📋 Removing remaining TEACH Act references');

// Configuration
const REGULATIONS_DIR = './src/client/public/regulations';

// Enhanced replacements for remaining TEACH Act references
const globalReplacements = [
    // Parenthetical references
    [/\(TEACH Act\)/g, ''],
    [/\s*\(TEACH Act\)\s*/g, ' '],
    
    // Console log messages with TEACH Act in parentheses
    [/CFR Implementation \(TEACH Act\)/g, 'CFR Implementation'],
    [/Guidelines \(TEACH Act\)/g, 'Guidelines'],
    [/Guidance \(TEACH Act\)/g, 'Guidance'],
    
    // Remaining console messages
    [/'📋 Fetching real TEACH Act compliance guidance from API\.\.\.'/g, "'📋 Fetching real compliance guidance from API...'"],
    [/'Fetching real TEACH Act compliance guidance from API\.\.\.'/g, "'Fetching real compliance guidance from API...'"],
    
    // Any remaining "TEACH Act" references in various contexts
    [/TEACH Act compliance/g, 'compliance'],
    [/TEACH Act guidance/g, 'regulatory guidance'],
    [/TEACH Act requirements/g, 'regulatory requirements'],
    [/TEACH Act implementation/g, 'implementation'],
    [/TEACH Act provisions/g, 'regulatory provisions'],
    [/TEACH Act standards/g, 'regulatory standards'],
    
    // Requirements sections that might still have TEACH Act
    [/Key Compliance Requirements for TEACH Act:/g, 'Key Compliance Requirements:'],
    [/TEACH Act Enhanced Requirements/g, 'Enhanced Requirements'],
    
    // Workflow descriptions
    [/comprehensive LinearEngine workflow for TEACH Act/g, 'comprehensive LinearEngine workflow for regulatory'],
    [/LinearEngine workflow for TEACH Act/g, 'LinearEngine workflow for regulatory'],
    
    // API endpoint variations that might have been missed
    [/\/api\/llm\/compliance\/teach-act/g, '/api/llm/compliance/regulation'],
    [/api\/llm\/compliance\/teach-act/g, 'api/llm/compliance/regulation'],
    [/'teach-act'/g, "'regulation'"],
    [/"teach-act"/g, '"regulation"'],
    
    // University analysis references
    [/Found TEACH Act/g, 'Found regulatory'],
    [/TEACH Act interpretation/g, 'regulatory interpretation'],
    [/TEACH Act research/g, 'regulatory research'],
    
    // Any standalone "TEACH Act" that might remain
    [/\bTEACH Act\b/g, 'Regulation'],
];

// Function to apply enhanced fixes to a single file
function enhancedFixFile(filePath) {
    const filename = path.basename(filePath);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let changeCount = 0;
        let originalContent = content;
        
        // Apply all enhanced replacements
        for (const [regex, replacement] of globalReplacements) {
            const matches = content.match(regex);
            if (matches) {
                content = content.replace(regex, replacement);
                changeCount += matches.length;
            }
        }
        
        // Only write if changes were made
        if (changeCount > 0) {
            fs.writeFileSync(filePath, content);
            console.log(`📝 ${filename}: Applied ${changeCount} additional fixes`);
        }
        
        return changeCount;
        
    } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        return 0;
    }
}

// Main execution
async function main() {
    try {
        // Get all console files
        const files = fs.readdirSync(REGULATIONS_DIR)
            .filter(file => file.endsWith('-console.html'))
            .map(file => path.join(REGULATIONS_DIR, file));
        
        console.log(`📊 Processing ${files.length} console pages for enhanced fixes`);
        
        let totalFiles = 0;
        let totalChanges = 0;
        
        // Process each file
        for (const filePath of files) {
            const changes = enhancedFixFile(filePath);
            if (changes > 0) {
                totalFiles++;
                totalChanges += changes;
            }
        }
        
        console.log('\n🎯 ENHANCED FIX COMPLETE');
        console.log('========================');
        console.log(`✅ Files with additional fixes: ${totalFiles}`);
        console.log(`✅ Additional replacements: ${totalChanges}`);
        
        // Final verification
        console.log('\n🔍 Final verification...');
        const remainingTeachActFiles = files.filter(filePath => {
            const content = fs.readFileSync(filePath, 'utf8');
            return content.includes('TEACH Act');
        });
        
        if (remainingTeachActFiles.length === 0) {
            console.log('🎉 SUCCESS: All TEACH Act references have been removed!');
        } else {
            console.log(`⚠️ ${remainingTeachActFiles.length} files still contain TEACH Act references`);
            
            // Show specific remaining references
            for (const filePath of remainingTeachActFiles.slice(0, 3)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const teachActLines = lines
                    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
                    .filter(item => item.line.includes('TEACH Act'));
                
                console.log(`\n📄 ${path.basename(filePath)}:`);
                teachActLines.slice(0, 2).forEach(item => {
                    console.log(`   Line ${item.number}: ${item.line.substring(0, 80)}...`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Enhanced fix script failed:', error.message);
        process.exit(1);
    }
}

// Run the script
main();


