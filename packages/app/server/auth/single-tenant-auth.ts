/**
 * Single-Tenant Authentication System
 * Supports both SAML and username/password without tenant complexity
 */

import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as SamlStrategy, type VerifiedCallback } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import { verifyPassword } from '../auth';  // Import our new scrypt-based function
import { institutionConfig } from '../config/institution';
import { getDatabaseStorage } from '../services/database';
import { mapOktaGroupsToRoles, getHighestPriorityRole } from '../config/role-mapping';

declare module 'express-session' {
  interface SessionData {
    pendingMFAUser?: Express.User;
  }
}

/**
 * Configure authentication strategies
 */
export function configureAuth(app: Express): void {
  
  // Local username/password strategy - MULTI-TENANT AWARE
  if (institutionConfig.authentication.usernamePasswordEnabled) {
    passport.use(new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true, // CRITICAL: Need request for tenant context
      },
       
      async (req: Request, username: string, password: string, done: (error: any, user?: Express.User | false, info?: { message: string }) => void) => {
        try {
          // MULTI-TENANT FIX: Get tenant from request (set by tenant middleware)
          const tenantId = (req as any).tenantId || 'default';
          console.log(`[AUTH] Login attempt for '${username}' in tenant '${tenantId}'`);
          
          // Use tenant-specific storage
          const storage = getDatabaseStorage(tenantId);
          const user = await storage.getUserByUsername(username, undefined);

          if (!user) {
            console.log(`[AUTH] User '${username}' not found in tenant '${tenantId}'`);
            return done(null, false, { message: 'User not found' });
          }

          const isValidPassword = await verifyPassword(password, user.password);
          if (!isValidPassword) {
            console.log(`[AUTH] Invalid password for '${username}' in tenant '${tenantId}'`);
            return done(null, false, { message: 'Invalid password' });
          }

          // CRITICAL: Attach tenantId to user for session serialization
          (user as any)._tenantId = tenantId;
          console.log(`[AUTH] Login successful for '${username}' in tenant '${tenantId}'`);

          return done(null, user);
        } catch (error) {
          console.error('[AUTH] Login error:', error);
          return done(error, false);
        }
      }
    ));
  }

  // SAML strategy - Skip for development
  if (institutionConfig.authentication.samlEnabled && process.env.NODE_ENV !== 'development') {
    
    // Use fake certificate to bypass signature validation completely
    const useFakeCert = process.env.SAML_USE_FAKE_CERT === 'true';
    
    const fakeCert = "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890\n-----END CERTIFICATE-----";
    
    if (useFakeCert) {
    } else {
      const samlCert = institutionConfig.authentication.samlCertificate;
    }
    
    // Check if we should disable signature validation (for debugging)
    const disableSignatureValidation = process.env.SAML_DISABLE_SIGNATURE_VALIDATION === 'true';
    if (disableSignatureValidation) {
      console.log('⚠️ SAML signature validation is DISABLED');
    }

    passport.use(new SamlStrategy(
      {
        entryPoint: institutionConfig.authentication.samlSsoUrl!,
        issuer: institutionConfig.authentication.samlEntityId!,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/saml/callback`,
        // Use fake certificate when flag is set, otherwise use real certificate
        idpCert: useFakeCert ? fakeCert : (institutionConfig.authentication.samlCertificate?.trim() || ''),
        signatureAlgorithm: 'sha256' as const,
        wantAssertionsSigned: !disableSignatureValidation,
        wantAuthnResponseSigned: !disableSignatureValidation,
        validateInResponseTo: ValidateInResponseTo.never,
        disableRequestedAuthnContext: true,
        // Request groups attribute in SAML assertion
        identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      },
       
      async (profile: any, done: VerifiedCallback) => {
        try {
          const storage = getDatabaseStorage();
          const samlProfile = profile as Record<string, unknown>;
          const email = (samlProfile.email || samlProfile.nameID) as string | undefined;

          // Extract groups from SAML profile
          let groups: string[] = [];
          if (samlProfile.groups) {
            groups = Array.isArray(samlProfile.groups) 
              ? samlProfile.groups as string[] 
              : [samlProfile.groups as string];
          }

          // Map Okta groups to EdSteward roles
          const mappedRoles = mapOktaGroupsToRoles(groups);
          const primaryRole = getHighestPriorityRole(mappedRoles);

          if (!email) {
            return done(new Error('No email found in SAML profile'));
          }

          // Find or create user
          let user = await storage.getUserByEmail(email as string, undefined);


          if (!user && institutionConfig.authentication.allowSelfRegistration) {
            user = await storage.createUser({
              email: email as string,
              username: email as string,
              firstName: (samlProfile.firstName || samlProfile.displayName || '') as string,
              lastName: (samlProfile.lastName || '') as string,
              role: primaryRole as "user" | "viewer" | "department_head" | "admin" | "compliance_officer",
              roles: JSON.stringify(mappedRoles), // Store all roles
              externalId: samlProfile.nameID as string,
              identityProvider: 'saml',
            }, undefined);
          } else if (user) {
            // Update existing user's data from Okta on each login (Okta is source of truth)
            await storage.updateUser(user.id, {
              role: primaryRole as "user" | "viewer" | "department_head" | "admin" | "compliance_officer",
              roles: JSON.stringify(mappedRoles),
              firstName: (samlProfile.firstName || samlProfile.displayName || user.firstName || '') as string,
              lastName: (samlProfile.lastName || user.lastName || '') as string,
              identityProvider: 'saml',
              lastLogin: new Date(),
            }, undefined);
            
            // Refresh user object with updated data
            user = await storage.getUserByEmail(email as string, undefined);
          }

          if (!user) {
            return done(new Error('User not found and auto-provisioning is disabled'));
          }

          return done(null, user);
        } catch (error) {
          console.error('🔐 SAML authentication error:', error);
          return done(error instanceof Error ? error : new Error(String(error)));
        }
      },
      async (profile: any, done: VerifiedCallback) => {
        done(null);
      }
    ));
  }

  // Passport serialization - MULTI-TENANT AWARE
  passport.serializeUser((user: unknown, done) => {
    const userObj = user as Record<string, unknown>;
    // CRITICAL: Store both userId and tenantId to prevent cross-tenant session hijacking
    const sessionData = {
      userId: userObj.id,
      tenantId: userObj._tenantId || process.env.DEFAULT_TENANT || 'default',
    };
    console.log(`[AUTH] Serializing user ${userObj.id} for tenant ${sessionData.tenantId}`);
    done(null, sessionData);
  });

   
  passport.deserializeUser(async (sessionData: unknown, done: (_error: unknown, _user?: unknown) => void) => {
    try {
      // Handle both old format (just ID string/number) and new format (object with userId and tenantId)
      let userId: number;
      let tenantId: string;
      
      if (typeof sessionData === 'object' && sessionData !== null && 'userId' in sessionData) {
        const data = sessionData as { userId: number; tenantId: string };
        userId = data.userId;
        tenantId = data.tenantId || 'default';
      } else {
        // Legacy format - just user ID (string or number)
        userId = typeof sessionData === 'string' ? parseInt(sessionData, 10) : sessionData as number;
        tenantId = 'default';
      }

      // Remap legacy 'default' tenant to the actual configured default
      if (tenantId === 'default' && process.env.DEFAULT_TENANT && process.env.DEFAULT_TENANT !== 'default') {
        tenantId = process.env.DEFAULT_TENANT;
      }
      
      console.log(`[AUTH] Deserializing user ${userId} from tenant ${tenantId}`);
      
      let storage;
      try {
        storage = getDatabaseStorage(tenantId);
      } catch {
        console.warn(`[AUTH] Tenant '${tenantId}' not found during deserialization, invalidating session`);
        return done(null, false);
      }
      let user = await storage.getUser(userId, undefined);

      if (!user) {
        console.log(`[AUTH] User ${userId} not found in tenant ${tenantId} during deserialization`);
        return done(null, false);
      }

      // Attach tenant info to user for downstream verification
      (user as any)._sessionTenantId = tenantId;

      done(null, user);
    } catch (error) {
      console.error('[AUTH] Deserialization error:', error);
      done(error);
    }
  });

  // Routes
  setupAuthRoutes(app);
}

/**
 * Set up authentication routes
 */
function setupAuthRoutes(app: Express): void {
  // Local login
  if (institutionConfig.authentication.usernamePasswordEnabled) {
    app.post('/api/login', passport.authenticate('local'), async (req: Request, res: Response) => {
      const user = req.user;

      // Check if user has MFA enabled (required for local accounts)
      if (user && user.mfaEnabled) {
        // Store user in session but mark as needing MFA verification
        req.session.pendingMFAUser = user;
        req.logout(() => {}); // Log out until MFA is verified
        
        return res.json({ 
          success: false, 
          requiresMFA: true,
          message: 'MFA verification required',
          isEmergencyAccount: user.identityProvider === 'local_emergency'
        });
      }

      // HECVAT 4.0 Requirement: Local accounts should have MFA enabled
      if (user && user.identityProvider !== 'saml' && !user.mfaEnabled) {
        
        return res.json({ 
          success: true, 
          user: user,
          mfaRecommended: true,
          message: 'MFA setup recommended for enhanced security'
        });
      }

      res.json({ success: true, user: user });
    });

    // MFA verification endpoint for login
    app.post('/api/login/mfa', async (req: Request, res: Response) => {
      try {
        const { code } = req.body;
        const pendingUser = req.session.pendingMFAUser;

        if (!pendingUser) {
          return res.status(400).json({
            success: false,
            error: 'No pending MFA verification'
          });
        }

        // Import MFA service
        const { MFAService } = await import('../services/mfa');
        const result = await MFAService.verifyMFA(pendingUser.id, code);

        if (result.success) {
          // Clear pending user and log them in
          delete req.session.pendingMFAUser;
          
          // Manually log in the user
          req.login(pendingUser, (err) => {
            if (err) {
              return res.status(500).json({
                success: false,
                error: 'Login failed after MFA verification'
              });
            }
            
            res.json({
              success: true,
              user: pendingUser,
              message: result.message,
              backupCodeUsed: result.backupCodeUsed
            });
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.message
          });
        }
      } catch (error) {
        console.error('❌ MFA login verification error:', error);
        res.status(500).json({
          success: false,
          error: 'MFA verification failed'
        });
      }
    });
  }

  // SAML routes
  if (institutionConfig.authentication.samlEnabled) {
    app.get('/auth/saml', passport.authenticate('saml'));

    app.post('/auth/saml/callback', (req: Request, res: Response, next: NextFunction) => {
      console.log('🔐 SAML callback received');
      passport.authenticate('saml', (err: Error | null, user: Express.User | false, info: { message?: string } | undefined) => {
        if (err) {
          console.error('🔐 SAML authentication error:', err.message);
          console.error('🔐 SAML error stack:', err.stack);
          return res.status(500).json({ error: 'SAML authentication failed', details: err.message });
        }
        if (!user) {
          console.error('🔐 SAML no user returned, info:', info);
          return res.redirect('/login?error=saml_no_user');
        }
        
        // CRITICAL: Attach tenantId to user for session serialization (same as /api/authenticate)
        // This prevents the "Session tenant mismatch" error in multi-tenant mode
        const tenantId = (req as any).tenantId || 'default';
        (user as any)._tenantId = tenantId;
        console.log(`🔐 SAML attaching tenant '${tenantId}' to user`);
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('🔐 SAML login error:', loginErr.message);
            return res.status(500).json({ error: 'Login failed', details: loginErr.message });
          }
          console.log('🔐 SAML login successful for user:', (user as { email?: string }).email);
          return res.redirect('/');
        });
      })(req, res, next);
    });

    app.get('/auth/saml/metadata', (req: Request, res: Response) => {
      res.type('application/xml');
      res.send(generateSamlMetadata());
    });
  }

  // Logout
  app.post('/api/logout', (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Current user
  app.get('/api/user', (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.user);
  });
}

/**
 * Generate SAML metadata
 */
function generateSamlMetadata(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${institutionConfig.authentication.samlEntityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      WantAssertionsSigned="true">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${process.env.BASE_URL}/auth/saml/callback"
                                 index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}
