#!/usr/bin/env node
/**
 * Fix law library data path in console files
 * The API returns law library data at result.data.realApiResults.legalResearch
 * but the console is looking for it at result.data.lawLibrarySources
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// Old path
const OLD_PATH = `const lawLibraryData = result.data?.lawLibrarySources || result.data?.workflowDetails?.lawLibrarySources;`;

// New path that matches the actual API response structure
const NEW_PATH = `const lawLibraryData = result.data?.realApiResults?.legalResearch || result.data?.lawLibrarySources || result.data?.workflowDetails?.lawLibrarySources;`;

// Also need to fix the property names - API uses different keys
// API returns: harvardCaselawAccessProject, courtListener, justia
// But also cornellLII is in academicSources, not legalResearchSources

async function fixConsoleFiles() {
  console.log('🔧 Fixing law library data paths in console files...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix the data path
      if (content.includes(OLD_PATH)) {
        content = content.replace(OLD_PATH, NEW_PATH);
        modified = true;
      }
      
      // Also add Cornell from academicSources if needed
      const cornellOld = `const cornellData = result.data?.academicSources?.cornellLII;`;
      const cornellNew = `const cornellData = result.data?.realApiResults?.academic?.cornellLII || result.data?.academicSources?.cornellLII;`;
      
      if (content.includes(cornellOld)) {
        content = content.replace(cornellOld, cornellNew);
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
