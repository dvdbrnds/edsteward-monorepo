#!/usr/bin/env node
/**
 * Generate Regulation Console from Gold Standard Template
 * 
 * Uses Clery (REG-001) console as the gold standard template and generates
 * consoles for other regulations by replacing ONLY the configuration constants.
 * 
 * IMPORTANT: The template must use REGULATION_SLUG variable everywhere.
 * This script ONLY replaces:
 *   1. <title> tag
 *   2. const REGULATION_SLUG = '...'
 *   3. const REG_KEY = '...'
 *   4. const REGULATION_NAME = '...' (if present)
 * 
 * DO NOT do global string replacements - that corrupts the template!
 * 
 * Usage:
 *   node scripts/generate-console-from-template.cjs REG-004
 *   node scripts/generate-console-from-template.cjs --all
 *   node scripts/generate-console-from-template.cjs --top20
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CONSOLES_DIR = path.join(__dirname, '../src/client/public/regulations');
const TEMPLATE_FILE = path.join(CONSOLES_DIR, 'jeanne-clery-disclosure-of-campus-security-policy--console.html');

// Database connection
const pool = new Pool({
  host: 'localhost',
  database: 'mcp_engine',
  port: 5432
});

async function getRegulationData(regKey) {
  const result = await pool.query(`
    SELECT 
      r.id, r.reg_key, r.item_id, r.name, r.short_name, r.statute, r.cfr,
      r.category, r.topic, r.summary,
      r.jurisdiction_source, r.state_code
    FROM regulations r
    WHERE r.reg_key = $1 AND r.is_current = TRUE
  `, [regKey]);
  
  if (result.rows.length === 0) {
    throw new Error(`Regulation ${regKey} not found`);
  }
  
  return result.rows[0];
}

async function generateConsole(regKey) {
  console.log(`\n🔄 Generating console for ${regKey}...`);
  
  // Get regulation data
  const reg = await getRegulationData(regKey);
  console.log(`   Found: ${reg.name}`);
  console.log(`   Slug: ${reg.item_id}`);
  
  // Read template
  let template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  
  // Build filename
  const consoleFilename = `${reg.item_id}-console.html`;
  const consolePath = path.join(CONSOLES_DIR, consoleFilename);
  
  // Check if console already exists (to preserve any manual customizations)
  const backupPath = consolePath + '.backup-' + Date.now();
  if (fs.existsSync(consolePath)) {
    fs.copyFileSync(consolePath, backupPath);
    console.log(`   Backed up existing: ${path.basename(backupPath)}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SAFE REPLACEMENTS ONLY - Just the configuration constants
  // DO NOT do global string replacements that corrupt the template!
  // ═══════════════════════════════════════════════════════════════════════════
  
  let console_html = template;
  
  // 1. Replace <title> tag
  console_html = console_html.replace(
    /<title>.*?<\/title>/,
    `<title>${reg.name} - MCP Engine Console</title>`
  );
  
  // 2. Replace REGULATION_SLUG constant (ONLY the const declaration)
  console_html = console_html.replace(
    /const REGULATION_SLUG = '[^']+';/,
    `const REGULATION_SLUG = '${reg.item_id}';`
  );
  
  // 3. Replace REG_KEY constant (ONLY the const declaration)
  console_html = console_html.replace(
    /const REG_KEY = '[^']+';/,
    `const REG_KEY = '${reg.reg_key}';`
  );
  
  // 4. Replace REGULATION_NAME constant if it exists (ONLY the const declaration)
  if (console_html.includes('const REGULATION_NAME =')) {
    console_html = console_html.replace(
      /const REGULATION_NAME = '[^']+';/,
      `const REGULATION_NAME = '${reg.name}';`
    );
  }
  
  // 5. Replace let REGULATION_NAME if it exists (some templates use let)
  if (console_html.includes('let REGULATION_NAME =')) {
    console_html = console_html.replace(
      /let REGULATION_NAME = '[^']+';/,
      `let REGULATION_NAME = '${reg.name}';`
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION: Ensure REGULATION_SLUG is used (not hardcoded strings)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Check that the template properly uses REGULATION_SLUG variable
  const hardcodedPatterns = [
    /regulation:\s*'[^']+',\s*\n\s*quick:/,  // Workflow calls should use variable
    /regulationSlug:\s*'[^']+'/,              // Should be regulationSlug: REGULATION_SLUG
    /regulationId:\s*'[^']*clery[^']*'/i,     // Should not have hardcoded Clery refs
  ];
  
  let warnings = [];
  for (const pattern of hardcodedPatterns) {
    if (pattern.test(console_html)) {
      warnings.push(`   ⚠️  Template may have hardcoded strings - run fix-all-hardcoded-slugs.cjs after`);
      break;
    }
  }
  
  // Write the new console
  fs.writeFileSync(consolePath, console_html);
  console.log(`   ✅ Generated: ${consoleFilename}`);
  
  if (warnings.length > 0) {
    warnings.forEach(w => console.log(w));
  }
  
  return { regKey, filename: consoleFilename, path: consolePath };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/generate-console-from-template.cjs REG-004');
    console.log('  node scripts/generate-console-from-template.cjs --all');
    console.log('  node scripts/generate-console-from-template.cjs --top20');
    console.log('');
    console.log('IMPORTANT: After generating, run:');
    console.log('  node scripts/fix-all-hardcoded-slugs.cjs');
    console.log('to ensure all regulation references use REGULATION_SLUG variable');
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🏗️  Console Generator from Gold Standard Template');
  console.log('   Template: Clery (REG-001)');
  console.log('   Mode: SAFE - Only replaces configuration constants');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  try {
    let generatedCount = 0;
    let errorCount = 0;
    
    if (args[0] === '--all') {
      // Get all regulations with reg_keys
      const result = await pool.query(`
        SELECT reg_key FROM regulations 
        WHERE is_current = TRUE AND reg_key IS NOT NULL 
        AND reg_key != 'REG-001'  -- Skip template
        ORDER BY reg_key
      `);
      
      console.log(`Found ${result.rows.length} regulations to process\n`);
      
      for (const row of result.rows) {
        try {
          await generateConsole(row.reg_key);
          generatedCount++;
        } catch (err) {
          console.error(`   ❌ Error for ${row.reg_key}: ${err.message}`);
          errorCount++;
        }
      }
    } else if (args[0] === '--top20') {
      // Process top 20 regulations
      const result = await pool.query(`
        SELECT reg_key FROM regulations 
        WHERE is_current = TRUE AND reg_key IS NOT NULL 
        AND reg_key != 'REG-001'
        ORDER BY reg_key
        LIMIT 20
      `);
      
      console.log(`Processing ${result.rows.length} regulations\n`);
      
      for (const row of result.rows) {
        try {
          await generateConsole(row.reg_key);
          generatedCount++;
        } catch (err) {
          console.error(`   ❌ Error for ${row.reg_key}: ${err.message}`);
          errorCount++;
        }
      }
    } else {
      // Single regulation
      await generateConsole(args[0]);
      generatedCount = 1;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`✅ Generated: ${generatedCount} consoles`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n📌 REMINDER: The template uses REGULATION_SLUG variable for all');
    console.log('   regulation-specific references. No further fixes needed if the');
    console.log('   template is properly configured.');
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
