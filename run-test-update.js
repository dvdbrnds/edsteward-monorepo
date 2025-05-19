/**
 * Script to run the test update creator
 */

import { execSync } from 'child_process';

try {
  console.log('Creating test regulation update for differential view testing...');
  execSync('tsx server/create-test-update.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('Error running test update creator:', error);
}