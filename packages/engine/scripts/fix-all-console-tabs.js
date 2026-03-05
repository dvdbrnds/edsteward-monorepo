const fs = require('fs');
const path = require('path');

const regulationsDir = './public/regulations';
const files = fs.readdirSync(regulationsDir).filter(f => f.endsWith('-console.html'));

console.log(`Fixing ${files.length} console files...`);

let fixed = 0;
files.forEach(file => {
    const filePath = path.join(regulationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Extract regulation slug from filename
    const slug = file.replace('-console.html', '');
    
    // Fix all the hardcoded reg-66 and teach-act endpoints to use the correct slug
    const originalContent = content;
    
    // Replace hardcoded endpoints with the correct slug
    content = content.replace(/\/api\/llm\/cfr\/reg-66/g, `/api/llm/cfr/${slug}`);
    content = content.replace(/\/api\/llm\/cfr\/teach-act/g, `/api/llm/cfr/${slug}`);
    content = content.replace(/\/api\/llm\/cfr\/enhanced\/teach-act/g, `/api/llm/cfr/${slug}`);
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        fixed++;
    }
});

console.log(`Fixed ${fixed} files with incorrect endpoints`);

// Also copy to dist
const distDir = '../src/client/dist/public/regulations';
if (fs.existsSync(distDir)) {
    files.forEach(file => {
        const srcPath = path.join(regulationsDir, file);
        const destPath = path.join(distDir, file);
        fs.copyFileSync(srcPath, destPath);
    });
    console.log(`Copied ${files.length} files to dist`);
}
