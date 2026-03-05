#!/usr/bin/env node
/**
 * Update console files to show proper API status messages
 * - requires_api_key: Show "API Key Required" with signup link
 * - web_only: Show "Web Only"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Old updateSubstep function
const OLD_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence) {
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

// New updateSubstep with better status handling
const NEW_UPDATESUBSTEP = `        function updateSubstep(id, status, confidence, errorMsg) {
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
                } else if (status === 'requires_key') {
                    icon.textContent = '🔑';
                    icon.style.background = 'transparent';
                    icon.style.color = '#f59e0b';
                    icon.style.fontSize = '10px';
                    icon.style.width = 'auto';
                    icon.style.height = 'auto';
                    if (confSpan) {
                        confSpan.textContent = '(key needed)';
                        confSpan.style.color = '#f59e0b';
                        confSpan.style.fontSize = '0.85em';
                    }
                } else if (status === 'web_only') {
                    icon.textContent = '🌐';
                    icon.style.background = 'transparent';
                    icon.style.color = '#6b7280';
                    icon.style.fontSize = '10px';
                    icon.style.width = 'auto';
                    icon.style.height = 'auto';
                    if (confSpan) {
                        confSpan.textContent = '(web only)';
                        confSpan.style.color = '#6b7280';
                        confSpan.style.fontSize = '0.85em';
                    }
                } else {
                    icon.textContent = '';
                    icon.style.background = '#ccc';
                    icon.style.width = '8px';
                    icon.style.height = '8px';
                }
            }
        }`;

// Update Harvard CAP handling
const OLD_HARVARD = `// Harvard Caselaw Access Project (REAL)
                if (lawLibraryData?.harvardCaselawAccessProject) {
                    const harvard = lawLibraryData.harvardCaselawAccessProject;
                    if (harvard.status === 'fetched' && harvard.confidence > 0) {
                        addConsoleLog(\`   📚 Harvard Caselaw Access Project: \${harvard.confidence}% confidence (REAL API)\`, 'success');
                        updateSubstep('harvard', 'completed', harvard.confidence);
                        addConsoleLog(\`      └─ \${harvard.data?.totalCases || 0} cases found, \${harvard.data?.coverage || 'US court cases'}\`, 'debug');
                    } else {
                        addConsoleLog(\`   📚 Harvard CAP: \${harvard.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');
                    updateSubstep('harvard', 'running', 0);
                }`;

const NEW_HARVARD = `// Harvard Caselaw Access Project
                if (lawLibraryData?.harvardCaselawAccessProject) {
                    const harvard = lawLibraryData.harvardCaselawAccessProject;
                    if (harvard.status === 'fetched' && harvard.confidence > 0) {
                        addConsoleLog(\`   📚 Harvard CAP: \${harvard.confidence}% confidence (REAL)\`, 'success');
                        updateSubstep('harvard', 'completed', harvard.confidence);
                    } else if (harvard.status === 'requires_api_key') {
                        addConsoleLog('   📚 Harvard CAP: API key required (free registration)', 'warning');
                        updateSubstep('harvard', 'requires_key', 0);
                    } else {
                        addConsoleLog(\`   📚 Harvard CAP: \${harvard.status || 'unavailable'}\`, 'info');
                        updateSubstep('harvard', 'pending', 0);
                    }
                } else {
                    addConsoleLog('   📚 Harvard CAP: Not configured', 'info');
                    updateSubstep('harvard', 'pending', 0);
                }`;

// Update Justia handling
const OLD_JUSTIA = `// Justia (REAL)
                if (lawLibraryData?.justia) {
                    const justia = lawLibraryData.justia;
                    if ((justia.status === 'fetched' || justia.status === 'available') && justia.confidence > 0) {
                        addConsoleLog(\`   📖 Justia Legal: \${justia.confidence}% confidence (REAL)\`, 'success');
                        updateSubstep('justia', 'completed', justia.confidence);
                    } else {
                        addConsoleLog(\`   📖 Justia: \${justia.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');
                    updateSubstep('justia', 'running', 0);
                }`;

const NEW_JUSTIA = `// Justia (Web Only - No API)
                if (lawLibraryData?.justia) {
                    const justia = lawLibraryData.justia;
                    if (justia.status === 'fetched' && justia.confidence > 0) {
                        addConsoleLog(\`   📖 Justia: \${justia.confidence}% confidence\`, 'success');
                        updateSubstep('justia', 'completed', justia.confidence);
                    } else if (justia.status === 'web_only') {
                        addConsoleLog('   📖 Justia: Web search only (no API)', 'info');
                        updateSubstep('justia', 'web_only', 0);
                    } else {
                        addConsoleLog(\`   📖 Justia: \${justia.status || 'unavailable'}\`, 'info');
                        updateSubstep('justia', 'pending', 0);
                    }
                } else {
                    addConsoleLog('   📖 Justia: Not available', 'info');
                    updateSubstep('justia', 'pending', 0);
                }`;

async function fixConsoleFiles() {
  console.log('🔧 Updating console files with API status messages...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      if (content.includes(OLD_UPDATESUBSTEP)) {
        content = content.replace(OLD_UPDATESUBSTEP, NEW_UPDATESUBSTEP);
        modified = true;
      }
      
      if (content.includes(OLD_HARVARD)) {
        content = content.replace(OLD_HARVARD, NEW_HARVARD);
        modified = true;
      }
      
      if (content.includes(OLD_JUSTIA)) {
        content = content.replace(OLD_JUSTIA, NEW_JUSTIA);
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
