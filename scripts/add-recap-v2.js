#!/usr/bin/env node
/**
 * Add RECAP sub-bullet to law library section in console HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// The RECAP HTML substep to add after CourtListener
const RECAP_SUBSTEP = `
                        <div class="substep" id="substep-recap" style="display: flex; align-items: center; gap: 10px;">
                            <span class="substep-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;"></span>
                            <span class="substep-name" style="flex: 1;">RECAP Archive</span>
                            <span class="substep-confidence" id="conf-recap" style="color: #22c55e; font-weight: 500;"></span>
                        </div>`;

// Pattern to find the end of CourtListener substep
const COURTLISTENER_END_PATTERN = /<\/div>\s*<div class="substep" id="substep-cornell"/;

async function addRecap() {
  console.log('🔧 Adding RECAP sub-bullet after CourtListener...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  let updatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if RECAP already exists
    if (content.includes('id="substep-recap"')) {
      continue;
    }
    
    // Add RECAP after CourtListener, before Cornell
    if (content.includes('id="substep-courtlistener"') && content.includes('id="substep-cornell"')) {
      const newContent = content.replace(
        /(<div class="substep" id="substep-courtlistener"[^>]*>[\s\S]*?<\/div>)(\s*<div class="substep" id="substep-cornell")/,
        `$1${RECAP_SUBSTEP}$2`
      );
      
      if (newContent !== content) {
        // Also add the JS handler for RECAP
        const jsPattern = /updateSubstep\('courtlistener',\s*lawLibraryData\.courtListener\.status,\s*lawLibraryData\.courtListener\.confidence\s*\|\|\s*0\);/;
        const jsReplacement = `updateSubstep('courtlistener', lawLibraryData.courtListener.status, lawLibraryData.courtListener.confidence || 0);
              if (lawLibraryData?.recap) {
                updateSubstep('recap', lawLibraryData.recap.status, lawLibraryData.recap.confidence || 0);
              }`;
        
        const finalContent = newContent.replace(jsPattern, jsReplacement);
        fs.writeFileSync(filePath, finalContent);
        console.log(`✅ Updated: ${file}`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: Updated ${updatedCount} files with RECAP`);
  console.log(`${'═'.repeat(60)}\n`);
}

addRecap().catch(console.error);
