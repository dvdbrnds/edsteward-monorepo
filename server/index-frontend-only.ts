import { startServer } from './server-frontend-only';

// Start the frontend-only server
startServer().catch((error) => {
  console.error('Failed to start frontend-only server:', error);
  process.exit(1);
}); 