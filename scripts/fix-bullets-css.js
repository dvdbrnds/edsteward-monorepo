#!/usr/bin/env node
/**
 * Fix bullets to use CSS-based indicators instead of Unicode
 * Use small colored circles that render consistently
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Old substeps HTML
const OLD_SUBSTEPS = `<div class="step-substeps" style="margin-left: 28px; font-size: 0.85em; color: #666; margin-top: 6px; line-height: 1.6;">
                        <div class="substep" id="substep-harvard" style="display: flex; align-items: center; gap: 8px;">
                            <span class="substep-icon" style="color: #999; font-size: 10px;">○</span>
                            <span class="substep-name">Harvard CAP</span>
                            <span class="substep-confidence" id="conf-harvard" style="color: #22c55e; font-weight: 500; margin-left: auto;"></span>
                        </div>
                        <div class="substep" id="substep-courtlistener" style="display: flex; align-items: center; gap: 8px;">
                            <span class="substep-icon" style="color: #999; font-size: 10px;">○</span>
                            <span class="substep-name">CourtListener</span>
                            <span class="substep-confidence" id="conf-courtlistener" style="color: #22c55e; font-weight: 500; margin-left: auto;"></span>
                        </div>
                        <div class="substep" id="substep-cornell" style="display: flex; align-items: center; gap: 8px;">
                            <span class="substep-icon" style="color: #999; font-size: 10px;">○</span>
                            <span class="substep-name">Cornell LII</span>
                            <span class="substep-confidence" id="conf-cornell" style="color: #22c55e; font-weight: 500; margin-left: auto;"></span>
                        </div>
                        <div class="substep" id="substep-justia" style="display: flex; align-items: center; gap: 8px;">
                            <span class="substep-icon" style="color: #999; font-size: 10px;">○</span>
                            <span class="substep-name">Justia</span>
                            <span class="substep-confidence" id="conf-justia" style="color: #22c55e; font-weight: 500; margin-left: auto;"></span>
                        </div>
                    </div>`;

// New substeps with CSS circles (inline style creates small dot)
const NEW_SUBSTEPS = `<div class="step-substeps" style="margin-left: 28px; font-size: 0.85em; color: #666; margin-top: 6px; line-height: 1.8;">
                        <div class="substep" id="substep-harvard" style="display: flex; align-items: center; gap: 10px;">
                            <span class="substep-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;"></span>
                            <span class="substep-name" style="flex: 1;">Harvard CAP</span>
                            <span class="substep-confidence" id="conf-harvard" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-courtlistener" style="display: flex; align-items: center; gap: 10px;">
                            <span class="substep-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;"></span>
                            <span class="substep-name" style="flex: 1;">CourtListener</span>
                            <span class="substep-confidence" id="conf-courtlistener" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-cornell" style="display: flex; align-items: center; gap: 10px;">
                            <span class="substep-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;"></span>
                            <span class="substep-name" style="flex: 1;">Cornell LII</span>
                            <span class="substep-confidence" id="conf-cornell" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-justia" style="display: flex; align-items: center; gap: 10px;">
                            <span class="substep-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;"></span>
                            <span class="substep-name" style="flex: 1;">Justia</span>
                            <span class="substep-confidence" id="conf-justia" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                    </div>`;

// Old updateSubstep function
const OLD_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence) {
            const substep = document.getElementById('substep-' + id);
            const confSpan = document.getElementById('conf-' + id);
            if (substep) {
                const icon = substep.querySelector('.substep-icon');
                if (status === 'completed' && confidence > 0) {
                    icon.textContent = '✓';
                    icon.style.color = '#22c55e';
                    icon.style.fontSize = '12px';
                    icon.style.fontWeight = 'bold';
                    if (confSpan) {
                        confSpan.textContent = '(' + confidence + '%)';
                    }
                } else if (status === 'running') {
                    icon.textContent = '◦';
                    icon.style.color = '#3b82f6';
                    icon.style.fontSize = '10px';
                    if (confSpan) {
                        confSpan.textContent = '';
                    }
                } else {
                    icon.textContent = '○';
                    icon.style.color = '#999';
                    icon.style.fontSize = '10px';
                }
            }
        }`;

// New updateSubstep with CSS-based updates
const NEW_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence) {
            const substep = document.getElementById('substep-' + id);
            const confSpan = document.getElementById('conf-' + id);
            if (substep) {
                const icon = substep.querySelector('.substep-icon');
                if (status === 'completed' && confidence > 0) {
                    icon.textContent = '✓';
                    icon.style.background = 'transparent';
                    icon.style.color = '#22c55e';
                    icon.style.fontSize = '14px';
                    icon.style.fontWeight = 'bold';
                    icon.style.width = 'auto';
                    icon.style.height = 'auto';
                    if (confSpan) {
                        confSpan.textContent = '(' + confidence + '%)';
                    }
                } else if (status === 'running') {
                    icon.textContent = '';
                    icon.style.background = '#3b82f6';
                    icon.style.width = '8px';
                    icon.style.height = '8px';
                    if (confSpan) {
                        confSpan.textContent = '';
                    }
                } else {
                    icon.textContent = '';
                    icon.style.background = '#ccc';
                    icon.style.width = '8px';
                    icon.style.height = '8px';
                }
            }
        }`;

async function fixConsoleFiles() {
  console.log('🔧 Fixing bullets to use CSS circles...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      if (content.includes(OLD_SUBSTEPS)) {
        content = content.replace(OLD_SUBSTEPS, NEW_SUBSTEPS);
        modified = true;
      }
      
      if (content.includes(OLD_UPDATESUBSTEP)) {
        content = content.replace(OLD_UPDATESUBSTEP, NEW_UPDATESUBSTEP);
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
      } else {
        console.log(`⏭️ No changes needed: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: Fixed ${fixedCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

fixConsoleFiles().catch(console.error);
