#!/usr/bin/env node
/**
 * Fix broken updateSubstep calls that were incorrectly inserted
 * The regex replacements broke the JavaScript structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

async function fixConsoleFiles() {
  console.log('🔧 Fixing broken updateSubstep calls in console files...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix Harvard - broken pattern
      if (content.includes("addConsoleLog(`   📚 Harvard Caselaw Access Project: ${harvard.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('harvard', 'completed', harvard.confidence);")) {
        content = content.replace(
          "addConsoleLog(`   📚 Harvard Caselaw Access Project: ${harvard.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('harvard', 'completed', harvard.confidence);",
          "addConsoleLog(`   📚 Harvard Caselaw Access Project: ${harvard.confidence}% confidence (REAL API)`, 'success');\n                        updateSubstep('harvard', 'completed', harvard.confidence);"
        );
        modified = true;
      }
      
      // Fix Harvard running - broken pattern  
      if (content.includes("addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');\n                updateSubstep('harvard', 'running', 0);")) {
        content = content.replace(
          "addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');\n                updateSubstep('harvard', 'running', 0);",
          "addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');\n                    updateSubstep('harvard', 'running', 0);"
        );
        modified = true;
      }
      
      // Fix CourtListener - broken pattern
      if (content.includes("addConsoleLog(`   🏛️ CourtListener (Free Law Project): ${cl.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('courtlistener', 'completed', cl.confidence);")) {
        content = content.replace(
          "addConsoleLog(`   🏛️ CourtListener (Free Law Project): ${cl.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('courtlistener', 'completed', cl.confidence);",
          "addConsoleLog(`   🏛️ CourtListener (Free Law Project): ${cl.confidence}% confidence (REAL API)`, 'success');\n                        updateSubstep('courtlistener', 'completed', cl.confidence);"
        );
        modified = true;
      }
      
      // Fix CourtListener running
      if (content.includes("addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');\n                updateSubstep('courtlistener', 'running', 0);")) {
        content = content.replace(
          "addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');\n                updateSubstep('courtlistener', 'running', 0);",
          "addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');\n                    updateSubstep('courtlistener', 'running', 0);"
        );
        modified = true;
      }
      
      // Fix Cornell - broken pattern
      if (content.includes("addConsoleLog(`   ⚖️ Cornell LII: ${cornellData.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('cornell', 'completed', cornellData.confidence);")) {
        content = content.replace(
          "addConsoleLog(`   ⚖️ Cornell LII: ${cornellData.confidence}% confidence (REAL API)`, 'success');\n                updateSubstep('cornell', 'completed', cornellData.confidence);",
          "addConsoleLog(`   ⚖️ Cornell LII: ${cornellData.confidence}% confidence (REAL API)`, 'success');\n                        updateSubstep('cornell', 'completed', cornellData.confidence);"
        );
        modified = true;
      }
      
      // Fix Cornell running
      if (content.includes("addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');\n                updateSubstep('cornell', 'running', 0);")) {
        content = content.replace(
          "addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');\n                updateSubstep('cornell', 'running', 0);",
          "addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');\n                    updateSubstep('cornell', 'running', 0);"
        );
        modified = true;
      }
      
      // Fix Justia - broken pattern
      if (content.includes("addConsoleLog(`   📖 Justia Legal: ${justia.confidence}% confidence (REAL)`, 'success');\n                updateSubstep('justia', 'completed', justia.confidence);")) {
        content = content.replace(
          "addConsoleLog(`   📖 Justia Legal: ${justia.confidence}% confidence (REAL)`, 'success');\n                updateSubstep('justia', 'completed', justia.confidence);",
          "addConsoleLog(`   📖 Justia Legal: ${justia.confidence}% confidence (REAL)`, 'success');\n                        updateSubstep('justia', 'completed', justia.confidence);"
        );
        modified = true;
      }
      
      // Fix Justia running
      if (content.includes("addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');\n                updateSubstep('justia', 'running', 0);")) {
        content = content.replace(
          "addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');\n                updateSubstep('justia', 'running', 0);",
          "addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');\n                    updateSubstep('justia', 'running', 0);"
        );
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
      } else {
        console.log(`⏭️ No fix needed: ${file}`);
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
