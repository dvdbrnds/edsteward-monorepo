#!/usr/bin/env node

/**
 * Automated Script: Add Inquisitor Widget to All Console Pages
 * 
 * This script automatically adds the AI Quality Auditor widget to all
 * regulation console pages in src/client/public/regulations/*-console.html
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, 'src/client/public/regulations');
const SNIPPET_FILE = path.join(__dirname, 'src/client/public/inquisitor-widget-snippet.html');
const BACKUP_DIR = path.join(__dirname, 'backups/console-pages');

// Read the snippet file
console.log('📖 Reading Inquisitor widget snippet...');
const snippetContent = fs.readFileSync(SNIPPET_FILE, 'utf8');

// Extract CSS, HTML, and JavaScript from snippet
const cssMatch = snippetContent.match(/<style>([\s\S]*?)<\/style>/);
const htmlMatch = snippetContent.match(/<!-- HTML Widget.*?-->([\s\S]*?)<!-- JavaScript/);
const jsMatch = snippetContent.match(/<script>([\s\S]*?)<\/script>/);

if (!cssMatch || !htmlMatch || !jsMatch) {
    console.error('❌ Failed to parse snippet file!');
    process.exit(1);
}

const cssContent = cssMatch[1].trim();
const htmlContent = htmlMatch[1].trim();
const jsContent = jsMatch[1].trim();

console.log('✅ Parsed snippet successfully!');
console.log(`   CSS: ${cssContent.length} chars`);
console.log(`   HTML: ${htmlContent.length} chars`);
console.log(`   JavaScript: ${jsContent.length} chars`);

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
}

// Find all console HTML files
const consoleFiles = fs.readdirSync(REGULATIONS_DIR)
    .filter(file => file.endsWith('-console.html'));

console.log(`\n🔍 Found ${consoleFiles.length} console pages to update\n`);

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

// Process each file
for (const filename of consoleFiles) {
    const filePath = path.join(REGULATIONS_DIR, filename);
    
    try {
        // Read original file
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if widget already exists
        if (content.includes('inquisitor-widget')) {
            console.log(`⏭️  SKIP: ${filename} (widget already exists)`);
            skipCount++;
            continue;
        }
        
        // Backup original file
        const backupPath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(backupPath, content);
        
        // 1. Add CSS to style section (find last </style> tag)
        const styleEndIndex = content.lastIndexOf('</style>');
        if (styleEndIndex === -1) {
            console.log(`⚠️  WARN: ${filename} (no <style> section found)`);
            errorCount++;
            continue;
        }
        
        content = content.substring(0, styleEndIndex) + 
                  '\n\n/* ====== INQUISITOR WIDGET STYLES ====== */\n' +
                  cssContent + '\n\n' +
                  content.substring(styleEndIndex);
        
        // 2. Add HTML to sidebar (find last </div> before </div> <!-- console-container -->)
        const sidebarPattern = /([\s\S]*?)(\s*<\/div>\s*(?:<!--.*?sidebar.*?-->)?\s*<\/div>\s*(?:<!--.*?console-container.*?-->)?)/;
        const sidebarMatch = content.match(sidebarPattern);
        
        if (!sidebarMatch) {
            console.log(`⚠️  WARN: ${filename} (sidebar structure not found)`);
            errorCount++;
            continue;
        }
        
        content = sidebarMatch[1] + 
                  '\n\n            <!-- ====== INQUISITOR WIDGET ====== -->\n' +
                  htmlContent.split('\n').map(line => '            ' + line).join('\n') + '\n' +
                  sidebarMatch[2];
        
        // 3. Add JavaScript before </body>
        const bodyEndIndex = content.lastIndexOf('</body>');
        if (bodyEndIndex === -1) {
            console.log(`⚠️  WARN: ${filename} (no </body> tag found)`);
            errorCount++;
            continue;
        }
        
        content = content.substring(0, bodyEndIndex) + 
                  '\n    <!-- ====== INQUISITOR WIDGET SCRIPT ====== -->\n' +
                  '    <script>\n' +
                  jsContent.split('\n').map(line => '    ' + line).join('\n') + '\n' +
                  '    </script>\n\n' +
                  content.substring(bodyEndIndex);
        
        // Write updated file
        fs.writeFileSync(filePath, content);
        
        console.log(`✅ SUCCESS: ${filename}`);
        successCount++;
        
    } catch (error) {
        console.error(`❌ ERROR: ${filename}`, error.message);
        errorCount++;
    }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Successfully updated: ${successCount} files`);
console.log(`⏭️  Skipped (already has widget): ${skipCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`📁 Backups saved to: ${BACKUP_DIR}`);
console.log('='.repeat(60));

if (successCount > 0) {
    console.log('\n🎉 Inquisitor widget added to console pages!');
    console.log('\n🧪 Test it:');
    console.log('   1. Open any console page (e.g., http://localhost:3050/regulations/ferpa-console.html)');
    console.log('   2. Look for the purple "AI Quality Auditor" widget in the sidebar');
    console.log('   3. Click "Run AI Audit" to test');
    console.log('\n💡 If you need to rollback, restore from:', BACKUP_DIR);
}

process.exit(errorCount > 0 ? 1 : 0);

