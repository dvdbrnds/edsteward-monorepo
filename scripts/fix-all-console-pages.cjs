#!/usr/bin/env node

/**
 * Fix All Console Pages Script
 * Updates all 285+ regulation console pages to remove TEACH Act references
 * and replace them with regulation-specific content
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Console Pages Content Fix...');
console.log('📋 Removing TEACH Act references from all regulation console pages');

// Configuration
const REGULATIONS_DIR = './src/client/public/regulations';
const BACKUP_DIR = './console-backup';

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
}

// Function to extract regulation info from filename
function extractRegulationInfo(filename) {
    const baseName = filename.replace('-console.html', '');
    const parts = baseName.split('-');
    
    // Generate regulation-specific content
    const regulationName = parts.map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    let regulationType = 'CFR';
    let agency = 'Department of Education';
    let focusArea = 'compliance';
    
    // Determine regulation type and agency based on name
    if (baseName.includes('ada') || baseName.includes('disabilities')) {
        agency = 'Department of Justice';
        focusArea = 'accessibility';
    } else if (baseName.includes('privacy') || baseName.includes('ferpa')) {
        agency = 'Department of Education';
        focusArea = 'privacy';
    } else if (baseName.includes('civil-rights') || baseName.includes('discrimination')) {
        agency = 'Department of Education / EEOC';
        focusArea = 'civil rights';
    } else if (baseName.includes('financial') || baseName.includes('aid')) {
        agency = 'Department of Education';
        focusArea = 'financial compliance';
    } else if (baseName.includes('health') || baseName.includes('safety')) {
        agency = 'Department of Health and Human Services';
        focusArea = 'health and safety';
    } else if (baseName.includes('employment') || baseName.includes('labor')) {
        agency = 'Department of Labor';
        focusArea = 'employment';
    }
    
    return {
        slug: baseName,
        name: regulationName,
        agency: agency,
        focusArea: focusArea,
        regulationType: regulationType
    };
}

// Function to generate regulation-specific replacements
function generateReplacements(regulationInfo) {
    const { name, agency, focusArea, slug } = regulationInfo;
    
    return {
        // Loading messages
        'Loading official TEACH Act statute from US Code': `Loading official ${name} statute from CFR`,
        'Loading official guidance from U.S. Copyright Office': `Loading official guidance from ${agency}`,
        
        // Titles and headers
        'TEACH Act Implementation Guidelines': `${name} Implementation Guidelines`,
        'TEACH Act Compliance Guidelines': `${name} Compliance Guidelines`,
        'TEACH Act Update Staging System': `${name} Update Staging System`,
        'TEACH Act Customer API Distribution': `${name} Customer API Distribution`,
        
        // Content descriptions
        'Fetching Real CFR TEACH Act Guidance': `Fetching Real CFR ${name} Guidance`,
        'Generating Real TEACH Act Compliance Guidance': `Generating Real ${name} Compliance Guidance`,
        'Calculating institutional requirements and risk assessments': `Calculating institutional ${focusArea} requirements and risk assessments`,
        
        // Workflow content
        'TEACH Act compliance validation': `${name} compliance validation`,
        'Copyright Office TEACH Act Guidance': `${agency} ${name} Guidance`,
        'TEACH Act regulatory guidance analysis': `${name} regulatory guidance analysis`,
        'Copyright Office integration and analysis': `${agency} integration and analysis`,
        
        // University research descriptions
        'TEACH Act research database': `${name} research database`,
        'Found TEACH Act references': `Found ${name} references`,
        'High agreement on TEACH Act interpretation': `High agreement on ${name} interpretation`,
        'TEACH Act interpretation': `${name} interpretation`,
        
        // Console messages
        'Regulation preview loaded: TEACH Act': `Regulation preview loaded: ${name}`,
        'TEACH Act LinearEngine ready for execution': `${name} LinearEngine ready for execution`,
        
        // API endpoints - this is critical!
        'http://localhost:3002/api/llm/compliance/teach-act': `http://localhost:3002/api/llm/cfr/${slug}`,
        '/api/llm/compliance/teach-act': `/api/llm/cfr/${slug}`,
        'api/llm/compliance/teach-act': `api/llm/cfr/${slug}`,
        
        // Requirements content
        'Key Compliance Requirements for TEACH Act': `Key Compliance Requirements for ${name}`,
        'TEACH Act Enhanced Requirements': `${name} Enhanced Requirements`
    };
}

// Function to fix a single console page
function fixConsolePage(filePath) {
    const filename = path.basename(filePath);
    const regulationInfo = extractRegulationInfo(filename);
    const replacements = generateReplacements(regulationInfo);
    
    console.log(`📝 Processing: ${regulationInfo.name} (${filename})`);
    
    try {
        // Create backup
        const backupPath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(filePath, backupPath);
        }
        
        // Read file content
        let content = fs.readFileSync(filePath, 'utf8');
        let changeCount = 0;
        
        // Apply all replacements
        for (const [oldText, newText] of Object.entries(replacements)) {
            const regex = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const matches = content.match(regex);
            if (matches) {
                content = content.replace(regex, newText);
                changeCount += matches.length;
            }
        }
        
        // Write updated content
        fs.writeFileSync(filePath, content);
        
        console.log(`   ✅ Applied ${changeCount} replacements`);
        return changeCount;
        
    } catch (error) {
        console.error(`   ❌ Error processing ${filename}:`, error.message);
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
        
        console.log(`📊 Found ${files.length} console pages to process`);
        
        let totalFiles = 0;
        let totalChanges = 0;
        
        // Process each file
        for (const filePath of files) {
            const changes = fixConsolePage(filePath);
            if (changes > 0) {
                totalFiles++;
                totalChanges += changes;
            }
        }
        
        console.log('\n🎯 CONTENT FIX COMPLETE');
        console.log('========================');
        console.log(`✅ Files processed: ${totalFiles}`);
        console.log(`✅ Total replacements: ${totalChanges}`);
        console.log(`📁 Backups stored in: ${BACKUP_DIR}`);
        
        // Verify the fix
        console.log('\n🔍 Verifying fix...');
        const remainingTeachActFiles = files.filter(filePath => {
            const content = fs.readFileSync(filePath, 'utf8');
            return content.includes('TEACH Act');
        });
        
        if (remainingTeachActFiles.length === 0) {
            console.log('✅ SUCCESS: No TEACH Act references found in any console page!');
        } else {
            console.log(`⚠️ WARNING: ${remainingTeachActFiles.length} files still contain TEACH Act references`);
            remainingTeachActFiles.slice(0, 5).forEach(file => {
                console.log(`   - ${path.basename(file)}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
