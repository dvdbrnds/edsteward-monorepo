/**
 * Authentication module entry point
 * Exports the main authentication setup function for single-tenant mode
 */

console.log('🔥 AUTH INDEX: Loading authentication module...');

import { configureAuth } from './single-tenant-auth';

console.log('🔥 AUTH INDEX: configureAuth imported successfully');

// Export configureAuth as setupAuth for compatibility with routes/index.ts
export { configureAuth as setupAuth };

console.log('🔥 AUTH INDEX: setupAuth exported successfully');

