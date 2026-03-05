#!/usr/bin/env node
/**
 * Remove Harvard CAP from console files - replaced by CourtListener
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

async function removeHarvardCap() {
  console.log('🔧 Removing Harvard CAP from console files (replaced by CourtListener)...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Remove Harvard CAP substep HTML
    const harvardSubstepPattern = /<div class="substep" id="substep-harvard"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="substep"|<\/div>)/g;
    if (content.match(harvardSubstepPattern)) {
      content = content.replace(harvardSubstepPattern, '');
      modified = true;
    }
    
    // Remove Harvard CAP JavaScript handling
    const harvardJsPattern = /\/\/ Harvard Caselaw Access Project[\s\S]*?(?=\/\/ CourtListener|\/\/ Cornell|\/\/ Justia)/g;
    if (content.match(harvardJsPattern)) {
      content = content.replace(harvardJsPattern, '');
      modified = true;
    }
    
    // Alternative patterns
    const altPatterns = [
      /if \(lawLibraryData\?\.harvardCaselawAccessProject\)[\s\S]*?}\s*(?=\/\/|if \(lawLibraryData)/g,
      /<div[^>]*id="substep-harvard"[^>]*>[\s\S]*?<\/div>/g
    ];
    
    for (const pattern of altPatterns) {
      if (content.match(pattern)) {
        content = content.replace(pattern, '');
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: Removed Harvard CAP from ${fixedCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

removeHarvardCap().catch(console.error);
