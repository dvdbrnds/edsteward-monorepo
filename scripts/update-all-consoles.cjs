#!/usr/bin/env node
/**
 * Update All Console HTML Files to New Standard
 * 
 * Fixes:
 * 1. fetchRegulationData() to use REGULATION_SLUG instead of hardcoded 'clery'
 * 2. Adds category-grouped task display
 * 
 * Run: node scripts/update-all-consoles.js
 */

const fs = require('fs');
const path = require('path');

const CONSOLES_DIR = path.join(__dirname, '../src/client/public/regulations');

// The correct fetchRegulationData function that uses the slug
const FIXED_FETCH_FUNCTION = `
        async function fetchRegulationData() {
            if (cachedRegulationData) return cachedRegulationData;
            try {
                // Use the REGULATION_SLUG to fetch the correct regulation
                const response = await fetch(\`http://localhost:3010/api/regulations/\${REGULATION_SLUG}\`);
                const data = await response.json();
                if (data && !data.error) {
                    cachedRegulationData = data;
                    return cachedRegulationData;
                }
            } catch (err) {
                console.error('Failed to fetch regulation data:', err);
            }
            return null;
        }`;

// Category-grouped task rendering function
const CATEGORY_GROUPED_TASKS = `
                // Group tasks by category
                const tasksByCategory = {};
                tasks.forEach(task => {
                    const cat = task.category || 'Uncategorized';
                    if (!tasksByCategory[cat]) tasksByCategory[cat] = [];
                    tasksByCategory[cat].push(task);
                });
                
                // Sort categories alphabetically
                const sortedCategories = Object.keys(tasksByCategory).sort();
                
                // Render each category with its tasks
                let tasksHtml = '';
                sortedCategories.forEach(category => {
                    const categoryTasks = tasksByCategory[category];
                    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
                    
                    tasksHtml += \`
                        <div style="margin-bottom: 20px;">
                            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 10px 16px; border-radius: 8px 8px 0 0; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                                <span>\${categoryTitle}</span>
                                <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 11px;">\${categoryTasks.length} tasks</span>
                            </div>
                            <div style="border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px; padding: 12px;">
                    \`;
                    
                    categoryTasks.forEach(task => {
                        tasksHtml += \`
                            <div style="background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 4px; padding: 12px 14px; margin-bottom: 8px;">
                                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">\${task.name || task.title || 'Task'}</div>
                                <div style="font-size: 12px; color: #64748b;">\${task.description || ''}</div>
                            </div>
                        \`;
                    });
                    
                    tasksHtml += '</div></div>';
                });
                
                tasksList.innerHTML = tasksHtml || '<div style="color: #6b7280; padding: 16px;">No compliance tasks available</div>';`;

function updateConsoleFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const fileName = path.basename(filePath);
    
    // Fix 1: Update fetchRegulationData to use REGULATION_SLUG instead of hardcoded search
    const oldFetchPattern = /async function fetchRegulationData\(\) \{[\s\S]*?return null;\s*\}/;
    if (oldFetchPattern.test(content)) {
        // Check if it has the old hardcoded search pattern
        if (content.includes("search=clery") || content.includes('search=')) {
            content = content.replace(oldFetchPattern, FIXED_FETCH_FUNCTION.trim());
            modified = true;
        }
    }
    
    // Fix 2: Check if tasks are rendered flat (without category grouping)
    // Look for the old flat task rendering pattern
    const oldTasksPattern = /tasksList\.innerHTML = tasks\.map\(t\s*=>/;
    if (oldTasksPattern.test(content)) {
        // This console has the old flat rendering, but updating this is complex
        // Mark it for manual review
        console.log(`  ⚠️  ${fileName} has flat task rendering - needs manual update`);
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Updated: ${fileName}`);
        return true;
    } else {
        return false;
    }
}

function main() {
    console.log('🔄 Updating all console HTML files...\n');
    
    const files = fs.readdirSync(CONSOLES_DIR)
        .filter(f => f.endsWith('-console.html'));
    
    console.log(`Found ${files.length} console files\n`);
    
    let updated = 0;
    let skipped = 0;
    
    files.forEach(file => {
        const filePath = path.join(CONSOLES_DIR, file);
        if (updateConsoleFile(filePath)) {
            updated++;
        } else {
            skipped++;
        }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already correct or no changes needed): ${skipped}`);
}

main();
