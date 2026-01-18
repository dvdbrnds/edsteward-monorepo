/**
 * Fix undefined variables in runInquisitorAudit function
 */
import fs from 'fs';
import path from 'path';

const regulationsDir = './src/client/public/regulations';
const files = fs.readdirSync(regulationsDir).filter(f => f.endsWith('-console.html'));

console.log(`Fixing ${files.length} console files...`);

let fixed = 0;
for (const file of files) {
  const filePath = path.join(regulationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if file has the buggy code
  if (content.includes('progress.style.display') && !content.includes("const progress = document.getElementById('inquisitorProgress')")) {
    
    // Fix: Add variable declarations at the start of the function
    const oldCode = `async function runInquisitorAudit() {
        const btn = document.getElementById('inquisitorBtn');
        const results = document.getElementById('inquisitorResults');
        const scores = document.getElementById('inquisitorScores');
        const errorDiv = document.getElementById('inquisitorError');
        
        btn.disabled = true;`;
    
    const newCode = `async function runInquisitorAudit() {
        const btn = document.getElementById('inquisitorBtn');
        const results = document.getElementById('inquisitorResults');
        const scores = document.getElementById('inquisitorScores');
        const errorDiv = document.getElementById('inquisitorError');
        const progress = document.getElementById('inquisitorProgress');
        const progressBar = document.getElementById('inquisitorProgressBar');
        const progressText = document.getElementById('inquisitorProgressText');
        
        btn.disabled = true;`;
    
    if (content.includes(oldCode)) {
      content = content.replace(oldCode, newCode);
      fs.writeFileSync(filePath, content, 'utf8');
      fixed++;
      console.log(`✅ Fixed: ${file}`);
    }
  }
}

console.log(`\n✅ Fixed ${fixed} files`);
