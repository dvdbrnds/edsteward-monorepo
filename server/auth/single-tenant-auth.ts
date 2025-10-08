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

/**
 * Configure authentication strategies
 */
export function configureAuth(app: Express): void {
  console.log('🔐 Authentication setup starting...');
  console.log('🔐 SAML Enabled:', institutionConfig.authentication.samlEnabled);
  console.log('🔐 Username/Password Enabled:', institutionConfig.authentication.usernamePasswordEnabled);
  
  // Local username/password strategy
  if (institutionConfig.authentication.usernamePasswordEnabled) {
    passport.use(new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
       
      async (username: string, password: string, done: (error: unknown, user?: unknown, info?: unknown) => void) => {
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
    console.log('🔐 SAML Certificate loaded:', !!institutionConfig.authentication.samlCertificate);
    console.log('🔐 SAML Certificate length:', institutionConfig.authentication.samlCertificate?.length || 0);
    
    // Use fake certificate to bypass signature validation completely
    const useFakeCert = process.env.SAML_USE_FAKE_CERT === 'true';
    console.log('🔐 Using fake certificate for signature bypass:', useFakeCert);
    
    const fakeCert = "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890\n-----END CERTIFICATE-----";
    
    if (useFakeCert) {
      console.log('🔐 Using fake certificate to bypass signature validation');
    } else {
      const samlCert = institutionConfig.authentication.samlCertificate;
      console.log('🔐 About to create SAML strategy with real cert:', !!samlCert);
      console.log('🔐 Cert value type:', typeof samlCert);
      console.log('🔐 Cert is truthy:', !!samlCert);
      console.log('🔐 Cert first 50 chars:', samlCert?.substring(0, 50));
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
      },
       
      async (profile: unknown, done: (error: unknown, user?: unknown, info?: unknown) => void) => {
        try {
          const storage = getDatabaseStorage();
          const samlProfile = profile as Record<string, unknown>;
          const email = samlProfile.email || samlProfile.nameID;

          console.log('🔐 SAML Profile received:', {
            email: samlProfile.email,
            nameID: samlProfile.nameID,
            firstName: samlProfile.firstName,
            lastName: samlProfile.lastName,
            displayName: samlProfile.displayName
          });

          if (!email) {
            return done(new Error('No email found in SAML profile'));
          }

          console.log('🔐 Looking for user with email:', email);
          // Find or create user
          let user = await storage.getUserByEmail(email, undefined);
          console.log('🔐 Existing user found:', !!user);

          console.log('🔐 Auto-provisioning enabled:', institutionConfig.authentication.allowSelfRegistration);
          console.log('🔐 Environment AUTH_ALLOW_SELF_REGISTRATION:', process.env.AUTH_ALLOW_SELF_REGISTRATION);

          if (!user && institutionConfig.authentication.allowSelfRegistration) {
            console.log('🔐 Creating new user via auto-provisioning...');
            user = await storage.createUser({
              email: email as string,
              username: email as string,
              firstName: (samlProfile.firstName || samlProfile.displayName || '') as string,
              lastName: (samlProfile.lastName || '') as string,
              role: 'user',
              externalId: samlProfile.nameID as string,
            }, undefined);
            console.log('🔐 New user created:', !!user);
          }

          if (!user) {
            console.log('🔐 User creation failed - auto-provisioning may be disabled');
            return done(new Error('User not found and auto-provisioning is disabled'));
          }

          return done(null, user);
        } catch (error) {
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

   
  passport.deserializeUser(async (id: string, done: (error: unknown, user?: unknown) => void) => {
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
        console.log(`⚠️ Local account ${user.username} should enable MFA for HECVAT 4.0 compliance`);
        
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
  console.log('🔐 Setting up SAML routes, samlEnabled:', institutionConfig.authentication.samlEnabled);
  if (institutionConfig.authentication.samlEnabled) {
    console.log('✅ SAML routes being registered!');
    app.get('/auth/saml', passport.authenticate('saml'));

    app.post('/auth/saml/callback',
      passport.authenticate('saml', { failureRedirect: '/login?error=saml' }),
      (req: Request, res: Response) => {
        console.log('🔐 SAML authentication successful, redirecting to home page');
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
