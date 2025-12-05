#!/usr/bin/env node
/**
 * Remove ALL fake validation sources from console HTML files
 * 
 * These sources don't have public APIs and should NOT be displayed:
 * - Stanford Law Library
 * - Harvard Law Library  
 * - Yale Law Library
 * - Columbia Law Library
 * - Westlaw
 * - HeinOnline
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

function removeFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalLength = content.length;
    
    // Remove entire source-item divs containing fake sources
    const fakeSourcePatterns = [
      // Remove div blocks for fake university libraries
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>Stanford Law Library<\/span>[\s\S]*?<\/div>/gi,
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>Harvard Law Library<\/span>[\s\S]*?<\/div>/gi,
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>Yale Law Library<\/span>[\s\S]*?<\/div>/gi,
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>Columbia Law Library<\/span>[\s\S]*?<\/div>/gi,
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>Westlaw<\/span>[\s\S]*?<\/div>/gi,
      /<div class="source-item[^"]*">\s*<span[^>]*>[^<]*<\/span>\s*<span>HeinOnline<\/span>[\s\S]*?<\/div>/gi,
      
      // Remove simpler patterns
      /<span>Stanford Law Library<\/span>/gi,
      /<span>Harvard Law Library<\/span>/gi,
      /<span>Yale Law Library<\/span>/gi,
      /<span>Columbia Law Library<\/span>/gi,
      
      // Remove JavaScript console log lines mentioning fake sources
      /addConsoleLog\([^)]*Stanford Law Library[^)]*\);?\n?/gi,
      /addConsoleLog\([^)]*Harvard Law Library[^)]*\);?\n?/gi,
      /addConsoleLog\([^)]*Yale Law School[^)]*\);?\n?/gi,
      /addConsoleLog\([^)]*Columbia Law Library[^)]*\);?\n?/gi,
      
      // Remove confidence variable assignments for fake sources  
      /const stanfordConfidence[^;]*;\n?/gi,
      /const harvardConfidence[^;]*;\n?/gi,
      /const yaleConfidence[^;]*;\n?/gi,
      /const columbiaConfidence[^;]*;\n?/gi,
      
      // Remove universityResults references
      /universityResults\['Stanford Law Library'\][^;]*;?\n?/gi,
      /universityResults\['Harvard Law Library'\][^;]*;?\n?/gi,
      /universityResults\['Yale Law Library'\][^;]*;?\n?/gi,
      /universityResults\['Columbia Law Library'\][^;]*;?\n?/gi,
      
      // Remove comments about university sources
      /\/\/\s*Stanford Law Library.*\n/gi,
      /\/\/\s*Harvard Law Library.*\n/gi,
      /\/\/\s*Yale Law Library.*\n/gi,
      /\/\/\s*Columbia Law Library.*\n/gi,
      
      // Remove UI update calls for fake sources
      /updateSourceConfidence\([^)]*stanford[^)]*\);?\n?/gi,
      /updateSourceConfidence\([^)]*harvard[^)]*\);?\n?/gi,
      /updateSourceConfidence\([^)]*yale[^)]*\);?\n?/gi,
      /updateSourceConfidence\([^)]*columbia[^)]*\);?\n?/gi,
    ];
    
    for (const pattern of fakeSourcePatterns) {
      content = content.replace(pattern, '');
    }
    
    // Clean up any double newlines left behind
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content);
      filesUpdated++;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ Error updating ${filePath}: ${error.message}`);
    return false;
  }
}

console.log('═'.repeat(60));
console.log('  REMOVING ALL FAKE VALIDATION SOURCES');
console.log('═'.repeat(60));
console.log('');
console.log('Sources being removed (no public APIs available):');
console.log('  ❌ Stanford Law Library');
console.log('  ❌ Harvard Law Library');
console.log('  ❌ Yale Law Library');
console.log('  ❌ Columbia Law Library');
console.log('  ❌ Westlaw');
console.log('  ❌ HeinOnline');
console.log('');

for (const dir of CONSOLE_DIRS) {
  if (!fs.existsSync(dir)) {
    console.log(`⏭️  Skipping ${dir} (not found)`);
    continue;
  }
  
  console.log(`📁 Processing ${dir}...`);
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-console.html'));
  totalFiles += files.length;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (removeFromFile(filePath)) {
      console.log(`   ✓ Cleaned: ${file}`);
    }
  }
}

console.log('');
console.log('═'.repeat(60));
console.log(`✅ Processed ${totalFiles} files`);
console.log(`📝 Updated ${filesUpdated} files`);
console.log('');
console.log('REAL sources that remain:');
console.log('  ✅ Federal Register (federalregister.gov)');
console.log('  ✅ Library of Congress (loc.gov)');
console.log('  ✅ Cornell LII (law.cornell.edu)');
console.log('  ✅ OpenAlex (openalex.org)');
console.log('  ✅ Semantic Scholar (semanticscholar.org)');
console.log('═'.repeat(60));

