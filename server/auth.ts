import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { getTenantStorage } from "./services/multi-tenant-database";
import { User as SelectUser } from "@shared/schema";
import { syslog, LogLevel } from "./services/syslog";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Export the hashPassword function
export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  return await bcrypt.compare(supplied, stored);
}

// Get tenant-aware storage for user operations
function getTenantAwareStorage(req: any) {
  const tenantId = req.tenantId || req.tenant?.id;
  return tenantId ? getTenantStorage(tenantId) : storage;
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
        // Use tenant-aware storage for user lookup
        const tenantStorage = getTenantAwareStorage(req);
        const user = await tenantStorage.getUserByUsername(username);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt", undefined, username, {
            tenantId: req.tenantId,
            subdomain: req.tenant?.subdomain
          });
          return done(null, false);
        }
        
        await syslog.logAuthEvent(LogLevel.INFO, "Login successful", user.id, username, {
          tenantId: req.tenantId,
          subdomain: req.tenant?.subdomain
        });
        return done(null, user);
      } catch (error) {
        await syslog.logAuthEvent(LogLevel.ERROR, "Login error", undefined, username, {
          tenantId: req.tenantId,
          error: error instanceof Error ? error.message : String(error)
        });
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

      // Note: For deserialization, we need to check all tenants since we don't have req context
      // This is a limitation - in production, we'd store tenantId in session
      let user = await storage.getUser(id);
      
      if (!user) {
        // Try checking tenant storages
        const tenantStorages = ['admin', 'moravian', 'test'];
        for (const tenantId of tenantStorages) {
          try {
            const tenantStorage = getTenantStorage(tenantId);
            user = await tenantStorage.getUser(id);
            if (user) break;
          } catch (error) {
            // Continue to next tenant
          }
        }
      }

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
      // Use tenant-aware storage for user operations
      const tenantStorage = getTenantAwareStorage(req);
      
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

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
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

      req.login(user, async (err) => {
        if (err) {
          await syslog.logAuthEvent(LogLevel.ERROR, "Session creation error", user.id, user.username, {
            tenantId: req.tenantId,
            error: err.message
          });
          return res.status(500).json({ error: "Session creation failed", details: err.message });
        }

        // Debug session state after login
        console.log('🔍 Session Debug After Login:', {
          sessionId: req.sessionID,
          hasSession: !!req.session,
          sessionKeys: req.session ? Object.keys(req.session) : [],
          passportUser: req.session?.passport?.user,
          isAuthenticated: req.isAuthenticated(),
          tenantId: req.tenantId,
          subdomain: req.tenant?.subdomain,
          setCookieHeader: res.getHeaders()['set-cookie']
        });

        try {
          // Use tenant-aware storage for user update
          const tenantStorage = getTenantAwareStorage(req);
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
              console.log('✅ Session saved successfully');
            }
            res.status(200).json(user);
          });
        } catch (error) {
          await syslog.error("Failed to update last login timestamp", { 
            userId: user.id, 
            tenantId: req.tenantId,
            error 
          });
          // Still return success to the user
          res.status(200).json(user);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Include tenant info in user response
    const userWithTenant = {
      ...req.user,
      tenantId: req.tenantId,
      subdomain: req.tenant?.subdomain
    };
    
    res.json(userWithTenant);
  });
}