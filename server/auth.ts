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

// Export the hashPassword function
export async function hashPassword(password: string) {
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
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, username);
          return done(null, false);
        }
        await syslog.logAuthEvent(LogLevel.INFO, "Login successful", user.id, username);
        return done(null, user);
      } catch (error) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, username);
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      if (!id || isNaN(id)) {
        console.error(`Invalid user ID during deserialization: ${id}`);
        return done(null, false);
      }

      const user = await storage.getUser(id);
      if (!user) {
        console.error(`User with ID ${id} not found during deserialization`);
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user ${id}:`, error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        role: req.body.role.toLowerCase(),
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
    if (!req.is('application/json')) {
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }

    passport.authenticate("local", async (err: Error | null, user: SelectUser | false, info: any) => {
      if (err) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, req.body.username);
        return res.status(500).json({ error: "Authentication error", details: err.message });
      }

      if (!user) {
        await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, req.body.username);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.login(user, async (err) => {
        if (err) {
          await syslog.logAuthEvent(LogLevel.ERROR, "Session creation error", user.id, user.username);
          return res.status(500).json({ error: "Session creation failed", details: err.message });
        }

        try {
          await storage.updateUser(user.id, { lastLogin: new Date() });
          await syslog.logAuthEvent(LogLevel.INFO, "User logged in successfully", user.id, user.username);
          res.status(200).json(user);
        } catch (error) {
          await syslog.error("Failed to update last login timestamp", { userId: user.id, error });
          // Still return success to the user
          res.status(200).json(user);
        }
      });
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;

    req.logout((err) => {
      if (err) {
        syslog.logAuthEvent(LogLevel.ERROR, "Logout error", userId, username);
        return next(err);
      }
      syslog.logAuthEvent(LogLevel.INFO, "User logged out", userId, username);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}