/**
 * Fix sidebar CSS in all console HTML files
 * Ensures the right panel (sidebar) is always visible
 */

const fs = require('fs');
const path = require('path');

const OLD_CSS = `.console-container {
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

const NEW_CSS = `.console-container {
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

// Find all console HTML files
const dirs = [
  path.join(__dirname, '../public/regulations'),
  path.join(__dirname, '../dist/public/regulations'),
  path.join(__dirname, '../src/client/public/regulations'),
  path.join(__dirname, '../src/client/dist/public/regulations')
];

let fixedCount = 0;
let skippedCount = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-console.html'));
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(OLD_CSS)) {
      content = content.replace(OLD_CSS, NEW_CSS);
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`✅ Fixed: ${file}`);
    } else if (content.includes('min-width: 320px')) {
      skippedCount++;
      // Already fixed
    } else {
      skippedCount++;
      console.log(`⚠️  Skipped (different CSS): ${file}`);
    }
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log(`⏭️  Skipped ${skippedCount} files (already fixed or different CSS)`);
