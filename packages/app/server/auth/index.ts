/**
 * Authentication module entry point
 * Exports the main authentication setup function for single-tenant mode
 */


import { configureAuth } from './single-tenant-auth';


// Export configureAuth as setupAuth for compatibility with routes/index.ts
export { configureAuth as setupAuth };


