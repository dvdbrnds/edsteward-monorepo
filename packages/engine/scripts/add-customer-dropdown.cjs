/**
 * Add Customer Dropdown to All Console Pages
 * Replaces the simple "PUSH UPDATE TO CLIENTS" button with a customer-aware dropdown
 */

const fs = require('fs');
const path = require('path');

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');

// New button HTML with customer dropdown
const NEW_BUTTON_HTML = `
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 12px;">
                    <select id="customerSelect" style="padding: 8px 12px; border-radius: 4px; border: 1px solid #4a5568; background: #2d3748; color: #e2e8f0; font-size: 12px; cursor: pointer;">
                        <option value="moravian-prod">Moravian Prod</option>
                        <option value="moravian-dev">Moravian Dev</option>
                        <option value="all">All Customers</option>
                    </select>
                    <button id="pushUpdateBtn" onclick="pushToCustomer()" class="run-button" style="background: #2563eb; font-size: 12px;">
                        📤 PUSH UPDATE
                    </button>
                </div>`;

// Old button pattern to find
const OLD_BUTTON_PATTERN = /<button[^>]*onclick="pushUpdateToClients\(\)"[^>]*>[\s\S]*?📤 PUSH UPDATE TO CLIENTS[\s\S]*?<\/button>/gi;

// Alternative pattern
const ALT_BUTTON_PATTERN = /📤 PUSH UPDATE TO CLIENTS[\s\S]*?<\/button>/gi;

// Function to add to each file
const PUSH_FUNCTION = `
        // Push to selected customer(s)
        async function pushToCustomer() {
            const button = document.getElementById('pushUpdateBtn');
            const select = document.getElementById('customerSelect');
            const customerId = select.value;
            const originalText = button.textContent;
            
            button.textContent = '⏳ Pushing...';
            button.disabled = true;
            
            // Get regulation slug from URL
            const pathParts = window.location.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            const regulationSlug = filename.replace('-console.html', '');
            
            try {
                addConsoleLog(\`📤 Pushing update to \${customerId === 'all' ? 'ALL customers' : customerId}...\`, 'info');
                
                const response = await fetch('http://localhost:3051/api/customers/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        regulationId: regulationSlug,
                        customerIds: customerId === 'all' ? null : [customerId],
                        pushToAll: customerId === 'all'
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addConsoleLog(\`✅ Successfully pushed to \${result.successCount}/\${result.totalCustomers} customers\`, 'success');
                    result.results.forEach(r => {
                        const icon = r.success ? '✅' : '❌';
                        addConsoleLog(\`   \${icon} \${r.customerName}: \${r.success ? 'Delivered' : r.error}\`, r.success ? 'info' : 'error');
                    });
                } else {
                    addConsoleLog(\`❌ Push failed: \${result.error || 'Unknown error'}\`, 'error');
                }
            } catch (error) {
                addConsoleLog(\`❌ Error: \${error.message}\`, 'error');
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        }`;

let filesUpdated = 0;
let filesSkipped = 0;
let errors = [];

// Get all console files
const files = fs.readdirSync(CONSOLE_DIR).filter(f => f.endsWith('-console.html'));

console.log(`Found ${files.length} console files to process...`);

files.forEach(file => {
    const filePath = path.join(CONSOLE_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if already updated
    if (content.includes('customerSelect') || content.includes('pushToCustomer')) {
        filesSkipped++;
        return;
    }

    // Replace old button with new dropdown + button
    if (content.includes('PUSH UPDATE TO CLIENTS')) {
        // Find and replace the button
        content = content.replace(
            /<button[^>]*id="pushUpdateBtn"[^>]*onclick="pushUpdateToClients\(\)"[^>]*>[\s\S]*?<\/button>/i,
            NEW_BUTTON_HTML
        );
        
        // If that didn't work, try simpler pattern
        if (!content.includes('customerSelect')) {
            content = content.replace(
                /(<button[^>]*>[\s\S]*?📤 PUSH UPDATE TO CLIENTS[\s\S]*?<\/button>)/i,
                NEW_BUTTON_HTML
            );
        }
        modified = true;
    }

    // Add the pushToCustomer function if not present
    if (modified && !content.includes('pushToCustomer')) {
        // Find the pushUpdateToClients function and add our new function after it
        const insertPoint = content.indexOf('async function pushUpdateToClients()');
        if (insertPoint > -1) {
            // Find the end of the function (closing brace at same indentation)
            let braceCount = 0;
            let foundStart = false;
            let endIndex = insertPoint;
            
            for (let i = insertPoint; i < content.length; i++) {
                if (content[i] === '{') {
                    braceCount++;
                    foundStart = true;
                }
                if (content[i] === '}') {
                    braceCount--;
                    if (foundStart && braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
            
            // Insert the new function after pushUpdateToClients
            content = content.slice(0, endIndex) + '\n' + PUSH_FUNCTION + content.slice(endIndex);
        }
    }

    if (modified && content.includes('customerSelect')) {
        fs.writeFileSync(filePath, content);
        filesUpdated++;
        console.log(`✅ Updated: ${file}`);
    } else if (modified) {
        errors.push(file);
        console.log(`⚠️  Partial update: ${file}`);
    }
});

console.log(`
═══════════════════════════════════════════
CUSTOMER DROPDOWN ADDITION COMPLETE
═══════════════════════════════════════════
Files updated:  ${filesUpdated}
Files skipped:  ${filesSkipped} (already had dropdown)
Errors:         ${errors.length}
Total files:    ${files.length}
═══════════════════════════════════════════
`);

if (errors.length > 0) {
    console.log('Files with errors:', errors.slice(0, 10).join(', '));
}
