#!/usr/bin/env node
/**
 * Update Console Task Display to Category-Grouped Standard
 * 
 * This script updates all console HTML files to use the gold standard
 * category-grouped task display instead of flat or parent/child grouping.
 * 
 * Run: node scripts/update-console-tasks-display.cjs
 */

const fs = require('fs');
const path = require('path');

const CONSOLES_DIR = path.join(__dirname, '../src/client/public/regulations');

// The gold standard category-grouped task rendering code
const CATEGORY_GROUPED_TASKS = `                // Tasks - Category Grouped Display (Gold Standard)
                const tasksList = document.getElementById('tasks-list');
                const tasks = reg.complianceTasks || [];
                document.getElementById('task-count').textContent = \`\${tasks.length} tasks\`;
                
                const priorityColors = {
                    'CRITICAL': '#dc2626',
                    'HIGH': '#f59e0b', 
                    'MEDIUM': '#3b82f6',
                    'LOW': '#10b981'
                };
                
                if (tasks.length > 0) {
                    // Group tasks by category
                    const taskCategories = {};
                    tasks.forEach(t => {
                        const cat = t.category || 'Uncategorized';
                        if (!taskCategories[cat]) taskCategories[cat] = [];
                        taskCategories[cat].push(t);
                    });
                    
                    const sortedCats = Object.keys(taskCategories).sort();
                    let tasksHTML = '';
                    
                    sortedCats.forEach(category => {
                        const catTasks = taskCategories[category];
                        const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
                        tasksHTML += \`
                            <div style="margin-bottom: 16px;">
                                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 10px 14px; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
                                    <span>\${catTitle}</span>
                                    <span style="background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 12px; font-size: 11px;">\${catTasks.length}</span>
                                </div>
                                <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 8px;">
                        \`;
                        
                        catTasks.forEach((t, idx) => {
                            const priority = (t.priority || 'MEDIUM').toUpperCase();
                            const color = priorityColors[priority] || '#64748b';
                            tasksHTML += \`<div style="padding: 10px 12px; margin-bottom: 6px; background: white; border-radius: 6px; border-left: 4px solid \${color}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                    <strong style="color: #1e293b; font-size: 12px;">\${t.title || t.name || 'Task ' + (idx+1)}</strong>
                                    <span style="background: \${color}; color: white; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">\${priority}</span>
                                </div>
                                \${t.description ? \`<div style="color: #475569; font-size: 11px; margin-bottom: 4px;">\${t.description}</div>\` : ''}
                                \${t.assignedRole ? \`<div style="font-size: 10px; color: #3b82f6;">👤 \${t.assignedRole}</div>\` : ''}
                            </div>\`;
                        });
                        
                        tasksHTML += '</div></div>';
                    });
                    tasksList.innerHTML = tasksHTML;
                } else {
                    tasksList.innerHTML = '<div style="color: #6b7280; padding: 16px;">No compliance tasks available</div>';
                }`;

// Pattern to match the old flat task rendering
const OLD_FLAT_PATTERN = /\/\/ Tasks\s*\n\s*const tasksList = document\.getElementById\('tasks-list'\);[\s\S]*?tasksList\.innerHTML = tasksHTML;\s*\}\s*else\s*\{\s*tasksList\.innerHTML = '[^']*';\s*\}/;

// Pattern to match parent/child task grouping (another old style)
const OLD_PARENT_CHILD_PATTERN = /\/\/ Tasks\s*\n\s*const tasksList = document\.getElementById\('tasks-list'\);[\s\S]*?\/\/ Group by parent[\s\S]*?tasksList\.innerHTML = tasksHTML;\s*\}\s*else\s*\{\s*tasksList\.innerHTML = '[^']*';\s*\}/;

// Skip files that already have category grouping
const ALREADY_UPDATED_PATTERN = /Tasks - Category Grouped Display|Group tasks by category/;

function updateConsoleFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Skip if already has category grouping
    if (ALREADY_UPDATED_PATTERN.test(content)) {
        return { status: 'skipped', reason: 'already updated' };
    }
    
    // Try to find and replace old patterns
    let modified = false;
    
    // Check for flat pattern
    if (OLD_FLAT_PATTERN.test(content)) {
        content = content.replace(OLD_FLAT_PATTERN, CATEGORY_GROUPED_TASKS);
        modified = true;
    }
    
    // Check for parent/child pattern
    if (!modified && OLD_PARENT_CHILD_PATTERN.test(content)) {
        content = content.replace(OLD_PARENT_CHILD_PATTERN, CATEGORY_GROUPED_TASKS);
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content);
        return { status: 'updated' };
    }
    
    return { status: 'skipped', reason: 'no matching pattern' };
}

function main() {
    console.log('🔄 Updating console task displays to category-grouped standard...\n');
    
    const files = fs.readdirSync(CONSOLES_DIR)
        .filter(f => f.endsWith('-console.html'));
    
    console.log(`Found ${files.length} console files\n`);
    
    let updated = 0;
    let skipped = 0;
    let noMatch = 0;
    
    files.forEach(file => {
        const filePath = path.join(CONSOLES_DIR, file);
        const result = updateConsoleFile(filePath);
        
        if (result.status === 'updated') {
            console.log(`  ✅ Updated: ${file}`);
            updated++;
        } else if (result.reason === 'already updated') {
            skipped++;
        } else {
            noMatch++;
        }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Updated to category-grouped: ${updated}`);
    console.log(`   Already had category grouping: ${skipped}`);
    console.log(`   No matching task pattern found: ${noMatch}`);
}

main();
