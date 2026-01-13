#!/usr/bin/env node
/**
 * Add RECAP to the law library sub-bullets in console HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Pattern to find the existing CourtListener substep and add RECAP after it
const COURTLISTENER_SUBSTEP_PATTERN = /<div class="substep" id="substep-courtlistener"[^>]*>[\s\S]*?<\/div>/;

const RECAP_SUBSTEP = `<div class="substep" id="substep-courtlistener"><span class="substep-icon"></span><span class="substep-text">CourtListener</span></div>
              <div class="substep" id="substep-recap"><span class="substep-icon"></span><span class="substep-text">RECAP Archive</span></div>`;

// Pattern to find the law library data processing and add RECAP handling
const LAW_LIBRARY_JS_PATTERN = /if \(lawLibraryData\?\.courtListener\) \{[\s\S]*?updateSubstep\('courtlistener'[\s\S]*?\}/;

const LAW_LIBRARY_JS_WITH_RECAP = `if (lawLibraryData?.courtListener) {
                updateSubstep('courtlistener', lawLibraryData.courtListener.status, lawLibraryData.courtListener.confidence || 0);
              }
              if (lawLibraryData?.recap) {
                updateSubstep('recap', lawLibraryData.recap.status, lawLibraryData.recap.confidence || 0);
              }`;

async function addRecapSubbullet() {
  console.log('🔧 Adding RECAP to console sub-bullets...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let updatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Add RECAP HTML substep if CourtListener exists but RECAP doesn't
    if (content.includes('id="substep-courtlistener"') && !content.includes('id="substep-recap"')) {
      content = content.replace(
        /<div class="substep" id="substep-courtlistener"[^>]*><span class="substep-icon"><\/span><span class="substep-text">CourtListener<\/span><\/div>/g,
        RECAP_SUBSTEP
      );
      modified = true;
    }
    
    // Add RECAP JavaScript handling if not present
    if (content.includes("updateSubstep('courtlistener'") && !content.includes("updateSubstep('recap'")) {
      content = content.replace(
        /if \(lawLibraryData\?\.courtListener\) \{\s*updateSubstep\('courtlistener', lawLibraryData\.courtListener\.status, lawLibraryData\.courtListener\.confidence \|\| 0\);\s*\}/g,
        LAW_LIBRARY_JS_WITH_RECAP
      );
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${file}`);
      updatedCount++;
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: Updated ${updatedCount} files with RECAP sub-bullet`);
  console.log(`${'═'.repeat(60)}\n`);
}

addRecapSubbullet().catch(console.error);
