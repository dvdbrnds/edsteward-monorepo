import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "@shared/schema";
import session from "express-session";
import { storage } from "./storage";
import passport from "passport";
import path from 'path';
import fs from 'fs';
import { sql } from 'drizzle-orm';
import { Server } from 'http';
import net from 'net';
import { checkAndSendDeadlineNotifications } from './services/deadline-notifications';

// Initialize Express application with middleware
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(
  session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Initialize passport after session
app.use(passport.initialize());
app.use(passport.session());

// Enhanced logging middleware for API requests
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });
  next();
});

// Check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} is in use`);
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);

    // Add timeout to avoid hanging
    setTimeout(() => {
      try {
        tester.close();
      } catch (e) {
        // Ignore close errors
      }
      resolve(true);
    }, 1000);
  });
}

// Declare server variable at module scope for proper cleanup
let server: Server | null = null;
let deadlineCheckInterval: NodeJS.Timeout | null = null;

async function startServer(): Promise<Server> {
  try {
    const PORT = 5000;
    log("Checking port status...");

    // Check if port is in use
    const portInUse = await isPortInUse(PORT);
    if (portInUse) {
      log(`Port ${PORT} is in use. Exiting process...`);
      process.exit(1);
    }

    log("Starting server initialization...");

    // Test database connection with retries
    let dbConnected = false;
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await db.execute(sql`SELECT 1`);
        dbConnected = true;
        log("Database connection successful");
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`Database connection failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        log(`Database connection attempt ${i + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!dbConnected) {
      throw new Error("Unable to establish database connection");
    }

    // Register routes first
    log("Registering routes...");
    const httpServer = registerRoutes(app);
    log("Routes registered successfully");

    // Setup Vite or static serving based on environment
    if (process.env.NODE_ENV !== "production") {
      log("Setting up Vite development server...");
      await setupVite(app, httpServer);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static serving setup complete");
    }

    return new Promise((resolve, reject) => {
      // Set timeout for server startup
      const timeoutId = setTimeout(() => {
        log("Server startup timed out");
        httpServer.close();
        process.exit(1);
      }, 10000);

      // Start server with proper error handling
      httpServer
        .listen(PORT, "0.0.0.0")
        .once('listening', () => {
          clearTimeout(timeoutId);
          log(`Server successfully started on port ${PORT}`);

          // Start deadline notification check interval
          log("Starting deadline notification checker...");
          deadlineCheckInterval = setInterval(async () => {
            try {
              await checkAndSendDeadlineNotifications();
              log("Deadline notifications check completed");
            } catch (error) {
              log("Error checking deadline notifications: " + error);
            }
          }, 60 * 60 * 1000); // Check every hour

          resolve(httpServer);
        })
        .once('error', (err: NodeJS.ErrnoException) => {
          clearTimeout(timeoutId);
          if (err.code === 'EADDRINUSE') {
            log(`Error: Port ${PORT} is already in use`);
            process.exit(1);
          }
          reject(err);
        });
    });
  } catch (error) {
    log("Fatal error during server startup: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

// Graceful shutdown handler
function cleanup() {
  log("Starting cleanup process...");

  // Clear the deadline check interval
  if (deadlineCheckInterval) {
    clearInterval(deadlineCheckInterval);
    log("Deadline check interval cleared");
  }

  if (server) {
    server.close(() => {
      log("Server closed gracefully");
      process.exit(0);
    });

    // Force exit after 3 seconds if graceful shutdown fails
    setTimeout(() => {
      log("Forcing process exit after timeout");
      process.exit(1);
    }, 3000);
  } else {
    process.exit(0);
  }
}

// Handle termination signals
process.on('SIGTERM', () => {
  log("Received SIGTERM signal");
  cleanup();
});

process.on('SIGINT', () => {
  log("Received SIGINT signal");
  cleanup();
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  log("Unhandled rejection: " + String(reason));
  cleanup();
});

// Start the server
startServer()
  .then((httpServer) => {
    server = httpServer;
    log("Server startup complete");
  })
  .catch((error) => {
    log("Unhandled error during server startup: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });