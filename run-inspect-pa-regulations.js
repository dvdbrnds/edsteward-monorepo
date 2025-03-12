
// Script to execute the TypeScript inspection file using ts-node with proper flags
import { execSync } from 'child_process';

try {
  console.log('Running inspect-pa-regulations.ts...');
  
  // Use ts-node-esm for properly handling ES modules
  execSync('npx ts-node-esm --transpile-only server/inspect-pa-regulations.ts', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--experimental-specifier-resolution=node' }
  });
  
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Failed to run inspect-pa-regulations.ts:', error.message);
  process.exit(1);
}
