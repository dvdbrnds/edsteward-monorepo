#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Removing Update All buttons from individual console pages...');

// Configuration
const REGULATIONS_DIR = './src/client/public/regulations';

// Function to remove Update All button from console page
function removeUpdateAllButton(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove the Update All button from control panel
        content = content.replace(
            /<button id="updateAllButton"[^>]*onclick="updateAllRegulations\(\)"[^>]*>[\s\S]*?<\/button>/g,
            ''
        );
        
        // Remove the updateAllRegulations function and related code
        content = content.replace(
            /\/\/ Global variables for update all functionality[\s\S]*?async function runLinearEngine\(\) \{/g,
            'async function runLinearEngine() {'
        );
        
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ Failed to process ${filePath}: ${error.message}`);
        return false;
    }
}

// Process all console files
async function removeUpdateAllFromConsoles() {
    try {
        if (!fs.existsSync(REGULATIONS_DIR)) {
            console.log('❌ Regulations directory not found');
            return;
        }
        
        const files = fs.readdirSync(REGULATIONS_DIR);
        const consoleFiles = files.filter(file => file.endsWith('-console.html'));
        
        console.log(`📋 Found ${consoleFiles.length} console files to process`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const file of consoleFiles) {
            const filePath = path.join(REGULATIONS_DIR, file);
            
            if (removeUpdateAllButton(filePath)) {
                successCount++;
                if (successCount % 50 === 0) {
                    console.log(`   🔧 Processed ${successCount}/${consoleFiles.length} files...`);
                }
            } else {
                errorCount++;
            }
        }
        
        console.log('\n🎉 Update All Button Removal Complete!');
        console.log(`✅ Successfully processed: ${successCount} files`);
        console.log(`❌ Failed: ${errorCount} files`);
        console.log('📋 Update All functionality now only available on main dashboard');
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        process.exit(1);
    }
}

// Run the removal process
if (require.main === module) {
    removeUpdateAllFromConsoles().catch(console.error);
}

module.exports = { removeUpdateAllFromConsoles };
