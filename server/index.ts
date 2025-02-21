import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "@shared/schema";
import session from "express-session";
import { storage } from "./storage";
import passport from "passport";

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

async function startServer() {
  try {
    log("Starting server initialization...");

    // Test database connection
    try {
      log("Testing database connection...");
      await db.select().from(users).limit(1);
      log("Database connection successful");
    } catch (error) {
      log("Database connection failed: " + (error instanceof Error ? error.message : String(error)));
      throw new Error("Database connection failed - please check DATABASE_URL");
    }

    // Register routes and create server instance
    log("Registering routes...");
    server = registerRoutes(app);
    log("Routes registered successfully");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    // Setup Vite or static serving based on environment
    if (app.get("env") === "development") {
      log("Setting up Vite development server...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static serving setup complete");
    }

    let PORT = 5000;
    const MAX_PORT_ATTEMPTS = 10;

    // Try to find an available port
    async function findAvailablePort(startPort: number): Promise<number> {
      for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
        try {
          const temp = express().listen(port);
          await new Promise(resolve => temp.close(resolve));
          return port;
        } catch (err) {
          if (port === startPort + MAX_PORT_ATTEMPTS - 1) {
            throw err;
          }
          // Continue to next port
          continue;
        }
      }
      throw new Error('No available ports found');
    }

    // Find and set available port
    PORT = await findAvailablePort(PORT);

    // Start server with proper error handling
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error("Server instance not initialized"));
        return;
      }

      server.listen(PORT, "0.0.0.0", () => {
        log(`Server successfully started and listening on port ${PORT}`);
        log("Application initialization complete");
        resolve();
      }).on('error', (err: NodeJS.ErrnoException) => {
        reject(err);
      });
    });

    return server;
  } catch (error) {
    log("Fatal error during server startup: " + (error instanceof Error ? error.message : String(error)));
    if (server) {
      server.close(() => {
        log("Server closed due to startup error");
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
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