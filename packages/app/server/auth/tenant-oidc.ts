/**
 * Multi-Tenant OIDC Authentication
 * Supports Azure AD, Google Workspace, Auth0, Okta, and generic OIDC providers
 * 
 * This file is ADDITIVE - existing SAML auth continues to work unchanged.
 * New routes: /auth/oidc/login, /auth/oidc/callback
 */

import passport from 'passport';
import { Strategy as OpenIDConnectStrategy, Profile, VerifyCallback } from 'passport-openidconnect';
import { Express, Request, Response, NextFunction } from 'express';
import { TenantService } from '../middleware/tenant';
import { getDatabaseStorage } from '../services/database';
import { syslog, LogLevel } from '../services/syslog';

// Extend session type for tenant-aware OIDC
declare module 'express-session' {
  interface SessionData {
    oidcTenantId?: string;
    oidcReturnTo?: string;
    oidcState?: string;
  }
}

// OIDC user profile interface
interface OIDCUserProfile {
  id?: string;
  displayName?: string;
  name?: {
    familyName?: string;
    givenName?: string;
  };
  emails?: Array<{ value: string; type?: string }>;
  _json?: Record<string, any>;
}

// OIDC configuration for a tenant
interface TenantOIDCConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  attributeMapping?: Record<string, string>;
  preset?: 'azure-ad' | 'google' | 'auth0' | 'okta' | 'custom';
}

// Known OIDC provider configurations
const OIDC_PRESETS: Record<string, Partial<TenantOIDCConfig>> = {
  'azure-ad': {
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  },
  'google': {
    issuerUrl: 'https://accounts.google.com',
    scopes: ['openid', 'profile', 'email'],
  },
  'auth0': {
    scopes: ['openid', 'profile', 'email'],
  },
  'okta': {
    scopes: ['openid', 'profile', 'email', 'groups'],
  },
};

/**
 * Get OIDC configuration for a tenant
 */
async function getTenantOIDCConfig(tenantId: string, req: Request): Promise<{
  issuerURL: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string;
}> {
  const tenant = await TenantService.getTenantById(tenantId);
  
  if (!tenant || !tenant.ssoConfig?.oidc) {
    throw new Error(`OIDC configuration not found for tenant: ${tenantId}`);
  }

  const oidcConfig = tenant.ssoConfig.oidc;
  const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
  
  // Apply preset defaults if specified
  const preset = oidcConfig.preset ? OIDC_PRESETS[oidcConfig.preset] : {};
  const scopes = oidcConfig.scopes || preset.scopes || ['openid', 'profile', 'email'];
  
  return {
    issuerURL: oidcConfig.issuerUrl || preset.issuerUrl || '',
    clientID: oidcConfig.clientId,
    clientSecret: oidcConfig.clientSecret,
    callbackURL: `${baseUrl}/auth/oidc/callback`,
    scope: scopes.join(' '),
  };
}

/**
 * Extract user attributes from OIDC profile based on tenant configuration
 */
function extractOIDCUserAttributes(profile: OIDCUserProfile, tenant: any): any {
  const defaultMapping = {
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
    username: 'preferred_username',
    department: 'department',
    groups: 'groups',
  };

  // Use tenant-specific mapping if available
  const mapping = tenant.ssoConfig?.oidc?.attributeMapping || defaultMapping;
  const json = profile._json || {};
  
  // Extract email - check multiple sources
  let email = json[mapping.email] || json.email;
  if (!email && profile.emails && profile.emails.length > 0) {
    email = profile.emails[0].value;
  }
  
  const extractedData = {
    email: email,
    firstName: json[mapping.firstName] || profile.name?.givenName || '',
    lastName: json[mapping.lastName] || profile.name?.familyName || '',
    username: json[mapping.username] || email,
    department: json[mapping.department] || '',
    externalId: profile.id || json.sub || json.oid, // oid for Azure AD
    identityProvider: 'oidc',
    providerId: tenant.id,
    tenantId: tenant.id,
    role: tenant.ssoConfig?.defaultRole || 'user',
    organization: json.organization || tenant.name,
  };

  // Role mapping based on groups
  const groups = json[mapping.groups] || json.groups || [];
  if (Array.isArray(groups)) {
    if (groups.some((group: string) => group.toLowerCase().includes('admin'))) {
      extractedData.role = 'admin';
    } else if (groups.some((group: string) => 
      group.toLowerCase().includes('compliance') || 
      group.toLowerCase().includes('officer') ||
      group.toLowerCase().includes('faculty') ||
      group.toLowerCase().includes('staff')
    )) {
      extractedData.role = 'compliance_officer';
    }
  }

  return extractedData;
}

/**
 * Setup multi-tenant OIDC authentication
 * This is ADDITIVE - does not modify existing auth
 */
export function setupTenantOIDCAuth(app: Express) {
  // We use a dynamic strategy approach since passport-openidconnect 
  // doesn't have a MultiStrategy like SAML
  // Instead, we configure per-request using session state
  
  /**
   * OIDC Login initiation
   * Dynamically configures OIDC based on tenant
   */
  app.get('/auth/oidc/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure we have tenant context
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant context required for OIDC authentication',
          code: 'TENANT_REQUIRED'
        });
      }

      // Store tenant and return URL in session
      if (req.session) {
        req.session.oidcTenantId = tenantId;
        req.session.oidcReturnTo = req.query.returnTo as string || '/dashboard';
      }

      // Get tenant's OIDC configuration
      const oidcConfig = await getTenantOIDCConfig(tenantId, req);
      
      // Generate state for CSRF protection
      const state = `${tenantId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      if (req.session) {
        req.session.oidcState = state;
      }

      // Create a temporary strategy for this request
      const strategy = new OpenIDConnectStrategy(
        {
          issuer: oidcConfig.issuerURL,
          authorizationURL: `${oidcConfig.issuerURL}/authorize`,
          tokenURL: `${oidcConfig.issuerURL}/oauth/token`,
          userInfoURL: `${oidcConfig.issuerURL}/userinfo`,
          clientID: oidcConfig.clientID,
          clientSecret: oidcConfig.clientSecret,
          callbackURL: oidcConfig.callbackURL,
          scope: oidcConfig.scope,
        } as any,
        (
          issuer: string,
          profile: Profile,
          done: VerifyCallback
        ) => {
          done(null, profile as any);
        }
      );

      // Use the strategy for this request
      passport.use(`oidc-${tenantId}`, strategy);
      
      passport.authenticate(`oidc-${tenantId}`, {
        state: state,
      })(req, res, next);

    } catch (error) {
      console.error('OIDC login initiation error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/login?error=oidc_config_error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * OIDC Callback handler
   */
  app.get('/auth/oidc/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenant from session
      const tenantId = req.session?.oidcTenantId;
      if (!tenantId) {
        return res.redirect('/login?error=oidc_session_lost');
      }

      // Verify state for CSRF protection
      const returnedState = req.query.state as string;
      const expectedState = req.session?.oidcState;
      if (!returnedState || !expectedState || !returnedState.startsWith(tenantId)) {
        return res.redirect('/login?error=oidc_state_mismatch');
      }

      // Get tenant's OIDC configuration
      const oidcConfig = await getTenantOIDCConfig(tenantId, req);
      const tenant = await TenantService.getTenantById(tenantId);
      
      if (!tenant) {
        return res.redirect('/login?error=tenant_not_found');
      }

      // Create strategy with verify callback for this callback
      const strategy = new OpenIDConnectStrategy(
        {
          issuer: oidcConfig.issuerURL,
          authorizationURL: `${oidcConfig.issuerURL}/authorize`,
          tokenURL: `${oidcConfig.issuerURL}/oauth/token`,
          userInfoURL: `${oidcConfig.issuerURL}/userinfo`,
          clientID: oidcConfig.clientID,
          clientSecret: oidcConfig.clientSecret,
          callbackURL: oidcConfig.callbackURL,
          scope: oidcConfig.scope,
          passReqToCallback: true,
        } as any,
        (async (
          req: Request,
          issuer: string,
          profile: Profile,
          context: any,
          idToken: string,
          accessToken: string,
          refreshToken: string,
          done: VerifyCallback
        ) => {
          try {
            const userData = extractOIDCUserAttributes(profile as OIDCUserProfile, tenant);
            
            // Verify user belongs to this tenant (domain validation)
            if (userData.email && tenant.ssoConfig?.allowedDomains && tenant.ssoConfig.allowedDomains.length > 0) {
              const emailDomain = userData.email.split('@')[1];
              if (!tenant.ssoConfig!.allowedDomains!.includes(emailDomain)) {
                throw new Error(`User domain ${emailDomain} not allowed for tenant ${tenant.name}`);
              }
            }
            
            // CRITICAL: Use tenant-specific storage for database isolation
            const tenantStorage = getDatabaseStorage(tenantId);
            
            // Check if user exists in this tenant
            let user = await tenantStorage.getUserByExternalId(userData.externalId, tenantId);
            if (!user && userData.email) {
              user = await tenantStorage.getUserByEmail(userData.email, tenantId);
            }

            if (user) {
              // Update existing user
              await tenantStorage.updateUser(user.id, {
                lastLogin: new Date(),
                identityProvider: userData.identityProvider,
                providerId: userData.providerId,
                firstName: userData.firstName || user.firstName,
                lastName: userData.lastName || user.lastName,
              }, tenantId);
              
              await syslog.logAuthEvent(
                LogLevel.INFO, 
                `Tenant OIDC login successful for ${tenant.name}`, 
                user.id, 
                user.username,
                { tenantId, provider: 'oidc' }
              );
              return done(null, user as Express.User);
            } else if (tenant.ssoConfig?.autoProvisioning) {
              // Create new user for this tenant
              const newUser = await tenantStorage.createUser({
                ...userData,
                lastLogin: new Date()
              }, tenantId);
              
              await syslog.logAuthEvent(
                LogLevel.INFO, 
                `New tenant OIDC user created for ${tenant.name}`, 
                newUser.id, 
                newUser.username,
                { tenantId, provider: 'oidc' }
              );
              return done(null, newUser as Express.User);
            } else {
              throw new Error(`Auto-provisioning disabled for tenant ${tenant.name}. Contact administrator.`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await syslog.logAuthEvent(
              LogLevel.ERROR, 
              `Tenant OIDC authentication error: ${errorMessage}`, 
              undefined, 
              undefined,
              { tenantId, provider: 'oidc' }
            );
            return done(error instanceof Error ? error : new Error(errorMessage));
          }
        }
      ) as any);

      passport.use(`oidc-callback-${tenantId}`, strategy);
      
      passport.authenticate(`oidc-callback-${tenantId}`, {
        failureRedirect: '/login?error=oidc_auth_failed',
      })(req, res, (err: any) => {
        if (err) {
          console.error('OIDC callback error:', err);
          return res.redirect(`/login?error=oidc_error&message=${encodeURIComponent(err.message)}`);
        }

        // Successful authentication
        const redirectTo = req.session?.oidcReturnTo || '/dashboard';
        
        // Clean up session
        delete req.session?.oidcTenantId;
        delete req.session?.oidcReturnTo;
        delete req.session?.oidcState;
        
        // Unregister temporary strategies
        passport.unuse(`oidc-${tenantId}`);
        passport.unuse(`oidc-callback-${tenantId}`);
        
        res.redirect(redirectTo);
      });

    } catch (error) {
      console.error('OIDC callback error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.redirect(`/login?error=oidc_callback_error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * OIDC Discovery endpoint - helps IT admins configure their IdP
   */
  app.get('/auth/oidc/discovery', async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant context required',
          code: 'TENANT_REQUIRED'
        });
      }

      const tenant = await TenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const baseUrl = `https://${tenant.subdomain}.${process.env.BASE_DOMAIN || 'edsteward.ai'}`;
      
      res.json({
        tenant: tenant.name,
        callbackUrl: `${baseUrl}/auth/oidc/callback`,
        requiredScopes: ['openid', 'profile', 'email'],
        optionalScopes: ['groups'],
        supportedProviders: [
          { name: 'Azure AD / Entra ID', preset: 'azure-ad' },
          { name: 'Google Workspace', preset: 'google' },
          { name: 'Okta', preset: 'okta' },
          { name: 'Auth0', preset: 'auth0' },
          { name: 'Custom OIDC', preset: 'custom' },
        ],
        attributeMapping: {
          email: 'email (required)',
          firstName: 'given_name',
          lastName: 'family_name',
          username: 'preferred_username',
          groups: 'groups (for role mapping)',
        },
      });
    } catch (error) {
      console.error('OIDC discovery error:', error);
      res.status(500).json({ error: 'Failed to generate discovery info' });
    }
  });

  console.log('✅ Tenant OIDC authentication routes configured');
  console.log('   Routes: /auth/oidc/login, /auth/oidc/callback, /auth/oidc/discovery');
}

export default {
  setupTenantOIDCAuth,
};
