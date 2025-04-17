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
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { checkAndSendDeadlineNotifications } from './services/deadline-notifications';

const exec = promisify(execCallback);

// Initialize Express application with middleware
const app = express();

// Always parse JSON before any routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add X-Robots-Tag header to prevent search engine indexing
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Setup authentication AFTER JSON parsing
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

// Error handler specifically for JSON parsing errors
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// Enhanced logging middleware for API requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
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

// Declare server variable at module scope for proper cleanup
let server: Server | null = null;

// Session cleanup middleware - clears invalid sessions
app.use((req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    // Check for invalid user ID (not a number or NaN)
    if (typeof req.session.passport.user !== 'number' || isNaN(req.session.passport.user)) {
      console.log(`Invalid user ID in session, destroying session`);
      return req.session.destroy(err => {
        if (err) console.error('Session destruction error:', err);
        // Redirect to home page or login after destroying session
        return res.redirect('/');
      });
    }
  }
  next();
});

// Handle deserialization errors
app.use((err, req, res, next) => {
  if (err && err.message === 'Failed to deserialize user out of session') {
    console.log('Caught deserialization error, clearing session');
    // Check if the request expects JSON
    if (req.xhr || req.path.startsWith('/api/')) {
      return req.session.destroy(() => {
        return res.status(401).json({ error: "Session expired, please log in again" });
      });
    } else {
      return req.session.destroy(() => {
        return res.redirect('/');
      });
    }
  }
  next(err);
});

// API error handler - ensure JSON responses for API routes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
    console.error('API error:', err);
    return res.status(500).json({ 
      error: "Server error", 
      message: err.message || "Unknown error",
      path: req.path
    });
  }
  next(err);
});

let deadlineCheckInterval: NodeJS.Timeout | null = null;

async function startServer(): Promise<Server> {
  try {
    const PORT = 5000;
    log("Starting server initialization...");
    
    // Kill any existing processes more reliably
    try {
      await exec('pkill -f "node.*5000"');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore errors from pkill
    }

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
      try {
        log("Setting up Vite development server...");
        await setupVite(app, httpServer);
        log("Vite setup complete");
      } catch (error) {
        log("Error setting up Vite: " + (error instanceof Error ? error.message : String(error)));
        // Continue without Vite in case of error
        log("Falling back to static serving...");
        serveStatic(app);
      }
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static serving setup complete");
    }

    return new Promise((resolve, reject) => {
      // Clean any existing connections
      const cleanup = async () => {
        try {
          await exec('fuser -k 5000/tcp');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          // Ignore cleanup errors
        }
      };

      cleanup().then(() => {
        const server = httpServer.listen(PORT, "0.0.0.0", () => {
          log(`Server successfully started on port ${PORT}`);
          
          // Start deadline notification check interval after a delay
          log("Starting server successfully, will initialize deadline checker in 30 seconds...");
          setTimeout(() => {
            log("Initializing deadline notification checker...");
            deadlineCheckInterval = setInterval(async () => {
              try {
                await checkAndSendDeadlineNotifications();
                log("Deadline notifications check completed");
              } catch (error) {
                log("Error checking deadline notifications: " + error);
              }
            }, 60 * 60 * 1000); // Check every hour
          }, 30000); // Wait 30 seconds before starting the checker

          resolve(httpServer);
          })
          .once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              log(`Error: Port ${PORT} is already in use`);
              process.exit(1);
            }
            reject(err);
          });
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

export default app;