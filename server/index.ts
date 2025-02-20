import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "@shared/schema";
import session from "express-session";
import { storage } from "./storage";
import passport from "passport";

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

// Enhanced logging middleware
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

    log("Registering routes...");
    const server = registerRoutes(app);
    log("Routes registered successfully");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      log("Setting up Vite development server...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static serving setup complete");
    }

    // Try ports in sequence until one works
    const ports = [5000, 5001, 5002, 5003];
    let port: number | null = null;

    for (const testPort of ports) {
      try {
        await new Promise((resolve, reject) => {
          server.listen(testPort, "0.0.0.0", () => {
            port = testPort;
            resolve(true);
          }).on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              log(`Port ${testPort} is in use, trying next port...`);
              resolve(false);
            } else {
              reject(err);
            }
          });
        });

        if (port) break;
      } catch (err) {
        log(`Error trying port ${testPort}: ${err}`);
      }
    }

    if (!port) {
      throw new Error("Could not find an available port");
    }

    log(`Server successfully started and listening on port ${port}`);
    log("Application initialization complete");

    return server;
  } catch (error) {
    log("Fatal error during server startup: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  log("Unhandled error during server startup: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});