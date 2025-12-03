#!/usr/bin/env node
/**
 * Remove "Update All Regulations" Button from Individual Console Pages
 * This button should only be on the main dashboard, not on individual regulation pages
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, 'src/client/public/regulations');

async function removeUpdateAllButtons() {
    console.log('🔧 Removing "Update All Regulations" buttons from individual console pages...');
    
    try {
        const files = await fs.promises.readdir(REGULATIONS_DIR);
        const htmlFiles = files.filter(file => file.endsWith('-console.html'));
        
        console.log(`📋 Found ${htmlFiles.length} console pages to process`);
        
        let totalReplacements = 0;
        let processedFiles = 0;
        
        for (const file of htmlFiles) {
            const filePath = path.join(REGULATIONS_DIR, file);
            
            try {
                let content = await fs.promises.readFile(filePath, 'utf8');
                let fileReplacements = 0;
                
                // Remove the button HTML element
                const buttonPattern = /<button[^>]*id="updateAllButton"[^>]*>[\s\S]*?<\/button>/g;
                const newContent = content.replace(buttonPattern, '');
                if (newContent !== content) {
                    fileReplacements++;
                    content = newContent;
                }
                
                // Remove the updateAllRegulations function
                const functionPattern = /async function updateAllRegulations\(\)[^{]*\{[\s\S]*?^        \}/gm;
                const newContent2 = content.replace(functionPattern, '');
                if (newContent2 !== content) {
                    fileReplacements++;
                    content = newContent2;
                }
                
                // Remove any references to "UPDATE ALL REGULATIONS" in console logs
                const logPattern = /'🔄 UPDATE ALL REGULATIONS'/g;
                const newContent3 = content.replace(logPattern, "'🔄 UPDATE REGULATION'");
                if (newContent3 !== content) {
                    fileReplacements++;
                    content = newContent3;
                }
                
                // Remove "Starting UPDATE ALL REGULATIONS process" logs
                const startLogPattern = /'🚀 Starting UPDATE ALL REGULATIONS process'/g;
                const newContent4 = content.replace(startLogPattern, "'🚀 Starting regulation update process'");
                if (newContent4 !== content) {
                    fileReplacements++;
                    content = newContent4;
                }
                
                // Remove "UPDATE ALL REGULATIONS COMPLETED!" logs
                const completeLogPattern = /'🎉 UPDATE ALL REGULATIONS COMPLETED!'/g;
                const newContent5 = content.replace(completeLogPattern, "'🎉 Regulation update completed!'");
                if (newContent5 !== content) {
                    fileReplacements++;
                    content = newContent5;
                }
                
                if (fileReplacements > 0) {
                    await fs.promises.writeFile(filePath, content, 'utf8');
                    processedFiles++;
                    totalReplacements += fileReplacements;
                    console.log(`  ✅ ${file}: ${fileReplacements} replacements made`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${file}:`, error.message);
            }
        }
        
        console.log(`\n📊 Update All Button Removal Complete:`);
        console.log(`   📄 Files processed: ${processedFiles}`);
        console.log(`   🔄 Total replacements: ${totalReplacements}`);
        console.log(`   ✅ "Update All Regulations" button removed from individual pages`);
        
        if (totalReplacements > 0) {
            console.log(`\n🎯 The "Update All Regulations" button is now only on the main dashboard`);
            console.log(`   Individual pages now have regulation-specific update functionality only`);
        }
        
    } catch (error) {
        console.error('❌ Failed to remove Update All buttons:', error);
        process.exit(1);
    }
}

// Run the removal
if (require.main === module) {
    removeUpdateAllButtons();
}

module.exports = { removeUpdateAllButtons };


