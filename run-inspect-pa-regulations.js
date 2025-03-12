
// Script to execute the TypeScript file using child_process
import { execSync } from 'child_process';

try {
  console.log('Running inspect-pa-regulations.ts...');
  execSync('npx ts-node --transpile-only server/inspect-pa-regulations.ts', { stdio: 'inherit' });
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Failed to run inspect-pa-regulations.ts:', error.message);
  process.exit(1);
}
