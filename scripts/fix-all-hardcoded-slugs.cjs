#!/usr/bin/env node
/**
 * Comprehensive fix for all hardcoded regulation references in console HTML files
 * 
 * Issues fixed:
 * 1. regulationSlug: 'clery-act' -> regulationSlug: REGULATION_SLUG
 * 2. Corrupted regulationId values -> proper REGULATION_SLUG reference
 * 3. Any other hardcoded slug references
 */

const fs = require('fs');
const path = require('path');

const CONSOLES_DIR = path.join(__dirname, '..', 'src', 'client', 'public', 'regulations');

let totalFixes = 0;
let filesFixed = 0;

// Get all HTML files
const files = fs.readdirSync(CONSOLES_DIR).filter(f => f.endsWith('-console.html'));

console.log(`\n🔧 Fixing all hardcoded slug references in ${files.length} console files...\n`);

for (const file of files) {
    const filePath = path.join(CONSOLES_DIR, file);
    let fixesInFile = 0;
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Fix 1: regulationSlug: 'clery-act' -> regulationSlug: REGULATION_SLUG
        const clerySlugPattern = /regulationSlug:\s*'clery-act'/g;
        if (clerySlugPattern.test(content)) {
            content = content.replace(/regulationSlug:\s*'clery-act'/g, 'regulationSlug: REGULATION_SLUG');
            fixesInFile++;
        }
        
        // Fix 2: regulationSlug: 'any-hardcoded-value' -> regulationSlug: REGULATION_SLUG
        // But NOT if it's already REGULATION_SLUG
        const hardcodedSlugPattern = /regulationSlug:\s*'[^']+'/g;
        if (hardcodedSlugPattern.test(content) && !content.includes('regulationSlug: REGULATION_SLUG')) {
            content = content.replace(/regulationSlug:\s*'[^']+'/g, 'regulationSlug: REGULATION_SLUG');
            fixesInFile++;
        }
        
        // Fix 3: Corrupted regulationId patterns like 'academic-standardsand-campus-crime...'
        // These should use REGULATION_SLUG
        const corruptedIdPattern = /const regulationId = '[^']*and-campus-crime-statistics[^']*'/g;
        if (corruptedIdPattern.test(content)) {
            content = content.replace(corruptedIdPattern, 'const regulationId = REGULATION_SLUG');
            fixesInFile++;
        }
        
        // Fix 4: regulationId: 'corrupted-value' in object literals
        const corruptedIdObjPattern = /regulationId:\s*'[^']*and-campus-crime-statistics[^']*'/g;
        if (corruptedIdObjPattern.test(content)) {
            content = content.replace(corruptedIdObjPattern, 'regulationId: REGULATION_SLUG');
            fixesInFile++;
        }
        
        // Fix 5: Any remaining hardcoded regulation: 'xxx' in workflow calls
        // (This should already be fixed but let's make sure)
        const workflowRegPattern = /regulation:\s*'[^']+',\s*\n\s*quick:/g;
        if (workflowRegPattern.test(content) && !content.includes('regulation: REGULATION_SLUG,')) {
            content = content.replace(workflowRegPattern, 'regulation: REGULATION_SLUG,\n                        quick:');
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

// Verify no remaining issues
console.log('🔍 Verifying no remaining hardcoded slugs...\n');

let remainingIssues = 0;
for (const file of files) {
    const filePath = path.join(CONSOLES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for remaining clery-act references (excluding comments and legitimate references)
    if (content.includes("regulationSlug: 'clery-act'") || 
        content.includes("and-campus-crime-statistics-act")) {
        console.log(`⚠️  Still has issues: ${file}`);
        remainingIssues++;
    }
}

if (remainingIssues === 0) {
    console.log('✅ All consoles verified - no hardcoded cross-regulation references found!');
} else {
    console.log(`\n⚠️  ${remainingIssues} files still have issues - may need manual review`);
}
