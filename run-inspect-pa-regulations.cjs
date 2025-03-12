
// CommonJS script to properly execute TypeScript files in an ES module environment
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Running inspect-pa-regulations.ts...');
  
  // Use ts-node-esm which specifically supports ESM
  execSync('npx ts-node-esm server/inspect-pa-regulations.ts', { 
    stdio: 'inherit',
    env: { 
      ...process.env,
      // These options help with TypeScript ESM resolution
      NODE_OPTIONS: '--experimental-specifier-resolution=node --loader ts-node/esm'
    }
  });
  
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Failed to run inspect-pa-regulations.ts:', error.message);
  process.exit(1);
}
