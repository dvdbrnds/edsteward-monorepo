#!/usr/bin/env node
/**
 * Add "SEND TO EDSTEWARD" button to console pages
 */

import fs from 'fs';
import path from 'path';

const CONSOLE_DIR = 'src/client/public/regulations';
const EDSTEWARD_URL = 'https://moravian.edsteward.ai';
const AUTH = Buffer.from('dvdbrnds:gabadh').toString('base64');

// The new button HTML
const NEW_BUTTON = `<button id="sendToEdstewardBtn" onclick="sendToEdSteward()" class="run-button" style="background: #2563eb; margin-left: 12px; font-size: 12px;">
                    📤 SEND TO EDSTEWARD
                </button>`;

// The JS function to add
const SEND_FUNCTION = `
        // Send regulation update to EdSteward
        async function sendToEdSteward() {
            const button = document.getElementById('sendToEdstewardBtn');
            if (!button) return;
            
            const originalText = button.textContent;
            button.textContent = '📤 SENDING...';
            button.style.background = '#f59e0b';
            button.disabled = true;
            
            try {
                addConsoleLog('📤 Sending update to EdSteward...', 'info');
                
                const regId = window.regulationConfig?.edstewardId || 9; // Clery Act = 9
                const regName = window.regulationConfig?.name || 'Clery Act';
                
                const payload = {
                    regulationId: regId,
                    name: regName,
                    originalContent: '',
                    updatedContent: '[UPDATED ' + new Date().toLocaleDateString() + '] Update from MCP Engine - Real-time regulation monitoring detected changes.',
                    status: 'pending',
                    summary: 'Regulation update delivered by MCP Engine',
                    metadata: {
                        source: 'MCP_ENGINE_CONSOLE',
                        timestamp: new Date().toISOString()
                    }
                };
                
                const response = await fetch('${EDSTEWARD_URL}/api/regulation-updates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic ${AUTH}'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    addConsoleLog('✅ Successfully sent to EdSteward!', 'success');
                    addConsoleLog('📋 Regulation ID: ' + regId + ' | Status: Pending CCO Review', 'info');
                    button.textContent = '✅ SENT!';
                    button.style.background = '#059669';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = '#2563eb';
                        button.disabled = false;
                    }, 3000);
                } else {
                    const errorText = await response.text();
                    addConsoleLog('❌ EdSteward error: ' + response.status + ' - ' + errorText, 'error');
                    button.textContent = '❌ FAILED';
                    button.style.background = '#dc2626';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = '#2563eb';
                        button.disabled = false;
                    }, 3000);
                }
            } catch (error) {
                addConsoleLog('❌ Error: ' + error.message, 'error');
                button.textContent = originalText;
                button.style.background = '#2563eb';
                button.disabled = false;
            }
        }
`;

// Target file
const targetFile = path.join(CONSOLE_DIR, 'jeanne-clery-disclosure-of-campus-security-policy--console.html');
let content = fs.readFileSync(targetFile, 'utf8');

// Add the button after PUSH UPDATE TO CLIENTS button
if (!content.includes('sendToEdstewardBtn')) {
    content = content.replace(
        /(<button id="pushUpdateButton"[^>]*>[\s\S]*?<\/button>)/,
        '$1\n                ' + NEW_BUTTON
    );
    
    // Add the JS function before the closing </script> tag
    content = content.replace(
        /(function pushRegulationUpdate\(\) \{[\s\S]*?\n        \})/,
        '$1\n' + SEND_FUNCTION
    );
    
    // Also add regulationConfig
    if (!content.includes('window.regulationConfig')) {
        content = content.replace(
            '<script>',
            `<script>
        // Regulation config for EdSteward integration
        window.regulationConfig = {
            edstewardId: 9,
            name: 'Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act (Clery Act)',
            slug: 'clery-act'
        };
`
        );
    }
    
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ Added SEND TO EDSTEWARD button to Clery Act console');
} else {
    console.log('Button already exists');
}
