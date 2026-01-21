#!/usr/bin/env node
/**
 * Sync Console Improvements
 * 
 * Copies all UX/UI improvements from the Clery console (our gold standard)
 * to all other regulation consoles.
 * 
 * This preserves regulation-specific data while updating:
 * - CSS fixes (layout containment, no drift)
 * - Confirmation dialog for workflow
 * - Enhanced Inquisitor display
 * - Port configurations
 * - Error handling improvements
 * 
 * Usage: node scripts/sync-console-improvements.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CONSOLE_DIR = path.join(__dirname, '../src/client/public/regulations');
const TEMPLATE_FILE = 'jeanne-clery-disclosure-of-campus-security-policy--console.html';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  SYNC CONSOLE IMPROVEMENTS FROM CLERY TEMPLATE`);
  console.log(`  ${dryRun ? '(DRY RUN - no changes will be made)' : ''}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  // Read template
  const templatePath = path.join(CONSOLE_DIR, TEMPLATE_FILE);
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${TEMPLATE_FILE}`);
    process.exit(1);
  }
  
  const template = fs.readFileSync(templatePath, 'utf8');
  console.log(`📋 Template: ${TEMPLATE_FILE} (${template.split('\n').length} lines)`);
  
  // Get all regulation data from database
  const client = new Client({
    host: 'localhost',
    database: 'mcp_engine',
    port: 5432
  });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        reg_key,
        name,
        statute
      FROM regulations
      ORDER BY reg_key
    `);
    
    console.log(`📊 Found ${result.rows.length} regulations in database\n`);
    
    // Get all console files
    const consoleFiles = fs.readdirSync(CONSOLE_DIR)
      .filter(f => f.endsWith('-console.html') && f !== TEMPLATE_FILE);
    
    console.log(`📁 Found ${consoleFiles.length} console files to update\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const file of consoleFiles) {
      const filePath = path.join(CONSOLE_DIR, file);
      const slug = file.replace('-console.html', '');
      
      // Find matching regulation in database
      const regulation = result.rows.find(r => {
        const dbSlug = r.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-+$/, '')
          .substring(0, 50);
        return slug.includes(dbSlug.substring(0, 20)) || dbSlug.includes(slug.substring(0, 20));
      });
      
      if (!regulation) {
        // Try to extract info from existing file
        const existingContent = fs.readFileSync(filePath, 'utf8');
        const titleMatch = existingContent.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(' - MCP Engine Console', '').trim() : slug;
        
        // Generate new console from template
        let newConsole = template
          .replace(/jeanne-clery-disclosure-of-campus-security-policy-/g, slug)
          .replace(/Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act/g, title)
          .replace(/Clery Act Console/g, `${title} Console`)
          .replace(/REG-001/g, 'REG-XXX');
        
        if (!dryRun) {
          fs.writeFileSync(filePath, newConsole);
        }
        console.log(`   ✅ ${file} (from title: ${title.substring(0, 40)}...)`);
        updated++;
        continue;
      }
      
      // Generate new console from template with regulation data
      let newConsole = template
        .replace(/jeanne-clery-disclosure-of-campus-security-policy-/g, slug)
        .replace(/Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act/g, regulation.name)
        .replace(/Clery Act Console/g, `${regulation.name} Console`)
        .replace(/Clery Act/g, regulation.name.split(' ').slice(0, 3).join(' '))
        .replace(/REG-001/g, regulation.reg_key)
        .replace(/20 U\.S\.C\. § 1092/g, regulation.statute || '');
      
      if (!dryRun) {
        fs.writeFileSync(filePath, newConsole);
      }
      console.log(`   ✅ ${file} → ${regulation.reg_key}: ${regulation.name.substring(0, 35)}...`);
      updated++;
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`  SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    if (dryRun) {
      console.log(`\n  🔄 Run without --dry-run to apply changes`);
    }
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
