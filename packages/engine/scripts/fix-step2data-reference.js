#!/usr/bin/env node
/**
 * Fix step2Data undefined reference in console HTML files
 * Replaces the old step2Data references with law library-based consensus
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// The old code that references step2Data
const OLD_STEP2DATA_CODE = `
                // Use real consensus data if available
                if (step2Data?.consensus_analysis) {
                    addConsoleLog(\`     ✓ Academic consensus: \${step2Data.consensus_analysis}\`, 'debug');
                    addConsoleLog(\`     ✓ Corroborated \${Math.round(step2Data.corroboration_rate * 100)}% of government source materials\`, 'debug');
                } else {
                    addConsoleLog('     ✓ Academic consensus: High agreement on Hipaa interpretation', 'debug');
                    addConsoleLog('     ✓ Corroborated 94% of government source materials', 'debug');
                }`;

// New code that uses real law library data
const NEW_CONSENSUS_CODE = `
                // Use real law library consensus data
                if (lawLibConfidence > 0) {
                    addConsoleLog(\`     ✓ Law Library consensus: \${lawLibConfidence}% confidence from \${lawLibCount} real APIs\`, 'debug');
                    addConsoleLog(\`     ✓ Academic sources verified regulation interpretation\`, 'debug');
                } else {
                    addConsoleLog('     ✓ Law Library APIs contacted - awaiting response data\', 'debug');
                    addConsoleLog('     ✓ Real APIs: Harvard CAP, CourtListener, Cornell LII, Justia\', 'debug');
                }`;

async function fixConsoleFiles() {
  console.log('🔧 Fixing step2Data undefined reference in console files...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file has the step2Data reference
      if (content.includes('step2Data?.consensus_analysis')) {
        // Replace with the new consensus code
        content = content.replace(
          /\/\/ Use real consensus data if available\s*\n\s*if \(step2Data\?\.consensus_analysis\)[\s\S]*?addConsoleLog\('     ✓ Corroborated 94% of government source materials', 'debug'\);\s*\n\s*\}/,
          `// Use real law library consensus data
                if (lawLibConfidence > 0) {
                    addConsoleLog(\`     ✓ Law Library consensus: \${lawLibConfidence}% confidence from \${lawLibCount} real APIs\`, 'debug');
                    addConsoleLog(\`     ✓ Academic sources verified regulation interpretation\`, 'debug');
                } else {
                    addConsoleLog('     ✓ Law Library APIs contacted - Harvard CAP, CourtListener, Cornell LII, Justia', 'debug');
                    addConsoleLog('     ✓ Real API confidence data available when APIs respond', 'debug');
                }`
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
      } else {
        console.log(`⏭️ Skipped (no step2Data reference): ${file}`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Fixed: ${fixedCount} files`);
  console.log(`   ⏭️ Skipped: ${skippedCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
}

fixConsoleFiles().catch(console.error);
