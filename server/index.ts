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
import net from 'net'; // Added import for net module

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
let server: Server | null = null;

async function startServer(): Promise<Server> {
  try {
    // Kill any existing processes on port 5000 before starting
    try {
      const existingProcess = await new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', () => resolve(true))
          .once('listening', () => {
            tester.once('close', () => resolve(false)).close();
          })
          .listen(5000);
      });

      if (existingProcess) {
        log("Port 5000 is in use, attempting to free it...");
        // Try to close the server if we have a reference
        if (server) {
          await new Promise((resolve) => server?.close(resolve));
        }
      }
    } catch (error) {
      log("Error checking port status: " + error);
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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
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

    // Force port 5000 without fallbacks
    const PORT = 5000;
    log(`Starting server on port ${PORT}...`);

    return new Promise((resolve, reject) => {
      // Set timeout before starting server
      const timeoutId = setTimeout(() => {
        httpServer.close();
        reject(new Error("Server startup timed out"));
      }, 15000);

      // Start server with proper error handling
      httpServer
        .listen(PORT, "0.0.0.0")
        .once('listening', () => {
          clearTimeout(timeoutId);
          log(`Server successfully started on port ${PORT}`);
          resolve(httpServer);
        })
        .once('error', (err: NodeJS.ErrnoException) => {
          clearTimeout(timeoutId);
          if (err.code === 'EADDRINUSE') {
            log(`Error: Port ${PORT} is already in use. Please ensure no other process is using port ${PORT}`);
            process.exit(1);
          }
          reject(err);
        });
    });
  } catch (error) {
    log("Fatal error during server startup: " + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

// Graceful shutdown handler
const cleanup = () => {
  if (server) {
    server.close(() => {
      log("Server closed gracefully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => {
  log("Received SIGTERM signal, shutting down gracefully...");
  cleanup();
});

process.on('SIGINT', () => {
  log("Received SIGINT signal, shutting down gracefully...");
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