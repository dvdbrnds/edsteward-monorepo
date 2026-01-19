// scripts/auto-align.cjs
// Auto-detects drift between MCP Engine and EdSteward and re-syncs if needed

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.dirname(SCRIPTS_DIR);

async function autoAlign() {
  console.log('='.repeat(70));
  console.log('🔄 MCP ENGINE AUTO-ALIGNMENT');
  console.log('='.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  console.log('📋 Step 1: Running alignment verification...\n');
  
  try {
    // Run verification
    execSync(`node ${path.join(SCRIPTS_DIR, 'verify-edsteward-alignment.cjs')}`, { 
      stdio: 'inherit',
      env: process.env,
      cwd: PROJECT_ROOT
    });
    
    console.log('\n✅ Systems are aligned. No action needed.');
    console.log(`Completed at: ${new Date().toISOString()}`);
    
  } catch (err) {
    // Verification failed - systems misaligned
    console.log('\n⚠️  Misalignment detected. Starting re-sync...\n');
    console.log('='.repeat(70));
    console.log('📋 Step 2: Executing alignment sync...');
    console.log('='.repeat(70) + '\n');
    
    try {
      execSync(`node ${path.join(SCRIPTS_DIR, 'execute-alignment.cjs')}`, {
        stdio: 'inherit',
        env: process.env,
        cwd: PROJECT_ROOT
      });
      
      console.log('\n✅ Re-sync complete. Running verification...\n');
      console.log('='.repeat(70));
      console.log('📋 Step 3: Post-sync verification...');
      console.log('='.repeat(70) + '\n');
      
      // Verify again
      execSync(`node ${path.join(SCRIPTS_DIR, 'verify-edsteward-alignment.cjs')}`, {
        stdio: 'inherit',
        env: process.env,
        cwd: PROJECT_ROOT
      });
      
      console.log('\n✅ Auto-alignment completed successfully.');
      console.log(`Completed at: ${new Date().toISOString()}`);
      
    } catch (syncErr) {
      console.error('\n❌ Re-sync failed:', syncErr.message);
      console.error('Please check the logs above for details.');
      console.error('\nTroubleshooting:');
      console.error('  1. Ensure EdSteward is running');
      console.error('  2. Check EDSTEWARD_URL environment variable');
      console.error('  3. Verify authentication credentials');
      console.error('  4. Run `npm run align` manually for detailed output');
      process.exit(1);
    }
  }
}

autoAlign();
