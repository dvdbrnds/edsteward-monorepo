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

const RECAP_JS_BLOCK = `
                // RECAP Archive (FREE PACER via CourtListener)
                if (lawLibraryData?.recap) {
                    const recap = lawLibraryData.recap;
                    if (recap.status === 'fetched' && recap.confidence > 0) {
                        addConsoleLog(\`   📄 RECAP Archive: \${recap.confidence}% confidence (FREE PACER)\`, 'success');
                        updateSubstep('recap', 'completed', recap.confidence);
                        addConsoleLog(\`      └─ \${recap.data?.totalDocuments || 0} PACER documents found\`, 'debug');
                    } else {
                        addConsoleLog(\`   📄 RECAP Archive: \${recap.status || 'checking'}...\`, 'info');
                        updateSubstep('recap', 'running', 0);
                    }
                } else {
                    addConsoleLog('   📄 RECAP Archive: Checking...', 'info');
                    updateSubstep('recap', 'running', 0);
                }
`;

async function fixRecapJS() {
  console.log('🔧 Adding RECAP JavaScript handler...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  let updatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only fix if RECAP HTML exists but JS handler doesn't
    if (content.includes('id="substep-recap"') && !content.includes("lawLibraryData?.recap")) {
      // Find the end of CourtListener block and add RECAP after
      const pattern = /(\/\/ CourtListener \/ Free Law Project \(REAL\)[\s\S]*?updateSubstep\('courtlistener', 'running', 0\);\s*\}\s*\n\s*await new Promise\(resolve => setTimeout\(resolve, 400\)\);)/;
      
      const match = content.match(pattern);
      if (match) {
        const replacement = match[0] + RECAP_JS_BLOCK;
        const newContent = content.replace(pattern, replacement);
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
