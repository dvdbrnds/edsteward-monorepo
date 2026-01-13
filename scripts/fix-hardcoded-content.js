#!/usr/bin/env node
/**
 * Fix hardcoded TEACH Act content in console files
 */

import fs from 'fs';
import path from 'path';

const CONSOLE_DIR = 'src/client/public/regulations';

// TEACH-specific content to replace with generic
const replacements = [
  // Training requirements
  ['New faculty copyright training before first online course', 'Initial compliance training for new staff'],
  ['Annual refresher training for all teaching staff', 'Annual refresher training for all relevant staff'],
  ['Student copyright awareness training at enrollment', 'Student awareness training at enrollment'],
  
  // Record keeping - make generic
  ['Store copyright permissions/licenses for 7 years', 'Store compliance documentation per retention policy'],
  ['copyright permissions/licenses', 'compliance documentation'],
  
  // Titles
  ['Copyright Enforcement Statistics', 'Compliance Statistics'],
  ['Copyright terms', 'Compliance terms'],
  ['copyrightTerms', 'complianceTerms'],
  
  // TEACH-specific terms
  ['distance education', 'educational programs'],
  ['online course', 'program requirements'],
  ['§ 110(2)', 'applicable sections'],
  ['section 110', 'applicable sections'],
];

const files = fs.readdirSync(CONSOLE_DIR)
  .filter(f => f.endsWith('-console.html') && !f.includes('teach'));

let fixedCount = 0;

for (const file of files) {
  const filePath = path.join(CONSOLE_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [find, replace] of replacements) {
    if (content.includes(find)) {
      content = content.split(find).join(replace);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
  }
}

console.log(`✅ Fixed hardcoded content in ${fixedCount} files`);
