#!/usr/bin/env node

/**
 * Deploy Inquisitor Widget to All Console Pages
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, 'src/client/public/regulations');
const BACKUP_DIR = path.join(__dirname, 'backups/console-pages-' + Date.now());

// HTML to add to sidebar (before closing </div>)
const HTML_WIDGET = `
            <h3 style="margin-top: 24px;">🤖 AI Quality Auditor</h3>
            <div id="inquisitorWidget" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                <button id="inquisitorBtn" onclick="runInquisitorAudit()" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 12px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600; font-size: 14px;">
                    ⚡ Run AI Audit
                </button>
                <div id="inquisitorResults" style="display: none; background: white; margin-top: 12px; padding: 12px; border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Quality Report</div>
                    <div id="inquisitorScores" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;"></div>
                </div>
                <div id="inquisitorError" style="display: none; background: #fee; color: #dc2626; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 12px;"></div>
            </div>`;

// JavaScript to add before </body>
const JS_SCRIPT = `
    <script>
    // Inquisitor AI Quality Auditor
    async function runInquisitorAudit() {
        const btn = document.getElementById('inquisitorBtn');
        const results = document.getElementById('inquisitorResults');
        const scores = document.getElementById('inquisitorScores');
        const errorDiv = document.getElementById('inquisitorError');
        
        btn.disabled = true;
        btn.textContent = '🔄 Analyzing...';
        results.style.display = 'none';
        errorDiv.style.display = 'none';
        
        // Get regulation slug from URL
        const slug = window.location.pathname.split('/').pop().replace('-console.html', '');
        
        try {
            const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regulationSlug: slug }),
                signal: AbortSignal.timeout(60000)
            });
            
            if (!response.ok) throw new Error('Audit failed');
            
            const data = await response.json();
            if (data.success && data.audit) {
                const audit = data.audit;
                scores.innerHTML = \`
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600;">OVERALL</div>
                        <div style="font-size: 24px; font-weight: 700; color: \${audit.overallScore >= 90 ? '#10b981' : audit.overallScore >= 75 ? '#3b82f6' : audit.overallScore >= 60 ? '#f59e0b' : '#ef4444'};\">\${audit.overallScore}</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600;">CERTAINTY</div>
                        <div style="font-size: 24px; font-weight: 700;">\${audit.certaintyLevel || 'D'}</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600;">CONTENT</div>
                        <div style="font-size: 24px; font-weight: 700;">\${audit.scores?.content || 0}</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600;">SUMMARY</div>
                        <div style="font-size: 24px; font-weight: 700;">\${audit.scores?.summary || 0}</div>
                    </div>
                \`;
                if (audit.aiAnalysis && audit.aiAnalysis.enabled) {
                    scores.innerHTML += \`
                        <div style="grid-column: 1 / -1; background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 8px;">
                            <div style="font-weight: 600; margin-bottom: 6px;">🤖 AI Analysis</div>
                            <div style="font-size: 11px;">Legal Accuracy: <strong>\${audit.aiAnalysis.legalAccuracy?.score || 0}/100</strong></div>
                            <div style="font-size: 11px;">Completeness: <strong>\${audit.aiAnalysis.completeness?.score || 0}/100</strong></div>
                            <div style="font-size: 11px; margin-top: 6px; padding: 6px; background: white; border-radius: 4px;">\${audit.aiAnalysis.overallAssessment || 'No assessment'}</div>
                        </div>
                    \`;
                }
                results.style.display = 'block';
            }
        } catch (err) {
            errorDiv.textContent = '⚠️ Error: ' + err.message;
            errorDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = '⚡ Run AI Audit';
        }
    }
    </script>`;

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🚀 Starting Inquisitor Widget Deployment...\n');

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
        
        // Skip if already has widget
        if (content.includes('inquisitorWidget')) {
            console.log(`⏭️  SKIP: ${filename}`);
            skipCount++;
            continue;
        }
        
        // Backup original
        const backupPath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(backupPath, content);
        
        // Add HTML widget before closing sidebar div
        // Look for error-panel closing, then add widget before sidebar closing
        const sidebarPattern = /(\s*<\/div>\s*)\s*<\/div>\s*<\/div>\s*<script>/;
        if (!sidebarPattern.test(content)) {
            console.log(`⚠️  WARN: ${filename} (sidebar pattern not found)`);
            errorCount++;
            continue;
        }
        
        content = content.replace(
            /(\s*<\/div>\s*)\s*(<\/div>\s*<\/div>\s*<script>)/,
            `$1${HTML_WIDGET}\n        $2`
        );
        
        // Add JavaScript before closing body tag
        const bodyPattern = /(\s*<\/script>\s*)(<\/body>)/;
        if (!bodyPattern.test(content)) {
            console.log(`⚠️  WARN: ${filename} (body closing not found)`);
            errorCount++;
            continue;
        }
        
        content = content.replace(
            /(\s*<\/script>\s*)(<\/body>)/,
            `$1${JS_SCRIPT}\n$2`
        );
        
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
console.log('📊 DEPLOYMENT SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Successfully updated: ${successCount} files`);
console.log(`⏭️  Skipped (already has widget): ${skipCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`📁 Backups saved to: ${BACKUP_DIR}`);
console.log('='.repeat(60));

console.log('\n🎉 Inquisitor widget deployed!\n');
console.log('🧪 Test any console page:');
console.log('   http://localhost:3050/regulations/*-console.html\n');

process.exit(errorCount > 0 ? 1 : 0);

