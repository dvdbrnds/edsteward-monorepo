/**
 * Single-Tenant Authentication System
 * Supports both SAML and username/password without tenant complexity
 */

import { Express, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { verifyPassword } from '../auth';  // Import our new scrypt-based function
import { institutionConfig } from '../config/institution';
import { getDatabaseStorage } from '../services/database';
import { mapOktaGroupsToRoles, getHighestPriorityRole } from '../config/role-mapping';

/**
 * Configure authentication strategies
 */
export function configureAuth(app: Express): void {
  
  // Local username/password strategy
  if (institutionConfig.authentication.usernamePasswordEnabled) {
    passport.use(new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
       
      async (username: string, password: string, done: (_error: unknown, _user?: unknown, _info?: unknown) => void) => {
        try {
          const storage = getDatabaseStorage();
          const user = await storage.getUserByUsername(username, undefined);

          if (!user) {
            return done(null, false, { message: 'User not found' });
          }

          const isValidPassword = await verifyPassword(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: 'Invalid password' });
          }

          return done(null, user);
        } catch (error) {
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
    
    passport.use(new SamlStrategy(
      {
        entryPoint: institutionConfig.authentication.samlSsoUrl!,
        issuer: institutionConfig.authentication.samlEntityId!,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/saml/callback`,
        // Use fake certificate when flag is set, otherwise use real certificate
        idpCert: useFakeCert ? fakeCert : institutionConfig.authentication.samlCertificate?.trim(),
        signatureAlgorithm: 'sha256',
        // Enable proper signature validation with OKTA certificate
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true,
        validateInResponseTo: 'never', // Disable InResponseTo validation
        disableRequestedAuthnContext: true,
        // Request groups attribute in SAML assertion
        identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      },
       
      async (profile: unknown, done: (_error: unknown, _user?: unknown, _info?: unknown) => void) => {
        try {
          const storage = getDatabaseStorage();
          const samlProfile = profile as Record<string, unknown>;
          const email = samlProfile.email || samlProfile.nameID;

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
          let user = await storage.getUserByEmail(email, undefined);


          if (!user && institutionConfig.authentication.allowSelfRegistration) {
            user = await storage.createUser({
              email: email as string,
              username: email as string,
              firstName: (samlProfile.firstName || samlProfile.displayName || '') as string,
              lastName: (samlProfile.lastName || '') as string,
              role: primaryRole, // ✅ Now uses Okta group mapping!
              roles: JSON.stringify(mappedRoles), // Store all roles
              externalId: samlProfile.nameID as string,
              identityProvider: 'saml',
            }, undefined);
          } else if (user) {
            // Update existing user's data from Okta on each login (Okta is source of truth)
            await storage.updateUser(user.id, {
              role: primaryRole,
              roles: JSON.stringify(mappedRoles),
              // Always sync name from Okta - Okta is the source of truth
              firstName: (samlProfile.firstName || samlProfile.displayName || user.firstName || '') as string,
              lastName: (samlProfile.lastName || user.lastName || '') as string,
              identityProvider: 'saml',
              lastLogin: new Date(),
            }, undefined);
            
            // Refresh user object with updated data
            user = await storage.getUserByEmail(email, undefined);
          }

          if (!user) {
            return done(new Error('User not found and auto-provisioning is disabled'));
          }

          return done(null, user);
        } catch (error) {
          console.error('🔐 SAML authentication error:', error);
          return done(error, false);
        }
      }
    ));
  }

  // Passport serialization
  passport.serializeUser((user: unknown, done) => {
    const userObj = user as Record<string, unknown>;
    done(null, userObj.id);
  });

   
  passport.deserializeUser(async (id: string, done: (_error: unknown, _user?: unknown) => void) => {
    try {
      const storage = getDatabaseStorage();
      let user = await storage.getUser(parseInt(id, 10), undefined);

      // Ensure dvdbrnds is always admin
      if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
        user = { ...user, role: 'admin' };
      }

      done(null, user);
    } catch (error) {
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
      let user = req.user;

      // Ensure dvdbrnds is always admin
      if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
        user = { ...user, role: 'admin' };
      }

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

    app.post('/auth/saml/callback',
      passport.authenticate('saml', { failureRedirect: '/login?error=saml' }),
      (req: Request, res: Response) => {
        res.redirect('/');
      }
    );

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
