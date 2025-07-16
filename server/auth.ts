import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { storage } from "./storage";
import { getDatabaseStorage } from "./services/database";
import { User as SelectUser } from "@shared/schema";
import { syslog, LogLevel } from "./services/syslog";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

// Convert scrypt to async/await
const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt (Node.js built-in, no external dependencies)
 * @param password - Plain text password
 * @returns Promise<string> - Hashed password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 32) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a hash
 * @param supplied - Plain text password
 * @param stored - Hashed password from database
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(supplied: string, stored: string): Promise<boolean> {
  // Only support scrypt hashes - no more bcrypt compatibility
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) {
    console.error('Invalid password hash format - expected salt:hash');
    return false;
  }

  try {
    const derivedKey = await scryptAsync(supplied, salt, 32) as Buffer;
    const storedKey = Buffer.from(hash, 'hex');
    return timingSafeEqual(derivedKey, storedKey);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

// Single-tenant storage for user operations
function getSingleTenantStorage() {
  return getDatabaseStorage();
}

export function setupAuth(app: Express) {
  // Note: Session middleware is already configured in app.ts
  // We only need to set up passport here

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  // Passport middleware is already configured in app.ts
  // We only need to configure the strategies here

  passport.use(
    new LocalStrategy({ passReqToCallback: true }, async (req: any, username: string, password: string, done) => {
      try {
        // Use single-tenant storage for user lookup
        const tenantStorage = getSingleTenantStorage();
        const user = await tenantStorage.getUserByUsername(username);

        if (!user || !(await verifyPassword(password, user.password))) {
          await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, username, {});
          return done(null, false);
        }

        await syslog.logAuthEvent(LogLevel.INFO, "Login successful", user.id, username, {});
        return done(null, user);
      } catch (error) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, username, {
          error: error instanceof Error ? error.message : String(error)
        });
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    // Single-tenant: Store only user ID in session
    done(null, user.id);
  });

  passport.deserializeUser(async (userId: number, done) => {
    try {
      if (!userId || isNaN(userId)) {
        console.error(`Invalid user ID during deserialization: ${userId}`);
        return done(null, false);
      }

      // Use single-tenant storage for user lookup
      const tenantStorage = getSingleTenantStorage();
      const user = await tenantStorage.getUser(userId);

      if (!user) {
        console.error(`User ${userId} not found during deserialization`);
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user:`, error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Use single-tenant storage for user operations
      const tenantStorage = getSingleTenantStorage();

      const existingUser = await tenantStorage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists in this tenant" });
      }

      // Check for existing email in this tenant
      if (req.body.email) {
        const existingEmailUser = await tenantStorage.getUserByEmail(req.body.email);
        if (existingEmailUser) {
          return res.status(400).json({ error: "Email already exists in this tenant" });
        }
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await tenantStorage.createUser({
        ...req.body,
        password: hashedPassword,
        role: req.body.role.toLowerCase(),
        tenantId: req.tenantId || req.tenant?.id // Store tenant association
      });

      await syslog.logAuthEvent(LogLevel.INFO, "User registered successfully", user.id, user.username, {
        tenantId: req.tenantId,
        subdomain: req.tenant?.subdomain
      });

      // Context7 Multi-Tenant Fix: Attach tenant context to user before login
      (user as any).tenantId = req.tenantId || 'admin';

      req.login(user, (err) => {
        if (err) return next(err);

        // Return user with tenant context
        const userWithTenant = {
          ...user,
          tenantId: req.tenantId,
          subdomain: req.tenant?.subdomain
        };
        res.status(201).json(userWithTenant);
      });
    } catch (error) {
      await syslog.logAuthEvent(LogLevel.ERROR, "Registration error", undefined, req.body.username, {
        tenantId: req.tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    if (!req.is('application/json')) {
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }

    passport.authenticate("local", async (err: Error | null, user: SelectUser | false, info: any) => {
      if (err) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, req.body.username, {
          tenantId: req.tenantId,
          error: err.message
        });
        return res.status(500).json({ error: "Authentication error", details: err.message });
      }

      if (!user) {
        await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, req.body.username, {
          tenantId: req.tenantId,
          subdomain: req.tenant?.subdomain
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Context7 Multi-Tenant Fix: Attach tenant context to user before login
      (user as any).tenantId = req.tenantId || 'admin';

      req.login(user, async (err) => {
        if (err) {
          await syslog.logAuthEvent(LogLevel.ERROR, "Session creation error", user.id, user.username, {
            tenantId: req.tenantId,
            error: err.message
          });
          return res.status(500).json({ error: "Session creation failed", details: err.message });
        }

        // Debug session state after login
        console.log('🔍 Context7 Multi-Tenant Session Debug After Login:', {
          sessionId: req.sessionID,
          hasSession: !!req.session,
          sessionKeys: req.session ? Object.keys(req.session) : [],
          passportUser: req.session?.passport?.user,
          isAuthenticated: req.isAuthenticated(),
          tenantId: req.tenantId,
          subdomain: req.tenant?.subdomain,
          userTenantId: (user as any).tenantId,
          setCookieHeader: res.getHeaders()['set-cookie']
        });

        try {
          // Use single-tenant storage for user update
          const tenantStorage = getSingleTenantStorage();
          await tenantStorage.updateUser(user.id, { lastLogin: new Date() });

          await syslog.logAuthEvent(LogLevel.INFO, "User logged in successfully", user.id, user.username, {
            tenantId: req.tenantId,
            subdomain: req.tenant?.subdomain
          });

          // Store tenant info in session for future requests
          if (req.session && req.tenantId) {
            req.session.tenantId = req.tenantId;
          }

          // Force session save before responding
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('❌ Session save error:', saveErr);
            } else {
              console.log('✅ Session saved successfully with tenant context');
            }

            // Return user with tenant context
            const userWithTenant = {
              ...user,
              tenantId: req.tenantId,
              subdomain: req.tenant?.subdomain
            };
            res.status(200).json(userWithTenant);
          });
        } catch (error) {
          await syslog.error("Failed to update last login timestamp", {
            userId: user.id,
            tenantId: req.tenantId,
            error
          });
          // Still return success to the user with tenant context
          const userWithTenant = {
            ...user,
            tenantId: req.tenantId,
            subdomain: req.tenant?.subdomain
          };
          res.status(200).json(userWithTenant);
        }
      });
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const tenantId = req.tenantId || req.session?.tenantId;

    req.logout((err) => {
      if (err) {
        syslog.logAuthEvent(LogLevel.ERROR, "Logout error", userId, username, {
          tenantId,
          error: err.message
        });
        return next(err);
      }

      // Clear tenant info from session
      if (req.session) {
        delete req.session.tenantId;
      }

      syslog.logAuthEvent(LogLevel.INFO, "User logged out", userId, username, {
        tenantId
      });
      res.status(200).json({ success: true, message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Include tenant info in user response
    const userWithTenant = {
      ...req.user,
      tenantId: (req as any).tenantId,
      subdomain: (req as any).tenant?.subdomain
    };

    res.json(userWithTenant);
  });
}