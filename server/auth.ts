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

// Add user cache
const userCache = new Map<number, {
  user: SelectUser;
  timestamp: number;
}>();

const CACHE_TTL = 60000; // 1 minute cache TTL

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
          await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, username, {
            reason: !user ? "user_not_found" : "invalid_password"
          });
          return done(null, false);
        } else {
          await syslog.logAuthEvent(LogLevel.INFO, "Successful login", user.id, username);
          return done(null, user);
        }
      } catch (error) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, username, { error });
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      // Check cache first
      const cached = userCache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return done(null, cached.user);
      }

      const user = await storage.getUser(id);
      if (!user) {
        await syslog.logAuthEvent(LogLevel.WARNING, "User not found during deserialization", undefined, undefined, { userId: id });
        return done(null, false);
      }

      // Update cache
      userCache.set(id, {
        user,
        timestamp: Date.now()
      });

      done(null, user);
    } catch (error) {
      await syslog.logAuthEvent(LogLevel.ERROR, "Deserialization error", undefined, undefined, { 
        userId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      done(error);
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

      await syslog.logAuthEvent(LogLevel.INFO, "New user registered", user.id, user.username);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      await syslog.logAuthEvent(LogLevel.ERROR, "Registration error", undefined, req.body.username);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, req.body.username);
        return next(err);
      }

      if (!user) {
        await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, req.body.username);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.login(user, async (err) => {
        if (err) {
          await syslog.logAuthEvent(LogLevel.ERROR, "Session creation error", user.id, user.username);
          return next(err);
        }

        // Update last login timestamp
        storage.updateUser(user.id, { lastLogin: new Date() })
          .then(() => {
            res.status(200).json(user);
          })
          .catch(error => {
            syslog.error("Failed to update last login timestamp", { userId: user.id, error });
            // Still return success to the user
            res.status(200).json(user);
          });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;

    // Clear user from cache on logout
    if (userId) {
      userCache.delete(userId);
    }

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