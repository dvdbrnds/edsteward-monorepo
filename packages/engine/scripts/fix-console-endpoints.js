#!/usr/bin/env node
/**
 * Fix console files - replace hardcoded TEACH Act references with dynamic regulation references
 */

import fs from 'fs';
import path from 'path';

const CONSOLE_DIR = 'src/client/public/regulations';

const files = fs.readdirSync(CONSOLE_DIR)
  .filter(f => f.endsWith('-console.html') && !f.includes('teach'));

let fixedCount = 0;

for (const file of files) {
  const filePath = path.join(CONSOLE_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extract regulation slug from filename
  const slug = file.replace('-console.html', '');
  
  // Check if it has TEACH references
  if (content.includes('teach-act') || content.includes('teach_act')) {
    // Replace API endpoints
    content = content.replace(/\/api\/v1\/regulations\/teach-act/g, `/api/v1/regulations/${slug}`);
    content = content.replace(/teach_act_\[customer_id\]/g, `${slug.replace(/-/g, '_')}_[customer_id]`);
    content = content.replace(/\/cfr\/enhanced\/teach-act/g, `/cfr/enhanced/${slug}`);
    
    // Replace metrics labels
    content = content.replace(/TEACH refs/g, 'Regulation refs');
    content = content.replace(/teachReferences/g, 'regulationReferences');
    content = content.replace(/Copyright terms/g, 'Compliance terms');
    content = content.replace(/copyrightTerms/g, 'complianceTerms');
    
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
  }
}

console.log(`✅ Fixed ${fixedCount} console files`);
