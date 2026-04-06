#!/usr/bin/env node

/**
 * Migrate all v1 monolithic console pages to the v2 template pattern.
 *
 * For each *-console.html:
 *   1. Extract embedded globals (REGULATION_SLUG, REG_KEY, etc.)
 *   2. If no bespoke *-config.js exists, generate a minimal one
 *   3. Replace the v1 HTML with the shared template pointing to the config
 *
 * The v2 pattern: config.js sets window globals + REGULATION_CONFIG,
 * then shared/console-ui.js handles all rendering and merges bespoke data.
 *
 * Usage:
 *   node packages/engine/scripts/migrate-consoles-to-v2.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGS_DIR = path.join(__dirname, '../src/client/public/regulations');
const TEMPLATE_PATH = path.join(REGS_DIR, 'shared/console-template.html');
const DRY_RUN = process.argv.includes('--dry-run');

function extractGlobals(html) {
  const extract = (pattern) => {
    const match = html.match(pattern);
    return match ? match[1] : null;
  };

  const slug = extract(/const\s+REGULATION_SLUG\s*=\s*'([^']+)'/);
  const regKey = extract(/const\s+REG_KEY\s*=\s*'([^']+)'/);
  const jurisdiction = extract(/const\s+JURISDICTION_SOURCE\s*=\s*'([^']*)'/);
  const stateCode = extract(/const\s+STATE_CODE\s*=\s*'([^']*)'/);
  const enforcingAgency = extract(/const\s+ENFORCING_AGENCY\s*=\s*'([^']*)'/);

  if (!slug) return null;

  return {
    slug,
    regKey: regKey || '',
    jurisdiction: jurisdiction || 'federal',
    stateCode: stateCode || '',
    enforcingAgency: enforcingAgency || '',
  };
}

function generateMinimalConfig(globals) {
  const name = globals.slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

  return `/**
 * Auto-generated config for: ${name}
 * Migrated from v1 inline console to v2 shared template.
 *
 * To add bespoke tasks, deadlines, and penalties, populate
 * window.REGULATION_CONFIG.tasks / .deadlines / .penalties below.
 */

window.REGULATION_SLUG = '${globals.slug}';
window.REG_KEY = '${globals.regKey}';
window.JURISDICTION_SOURCE = '${globals.jurisdiction}';
window.STATE_CODE = '${globals.stateCode}';
window.ENFORCING_AGENCY = '${globals.enforcingAgency}';
window.REGULATION_NAME = '${name}';

window.REGULATION_CONFIG = {
  id: '${globals.slug}',
  name: '${name}',
  jurisdiction: '${globals.jurisdiction}',
  stateCode: '${globals.stateCode}',
  enforcingAgency: '${globals.enforcingAgency}',
  tasks: [],
  deadlines: [],
  penalties: [],
};
`;
}

function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const files = fs.readdirSync(REGS_DIR).filter(f => f.endsWith('-console.html'));

  console.log(`Found ${files.length} v1 console pages`);
  console.log(`Template: ${TEMPLATE_PATH}`);
  if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

  let migrated = 0;
  let configsCreated = 0;
  let skipped = 0;
  const failures = [];

  for (const file of files) {
    const htmlPath = path.join(REGS_DIR, file);
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Skip if already a v2 page (loads shared/console-ui.js)
    if (html.includes('src="shared/console-ui.js"')) {
      console.log(`  SKIP (already v2): ${file}`);
      skipped++;
      continue;
    }

    const globals = extractGlobals(html);
    if (!globals) {
      console.log(`  FAIL (no globals found): ${file}`);
      failures.push(file);
      continue;
    }

    // Determine config file name (normalize trailing dash to avoid triple-dash filenames)
    const normalizedSlug = globals.slug.replace(/-+$/, '');
    const configFilename = `${normalizedSlug}--config.js`;
    const configPath = path.join(REGS_DIR, configFilename);
    const hasBespokeConfig = fs.existsSync(configPath);

    if (!hasBespokeConfig) {
      const minimalConfig = generateMinimalConfig(globals);
      if (!DRY_RUN) {
        fs.writeFileSync(configPath, minimalConfig, 'utf-8');
      }
      configsCreated++;
    }

    // Generate v2 HTML from template
    const v2Html = template.replace('REGULATION_CONFIG_PATH_HERE', configFilename);

    if (!DRY_RUN) {
      fs.writeFileSync(htmlPath, v2Html, 'utf-8');
    }

    const configNote = hasBespokeConfig ? '(bespoke config)' : '(generated config)';
    console.log(`  OK: ${file} -> v2 ${configNote}`);
    migrated++;
  }

  // Also handle any v2 files that exist separately (like *-console-v2.html)
  // and remove the v2 suffix since the main file is now v2
  const v2Files = fs.readdirSync(REGS_DIR).filter(f => f.endsWith('-console-v2.html'));
  for (const v2File of v2Files) {
    const mainFile = v2File.replace('-console-v2.html', '-console.html');
    const mainPath = path.join(REGS_DIR, mainFile);
    const v2Path = path.join(REGS_DIR, v2File);

    if (fs.existsSync(mainPath)) {
      // Main file was already migrated; remove the redundant v2 copy
      if (!DRY_RUN) {
        fs.unlinkSync(v2Path);
      }
      console.log(`  CLEANUP: removed redundant ${v2File}`);
    }
  }

  // Regenerate index.html
  const allConsoleFiles = fs.readdirSync(REGS_DIR)
    .filter(f => f.endsWith('-console.html'))
    .sort();

  const indexEntries = allConsoleFiles.map(f => {
    const slug = f.replace('-console.html', '');
    const configFile = `${slug}--config.js`;
    const configPath = path.join(REGS_DIR, configFile);
    let name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let regKey = '';
    let jurisdiction = 'federal';

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const nameMatch = configContent.match(/window\.REGULATION_NAME\s*=\s*'([^']+)'/);
      const keyMatch = configContent.match(/window\.REG_KEY\s*=\s*'([^']+)'/);
      const jurMatch = configContent.match(/window\.JURISDICTION_SOURCE\s*=\s*'([^']*)'/);
      if (nameMatch) name = nameMatch[1];
      if (keyMatch) regKey = keyMatch[1];
      if (jurMatch) jurisdiction = jurMatch[1];
    }

    const badge = jurisdiction === 'state'
      ? '<span style="background: #2563eb; color: white; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-left: 6px;">STATE</span>'
      : '';

    return `
        <div class="regulation">
            <h3><a href="${f}">${name}</a>${badge}</h3>
            <p><span class="topic">${regKey}</span> | Slug: ${slug}</p>
        </div>`;
  }).join('');

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Regulation Console Pages Index</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; margin: 20px; background: #f8fafc; color: #1e293b; }
        h1 { color: #0f172a; }
        .regulation { margin: 10px 0; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; }
        .regulation:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1); }
        .regulation h3 { margin: 0 0 5px 0; font-size: 15px; }
        .regulation a { color: #0066cc; text-decoration: none; }
        .regulation a:hover { text-decoration: underline; }
        .regulation p { margin: 0; font-size: 12px; color: #64748b; }
        .topic { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
        .stats { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; }
    </style>
</head>
<body>
    <h1>Regulation Console Pages</h1>
    <div class="stats">
        <strong>${allConsoleFiles.length}</strong> regulations | All using v2 shared template with bespoke configs
    </div>
    ${indexEntries}
</body>
</html>`;

  if (!DRY_RUN) {
    fs.writeFileSync(path.join(REGS_DIR, 'index.html'), indexHtml, 'utf-8');
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Migrated:        ${migrated}`);
  console.log(`Configs created: ${configsCreated}`);
  console.log(`Already v2:      ${skipped}`);
  console.log(`Failures:        ${failures.length}`);
  if (failures.length > 0) {
    console.log(`Failed files:\n  ${failures.join('\n  ')}`);
  }
  console.log(`Index updated:   ${allConsoleFiles.length} entries`);
  if (DRY_RUN) console.log('\n(dry run — no files written)');
}

main();
