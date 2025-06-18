
// Simple script to execute the TypeScript file using child_process
const { execSync } = require('child_process');

try {
  console.log('Running fix-deadlines.ts...');
  execSync('npx ts-node --transpile-only server/fix-deadlines.ts', { stdio: 'inherit' });
  console.log('Successfully completed generating deadlines!');
} catch (error) {
  console.error('Failed to run fix-deadlines.ts:', error.message);
  process.exit(1);
}
