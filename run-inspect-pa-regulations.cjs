
// CommonJS script to execute TypeScript files in an ES modules environment
const { execSync } = require('child_process');

try {
  console.log('Running inspect-pa-regulations.ts...');
  
  // Use correct flags for ESM environment
  execSync('npx ts-node --esm --project tsconfig.json server/inspect-pa-regulations.ts', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Failed to run inspect-pa-regulations.ts:', error.message);
  process.exit(1);
}
