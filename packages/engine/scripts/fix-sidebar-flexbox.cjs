/**
 * Fix sidebar layout in all console HTML files using flexbox
 * Ensures the right panel (sidebar) is always visible
 */

const fs = require('fs');
const path = require('path');

// Match the broken grid-based CSS (both old and the responsive version)
const PATTERNS_TO_REPLACE = [
  // Pattern 1: The responsive version I just added
  {
    pattern: /\.console-container \{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr 320px;[^}]*min-width:\s*900px;[^}]*\}[\s\S]*?\.main-console \{[^}]*min-width:\s*0;[^}]*\}[\s\S]*?\.sidebar \{[^}]*min-width:\s*320px;[^}]*flex-shrink:\s*0;[^}]*\}[\s\S]*?@media \(max-width:\s*900px\) \{[^}]*\.console-container \{[^}]*\}[^}]*\.sidebar \{[^}]*\}[^}]*\}/,
    name: 'responsive-grid'
  },
  // Pattern 2: Original grid CSS
  {
    pattern: /\.console-container \{\s*display:\s*grid;\s*grid-template-columns:\s*1fr 320px;\s*height:\s*100vh;\s*gap:\s*0;\s*background:\s*#f5f6f8;\s*\}\s*\.main-console \{\s*background:\s*#ffffff;\s*padding:\s*24px;\s*overflow-y:\s*auto;\s*border-right:\s*1px solid #e1e5e9;\s*box-shadow:\s*2px 0 8px rgba\(0, 0, 0, 0\.04\);\s*\}\s*\.sidebar \{\s*background:\s*#f8f9fb;\s*padding:\s*20px;\s*border-left:\s*1px solid #e1e5e9;\s*overflow-y:\s*auto;\s*\}/,
    name: 'original-grid'
  }
];

const NEW_CSS = `.console-container {
            display: flex;
            flex-direction: row;
            height: 100vh;
            background: #f5f6f8;
        }
        
        .main-console {
            flex: 1;
            background: #ffffff;
            padding: 24px;
            overflow-y: auto;
            border-right: 1px solid #e1e5e9;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
            min-width: 400px;
        }
        
        .sidebar {
            width: 320px;
            min-width: 320px;
            flex-shrink: 0;
            background: #f8f9fb;
            padding: 20px;
            border-left: 1px solid #e1e5e9;
            overflow-y: auto;
        }`;

// Find all console HTML files
const dirs = [
  path.join(__dirname, '../public/regulations'),
  path.join(__dirname, '../dist/public/regulations'),
  path.join(__dirname, '../src/client/public/regulations'),
  path.join(__dirname, '../src/client/dist/public/regulations')
];

let fixedCount = 0;
let alreadyFixedCount = 0;
let errorCount = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    continue;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-console.html'));
  console.log(`Processing ${files.length} files in ${dir}`);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already using flexbox
    if (content.includes('display: flex;') && content.includes('flex-direction: row;') && content.includes('.console-container')) {
      alreadyFixedCount++;
      continue;
    }
    
    // Simple string replacement approach - find the CSS block and replace it
    const oldCssGrid = `.console-container {
            display: grid;
            grid-template-columns: 1fr 320px;
            min-width: 900px;
            height: 100vh;
            gap: 0;
            background: #f5f6f8;
        }
        
        .main-console {
            background: #ffffff;
            padding: 24px;
            overflow-y: auto;
            border-right: 1px solid #e1e5e9;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
            min-width: 0;
        }
        
        .sidebar {
            background: #f8f9fb;
            padding: 20px;
            border-left: 1px solid #e1e5e9;
            overflow-y: auto;
            width: 320px;
            min-width: 320px;
            flex-shrink: 0;
        }
        
        /* Responsive: Stack on small screens */
        @media (max-width: 900px) {
            .console-container {
                grid-template-columns: 1fr;
                min-width: auto;
            }
            .sidebar {
                width: 100%;
                min-width: auto;
                border-left: none;
                border-top: 1px solid #e1e5e9;
            }
        }`;
    
    if (content.includes(oldCssGrid)) {
      content = content.replace(oldCssGrid, NEW_CSS);
      fs.writeFileSync(filePath, content);
      fixedCount++;
      continue;
    }
    
    // Try original grid CSS
    const originalGridCss = `.console-container {
            display: grid;
            grid-template-columns: 1fr 320px;
            height: 100vh;
            gap: 0;
            background: #f5f6f8;
        }
        
        .main-console {
            background: #ffffff;
            padding: 24px;
            overflow-y: auto;
            border-right: 1px solid #e1e5e9;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
        }
        
        .sidebar {
            background: #f8f9fb;
            padding: 20px;
            border-left: 1px solid #e1e5e9;
            overflow-y: auto;
        }`;
    
    if (content.includes(originalGridCss)) {
      content = content.replace(originalGridCss, NEW_CSS);
      fs.writeFileSync(filePath, content);
      fixedCount++;
      continue;
    }
    
    // If neither pattern matched, log it
    if (content.includes('display: grid') && content.includes('.console-container')) {
      console.log(`⚠️  Could not fix (different CSS pattern): ${file}`);
      errorCount++;
    } else {
      console.log(`⚠️  No grid CSS found in: ${file}`);
      errorCount++;
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files with flexbox layout`);
console.log(`⏭️  Already fixed: ${alreadyFixedCount} files`);
if (errorCount > 0) {
  console.log(`⚠️  Could not process: ${errorCount} files`);
}
