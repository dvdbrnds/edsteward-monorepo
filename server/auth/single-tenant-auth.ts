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
      async (username: string, password: string, done: (error: any, user?: any, info?: any) => void) => {
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

  // SAML strategy
  if (institutionConfig.authentication.samlEnabled) {
    console.log('🔐 SAML Certificate loaded:', !!institutionConfig.authentication.samlCertificate);
    console.log('🔐 SAML Certificate length:', institutionConfig.authentication.samlCertificate?.length || 0);
    
    const samlCert = institutionConfig.authentication.samlCertificate;
    console.log('🔐 About to create SAML strategy with cert:', !!samlCert);
    console.log('🔐 Cert value type:', typeof samlCert);
    console.log('🔐 Cert is truthy:', !!samlCert);
    console.log('🔐 Cert first 50 chars:', samlCert?.substring(0, 50));
    
    // Try using the original certificate with cleaned format
    const cleanCert = samlCert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '')
      .trim();
    
    console.log('🔐 Using original OKTA certificate with cleaned format');
    console.log('🔐 Cleaned cert length:', cleanCert.length);
    console.log('🔐 Cleaned cert starts with:', cleanCert.substring(0, 50));
    
    passport.use(new SamlStrategy(
      {
        entryPoint: institutionConfig.authentication.samlSsoUrl!,
        issuer: institutionConfig.authentication.samlEntityId!,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/saml/callback`,
        cert: [cleanCert], // Try array format
        signatureAlgorithm: 'sha256',
        // Try with signature validation enabled again
        wantAssertionsSigned: true,
        validateInResponseTo: false, // Keep this disabled for now
        disableRequestedAuthnContext: true,
      },
      async (profile: any, done: (error: any, user?: any, info?: any) => void) => {
        try {
          const storage = getDatabaseStorage();
          const email = profile.email || profile.nameID;

          console.log('🔐 SAML Profile received:', {
            email: profile.email,
            nameID: profile.nameID,
            firstName: profile.firstName,
            lastName: profile.lastName,
            displayName: profile.displayName
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
              email,
              username: email,
              firstName: profile.firstName || profile.displayName || '',
              lastName: profile.lastName || '',
              role: 'user',
              externalId: profile.nameID,
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
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done: (error: any, user?: any) => void) => {
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
    app.post('/api/login', passport.authenticate('local'), (req: Request, res: Response) => {
      let user = req.user;

      // Ensure dvdbrnds is always admin
      if (user && user.username === 'dvdbrnds' && user.role !== 'admin') {
        user = { ...user, role: 'admin' };
      }

      res.json({ success: true, user: user });
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
