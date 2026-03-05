#!/usr/bin/env node
/**
 * Fix updateSubstep function placement - it was incorrectly inserted
 * inside updateStepStatus, breaking the if-else chain
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// The broken pattern
const BROKEN_PATTERN = `        function updateStepStatus(stepNum, status) {
            const step = document.getElementById(\`step\${stepNum}\`);
            if (step) {
                step.className = \`step-item \${status}\`;
                if (status === 'running') {
                    step.querySelector('.step-icon').textContent = '●';
                }

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
 else if (status === 'completed') {
                    step.querySelector('.step-icon').textContent = '✓';
                } else if (status === 'error') {
                    step.querySelector('.step-icon').textContent = '✗';
                }
            }
        }`;

// The fixed pattern
const FIXED_PATTERN = `        function updateSubstep(id, status, confidence) {
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
        
        function updateStepStatus(stepNum, status) {
            const step = document.getElementById(\`step\${stepNum}\`);
            if (step) {
                step.className = \`step-item \${status}\`;
                if (status === 'running') {
                    step.querySelector('.step-icon').textContent = '●';
                } else if (status === 'completed') {
                    step.querySelector('.step-icon').textContent = '✓';
                } else if (status === 'error') {
                    step.querySelector('.step-icon').textContent = '✗';
                }
            }
        }`;

async function fixConsoleFiles() {
  console.log('🔧 Fixing updateSubstep function placement...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  let alreadyFixed = 0;
  let noMatch = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(BROKEN_PATTERN)) {
        content = content.replace(BROKEN_PATTERN, FIXED_PATTERN);
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
      } else if (content.includes('function updateSubstep(id, status, confidence)') && 
                 content.includes('function updateStepStatus(stepNum, status)')) {
        // Check if already fixed (updateSubstep comes before updateStepStatus)
        const substepPos = content.indexOf('function updateSubstep(id, status, confidence)');
        const stepStatusPos = content.indexOf('function updateStepStatus(stepNum, status)');
        
        if (substepPos < stepStatusPos) {
          console.log(`⏭️ Already fixed: ${file}`);
          alreadyFixed++;
        } else {
          console.log(`⚠️ Different pattern: ${file}`);
          noMatch++;
        }
      } else {
        console.log(`⚠️ Pattern not found: ${file}`);
        noMatch++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Fixed: ${fixedCount} files`);
  console.log(`   ⏭️ Already fixed: ${alreadyFixed} files`);
  console.log(`   ⚠️ No match: ${noMatch} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

fixConsoleFiles().catch(console.error);
