import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { syslog, LogLevel } from "./services/syslog";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID!,
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax"
    },
    store: storage.sessionStore,
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`Deserializing user with ID: ${id}`);
      
      // Check if ID is valid
      if (!id || isNaN(id)) {
        console.error(`Invalid user ID during deserialization: ${id}`);
        return done(null, false);
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        console.error(`User with ID ${id} not found during deserialization`);
        return done(null, false);
      }
      
      console.log(`User deserialized successfully: ${user.id}, ${user.username}, First: ${user.firstName || 'N/A'}, Last: ${user.lastName || 'N/A'}`);
      
      // Check if user has complete profile
      if (!user.firstName || !user.lastName) {
        console.warn(`User ${user.username} has incomplete profile (missing name information)`);
      }
      
      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user ${id}:`, error);
      // Instead of throwing an error that crashes the request, return false
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    // Check for content type to ensure proper handling
    if (!req.is('application/json')) {
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }
    
    // Wrap the passport authenticate in try/catch to handle any exceptions
    try {
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          syslog.authEvent(LogLevel.ERROR, "Login error", undefined, req.body.username);
          return res.status(500).json({ error: "Authentication error", details: err.message });
        }
        
        if (!user) {
          syslog.authEvent(LogLevel.WARNING, "Failed login attempt", undefined, req.body.username);
          return res.status(401).json({ error: "Invalid credentials" });
        }

        req.login(user, (err) => {
          if (err) {
            syslog.authEvent(LogLevel.ERROR, "Session creation error", user.id, user.username);
            return res.status(500).json({ error: "Session creation failed", details: err.message });
          }
          
          // Update last login timestamp
          storage.updateUser(user.id, { lastLogin: new Date() })
            .then(() => {
              syslog.authEvent(LogLevel.INFO, "User logged in successfully", user.id, user.username);
              res.status(200).json(user);
            })
            .catch(error => {
              syslog.error("Failed to update last login timestamp", { userId: user.id, error });
              // Still return success to the user
              res.status(200).json(user);
            });
        });
      })(req, res, next);
    } catch (error) {
      console.error("Unexpected error in login route:", error);
      return res.status(500).json({ error: "Internal server error during login" });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    
    req.logout((err) => {
      if (err) {
        syslog.authEvent(LogLevel.ERROR, "Logout error", userId, username);
        return next(err);
      }
      syslog.authEvent(LogLevel.INFO, "User logged out", userId, username);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}