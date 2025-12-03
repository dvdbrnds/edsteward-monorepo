#!/usr/bin/env node

/**
 * Deploy ENHANCED Inquisitor Widget with Animated Progress Bar
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, 'src/client/public/regulations');
const BACKUP_DIR = path.join(__dirname, 'backups/enhanced-' + Date.now());

console.log('🚀 Deploying Enhanced Inquisitor Widget with Progress Bar...\n');

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Get all console files
const consoleFiles = fs.readdirSync(REGULATIONS_DIR)
    .filter(file => file.endsWith('-console.html'));

console.log(`📋 Found ${consoleFiles.length} console pages\n`);

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const filename of consoleFiles) {
    const filePath = path.join(REGULATIONS_DIR, filename);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Skip if doesn't have inquisitor widget
        if (!content.includes('inquisitorWidget')) {
            console.log(`⏭️  SKIP: ${filename} (no widget found)`);
            skipCount++;
            continue;
        }
        
        // Check if already enhanced
        if (content.includes('inquisitorProgress')) {
            console.log(`⏭️  SKIP: ${filename} (already enhanced)`);
            skipCount++;
            continue;
        }
        
        // Backup original
        const backupPath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(backupPath, content);
        
        // Replace old widget HTML with enhanced version
        const oldWidgetPattern = /<button id="inquisitorBtn"[\s\S]*?<\/button>\s*<div id="inquisitorResults"/;
        const enhancedWidget = `<button id="inquisitorBtn" onclick="runInquisitorAudit()" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 12px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600; font-size: 14px; transition: all 0.3s;">
                    ⚡ Run AI Audit
                </button>
                <div id="inquisitorProgress" style="display: none; background: rgba(255, 255, 255, 0.95); margin-top: 12px; padding: 12px; border-radius: 8px;">
                    <div style="font-size: 12px; color: #495057; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border: 2px solid #667eea; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
                        <span>AI analyzing regulation quality...</span>
                    </div>
                    <div style="background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div id="inquisitorProgressBar" style="height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: 0%; transition: width 0.5s ease;"></div>
                    </div>
                    <div id="inquisitorProgressText" style="text-align: center; font-size: 11px; color: #6c757d; margin-top: 6px; font-weight: 600;">0%</div>
                </div>
                <div id="inquisitorResults"`;
        
        if (!oldWidgetPattern.test(content)) {
            console.log(`⚠️  WARN: ${filename} (widget pattern not found)`);
            errorCount++;
            continue;
        }
        
        content = content.replace(oldWidgetPattern, enhancedWidget);
        
        // Add @keyframes spin if not present
        if (!content.includes('@keyframes spin')) {
            const styleEndIndex = content.lastIndexOf('</style>');
            if (styleEndIndex > 0) {
                content = content.substring(0, styleEndIndex) +
                         '\n                @keyframes spin { to { transform: rotate(360deg); } }\n            ' +
                         content.substring(styleEndIndex);
            }
        }
        
        // Update JavaScript function
        const oldJsPattern = /btn\.disabled = true;\s*btn\.textContent = '🔄 Analyzing\.\.\.';/;
        const enhancedJsStart = `btn.disabled = true;
        btn.textContent = '🔄 Analyzing...';
        btn.style.opacity = '0.6';
        results.style.display = 'none';
        errorDiv.style.display = 'none';
        progress.style.display = 'block';
        
        // Animate progress bar from 0 to 90% over ~8 seconds
        let currentProgress = 0;
        const progressInterval = setInterval(() => {
            currentProgress = Math.min(currentProgress + 10, 90);
            progressBar.style.width = currentProgress + '%';
            progressText.textContent = currentProgress + '%';
        }, 800);`;
        
        content = content.replace(oldJsPattern, enhancedJsStart);
        
        // Update after fetch to complete progress
        const fetchPattern = /const response = await fetch\('http:\/\/localhost:3061\/api\/inquisitor\/audit',[\s\S]*?\);[\s\n\s]*if \(!response\.ok\) throw new Error\('Audit failed'\);/;
        const enhancedFetch = `const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regulationSlug: slug }),
                signal: AbortSignal.timeout(60000)
            });
            
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressText.textContent = '100% Complete!';
            
            if (!response.ok) throw new Error('Audit failed');`;
        
        content = content.replace(fetchPattern, enhancedFetch);
        
        // Enhance error handling
        const catchPattern = /} catch \(err\) \{\s*errorDiv\.textContent = '⚠️ Error: ' \+ err\.message;\s*errorDiv\.style\.display = 'block';/;
        const enhancedCatch = `} catch (err) {
            clearInterval(progressInterval);
            errorDiv.textContent = '⚠️ Error: ' + err.message;
            errorDiv.style.display = 'block';`;
        
        content = content.replace(catchPattern, enhancedCatch);
        
        // Enhance finally block
        const finallyPattern = /} finally \{\s*btn\.disabled = false;\s*btn\.textContent = '⚡ Run AI Audit';/;
        const enhancedFinally = `} finally {
            setTimeout(() => {
                progress.style.display = 'none';
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
            }, 1500);
            btn.disabled = false;
            btn.textContent = '⚡ Run AI Audit';
            btn.style.opacity = '1';`;
        
        content = content.replace(finallyPattern, enhancedFinally);
        
        // Write updated file
        fs.writeFileSync(filePath, content);
        
        console.log(`✅ ENHANCED: ${filename}`);
        successCount++;
        
    } catch (error) {
        console.error(`❌ ERROR: ${filename}`, error.message);
        errorCount++;
    }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 ENHANCEMENT SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Successfully enhanced: ${successCount} files`);
console.log(`⏭️  Skipped: ${skipCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`📁 Backups saved to: ${BACKUP_DIR}`);
console.log('='.repeat(60));

console.log('\n🎉 Enhanced Inquisitor widgets deployed!\n');
console.log('✨ New features:');
console.log('   - Animated progress bar (0-100%)');
console.log('   - Real-time progress percentage');
console.log('   - Spinning loader icon');
console.log('   - Color-coded AI scores');
console.log('   - Timestamp on results');
console.log('   - "Claude Sonnet 4.5" badge\n');

console.log('🧪 Test it:');
console.log('   http://localhost:3050/regulations/title-ix-console.html\n');

process.exit(errorCount > 0 ? 1 : 0);
