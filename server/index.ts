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

// Declare server variable at module scope for proper cleanup
let server: ReturnType<typeof app.listen> | null = null;

// Get available port with enhanced logging
const getAvailablePort = async (preferredPort: number, fallbackPorts: number[]): Promise<number> => {
  const tryPort = (port: number): Promise<number> => {
    log(`Attempting to bind to port ${port}...`);
    return new Promise((resolve, reject) => {
      const testServer = app.listen(port, "0.0.0.0", () => {
        log(`Successfully bound to port ${port}`);
        testServer.close(() => {
          log(`Released port ${port} for main server`);
          resolve(port);
        });
      }).on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} is in use, will try next port`);
          reject(new Error(`Port ${port} is in use`));
        } else {
          log(`Error binding to port ${port}: ${err.message}`);
          reject(err);
        }
      });

      // Add timeout to prevent hanging
      setTimeout(() => {
        testServer.close();
        reject(new Error(`Timeout while trying to bind to port ${port}`));
      }, 5000);
    });
  };

  log(`Preferred port from environment: ${preferredPort}`);
  try {
    return await tryPort(preferredPort);
  } catch (error) {
    log(`Failed to bind to preferred port ${preferredPort}, trying fallback ports`);
    for (const port of fallbackPorts) {
      try {
        return await tryPort(port);
      } catch (error) {
        continue;
      }
    }
    throw new Error("No available ports found in range");
  }
};

async function startServer() {
  try {
    log("Starting server initialization...");
    log(`Environment: ${process.env.NODE_ENV}`);
    log(`Current working directory: ${process.cwd()}`);

    // Test database connection
    try {
      log("Testing database connection...");
      await db.execute(sql`SELECT 1`);
      log("Database connection successful");
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Initialize server
    server = app.listen();

    // Register routes before setting up static/Vite middleware
    log("Registering routes...");
    registerRoutes(app);
    log("Routes registered successfully");


    // Setup Vite or static serving based on environment
    if (process.env.NODE_ENV !== "production") {
      log("Setting up Vite development server...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving...");
      const buildPath = path.join(process.cwd(), "client", "dist");
      if (!fs.existsSync(buildPath)) {
        log(`Warning: Build directory not found at ${buildPath}`);
        log("Creating build directory...");
        fs.mkdirSync(buildPath, { recursive: true });
      }
      app.use(express.static(buildPath));
      log("Static serving setup complete");
    }

    // Port configuration with timeout handling
    const preferredPort = parseInt(process.env.PORT || "3001", 10);
    const fallbackPorts = [3002, 3003, 3004, 3005];

    try {
      const port = await getAvailablePort(preferredPort, fallbackPorts);
      if (!server) {
        throw new Error("Server instance not initialized");
      }

      // Start the server with timeout
      const serverStartPromise = new Promise<void>((resolve, reject) => {
        if (!server) {
          reject(new Error("Server instance not initialized"));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error("Server startup timed out after 15 seconds"));
        }, 15000);

        server.listen(port, "0.0.0.0", () => {
          clearTimeout(timeoutId);
          log(`Server successfully started and listening on port ${port}`);
          log("Application initialization complete");
          resolve();
        }).on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      await serverStartPromise;
      return server;
    } catch (error) {
      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    log("Fatal error during server startup: " + (error instanceof Error ? error.message : String(error)));
    if (server) {
      server.close();
    }
    throw error;
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  log("Received SIGTERM signal, shutting down gracefully...");
  if (server) {
    server.close(() => {
      log("Server closed gracefully on SIGTERM");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  log("Received SIGINT signal, shutting down gracefully...");
  if (server) {
    server.close(() => {
      log("Server closed gracefully on SIGINT");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Start the server with error handling
startServer().catch((error) => {
  log("Unhandled error during server startup: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});