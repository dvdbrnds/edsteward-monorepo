import { Server } from 'http';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { testDatabaseConnection, ensureDatabaseSchema } from './config/database';
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
  console.log('=== EDSTEWARD SERVER STARTUP v1.20 ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', config.PORT);
  console.log('isDevelopment:', isDevelopment);
  console.log('🔍 CRITICAL DEBUG: This is the NEW v1.19 server code!');
  
  try {
    console.log("Starting server initialization...");
    log("Starting server initialization...");
    
    // Kill any existing processes more reliably
    try {
      await exec('pkill -f "node.*3001"');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore errors from pkill
    }

    console.log("Testing database connection...");
    // In production, skip database connection test to get app running
    // We'll handle database errors gracefully in the routes
    if (isDevelopment) {
      await testDatabaseConnection();
      console.log("Database connection successful!");
      
      console.log("Ensuring database schema...");
      await ensureDatabaseSchema();
      console.log("Database schema ensured!");
    } else {
      console.log("⚠️  Skipping database connection test in production");
      console.log("Database connections will be tested on first request");
      console.log("⚠️  Also skipping database schema check in production");
      console.log("Application will start without database dependency");
    }

    console.log("Creating Express app...");
    // Create Express app with all middleware
    const app = createApp();
    console.log("Express app created successfully!");

    // Register routes
    console.log("Registering routes...");
    log("Registering routes...");
    const httpServer = registerRoutes(app);
    console.log("Routes registered successfully!");
    log("Routes registered successfully");

    // Setup Vite or static serving based on environment
    if (!isDevelopment) {
      console.log("Setting up static file serving (production mode)...");
      log("Setting up static file serving...");
      serveStatic(app as any);
      console.log("Static serving setup complete!");
      log("Static serving setup complete");
    } else {
      try {
        console.log("Setting up Vite development server...");
        log("Setting up Vite development server...");
        await setupVite(app as any, httpServer);
        console.log("Vite setup complete!");
        log("Vite setup complete");
      } catch (error) {
        console.error("Error setting up Vite:", error);
        log("Error setting up Vite: " + (error instanceof Error ? error.message : String(error)));
        // Continue without Vite in case of error
        console.log("Falling back to static serving...");
        log("Falling back to static serving...");
        serveStatic(app as any);
      }
    }

    console.log("Starting HTTP server on port", config.PORT);
    return new Promise((resolve, reject) => {
      // Clean any existing connections
      const cleanup = async () => {
        try {
          console.log("Cleaning up server...");
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
        console.log(`🚀 SERVER SUCCESSFULLY STARTED ON PORT ${config.PORT}!`);
        console.log(`Server accessible at http://localhost:${config.PORT}`);
        log(`Server running on port ${config.PORT}`);
        
        // Start deadline checking after successful server start
        if (!deadlineCheckInterval) {
          console.log("Starting deadline notification service...");
          deadlineCheckInterval = setInterval(async () => {
            try {
              await checkAndSendDeadlineNotifications();
            } catch (error) {
              console.error('Error checking deadlines:', error);
            }
          }, 60 * 60 * 1000); // Check every hour
          console.log("Deadline notification service started!");
        }
        
        resolve(httpServer);
      });

      server.on('error', (error) => {
        console.error('❌ SERVER ERROR:', error);
        cleanup().then(() => reject(error));
      });
    });
  } catch (error) {
    console.error('❌ FAILED TO START SERVER:', error);
    console.error('Error details:', error);
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