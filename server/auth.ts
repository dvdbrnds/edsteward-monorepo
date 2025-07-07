import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { getDatabaseStorage } from "./services/database";
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

// Single-tenant storage for user operations
function getTenantAwareStorage(req: any) {
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

  passport.serializeUser((user: any, done) => {
    // Context7 Multi-Tenant Fix: Store both user ID and tenant ID in session
    const sessionData = {
      userId: user.id,
      tenantId: user.tenantId || 'admin' // Include tenant context
    };
    done(null, sessionData);
  });

  passport.deserializeUser(async (sessionData: any, done) => {
    try {
      // Context7 Multi-Tenant Fix: Store both user ID and tenant ID in session
      let userId: number;
      let tenantId: string;
      
      if (typeof sessionData === 'object' && sessionData.userId && sessionData.tenantId) {
        // New format: { userId: number, tenantId: string }
        userId = sessionData.userId;
        tenantId = sessionData.tenantId;
      } else if (typeof sessionData === 'number') {
        // Legacy format: just user ID - try to determine tenant
        userId = sessionData;
        tenantId = 'admin'; // Default fallback
        console.warn(`Legacy session format detected for user ${userId}, defaulting to admin tenant`);
      } else {
        console.error(`Invalid session data during deserialization:`, sessionData);
        return done(null, false);
      }

      if (!userId || isNaN(userId)) {
        console.error(`Invalid user ID during deserialization: ${userId}`);
        return done(null, false);
      }

      // Use single-tenant storage for user lookup
      const tenantStorage = getDatabaseStorage();
      const user = await tenantStorage.getUser(userId);

      if (!user) {
        console.error(`User ${userId} not found in tenant ${tenantId} during deserialization`);
        return done(null, false);
      }

      // Attach tenant context to user object
      (user as any).tenantId = tenantId;
      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user:`, error);
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