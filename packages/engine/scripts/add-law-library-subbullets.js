#!/usr/bin/env node
/**
 * Add law library sub-bullets to the validation steps panel
 * Shows individual APIs under "University Law Libraries" step
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

async function updateConsoleFiles() {
  console.log('🔧 Adding law library sub-bullets to validation steps...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if already has substeps content in the step-substeps div
      if (content.includes('substep-harvard')) {
        console.log(`⏭️ Already has substeps: ${file}`);
        skippedCount++;
        continue;
      }
      
      // Find and replace the empty step-substeps div with content
      const oldPattern = /<div class="step-substeps"[^>]*>\s*\n\s*<\/div>/;
      const newContent = `<div class="step-substeps" style="margin-left: 20px; font-size: 0.85em; color: #666; margin-top: 5px;">
                        <div class="substep" id="substep-harvard" style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                            <span class="substep-icon" style="font-size: 0.8em; width: 12px;">○</span>
                            <span>Harvard CAP</span>
                        </div>
                        <div class="substep" id="substep-courtlistener" style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                            <span class="substep-icon" style="font-size: 0.8em; width: 12px;">○</span>
                            <span>CourtListener</span>
                        </div>
                        <div class="substep" id="substep-cornell" style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                            <span class="substep-icon" style="font-size: 0.8em; width: 12px;">○</span>
                            <span>Cornell LII</span>
                        </div>
                        <div class="substep" id="substep-justia" style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
                            <span class="substep-icon" style="font-size: 0.8em; width: 12px;">○</span>
                            <span>Justia</span>
                        </div>
                    </div>`;
      
      if (oldPattern.test(content)) {
        content = content.replace(oldPattern, newContent);
        
        // Also add the updateSubstep function after updateStepStatus if not present
        if (!content.includes('function updateSubstep')) {
          const updateSubstepFunc = `
                function updateSubstep(id, status, confidence) {
                    const substep = document.getElementById('substep-' + id);
                    if (substep) {
                        const icon = substep.querySelector('.substep-icon');
                        const text = substep.querySelector('span:last-child');
                        if (status === 'completed' && confidence > 0) {
                            icon.textContent = '✓';
                            icon.style.color = '#22c55e';
                            if (!text.textContent.includes('%')) {
                                text.textContent += ' (' + confidence + '%)';
                            }
                        } else if (status === 'running') {
                            icon.textContent = '◉';
                            icon.style.color = '#3b82f6';
                        } else if (status === 'checking') {
                            icon.textContent = '○';
                            icon.style.color = '#999';
                        }
                    }
                }
`;
          // Add after updateStepStatus function
          content = content.replace(
            /(function updateStepStatus\(stepNum, status\) \{[\s\S]*?^\s{16}\})/m,
            '$1\n' + updateSubstepFunc
          );
        }
        
        // Update Step 3 to call updateSubstep for each library
        // Harvard
        content = content.replace(
          "addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');",
          "addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');\n                updateSubstep('harvard', 'running', 0);"
        );
        content = content.replace(
          /addConsoleLog\(`   📚 Harvard Caselaw Access Project: \$\{harvard\.confidence\}% confidence \(REAL API\)`, 'success'\);/,
          "addConsoleLog(`   📚 Harvard Caselaw Access Project: ${harvard.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('harvard', 'completed', harvard.confidence);"
        );
        
        // CourtListener
        content = content.replace(
          "addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');",
          "addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');\n                updateSubstep('courtlistener', 'running', 0);"
        );
        content = content.replace(
          /addConsoleLog\(`   🏛️ CourtListener \(Free Law Project\): \$\{cl\.confidence\}% confidence \(REAL API\)`, 'success'\);/,
          "addConsoleLog(`   🏛️ CourtListener (Free Law Project): ${cl.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('courtlistener', 'completed', cl.confidence);"
        );
        
        // Cornell
        content = content.replace(
          "addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');",
          "addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');\n                updateSubstep('cornell', 'running', 0);"
        );
        content = content.replace(
          /addConsoleLog\(`   ⚖️ Cornell LII: \$\{cornellData\.confidence\}% confidence \(REAL API\)`, 'success'\);/,
          "addConsoleLog(`   ⚖️ Cornell LII: ${cornellData.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('cornell', 'completed', cornellData.confidence);"
        );
        
        // Justia
        content = content.replace(
          "addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');",
          "addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');\n                updateSubstep('justia', 'running', 0);"
        );
        content = content.replace(
          /addConsoleLog\(`   📖 Justia Legal: \$\{justia\.confidence\}% confidence \(REAL\)`, 'success'\);/,
          "addConsoleLog(`   📖 Justia Legal: ${justia.confidence}% confidence (REAL)`, 'success');\n                updateSubstep('justia', 'completed', justia.confidence);"
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${file}`);
        updatedCount++;
      } else {
        console.log(`⚠️ Pattern not found: ${file}`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Updated: ${updatedCount} files`);
  console.log(`   ⏭️ Skipped: ${skippedCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

updateConsoleFiles().catch(console.error);
