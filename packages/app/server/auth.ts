import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
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

// Account lockout tracking — persisted to the tenant database so it survives restarts
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

async function ensureLoginAttemptsTable(tenantId: string): Promise<void> {
  const { getDatabaseStorage } = await import('./services/database');
  const storage = getDatabaseStorage(tenantId);
  await (storage as any).pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(username)
    )
  `);
}

async function isAccountLocked(tenantId: string, username: string): Promise<boolean> {
  try {
    const { getDatabaseStorage } = await import('./services/database');
    const storage = getDatabaseStorage(tenantId);
    await ensureLoginAttemptsTable(tenantId);
    const result = await (storage as any).pool.query(
      `SELECT locked_until FROM login_attempts WHERE username = $1`,
      [username]
    );
    if (result.rows.length === 0) return false;
    const lockedUntil = result.rows[0].locked_until;
    if (!lockedUntil) return false;
    if (new Date() > new Date(lockedUntil)) {
      await (storage as any).pool.query(`DELETE FROM login_attempts WHERE username = $1`, [username]);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function recordFailedLogin(tenantId: string, username: string): Promise<{ locked: boolean; attemptsRemaining: number }> {
  const { getDatabaseStorage } = await import('./services/database');
  const storage = getDatabaseStorage(tenantId);
  await ensureLoginAttemptsTable(tenantId);
  const pool = (storage as any).pool;

  const result = await pool.query(`
    INSERT INTO login_attempts (username, failed_count, updated_at)
    VALUES ($1, 1, NOW())
    ON CONFLICT (username) DO UPDATE SET
      failed_count = login_attempts.failed_count + 1,
      updated_at = NOW()
    RETURNING failed_count
  `, [username]);

  const count = result.rows[0].failed_count;

  if (count >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await pool.query(
      `UPDATE login_attempts SET locked_until = $1 WHERE username = $2`,
      [lockedUntil, username]
    );
    return { locked: true, attemptsRemaining: 0 };
  }

  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - count };
}

async function clearFailedLogins(tenantId: string, username: string): Promise<void> {
  try {
    const { getDatabaseStorage } = await import('./services/database');
    const storage = getDatabaseStorage(tenantId);
    await ensureLoginAttemptsTable(tenantId);
    await (storage as any).pool.query(`DELETE FROM login_attempts WHERE username = $1`, [username]);
  } catch {
    // non-critical
  }
}

/**
 * Hash a password using scrypt (Node.js built-in, no external dependencies)
 * @param password - Plain text password
 * @returns Promise<string> - Hashed password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 32) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
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
    const derivedKey = await scryptAsync(supplied, Buffer.from(salt, 'hex'), 32) as Buffer;
    const storedKey = Buffer.from(hash, 'hex');
    return timingSafeEqual(derivedKey, storedKey);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

// Tenant-aware storage helper
function getTenantStorage(req: any) {
  // Get tenantId from request (set by tenant middleware) or default
  const tenantId = req?.tenantId || 'default';
  return getDatabaseStorage(tenantId);
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
        // MULTI-TENANT FIX: Get tenantId from request (set by tenant middleware)
        const tenantId = req.tenantId || 'default';
        console.log(`[AUTH] Login attempt for user '${username}' in tenant '${tenantId}'`);
        
        // Account lockout check (HECVAT PROD-03)
        if (await isAccountLocked(tenantId, username)) {
          await syslog.logAuthEvent(LogLevel.WARNING, "Login rejected - account locked due to failed attempts", undefined, username, { tenantId });
          return done(null, false, { message: `Account temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.` });
        }
        
        // Use tenant-aware storage for user lookup
        const tenantStorage = getDatabaseStorage(tenantId);
        const user = await tenantStorage.getUserByUsername(username);

        if (!user) {
          const lockResult = await recordFailedLogin(tenantId, username);
          await syslog.logAuthEvent(LogLevel.WARNING, "Failed login attempt - user not found", undefined, username, { tenantId, attemptsRemaining: lockResult.attemptsRemaining });
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
          const lockResult = await recordFailedLogin(tenantId, username);
          await syslog.logAuthEvent(LogLevel.WARNING, `Failed login attempt - wrong password (${lockResult.attemptsRemaining} attempts remaining)`, undefined, username, { tenantId, locked: lockResult.locked });
          if (lockResult.locked) {
            return done(null, false, { message: `Account temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.` });
          }
          return done(null, false, { message: 'Invalid credentials' });
        }

        // Successful login - clear failed attempts
        await clearFailedLogins(tenantId, username);

        // CRITICAL: Attach tenantId to user for session serialization
        // This ensures the session is tied to the tenant where login occurred
        (user as any)._tenantId = tenantId;

        await syslog.logAuthEvent(LogLevel.INFO, "Login successful", user.id, username, { tenantId });
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
    // MULTI-TENANT FIX: Store user ID and tenant ID together to prevent cross-tenant session hijacking
    // The tenantId is attached to user during login in the LocalStrategy
    const sessionData = {
      userId: user.id,
      tenantId: user._tenantId || 'default', // Tenant ID set during login
    };
    done(null, sessionData);
  });

  passport.deserializeUser(async (sessionData: any, done) => {
    try {
      // Handle both old format (just userId) and new format (object with userId and tenantId)
      let userId: number;
      let sessionTenantId: string;
      
      if (typeof sessionData === 'object' && sessionData.userId) {
        userId = sessionData.userId;
        sessionTenantId = sessionData.tenantId || 'default';
      } else {
        // Legacy format - just user ID
        userId = sessionData as number;
        sessionTenantId = 'default';
      }
      
      if (!userId || isNaN(userId)) {
        console.error(`Invalid user ID during deserialization: ${userId}`);
        return done(null, false);
      }

      // CRITICAL: Use tenant-aware storage for user lookup
      // Pass the session's tenantId to get the correct database
      const tenantStorage = getDatabaseStorage(sessionTenantId);
      const user = await tenantStorage.getUser(userId);

      if (!user) {
        console.error(`User ${userId} not found in tenant ${sessionTenantId} during deserialization`);
        return done(null, false);
      }

      // Attach tenant info to user for downstream use
      (user as any)._sessionTenantId = sessionTenantId;

      done(null, user);
    } catch (error) {
      console.error(`Error deserializing user:`, error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Use tenant-aware storage for user operations
      const tenantStorage = getTenantStorage(req);

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

      // MULTI-TENANT FIX: Attach tenant context to user before login (for session serialization)
      (user as any).tenantId = req.tenantId || 'admin';
      (user as any)._tenantId = req.tenantId || 'default'; // Used by serializeUser

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

    passport.authenticate("local", async (err: Error | null, user: SelectUser | false, info: { message?: string } | undefined) => {
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
        // Provide specific error message based on what went wrong
        const errorMessage = info?.message === 'User not found' 
          ? 'No account found with that username. Please check your username and try again.'
          : info?.message === 'Invalid password'
          ? 'Incorrect password. Please check your password and try again.'
          : 'Invalid credentials. Please check your username and password.';
        return res.status(401).json({ error: errorMessage });
      }

      // MULTI-TENANT FIX: Attach tenant context to user before login (for session serialization)
      (user as any).tenantId = req.tenantId || 'admin';
      (user as any)._tenantId = req.tenantId || 'default'; // Used by serializeUser

      req.login(user, async (err) => {
        if (err) {
          await syslog.logAuthEvent(LogLevel.ERROR, "Session creation error", user.id, user.username, {
            tenantId: req.tenantId,
            error: err.message
          });
          return res.status(500).json({ error: "Session creation failed", details: err.message });
        }

        // Session logged in successfully

        try {
          // Use tenant-aware storage for user update
          const tenantStorage = getTenantStorage(req);
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
            }
            // Session saved successfully (or error logged above)

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