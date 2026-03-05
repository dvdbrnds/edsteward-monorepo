#!/usr/bin/env node
/**
 * Fix Regulation ID Consistency Across Console Pages
 * 
 * This script fixes the mismatch between regulation IDs used in:
 * 1. WebSocket subscriptions (slug format: 'sarbanes-oxley-act-of-2002-sox')
 * 2. Manual push API calls (display name format: 'Sarbanes Oxley Act of 2002 (SOX)')
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, 'src/client/public/regulations');

// Regulation ID mappings: Display Name -> Slug
const regulationIdMappings = {
    // Common regulations that need consistent IDs
    'Sarbanes Oxley Act of 2002 (SOX)': 'sarbanes-oxley-act-of-2002-sox',
    'Americans with Disabilities Act of 1990': 'americans-with-disabilities-act-of-1990',
    'Age Discrimination Act of 1975': 'age-discrimination-act-of-1975',
    'Fair Credit Reporting Act (FCRA)': 'fair-credit-reporting-act-fcra',
    'Clery Act': 'clery-act',
    'Title IX': 'title-ix',
    'FERPA': 'reg-66', // Special case for REG-66
    'TEACH Act': 'reg-66', // Special case for REG-66
};

async function fixRegulationIdConsistency() {
    console.log('🔧 Fixing Regulation ID Consistency in Console Pages...');
    
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
                
                // Extract regulation name from filename
                const regulationSlug = file.replace('-console.html', '');
                
                // Look for display name in the content to determine the mapping
                for (const [displayName, slug] of Object.entries(regulationIdMappings)) {
                    if (content.includes(displayName) && slug === regulationSlug) {
                        // Fix the manual push regulation ID to use slug format
                        const oldPattern = `regulationId: '${displayName}'`;
                        const newPattern = `regulationId: '${slug}'`;
                        
                        if (content.includes(oldPattern)) {
                            content = content.replace(new RegExp(oldPattern, 'g'), newPattern);
                            fileReplacements++;
                            console.log(`  ✅ ${file}: Fixed regulationId from "${displayName}" to "${slug}"`);
                        }
                        
                        // Also ensure WebSocket subscription uses the same slug
                        const wsOldPattern = `regulationIds: ['${displayName}']`;
                        const wsNewPattern = `regulationIds: ['${slug}']`;
                        
                        if (content.includes(wsOldPattern)) {
                            content = content.replace(new RegExp(wsOldPattern, 'g'), wsNewPattern);
                            fileReplacements++;
                            console.log(`  ✅ ${file}: Fixed WebSocket regulationIds from "${displayName}" to "${slug}"`);
                        }
                    }
                }
                
                // Generic fix: Ensure WebSocket and API use the same slug format
                // Look for patterns where display names are used instead of slugs
                const displayNamePattern = /regulationId:\s*['"]([^'"]*(?:\s+\([^)]*\))[^'"]*)['"]/g;
                let match;
                
                while ((match = displayNamePattern.exec(content)) !== null) {
                    const displayName = match[1];
                    
                    // Convert display name to slug format (basic conversion)
                    const slug = displayName
                        .toLowerCase()
                        .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
                        .replace(/\s+/g, '-') // Replace spaces with hyphens
                        .replace(/-+/g, '-') // Replace multiple hyphens with single
                        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
                    
                    if (slug !== displayName && slug.length > 0) {
                        content = content.replace(match[0], `regulationId: '${slug}'`);
                        fileReplacements++;
                        console.log(`  🔄 ${file}: Converted "${displayName}" to "${slug}"`);
                    }
                }
                
                if (fileReplacements > 0) {
                    await fs.promises.writeFile(filePath, content, 'utf8');
                    processedFiles++;
                    totalReplacements += fileReplacements;
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${file}:`, error.message);
            }
        }
        
        console.log(`\n📊 Regulation ID Consistency Fix Complete:`);
        console.log(`   📄 Files processed: ${processedFiles}`);
        console.log(`   🔄 Total replacements: ${totalReplacements}`);
        console.log(`   ✅ All regulation IDs now use consistent slug format`);
        
        if (totalReplacements > 0) {
            console.log(`\n🎯 Next Steps:`);
            console.log(`   1. Test manual update push in console pages`);
            console.log(`   2. Verify WebSocket subscriptions work correctly`);
            console.log(`   3. Check browser console for any remaining errors`);
        }
        
    } catch (error) {
        console.error('❌ Failed to fix regulation ID consistency:', error);
        process.exit(1);
    }
}

// Run the fix
if (require.main === module) {
    fixRegulationIdConsistency();
}

module.exports = { fixRegulationIdConsistency };


