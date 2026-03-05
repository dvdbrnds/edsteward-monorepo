#!/usr/bin/env node
/**
 * Fix hardcoded regulation names and IDs in console files
 * 
 * Replaces hardcoded regulation names with dynamic variable references
 */

const fs = require('fs');
const path = require('path');

const CONSOLES_DIR = path.join(__dirname, '..', 'src', 'client', 'public', 'regulations');

let totalFixes = 0;
let filesFixed = 0;

const files = fs.readdirSync(CONSOLES_DIR).filter(f => f.endsWith('-console.html'));

console.log(`\n🔧 Fixing hardcoded names/IDs in ${files.length} console files...\n`);

for (const file of files) {
    const filePath = path.join(CONSOLES_DIR, file);
    let fixesInFile = 0;
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Fix 1: EdSteward payload - remove hardcoded regulationId and edstewardId
        const edstewardPattern = /body: JSON\.stringify\(\{\s*regulationId:\s*\d+,\s*regulationSlug:\s*REGULATION_SLUG,\s*name:\s*'[^']+',\s*edstewardId:\s*\d+\s*\}\)/gs;
        if (edstewardPattern.test(content)) {
            content = content.replace(edstewardPattern, 
                `body: JSON.stringify({
                        regulationSlug: REGULATION_SLUG,
                        regKey: REG_KEY,
                        name: REGULATION_NAME
                    })`);
            fixesInFile++;
        }
        
        // Fix 2: Hardcoded log message with ID 9
        const logIdPattern = /addConsoleLog\('📋 Regulation ID: \d+ \([^)]+\) \| Status:/g;
        if (logIdPattern.test(content)) {
            content = content.replace(logIdPattern, 
                "addConsoleLog(`📋 ${REG_KEY} (${REGULATION_NAME}) | Status:");
            fixesInFile++;
        }
        
        // Fix 3: Hardcoded 'REG-001' in log messages
        const regLogPattern = /addConsoleLog\('📋 Regulation: [^']+\(REG-001\)',/g;
        if (regLogPattern.test(content)) {
            content = content.replace(regLogPattern, 
                "addConsoleLog(`📋 Regulation: ${REGULATION_NAME} (${REG_KEY})`,");
            fixesInFile++;
        }
        
        // Fix 4: Hardcoded regulation name in package log
        const pkgLogPattern = /addConsoleLog\(`\s*📦 Regulation: \$\{pkg\?\.[^}]+\} - [^`]+`/g;
        if (pkgLogPattern.test(content) && !content.includes('${REGULATION_NAME}`, \'info\'')) {
            content = content.replace(
                /addConsoleLog\(`\s*📦 Regulation: \$\{pkg\?\.regKey \|\| 'REG-001'\} - [^`]+`/g,
                "addConsoleLog(`   📦 Regulation: ${pkg?.regKey || REG_KEY} - ${REGULATION_NAME}`"
            );
            fixesInFile++;
        }
        
        // Fix 5: Hardcoded "Sending Clery Act" or similar
        const sendingPattern = /addConsoleLog\('📤 Sending [^']+ update to EdSteward\.\.\.'/g;
        if (sendingPattern.test(content) && !content.includes('`📤 Sending ${REGULATION_NAME}')) {
            content = content.replace(sendingPattern, 
                "addConsoleLog(`📤 Sending ${REGULATION_NAME} update to EdSteward...`");
            fixesInFile++;
        }
        
        // Fix 6: Hardcoded regKey fallback to string 'REG-001'
        const regKeyFallbackPattern = /regKey: reg\.reg_key \|\| reg\.regKey \|\| 'REG-001'/g;
        if (regKeyFallbackPattern.test(content)) {
            content = content.replace(regKeyFallbackPattern, 
                "regKey: reg.reg_key || reg.regKey || REG_KEY");
            fixesInFile++;
        }
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fixed ${file} (${fixesInFile} patterns)`);
            filesFixed++;
            totalFixes += fixesInFile;
        }
    } catch (err) {
        console.error(`❌ Error processing ${file}: ${err.message}`);
    }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`📊 Summary:`);
console.log(`   ✅ Files fixed: ${filesFixed}`);
console.log(`   🔧 Total pattern fixes: ${totalFixes}`);
console.log(`   📁 Files unchanged: ${files.length - filesFixed}`);
console.log(`${'═'.repeat(60)}\n`);
