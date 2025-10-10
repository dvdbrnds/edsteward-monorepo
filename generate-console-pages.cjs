#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('🚀 Starting Console Page Generator...');
console.log('📋 Generating individual console pages for all regulations based on REG-66 template');

// Configuration
const TEMPLATE_FILE = './src/client/public/reg-66-advanced-console.html';
const OUTPUT_DIR = './src/client/public/regulations';
const API_URL = 'http://localhost:3010/api/regulations/all';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
}

// Function to fetch regulations from API
async function fetchRegulations() {
    return new Promise((resolve, reject) => {
        const http = require('http'); // Use http for localhost
        const url = new URL(API_URL);
        
        const req = http.request(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.data || []);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// Function to generate console page for a specific regulation
function generateConsolePage(templateContent, regulation) {
    const regulationName = regulation.name || 'Unknown Regulation';
    const regulationSlug = regulation.slug || 'unknown-regulation';
    const regulationTopic = regulation.topic || 'General';
    const regulationId = regulation.id || regulation.slug || 'unknown';
    
    console.log(`📝 Generating console page for: ${regulationName} (${regulationSlug})`);
    
    // Determine the correct API endpoint for this regulation
    let apiEndpoint = 'cfr/' + regulationSlug; // Default to CFR endpoint
    let displayName = `${regulationName} CFR Implementation`;
    
    // Special cases for USC endpoints
    if (regulationSlug.includes('teach-act') || regulationSlug.includes('copyright') || regulationId.includes('REG-66')) {
        apiEndpoint = 'usc/17/110';
        displayName = 'USC 17 Section 110';
    } else if (regulationSlug.includes('privacy-act')) {
        apiEndpoint = 'usc/5/552a';
        displayName = 'USC 5 Section 552a';
    } else if (regulationSlug.includes('freedom-of-information-act')) {
        apiEndpoint = 'usc/5/552';
        displayName = 'USC 5 Section 552';
    } else if (regulationName.includes('Age Discrimination')) {
        displayName = 'Age Discrimination Act CFR 45 Part 90';
    } else if (regulationName.includes('Fair Credit')) {
        displayName = 'Fair Credit Reporting Act CFR 12 Part 1000';
    } else if (regulationName.includes('Americans with Disabilities')) {
        displayName = 'Americans with Disabilities Act CFR 28 Part 35';
    }
    
    console.log(`   📡 API Endpoint: ${apiEndpoint}`);
    console.log(`   📋 Display Name: ${displayName}`);
    
    // Replace template placeholders with regulation-specific data
    let content = templateContent
        // Replace page title
        .replace(/<title>.*?<\/title>/g, `<title>${regulationName} - Advanced LinearEngine Console</title>`)
        
        // Replace main header
        .replace(/REG-66 Advanced LinearEngine Console/g, `${regulationName} - Advanced LinearEngine Console`)
        
        // Replace regulation-specific content
        .replace(/17 U\.S\.C\. § 110\(2\)/g, `Regulation: ${regulationName}`)
        .replace(/TEACH Act: Limitations on exclusive rights/g, regulationName)
        .replace(/FERPA Section 66/g, regulationName)
        
        // Replace regulation metadata
        .replace(/Active/g, 'Active')
        .replace(/Master Template/g, regulationTopic)
        
        // Replace console initialization messages
        .replace(/REG-66 LinearEngine Console Initialized/g, `${regulationName} Console Initialized`)
        .replace(/REG-66 comprehensive LinearEngine workflow/g, `${regulationName} comprehensive LinearEngine workflow`)
        
        // Replace WebSocket subscription
        .replace(/regulationIds: \['REG-66'\]/g, `regulationIds: ['${regulationId}']`)
        
        // CRITICAL FIX: Replace hardcoded API endpoints with regulation-specific ones
        .replace(/http:\/\/localhost:3002\/api\/llm\/usc\/17\/110/g, `http://localhost:3002/api/llm/${apiEndpoint}`)
        .replace(/api\/llm\/usc\/17\/110/g, `api/llm/${apiEndpoint}`)
        .replace(/USC 17 Section 110/g, displayName)
        .replace(/usc\/17\/110/g, apiEndpoint)
        .replace(/Fetching real USC 17 Section 110 text from API/g, `Fetching real ${displayName} text from API`)
        .replace(/Subscribed to REG-66 regulation updates/g, `Subscribed to ${regulationName} updates`)
        
        // Replace API query
        .replace(/regulation: 'reg-66'/g, `regulation: '${regulationId}'`)
        .replace(/Execute REG-66 comprehensive LinearEngine workflow/g, `Execute ${regulationName} comprehensive LinearEngine workflow`)
        
        // Replace any remaining REG-66 references
        .replace(/REG-66/g, regulationName);
    
    return content;
}

// Main generation function
async function generateAllConsolePages() {
    try {
        console.log('📖 Reading REG-66 template...');
        const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf8');
        console.log('✅ Template loaded successfully');
        
        console.log('🌐 Fetching regulations from API...');
        const regulations = await fetchRegulations();
        console.log(`✅ Found ${regulations.length} regulations to process`);
        
        console.log('🔄 Generating individual console pages...');
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < regulations.length; i++) {
            const regulation = regulations[i];
            const regulationSlug = regulation.slug || `regulation-${i}`;
            
            try {
                // Generate the console page content
                const pageContent = generateConsolePage(templateContent, regulation);
                
                // Write to file
                const filename = `${regulationSlug}-console.html`;
                const filepath = path.join(OUTPUT_DIR, filename);
                
                fs.writeFileSync(filepath, pageContent, 'utf8');
                
                successCount++;
                if (successCount % 50 === 0) {
                    console.log(`   📄 Generated ${successCount}/${regulations.length} pages...`);
                }
                
            } catch (error) {
                console.error(`❌ Failed to generate page for ${regulation.name}: ${error.message}`);
                errorCount++;
            }
        }
        
        console.log('\n🎉 Console Page Generation Complete!');
        console.log(`✅ Successfully generated: ${successCount} pages`);
        console.log(`❌ Failed: ${errorCount} pages`);
        console.log(`📁 Output directory: ${OUTPUT_DIR}`);
        
        // Generate index file
        generateIndexFile(regulations);
        
    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
    }
}

// Generate an index file listing all console pages
function generateIndexFile(regulations) {
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Regulation Console Pages Index</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .regulation { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .regulation h3 { margin: 0 0 5px 0; }
        .regulation a { color: #0066cc; text-decoration: none; }
        .regulation a:hover { text-decoration: underline; }
        .topic { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
    </style>
</head>
<body>
    <h1>Generated Regulation Console Pages (${regulations.length} total)</h1>
    <p>Each regulation has its own dedicated console page based on the REG-66 template.</p>
    
    ${regulations.map(reg => {
        const slug = reg.slug || 'unknown';
        const filename = `${slug}-console.html`;
        return `
        <div class="regulation">
            <h3><a href="${filename}">${reg.name || 'Unknown Regulation'}</a></h3>
            <p><span class="topic">${reg.topic || 'General'}</span> | Slug: ${slug}</p>
        </div>`;
    }).join('')}
    
    <hr>
    <p><em>Generated on ${new Date().toISOString()}</em></p>
</body>
</html>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexContent, 'utf8');
    console.log('📋 Generated index.html with links to all console pages');
}

// Run the generator
if (require.main === module) {
    generateAllConsolePages().catch(console.error);
}

module.exports = { generateAllConsolePages, generateConsolePage };
