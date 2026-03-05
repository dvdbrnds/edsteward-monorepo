#!/usr/bin/env node
/**
 * Fix RECAP JavaScript handler in console files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

async function fixRecapJS() {
  console.log('🔧 Adding RECAP JavaScript handler...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  let updatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only fix if RECAP HTML exists but JS handler doesn't
    if (content.includes('id="substep-recap"') && !content.includes("updateSubstep('recap'")) {
      // Find the courtListener update and add recap after it
      const pattern = /(updateSubstep\('courtlistener',\s*lawLibraryData\.courtListener\.status,\s*lawLibraryData\.courtListener\.confidence\s*\|\|\s*0\);)/g;
      const replacement = `$1
              if (lawLibraryData?.recap) {
                updateSubstep('recap', lawLibraryData.recap.status, lawLibraryData.recap.confidence || 0);
              }`;
      
      const newContent = content.replace(pattern, replacement);
      
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed: ${file}`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: Fixed ${updatedCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

fixRecapJS().catch(console.error);
