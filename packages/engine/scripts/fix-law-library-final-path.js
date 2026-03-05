#!/usr/bin/env node
/**
 * Fix law library data path - use lawLibrarySources which is now included in API response
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Current path (from previous fix)
const OLD_PATH = `const lawLibraryData = result.data?.realApiResults?.legalResearch || result.data?.lawLibrarySources || result.data?.workflowDetails?.lawLibrarySources;`;

// Correct path - lawLibrarySources is now at root of data
const NEW_PATH = `const lawLibraryData = result.data?.lawLibrarySources || result.data?.realApiResults?.lawLibraries;`;

async function fixConsoleFiles() {
  console.log('🔧 Fixing law library data path to use lawLibrarySources...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      if (content.includes(OLD_PATH)) {
        content = content.replace(OLD_PATH, NEW_PATH);
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
