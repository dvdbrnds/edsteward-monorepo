#!/usr/bin/env node
/**
 * Add Dashboard Home Button to All Console Pages
 * Adds a "← Dashboard" button to the toolbar on every regulation console page.
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, '..', 'src', 'client', 'public', 'regulations');

const CSS_MARKER = '.toolbar-primary {';
const CSS_TO_INSERT = `
        .btn-home {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 7px 12px;
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
        }
        .btn-home:hover {
            background: #e2e8f0;
            color: #1e293b;
            border-color: #cbd5e1;
        }
        .btn-home .icon {
            font-size: 14px;
        }

`;

const HTML_MARKER = '<div class="toolbar-primary">';
const HTML_TO_INSERT = `<div class="toolbar-primary">
                    <a href="/" class="btn-home" title="Back to Dashboard">
                        <span class="icon">\u2190</span>
                        <span>Dashboard</span>
                    </a>`;

const files = fs.readdirSync(REGULATIONS_DIR).filter(f => f.endsWith('-console.html'));
console.log(`Found ${files.length} console files`);

let updated = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
  const filePath = path.join(REGULATIONS_DIR, file);
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if already has home button
    if (content.includes('btn-home')) {
      skipped++;
      continue;
    }
    
    // Add CSS before .toolbar-primary
    if (content.includes(CSS_MARKER)) {
      content = content.replace(CSS_MARKER, CSS_TO_INSERT + '        ' + CSS_MARKER);
    }
    
    // Add HTML button inside toolbar-primary
    if (content.includes(HTML_MARKER)) {
      content = content.replace(HTML_MARKER, HTML_TO_INSERT);
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    updated++;
  } catch (err) {
    console.error(`  ERROR: ${file}: ${err.message}`);
    errors++;
  }
}

console.log(`\nResults:`);
console.log(`  Updated: ${updated}`);
console.log(`  Skipped (already had button): ${skipped}`);
console.log(`  Errors: ${errors}`);
console.log(`  Total: ${files.length}`);
