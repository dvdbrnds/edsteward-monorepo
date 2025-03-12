
// CommonJS script for two-step TypeScript execution
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  console.log('Compiling inspect-pa-regulations.ts to JavaScript...');
  
  // Ensure the temp directory exists
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Compile TypeScript to JavaScript (targeting CommonJS for maximum compatibility)
  execSync('npx tsc --allowJs --esModuleInterop --resolveJsonModule --target es2020 --module commonjs --outDir ./temp server/inspect-pa-regulations.ts', { 
    stdio: 'inherit'
  });
  
  console.log('Running compiled JavaScript file...');
  
  // Run the compiled JavaScript file
  execSync('node ./temp/server/inspect-pa-regulations.js', { 
    stdio: 'inherit'
  });
  
  console.log('Successfully completed PA regulations inspection!');
} catch (error) {
  console.error('Error:', error.message);
  if (error.stdout) console.error('stdout:', error.stdout.toString());
  if (error.stderr) console.error('stderr:', error.stderr.toString());
  process.exit(1);
}
