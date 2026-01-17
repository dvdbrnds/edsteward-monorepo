import { Server } from 'http';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { testDatabaseConnection, ensureDatabaseSchema } from './config/database';
import { config, isDevelopment } from './config/environment';
import { createApp } from './app';
import { registerRoutes } from './routes/index';
import { setupVite, serveStatic, log } from './vite';
import { checkAndSendDeadlineNotifications } from './services/deadline-notifications';
import { databaseHealthMonitor } from './services/database-health';
import { initializeTenantRegistry, closeTenantRegistry } from './services/tenant-registry';

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

    // In production, skip database connection test to get app running
    // We'll handle database errors gracefully in the routes
    if (isDevelopment) {
      await testDatabaseConnection();
      
      await ensureDatabaseSchema();
    } else {
      
      // Auto-initialize database schema in production
      try {
        const { initializeDatabase } = await import('./db-init');
        const result = await initializeDatabase();
      } catch (error) {
        console.error("❌ Database auto-initialization failed:", error);
      }
    }

    // Initialize dynamic tenant registry (loads from admin database)
    log("Initializing tenant registry...");
    try {
      await initializeTenantRegistry();
      log("Tenant registry initialized successfully");
    } catch (error) {
      console.error("Failed to initialize tenant registry:", error);
      log("Tenant registry initialization failed, using fallback tenants");
    }

    // Create Express app with all middleware
    const app = createApp();

    // Register routes FIRST, before static serving
    log("Registering routes...");
    const httpServer = registerRoutes(app);
    log("Routes registered successfully");

    // Setup Vite or static serving based on environment AFTER routes
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
        console.error("Error setting up Vite:", error);
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
          // Close tenant registry connection
          await closeTenantRegistry();
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
        
        // Start database health monitoring
        try {
          databaseHealthMonitor.startMonitoring().then(() => {
          }).catch((error) => {
            console.error('Error starting database health monitoring:', error);
          });
        } catch (error) {
          console.error('Error starting database health monitoring:', error);
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
  // Stop database health monitoring
  databaseHealthMonitor.stopMonitoring().catch(console.error);
  if (server) {
    server.close();
    server = null;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup); 