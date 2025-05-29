import { Server } from 'http';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { testDatabaseConnection } from './config/database';
import { config, isDevelopment } from './config/environment';
import { createApp } from './app';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { checkAndSendDeadlineNotifications } from './services/deadline-notifications';

const exec = promisify(execCallback);

// Declare server variable at module scope for proper cleanup
let server: Server | null = null;
let deadlineCheckInterval: NodeJS.Timeout | null = null;

export async function startServer(): Promise<Server> {
  try {
    log("Starting server initialization...");
    
    // Kill any existing processes more reliably
    try {
      await exec('pkill -f "node.*3001"');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore errors from pkill
    }

    // Test database connection
    await testDatabaseConnection();

    // Create Express app with all middleware
    const app = createApp();

    // Register routes
    log("Registering routes...");
    const httpServer = registerRoutes(app);
    log("Routes registered successfully");

    // Setup Vite or static serving based on environment
    if (!isDevelopment) {
      log("Setting up static file serving...");
      serveStatic(app as any);
      log("Static serving setup complete");
    } else {
      try {
        log("Setting up Vite development server...");
        await setupVite(app as any, httpServer);
        log("Vite setup complete");
      } catch (error) {
        log("Error setting up Vite: " + (error instanceof Error ? error.message : String(error)));
        // Continue without Vite in case of error
        log("Falling back to static serving...");
        serveStatic(app as any);
      }
    }

    return new Promise((resolve, reject) => {
      // Clean any existing connections
      const cleanup = async () => {
        try {
          if (deadlineCheckInterval) {
            clearInterval(deadlineCheckInterval);
            deadlineCheckInterval = null;
          }
          if (server) {
            server.close();
            server = null;
          }
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      };

      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);
      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        cleanup().then(() => process.exit(1));
      });

      server = httpServer.listen(config.PORT, () => {
        log(`Server running on port ${config.PORT}`);
        
        // Start deadline checking after successful server start
        if (!deadlineCheckInterval) {
          deadlineCheckInterval = setInterval(async () => {
            try {
              await checkAndSendDeadlineNotifications();
            } catch (error) {
              console.error('Error checking deadlines:', error);
            }
          }, 60 * 60 * 1000); // Check every hour
        }
        
        resolve(httpServer);
      });

      server.on('error', (error) => {
        console.error('Server error:', error);
        cleanup().then(() => reject(error));
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

function cleanup() {
  if (deadlineCheckInterval) {
    clearInterval(deadlineCheckInterval);
    deadlineCheckInterval = null;
  }
  if (server) {
    server.close();
    server = null;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup); 