/**
 * Single-Tenant Authentication System
 * Supports both SAML and username/password without tenant complexity
 */

import { Express, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import bcrypt from 'bcrypt';
import { institutionConfig } from '../config/institution';
import { getDatabaseStorage } from '../services/database';

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
      async (username: string, password: string, done: (error: any, user?: any, info?: any) => void) => {
        try {
          const storage = getDatabaseStorage();
          const user = await storage.getUserByUsername(username, undefined);

          if (!user) {
            return done(null, false, { message: 'User not found' });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);
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
    passport.use(new SamlStrategy(
      {
        entryPoint: institutionConfig.authentication.samlSsoUrl!,
        issuer: institutionConfig.authentication.samlEntityId!,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/saml/callback`,
        idpCert: institutionConfig.authentication.samlCertificate!,
        signatureAlgorithm: 'sha256',
        wantAssertionsSigned: true,
      },
      async (profile: any, done: (error: any, user?: any, info?: any) => void) => {
        try {
          const storage = getDatabaseStorage();
          const email = profile.email || profile.nameID;

          if (!email) {
            return done(new Error('No email found in SAML profile'));
          }

          // Find or create user
          let user = await storage.getUserByEmail(email, undefined);

          if (!user && institutionConfig.authentication.allowSelfRegistration) {
            user = await storage.createUser({
              email,
              username: email,
              firstName: profile.firstName || profile.displayName || '',
              lastName: profile.lastName || '',
              role: 'user',
              externalId: profile.nameID,
            }, undefined);
          }

          if (!user) {
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
  if (institutionConfig.authentication.samlEnabled) {
    app.get('/auth/saml', passport.authenticate('saml'));
    
    app.post('/auth/saml/callback', 
      passport.authenticate('saml', { failureRedirect: '/login?error=saml' }),
      (req: Request, res: Response) => {
        res.redirect('/dashboard');
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
