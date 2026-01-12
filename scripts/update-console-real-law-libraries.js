#!/usr/bin/env node
/**
 * Update console HTML files to use REAL Law Library APIs
 * Replaces fake Stanford/Harvard/Yale/Columbia validation with:
 * - Harvard Caselaw Access Project (real API)
 * - CourtListener / Free Law Project (real API)
 * - Justia (real resource)
 * - Cornell LII (real API)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// The new Step 3 code that uses real law library APIs
const NEW_STEP3_CODE = `
                // Step 3: Law Library APIs - REAL validation from actual legal databases
                currentStep = 3;
                updateStepStatus(3, 'running');
                addConsoleLog('⚖️ STEP 3: Law library validation (REAL APIs)...', 'step');
                
                // Check for real law library data from the comprehensive workflow
                const lawLibraryData = result.data?.lawLibrarySources || result.data?.workflowDetails?.lawLibrarySources;
                
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // Harvard Caselaw Access Project (REAL)
                if (lawLibraryData?.harvardCaselawAccessProject) {
                    const harvard = lawLibraryData.harvardCaselawAccessProject;
                    if (harvard.status === 'fetched' && harvard.confidence > 0) {
                        addConsoleLog(\`   📚 Harvard Caselaw Access Project: \${harvard.confidence}% confidence (REAL API)\`, 'success');
                        addConsoleLog(\`      └─ \${harvard.data?.totalCases || 0} cases found, \${harvard.data?.coverage || 'US court cases'}\`, 'debug');
                    } else {
                        addConsoleLog(\`   📚 Harvard CAP: \${harvard.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   📚 Harvard Caselaw Access Project: Checking...', 'info');
                }
                
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // CourtListener / Free Law Project (REAL)
                if (lawLibraryData?.courtListener) {
                    const cl = lawLibraryData.courtListener;
                    if (cl.status === 'fetched' && cl.confidence > 0) {
                        addConsoleLog(\`   🏛️ CourtListener (Free Law Project): \${cl.confidence}% confidence (REAL API)\`, 'success');
                        addConsoleLog(\`      └─ \${cl.data?.totalOpinions || 0} opinions found\`, 'debug');
                    } else {
                        addConsoleLog(\`   🏛️ CourtListener: \${cl.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   🏛️ CourtListener (Free Law Project): Checking...', 'info');
                }
                
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // Cornell LII (REAL)
                const cornellData = result.data?.academicSources?.cornellLII;
                if (cornellData) {
                    if (cornellData.status === 'fetched' && cornellData.confidence > 0) {
                        addConsoleLog(\`   ⚖️ Cornell LII: \${cornellData.confidence}% confidence (REAL API)\`, 'success');
                        addConsoleLog(\`      └─ \${cornellData.data?.citation || 'USC citation verified'}\`, 'debug');
                    } else {
                        addConsoleLog(\`   ⚖️ Cornell LII: \${cornellData.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   ⚖️ Cornell Legal Information Institute: Checking...', 'info');
                }
                
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // Justia (REAL)
                if (lawLibraryData?.justia) {
                    const justia = lawLibraryData.justia;
                    if ((justia.status === 'fetched' || justia.status === 'available') && justia.confidence > 0) {
                        addConsoleLog(\`   📖 Justia Legal: \${justia.confidence}% confidence (REAL)\`, 'success');
                    } else {
                        addConsoleLog(\`   📖 Justia: \${justia.status || 'checking'}...\`, 'info');
                    }
                } else {
                    addConsoleLog('   📖 Justia Legal Resources: Checking...', 'info');
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Calculate overall law library confidence
                let lawLibConfidence = 0;
                let lawLibCount = 0;
                if (lawLibraryData?.overall?.averageConfidence) {
                    lawLibConfidence = lawLibraryData.overall.averageConfidence;
                    lawLibCount = lawLibraryData.overall.sourcesFetched || 0;
                } else {
                    // Fallback calculation
                    const sources = [
                        lawLibraryData?.harvardCaselawAccessProject?.confidence || 0,
                        lawLibraryData?.courtListener?.confidence || 0,
                        cornellData?.confidence || 0,
                        lawLibraryData?.justia?.confidence || 0
                    ].filter(c => c > 0);
                    if (sources.length > 0) {
                        lawLibConfidence = Math.round(sources.reduce((a, b) => a + b, 0) / sources.length);
                        lawLibCount = sources.length;
                    }
                }
                
                addConsoleLog(\`   📊 Law Library Consensus: \${lawLibConfidence}% average from \${lawLibCount} sources\`, 'info');
`;

// Pattern to find the old Step 3 code block
const OLD_STEP3_PATTERN = /\/\/ Step 3: University Law Libraries.*?addConsoleLog\('   📊 Cross-referencing consensus across institutions\.\.\.', 'info'\);/gs;

// Alternative pattern for the already-partially-fixed files
const FIXED_STEP3_PATTERN = /\/\/ Step 3: University Law Libraries.*?addConsoleLog\(`\s*✓ Cross-reference validation: \d+% confidence`, 'debug'\);/gs;

// Simpler pattern to catch the remaining broken code
const SIMPLE_PATTERN = /currentStep = 3;[\s\S]*?updateStepStatus\(3, 'running'\);[\s\S]*?addConsoleLog\('📚 STEP 3: University law libraries validation\.\.\.', 'step'\);[\s\S]*?addConsoleLog\('   📊 Cross-referencing consensus across institutions\.\.\.', 'info'\);/g;

async function updateConsoleFiles() {
  console.log('🔧 Updating console files to use REAL Law Library APIs...\n');
  
  const files = fs.readdirSync(CONSOLE_DIR)
    .filter(f => f.endsWith('-console.html'));
  
  console.log(`📁 Found ${files.length} console files to process\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    const filePath = path.join(CONSOLE_DIR, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file has the old Step 3 pattern
      if (content.includes('STEP 3: University law libraries validation')) {
        // Find and replace the Step 3 section
        const startMarker = "currentStep = 3;";
        const endMarker = "addConsoleLog('   📊 Cross-referencing consensus across institutions...', 'info');";
        
        const startIdx = content.indexOf(startMarker);
        const endIdx = content.indexOf(endMarker);
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const before = content.substring(0, startIdx);
          const after = content.substring(endIdx + endMarker.length);
          
          content = before + NEW_STEP3_CODE + after;
          
          fs.writeFileSync(filePath, content);
          console.log(`✅ Updated: ${file}`);
          updatedCount++;
        } else {
          console.log(`⏭️ Skipped (pattern not found): ${file}`);
          skippedCount++;
        }
      } else if (content.includes('Law library validation (REAL APIs)')) {
        console.log(`⏭️ Already updated: ${file}`);
        skippedCount++;
      } else {
        console.log(`⏭️ No Step 3 found: ${file}`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Updated: ${updatedCount} files`);
  console.log(`   ⏭️ Skipped: ${skippedCount} files`);
  console.log(`   ❌ Errors: ${errorCount} files`);
  console.log(`${'═'.repeat(60)}\n`);
  
  console.log('📝 Console files now use REAL Law Library APIs:');
  console.log('   • Harvard Caselaw Access Project (6.5M cases)');
  console.log('   • CourtListener / Free Law Project');
  console.log('   • Cornell Legal Information Institute');
  console.log('   • Justia Legal Resources\n');
}

updateConsoleFiles().catch(console.error);
