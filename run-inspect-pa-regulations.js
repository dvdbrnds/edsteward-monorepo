
// Direct JavaScript executor that works in both ESM and CommonJS environments
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  console.log('Running PA regulations inspection...');
  
  // Compile TypeScript file first
  execSync('npx tsc --esModuleInterop --target es2020 --module commonjs --outDir ./temp server/inspect-pa-regulations.ts', { 
    stdio: 'inherit'
  });
  
  console.log('Compiled successfully, now running inspection...');
  
  // Run the compiled JS file
  execSync('node temp/server/inspect-pa-regulations.js', { 
    stdio: 'inherit'
  });
  
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
