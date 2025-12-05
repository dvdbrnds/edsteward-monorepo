#!/usr/bin/env node

/**
 * EMERGENCY: Enhance 8 PA regulations with AI
 * Presentation in <5 hours!
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const PA_REGS_FILE = 'src/server/registry-api/data/regulations.json';
const ENHANCED_DIR = 'enhanced-regulations';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🚨 EMERGENCY PA REGULATION ENHANCEMENT');
console.log('Presentation in <5 hours - AI enhancement in progress!');
console.log('═══════════════════════════════════════════════════════════════════\n');

async function enhanceRegulation(slug, name, num, total) {
  console.log(`\n[${num}/${total}] Enhancing: ${name}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   ⏳ Starting AI enhancement...`);
  
  try {
    const { stdout, stderr } = await execPromise(`node enhance-regulation-ai.cjs "${slug}"`);
    
    if (stdout.includes('✅') || stdout.includes('SUCCESS')) {
      console.log(`   ✅ ENHANCED!`);
      return { slug, success: true };
    } else {
      console.log(`   ⚠️  Enhancement completed with warnings`);
      return { slug, success: true, warnings: true };
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { slug, success: false, error: error.message };
  }
}

async function main() {
  // Load PA regulations
  console.log('📖 Loading PA regulations...');
  const paData = JSON.parse(fs.readFileSync(PA_REGS_FILE, 'utf8'));
  const paRegs = paData.filter(r => r.jurisdiction === 'state' && r.state === 'PA');
  
  console.log(`   Found ${paRegs.length} PA regulations to enhance\n`);
  
  const results = [];
  
  // Enhance each PA regulation with 20 second delays
  for (let i = 0; i < paRegs.length; i++) {
    const reg = paRegs[i];
    const result = await enhanceRegulation(reg.slug, reg.name, i + 1, paRegs.length);
    results.push(result);
    
    // Delay between requests to avoid rate limits
    if (i < paRegs.length - 1) {
      console.log(`   💤 Cooling down for 20 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('✅ PA REGULATION ENHANCEMENT COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`📊 Results:`);
  console.log(`   ✅ Successful: ${successful}/${paRegs.length}`);
  console.log(`   ❌ Failed: ${failed}/${paRegs.length}`);
  
  if (failed > 0) {
    console.log(`\n❌ Failed regulations:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.slug}: ${r.error}`);
    });
  }
  
  console.log('\n🚀 Next Step: Transmit PA regulations to EdSteward!');
  console.log('');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

