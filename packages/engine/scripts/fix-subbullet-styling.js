#!/usr/bin/env node
/**
 * Fix sub-bullet styling:
 * 1. Use proper bullet points (•) instead of circles (○)
 * 2. Add confidence span for percentages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Old substeps HTML
const OLD_SUBSTEPS = `<div class="step-substeps" style="margin-left: 20px; font-size: 0.85em; color: #666; margin-top: 5px;">
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

// New substeps HTML with proper bullets and confidence spans
const NEW_SUBSTEPS = `<div class="step-substeps" style="margin-left: 24px; font-size: 0.82em; color: #555; margin-top: 4px;">
                        <div class="substep" id="substep-harvard" style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span class="substep-icon" style="color: #888;">•</span>
                            <span class="substep-name">Harvard CAP</span>
                            <span class="substep-confidence" id="conf-harvard" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-courtlistener" style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span class="substep-icon" style="color: #888;">•</span>
                            <span class="substep-name">CourtListener</span>
                            <span class="substep-confidence" id="conf-courtlistener" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-cornell" style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span class="substep-icon" style="color: #888;">•</span>
                            <span class="substep-name">Cornell LII</span>
                            <span class="substep-confidence" id="conf-cornell" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                        <div class="substep" id="substep-justia" style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span class="substep-icon" style="color: #888;">•</span>
                            <span class="substep-name">Justia</span>
                            <span class="substep-confidence" id="conf-justia" style="color: #22c55e; font-weight: 500;"></span>
                        </div>
                    </div>`;

// Old updateSubstep function
const OLD_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence) {
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
        }`;

// New updateSubstep function - uses separate confidence span
const NEW_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence) {
            const substep = document.getElementById('substep-' + id);
            const confSpan = document.getElementById('conf-' + id);
            if (substep) {
                const icon = substep.querySelector('.substep-icon');
                if (status === 'completed' && confidence > 0) {
                    icon.textContent = '✓';
                    icon.style.color = '#22c55e';
                    if (confSpan) {
                        confSpan.textContent = '(' + confidence + '%)';
                    }
                } else if (status === 'running') {
                    icon.textContent = '→';
                    icon.style.color = '#3b82f6';
                    if (confSpan) {
                        confSpan.textContent = '';
                    }
                } else {
                    icon.textContent = '•';
                    icon.style.color = '#888';
                }
            }
        }`;

async function fixConsoleFiles() {
  console.log('🔧 Fixing sub-bullet styling and confidence display...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix substeps HTML
      if (content.includes(OLD_SUBSTEPS)) {
        content = content.replace(OLD_SUBSTEPS, NEW_SUBSTEPS);
        modified = true;
      }
      
      // Fix updateSubstep function
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
