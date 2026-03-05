#!/usr/bin/env node
/**
 * Deep Clean - Remove ALL university library fake validation code from console HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONSOLE_DIRS = [
  path.join(__dirname, '../src/client/public/regulations'),
  path.join(__dirname, '../dist/public/regulations'),
  path.join(__dirname, '../public/regulations')
];

let filesUpdated = 0;
let totalFiles = 0;

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalLength = content.length;
    
    // Remove entire university substep update blocks
    content = content.replace(/updateUniversitySubstep\s*\(\s*['"]stanford['"][^)]*\);\s*/gi, '');
    content = content.replace(/updateUniversitySubstep\s*\(\s*['"]harvard['"][^)]*\);\s*/gi, '');
    content = content.replace(/updateUniversitySubstep\s*\(\s*['"]yale['"][^)]*\);\s*/gi, '');
    content = content.replace(/updateUniversitySubstep\s*\(\s*['"]columbia['"][^)]*\);\s*/gi, '');
    
    // Remove console log lines about university analysis
    content = content.replace(/addConsoleLog\s*\([^)]*Stanford[^)]*\);\s*/gi, '');
    content = content.replace(/addConsoleLog\s*\([^)]*Harvard[^)]*\);\s*/gi, '');
    content = content.replace(/addConsoleLog\s*\([^)]*Yale[^)]*\);\s*/gi, '');
    content = content.replace(/addConsoleLog\s*\([^)]*Columbia[^)]*\);\s*/gi, '');
    
    // Remove university confidence variable checks
    content = content.replace(/if\s*\(\s*stanfordConfidence\s*\)\s*\{[^}]*\}\s*else\s*\{[^}]*\}/gis, '');
    content = content.replace(/if\s*\(\s*harvardConfidence\s*\)\s*\{[^}]*\}\s*else\s*\{[^}]*\}/gis, '');
    content = content.replace(/if\s*\(\s*yaleConfidence\s*\)\s*\{[^}]*\}\s*else\s*\{[^}]*\}/gis, '');
    content = content.replace(/if\s*\(\s*columbiaConfidence\s*\)\s*\{[^}]*\}\s*else\s*\{[^}]*\}/gis, '');
    
    // Remove university description assignments
    content = content.replace(/if\s*\(university\.university\.includes\s*\(\s*['"]Stanford['"]\s*\)\)\s*description\s*=\s*[^;]*;/gi, '');
    content = content.replace(/if\s*\(university\.university\.includes\s*\(\s*['"]Harvard['"]\s*\)\)\s*description\s*=\s*[^;]*;/gi, '');
    content = content.replace(/if\s*\(university\.university\.includes\s*\(\s*['"]Yale['"]\s*\)\)\s*description\s*=\s*[^;]*;/gi, '');
    content = content.replace(/if\s*\(university\.university\.includes\s*\(\s*['"]Columbia['"]\s*\)\)\s*description\s*=\s*[^;]*;/gi, '');
    
    // Remove variable declarations
    content = content.replace(/const\s+stanfordConfidence\s*=[^;]*;/gi, '');
    content = content.replace(/const\s+harvardConfidence\s*=[^;]*;/gi, '');
    content = content.replace(/const\s+yaleConfidence\s*=[^;]*;/gi, '');
    content = content.replace(/const\s+columbiaConfidence\s*=[^;]*;/gi, '');
    
    // Remove university results references
    content = content.replace(/const\s+universityResults\s*=[^;]*;/gi, '// University validation removed - no public APIs');
    content = content.replace(/const\s+universitySources\s*=[^;]*;/gi, '');
    
    // Remove div elements for university sources
    content = content.replace(/<div[^>]*class="[^"]*university[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove university library HTML sections
    content = content.replace(/<div[^>]*id="[^"]*stanford[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    content = content.replace(/<div[^>]*id="[^"]*harvard[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    content = content.replace(/<div[^>]*id="[^"]*yale[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    content = content.replace(/<div[^>]*id="[^"]*columbia[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove Westlaw/HeinOnline references
    content = content.replace(/Westlaw/gi, '');
    content = content.replace(/HeinOnline/gi, '');
    
    // Clean up excessive whitespace
    content = content.replace(/\n\s*\n\s*\n\s*\n/g, '\n\n');
    content = content.replace(/await new Promise\(resolve => setTimeout\(resolve, \d+\)\);\s*\n\s*\n/g, '');
    
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content);
      filesUpdated++;
      return true;
    }
    return false;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

console.log('═'.repeat(60));
console.log('  DEEP CLEAN - Removing ALL university fake code');
console.log('═'.repeat(60));
console.log('');

for (const dir of CONSOLE_DIRS) {
  if (!fs.existsSync(dir)) {
    console.log(`⏭️  Skipping ${dir} (not found)`);
    continue;
  }
  
  console.log(`📁 Processing ${dir}...`);
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-console.html'));
  totalFiles += files.length;
  
  let dirUpdated = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (cleanFile(filePath)) {
      dirUpdated++;
    }
  }
  console.log(`   Updated ${dirUpdated}/${files.length} files`);
}

console.log('');
console.log('═'.repeat(60));
console.log(`✅ Total: ${filesUpdated}/${totalFiles} files cleaned`);
console.log('═'.repeat(60));

