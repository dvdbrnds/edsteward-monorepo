#!/usr/bin/env node
/**
 * Fix the EdSteward button to use delivery system proxy
 */

import fs from 'fs';
import path from 'path';

const CONSOLE_DIR = 'src/client/public/regulations';
const targetFile = path.join(CONSOLE_DIR, 'jeanne-clery-disclosure-of-campus-security-policy--console.html');

let content = fs.readFileSync(targetFile, 'utf8');

// Replace the direct EdSteward call with a proxy call through delivery system
const OLD_FUNCTION = `
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
                
                const response = await fetch('https://moravian.edsteward.ai/api/regulation-updates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic [REDACTED-BASE64]'
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

const NEW_FUNCTION = `
        // Send regulation update to EdSteward via delivery system proxy
        async function sendToEdSteward() {
            const button = document.getElementById('sendToEdstewardBtn');
            if (!button) return;
            
            const originalText = button.textContent;
            button.textContent = '📤 SENDING...';
            button.style.background = '#f59e0b';
            button.disabled = true;
            
            try {
                addConsoleLog('📤 Sending Clery Act update to EdSteward...', 'info');
                
                // Use delivery system proxy to avoid CORS
                const response = await fetch('http://localhost:3051/api/send-to-edsteward', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        regulationId: 9,
                        regulationSlug: 'clery-act',
                        name: 'Jeanne Clery Disclosure of Campus Security Policy',
                        edstewardId: 9
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    addConsoleLog('✅ Successfully sent to EdSteward!', 'success');
                    addConsoleLog('📋 Regulation ID: 9 (Clery Act) | Status: Pending CCO Review', 'info');
                    button.textContent = '✅ SENT!';
                    button.style.background = '#059669';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = '#2563eb';
                        button.disabled = false;
                    }, 3000);
                } else {
                    addConsoleLog('❌ EdSteward error: ' + (result.error || 'Unknown error'), 'error');
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

// Replace old function with new one
content = content.replace(
    /\/\/ Send regulation update to EdSteward[\s\S]*?function sendToEdSteward\(\) \{[\s\S]*?\n        \}/,
    NEW_FUNCTION.trim()
);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('✅ Fixed button to use delivery system proxy');
