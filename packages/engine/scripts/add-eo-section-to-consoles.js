#!/usr/bin/env node
/**
 * Add Executive Order section to all regulation console HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const consolesDir = path.join(__dirname, '../src/client/public/regulations');

// HTML section to add after deadlines
const eoSectionHTML = `
                                <!-- SECTION 6.5: Executive Orders Affecting This Regulation -->
                                <div id="eo-section" style="margin-bottom: 24px; background: #fef3c7; border-radius: 12px; border: 1px solid #f59e0b; overflow: hidden; display: none;">
                                    <div onclick="toggleEOSection()" style="padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #b45309 0%, #d97706 100%); color: white;">
                                        <h4 style="margin: 0; font-size: 14px; color: white;">⚠️ Executive Orders Affecting This Regulation (<span id="data-eo-count">0</span>)</h4>
                                        <span id="eo-toggle" style="font-size: 12px; color: white;">▼ Expand</span>
                                    </div>
                                    <div id="data-eo-expanded" style="display: none; padding: 16px; max-height: 400px; overflow-y: auto; background: #fffbeb;">
                                        <div id="data-eo-list" style="font-size: 13px; color: #1e293b;"></div>
                                    </div>
                                </div>
                    `;

// JavaScript to add
const eoToggleJS = `
        function toggleEOSection() {
            const expanded = document.getElementById('data-eo-expanded');
            const toggle = document.getElementById('eo-toggle');
            if (expanded.style.display === 'none') {
                expanded.style.display = 'block';
                toggle.textContent = '▲ Collapse';
            } else {
                expanded.style.display = 'none';
                toggle.textContent = '▼ Expand';
            }
        }
        
        // Load Executive Orders affecting this regulation
        async function loadExecutiveOrders() {
            const regKey = REG_KEY;
            if (!regKey) return;
            
            try {
                const response = await fetch(\`http://localhost:3010/api/regulations/\${regKey}/executive-orders\`);
                if (!response.ok) return;
                
                const data = await response.json();
                
                if (data.count > 0) {
                    document.getElementById('eo-section').style.display = 'block';
                    document.getElementById('data-eo-count').textContent = data.count;
                    
                    const listEl = document.getElementById('data-eo-list');
                    listEl.innerHTML = data.executiveOrders.map(eo => {
                        const severityColors = {
                            high: '#dc2626',
                            medium: '#f59e0b', 
                            low: '#10b981'
                        };
                        const severityColor = severityColors[eo.impactSeverity] || '#6b7280';
                        const signedDate = new Date(eo.signedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                        
                        return \`
                            <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid \${severityColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                    <div>
                                        <div style="font-weight: 600; color: #1e293b; font-size: 14px;">\${eo.eoNumber}</div>
                                        <div style="color: #475569; font-size: 13px; margin-top: 2px;">\${eo.title}</div>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <span style="background: \${severityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                                            \${eo.impactSeverity} Impact
                                        </span>
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                                    Signed: \${signedDate} | Type: <strong>\${eo.impactType}</strong>
                                </div>
                                \${eo.impactSummary ? \`<div style="font-size: 12px; color: #334155; background: #f8fafc; padding: 8px; border-radius: 4px;">\${eo.impactSummary}</div>\` : ''}
                                \${eo.fullTextUrl ? \`<a href="\${eo.fullTextUrl}" target="_blank" style="display: inline-block; margin-top: 8px; font-size: 11px; color: #2563eb; text-decoration: none;">📄 View Full Text →</a>\` : ''}
                            </div>
                        \`;
                    }).join('');
                    
                    addConsoleLog(\`⚠️ Found \${data.count} Executive Order(s) affecting this regulation\`, 'warning');
                }
            } catch (error) {
                console.error('Error loading Executive Orders:', error);
            }
        }
        `;

async function main() {
  const files = fs.readdirSync(consolesDir).filter(f => f.endsWith('-console.html'));
  console.log(`Found ${files.length} console files`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of files) {
    const filePath = path.join(consolesDir, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Skip if already has EO section
      if (content.includes('eo-section') || content.includes('toggleEOSection')) {
        skipped++;
        continue;
      }
      
      // Add HTML section after deadlines section
      const deadlinesMarker = '<!-- SECTION 7: Full Regulation Text';
      if (content.includes(deadlinesMarker)) {
        content = content.replace(
          deadlinesMarker,
          eoSectionHTML + '\n' + deadlinesMarker
        );
      }
      
      // Add JavaScript functions after toggleDeadlinesSection
      const jsMarker = '// TAB 1: Load Complete Data';
      if (content.includes(jsMarker)) {
        content = content.replace(
          jsMarker,
          eoToggleJS + '\n        ' + jsMarker
        );
      }
      
      // Add loadExecutiveOrders() call in DOMContentLoaded
      const loadMarker = '// Initialize WebSocket for real-time updates';
      if (content.includes(loadMarker) && !content.includes('loadExecutiveOrders()')) {
        content = content.replace(
          loadMarker,
          '// Load Executive Orders affecting this regulation\n            loadExecutiveOrders();\n            \n            ' + loadMarker
        );
      }
      
      fs.writeFileSync(filePath, content);
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`  Progress: ${updated}/${files.length}`);
      }
      
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
      errors++;
    }
  }
  
  console.log('');
  console.log('═'.repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped} (already have EO section)`);
  console.log(`❌ Errors: ${errors}`);
}

main();
